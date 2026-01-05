// ==========================================
// AUTHENTICATION ROUTES (PostgreSQL Version)
// ==========================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getOne, execute } = require('../database/postgres');
const { verifyToken } = require('../middleware/authMiddleware');

// ==========================================
// REGISTER
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Check if user exists
        const existingUser = await getOne(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or username already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Insert user
        const result = await execute(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );

        const userId = result.rows[0].id;

        // Generate token
        const token = jwt.sign(
            { userId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: userId,
                username,
                email,
                is_premium: false
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// ==========================================
// LOGIN
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user
        const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check premium expiry
        let isPremium = user.is_premium;
        if (isPremium && user.premium_expires_at) {
            const expiresAt = new Date(user.premium_expires_at);
            if (expiresAt < new Date()) {
                await execute(
                    'UPDATE users SET is_premium = FALSE, premium_expires_at = NULL WHERE id = $1',
                    [user.id]
                );
                isPremium = false;
            }
        }

        // Generate token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                is_premium: isPremium,
                premium_expires_at: user.premium_expires_at
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// ==========================================
// GET CURRENT USER
// ==========================================
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await getOne(
            'SELECT id, username, email, avatar, is_premium, premium_expires_at, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user stats
        const likedCount = await getOne(
            'SELECT COUNT(*) as count FROM liked_songs WHERE user_id = $1',
            [req.user.id]
        );
        const playlistCount = await getOne(
            'SELECT COUNT(*) as count FROM playlists WHERE user_id = $1',
            [req.user.id]
        );

        res.json({
            success: true,
            user: {
                ...user,
                stats: {
                    liked_songs: parseInt(likedCount.count),
                    playlists: parseInt(playlistCount.count)
                }
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user data'
        });
    }
});

// ==========================================
// LOGOUT
// ==========================================
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = router;
