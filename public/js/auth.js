// ==========================================
// AUTHENTICATION JAVASCRIPT
// ==========================================

const API_URL = '/api';

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const showError = (message) => {
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');
    if (successEl) successEl.style.display = 'none';
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
};

const showSuccess = (message) => {
    const errorEl = document.getElementById('error-message');
    const successEl = document.getElementById('success-message');
    if (errorEl) errorEl.style.display = 'none';
    if (successEl) {
        successEl.textContent = message;
        successEl.style.display = 'block';
    }
};

const setLoading = (isLoading) => {
    const btn = document.getElementById('submit-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    
    btn.disabled = isLoading;
    btnText.style.display = isLoading ? 'none' : 'inline';
    btnLoader.style.display = isLoading ? 'inline' : 'none';
};

const saveToken = (token) => {
    localStorage.setItem('spotify_token', token);
};

const getToken = () => {
    return localStorage.getItem('spotify_token');
};

const saveUser = (user) => {
    localStorage.setItem('spotify_user', JSON.stringify(user));
};

const getUser = () => {
    const user = localStorage.getItem('spotify_user');
    return user ? JSON.parse(user) : null;
};

const clearAuth = () => {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('spotify_user');
};

// Check if user is already logged in
const checkAuth = () => {
    const token = getToken();
    if (token) {
        window.location.href = '/dashboard';
    }
};

// ==========================================
// LOGIN FORM HANDLER
// ==========================================
const loginForm = document.getElementById('login-form');
if (loginForm) {
    // Check if already logged in
    checkAuth();
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            showError('Please fill in all fields');
            return;
        }
        
        setLoading(true);
        
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                saveToken(data.token);
                saveUser(data.user);
                showSuccess('Login successful! Redirecting...');
                
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            } else {
                showError(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    });
}

// ==========================================
// REGISTER FORM HANDLER
// ==========================================
const registerForm = document.getElementById('register-form');
if (registerForm) {
    // Check if already logged in
    checkAuth();
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const terms = document.getElementById('terms').checked;
        
        // Validation
        if (!email || !username || !password || !confirmPassword) {
            showError('Please fill in all fields');
            return;
        }
        
        if (username.length < 3) {
            showError('Username must be at least 3 characters');
            return;
        }
        
        if (password.length < 6) {
            showError('Password must be at least 6 characters');
            return;
        }
        
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }
        
        if (!terms) {
            showError('Please agree to the Terms and Conditions');
            return;
        }
        
        setLoading(true);
        
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email, 
                    username, 
                    password, 
                    confirmPassword 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                saveToken(data.token);
                saveUser(data.user);
                showSuccess('Registration successful! Redirecting...');
                
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            } else {
                showError(data.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    });
}

// ==========================================
// SOCIAL LOGIN HANDLERS (Demo)
// ==========================================
document.querySelectorAll('.btn-social').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        showError('Social login is not available in this demo');
    });
});
