// ==========================================
// PAYMENT ROUTES (PostgreSQL Version)
// ==========================================

const express = require('express');
const router = express.Router();
const midtransClient = require('midtrans-client');
const { v4: uuidv4 } = require('uuid');
const { getOne, getMany, execute } = require('../database/postgres');
const { verifyToken } = require('../middleware/authMiddleware');

// Midtrans Configuration
const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

const PLANS = {
    monthly: { id: 'monthly', name: 'Premium Monthly', price: 54990, duration: 30 },
    yearly: { id: 'yearly', name: 'Premium Yearly', price: 549900, duration: 365 }
};

// GET PLANS
router.get('/plans', (req, res) => {
    res.json({ success: true, plans: Object.values(PLANS) });
});

// CREATE TRANSACTION
router.post('/create-transaction', verifyToken, async (req, res) => {
    try {
        const { planId } = req.body;
        const plan = PLANS[planId];

        if (!plan) {
            return res.status(400).json({ success: false, message: 'Invalid plan selected' });
        }

        if (req.user.is_premium) {
            return res.status(400).json({ success: false, message: 'You already have an active premium subscription' });
        }

        const orderId = `SPT-${Date.now()}-${uuidv4().slice(0, 8)}`;

        const parameter = {
            transaction_details: { order_id: orderId, gross_amount: plan.price },
            item_details: [{ id: plan.id, price: plan.price, quantity: 1, name: plan.name }],
            customer_details: { first_name: req.user.username, email: req.user.email },
            callbacks: { finish: `${process.env.APP_URL}/payment-success?order_id=${orderId}` }
        };

        const transaction = await snap.createTransaction(parameter);

        await execute(`
            INSERT INTO transactions (user_id, order_id, amount, plan_type, snap_token, snap_url)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [req.user.id, orderId, plan.price, plan.id, transaction.token, transaction.redirect_url]);

        res.json({
            success: true,
            token: transaction.token,
            redirect_url: transaction.redirect_url,
            order_id: orderId
        });

    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ success: false, message: 'Failed to create transaction' });
    }
});

// NOTIFICATION WEBHOOK
router.post('/notification', async (req, res) => {
    try {
        const notification = req.body;
        const orderId = notification.order_id;
        const transactionStatus = notification.transaction_status;
        const fraudStatus = notification.fraud_status;

        const transaction = await getOne('SELECT * FROM transactions WHERE order_id = $1', [orderId]);

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        let status = 'pending';
        if (transactionStatus === 'capture') {
            status = fraudStatus === 'accept' ? 'success' : 'challenge';
        } else if (transactionStatus === 'settlement') {
            status = 'success';
        } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
            status = 'failed';
        }

        await execute(
            'UPDATE transactions SET status = $1, payment_type = $2, updated_at = CURRENT_TIMESTAMP WHERE order_id = $3',
            [status, notification.payment_type, orderId]
        );

        if (status === 'success') {
            const plan = PLANS[transaction.plan_type];
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + plan.duration);

            await execute(
                'UPDATE users SET is_premium = TRUE, premium_expires_at = $1 WHERE id = $2',
                [expiresAt, transaction.user_id]
            );
        }

        res.status(200).json({ message: 'OK' });

    } catch (error) {
        console.error('Payment notification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// CHECK STATUS
router.get('/status/:orderId', verifyToken, async (req, res) => {
    try {
        const transaction = await getOne(
            'SELECT * FROM transactions WHERE order_id = $1 AND user_id = $2',
            [req.params.orderId, req.user.id]
        );

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        res.json({
            success: true,
            transaction: {
                order_id: transaction.order_id,
                amount: transaction.amount,
                status: transaction.status,
                plan_type: transaction.plan_type,
                created_at: transaction.created_at
            }
        });

    } catch (error) {
        console.error('Check status error:', error);
        res.status(500).json({ success: false, message: 'Failed to check transaction status' });
    }
});

// GET TRANSACTIONS
router.get('/transactions', verifyToken, async (req, res) => {
    try {
        const transactions = await getMany(`
            SELECT order_id, amount, status, plan_type, payment_type, created_at
            FROM transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 20
        `, [req.user.id]);

        res.json({ success: true, transactions });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ success: false, message: 'Failed to get transactions' });
    }
});

// SIMULATE SUCCESS (Testing)
router.post('/simulate-success/:orderId', verifyToken, async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ success: false, message: 'Not available in production' });
        }

        const transaction = await getOne(
            'SELECT * FROM transactions WHERE order_id = $1 AND user_id = $2',
            [req.params.orderId, req.user.id]
        );

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        await execute(
            'UPDATE transactions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2',
            ['success', req.params.orderId]
        );

        const plan = PLANS[transaction.plan_type];
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.duration);

        await execute(
            'UPDATE users SET is_premium = TRUE, premium_expires_at = $1 WHERE id = $2',
            [expiresAt, transaction.user_id]
        );

        res.json({ success: true, message: 'Payment simulated successfully', premium_expires_at: expiresAt });

    } catch (error) {
        console.error('Simulate payment error:', error);
        res.status(500).json({ success: false, message: 'Failed to simulate payment' });
    }
});

module.exports = router;
