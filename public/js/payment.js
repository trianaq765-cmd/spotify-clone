// ==========================================
// PAYMENT JAVASCRIPT (MIDTRANS)
// ==========================================

const API_URL = '/api';
let selectedPlan = null;

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const getToken = () => localStorage.getItem('spotify_token');
const getUser = () => {
    const user = localStorage.getItem('spotify_user');
    return user ? JSON.parse(user) : null;
};

const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });
    
    if (response.status === 401) {
        window.location.href = '/login';
        return null;
    }
    
    return response.json();
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
};

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!token) {
        window.location.href = '/login';
        return;
    }
    
    await loadUserData();
    await loadTransactions();
});

// ==========================================
// LOAD USER DATA
// ==========================================
const loadUserData = async () => {
    try {
        const data = await apiRequest('/auth/me');
        
        if (!data || !data.success) {
            window.location.href = '/login';
            return;
        }
        
        const user = data.user;
        
        // Update user info in nav
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.innerHTML = `
                <span style="color: var(--text-subdued);">
                    ${user.username}
                    ${user.is_premium ? '<i class="fas fa-crown" style="color: gold; margin-left: 8px;"></i>' : ''}
                </span>
            `;
        }
        
        // Show/hide sections based on premium status
        const premiumStatus = document.getElementById('premium-status');
        const upgradeSection = document.getElementById('upgrade-section');
        
        if (user.is_premium) {
            premiumStatus.style.display = 'block';
            upgradeSection.style.display = 'none';
            
            // Set expiry date
            const expiresDate = document.getElementById('expires-date');
            if (expiresDate && user.premium_expires_at) {
                expiresDate.textContent = formatDate(user.premium_expires_at);
            }
        } else {
            premiumStatus.style.display = 'none';
            upgradeSection.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
};

// ==========================================
// LOAD TRANSACTIONS
// ==========================================
const loadTransactions = async () => {
    try {
        const data = await apiRequest('/payment/transactions');
        
        if (!data || !data.success) return;
        
        const container = document.getElementById('transactions-list');
        
        if (data.transactions.length === 0) {
            container.innerHTML = '<p style="padding: 24px; color: var(--text-subdued);">No transactions yet</p>';
            return;
        }
        
        container.innerHTML = data.transactions.map(tx => `
            <div class="transaction-item">
                <div>
                    <div class="transaction-id">${tx.order_id}</div>
                    <div class="text-subdued" style="font-size: 0.85rem;">${formatDate(tx.created_at)}</div>
                </div>
                <div>${tx.plan_type === 'yearly' ? 'Premium Yearly' : 'Premium Monthly'}</div>
                <div>${formatCurrency(tx.amount)}</div>
                <div>
                    <span class="status-badge ${tx.status}">${tx.status.toUpperCase()}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
};

// ==========================================
// SELECT PLAN
// ==========================================
const selectPlan = async (planId) => {
    selectedPlan = planId;
    
    // Highlight selected plan
    document.querySelectorAll('.plan-card').forEach(card => {
        card.style.borderColor = card.dataset.plan === planId ? 'var(--spotify-green)' : 'transparent';
    });
    
    await createTransaction(planId);
};

// ==========================================
// CREATE TRANSACTION
// ==========================================
const createTransaction = async (planId) => {
    const modal = document.getElementById('payment-modal');
    modal.classList.add('active');
    
    try {
        const data = await apiRequest('/payment/create-transaction', {
            method: 'POST',
            body: JSON.stringify({ planId })
        });
        
        modal.classList.remove('active');
        
        if (!data.success) {
            alert(data.message || 'Failed to create transaction');
            return;
        }
        
        // Open Midtrans Snap
        if (window.snap) {
            window.snap.pay(data.token, {
                onSuccess: function(result) {
                    console.log('Payment success:', result);
                    window.location.href = `/payment-success?order_id=${data.order_id}`;
                },
                onPending: function(result) {
                    console.log('Payment pending:', result);
                    window.location.href = `/payment-success?order_id=${data.order_id}`;
                },
                onError: function(result) {
                    console.error('Payment error:', result);
                    alert('Payment failed. Please try again.');
                },
                onClose: function() {
                    console.log('Payment popup closed');
                }
            });
        } else {
            // Fallback: redirect to Midtrans hosted page
            window.location.href = data.redirect_url;
        }
        
    } catch (error) {
        modal.classList.remove('active');
        console.error('Create transaction error:', error);
        alert('Error creating transaction. Please try again.');
    }
};

// ==========================================
// SIMULATE PAYMENT (FOR TESTING)
// ==========================================
const simulatePayment = async (orderId) => {
    try {
        const data = await apiRequest(`/payment/simulate-success/${orderId}`, {
            method: 'POST'
        });
        
        if (data.success) {
            alert('Payment simulated successfully!');
            window.location.reload();
        } else {
            alert(data.message || 'Simulation failed');
        }
    } catch (error) {
        console.error('Simulate payment error:', error);
        alert('Error simulating payment');
    }
};
