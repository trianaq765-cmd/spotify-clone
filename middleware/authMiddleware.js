// ==========================================
// AUTH MIDDLEWARE (PostgreSQL Version)
// ==========================================

const jwt = require('jsonwebtoken');
const { getOne, execute } = require('../database/postgres');

const verifyToken = async (req, res, next) => {
    try {
        const token = 
            req.headers.authorization?.split(' ')[1] || 
            req.cookies?.token || 
            req.query?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await getOne(
            'SELECT id, username, email, is_premium, premium_expires_at FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Check premium expiry
        if (user.is_premium && user.premium_expires_at) {
            const expiresAt = new Date(user.premium_expires_at);
            if (expiresAt < new Date()) {
                await execute(
                    'UPDATE users SET is_premium = FALSE, premium_expires_at = NULL WHERE id = $1',
                    [user.id]
                );
                user.is_premium = false;
            }
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.'
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid token.'
        });
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const token = 
            req.headers.authorization?.split(' ')[1] || 
            req.cookies?.token || 
            req.query?.token;

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await getOne(
                'SELECT id, username, email, is_premium, premium_expires_at FROM users WHERE id = $1',
                [decoded.userId]
            );
            if (user) {
                req.user = user;
            }
        }
        next();
    } catch (error) {
        next();
    }
};

const requirePremium = (req, res, next) => {
    if (!req.user?.is_premium) {
        return res.status(403).json({
            success: false,
            message: 'Premium subscription required.',
            requiresPremium: true
        });
    }
    next();
};

module.exports = { verifyToken, optionalAuth, requirePremium };
