// ==========================================
// SPOTIFY CLONE - MAIN SERVER (RENDER)
// ==========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Import Routes
const authRoutes = require('./routes/auth');
const musicRoutes = require('./routes/music');
const paymentRoutes = require('./routes/payment');

// Import Database
const { initDatabase } = require('./database/postgres');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'views')));

// ==========================================
// VIEW ROUTES
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/premium', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'premium.html'));
});

app.get('/payment-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'payment-success.html'));
});

// Health Check (untuk Render)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// API ROUTES
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/payment', paymentRoutes);

// ==========================================
// ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ==========================================
// START SERVER
// ==========================================
const startServer = async () => {
    try {
        await initDatabase();
        console.log('✅ Database initialized successfully');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔════════════════════════════════════════════╗
║     🎵 SPOTIFY CLONE SERVER RUNNING 🎵     ║
╠════════════════════════════════════════════╣
║  Port: ${PORT}                                 ║
║  Environment: ${process.env.NODE_ENV || 'development'}              ║
║  Database: PostgreSQL                      ║
║  Status: Ready! 🎸                         ║
╚════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
