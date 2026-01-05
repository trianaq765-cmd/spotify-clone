// ==========================================
// SPOTIFY CLONE - MAIN SERVER
// Full Version for Render Deployment
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

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'views')));

// ==========================================
// VIEW ROUTES (HTML Pages)
// ==========================================

// Landing Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Auth Pages
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// Main App
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Premium Pages
app.get('/premium', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'premium.html'));
});

app.get('/payment-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'payment-success.html'));
});

// Admin Reset Page (untuk reset database via HP)
app.get('/admin-reset', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin-reset.html'));
});

// Health Check (untuk Render)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
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

// 404 Handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'API endpoint not found' 
    });
});

// 404 Handler for other routes - redirect to home
app.use((req, res, next) => {
    // If it's a page request, redirect to home
    if (req.accepts('html')) {
        res.redirect('/');
        return;
    }
    
    // Otherwise send 404
    res.status(404).json({ 
        success: false, 
        message: 'Not found' 
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    
    // Don't leak error details in production
    const isDev = process.env.NODE_ENV !== 'production';
    
    res.status(err.status || 500).json({ 
        success: false, 
        message: isDev ? err.message : 'Something went wrong!',
        error: isDev ? err.stack : undefined
    });
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==========================================
// START SERVER
// ==========================================
const startServer = async () => {
    try {
        console.log('');
        console.log('🚀 Starting Spotify Clone Server...');
        console.log('');
        
        // Initialize Database
        console.log('📦 Connecting to database...');
        await initDatabase();
        console.log('✅ Database ready');
        console.log('');

        // Start listening
        app.listen(PORT, '0.0.0.0', () => {
            console.log('╔═══════════════════════════════════════════════════╗');
            console.log('║                                                   ║');
            console.log('║     🎵 SPOTIFY CLONE SERVER IS RUNNING 🎵        ║');
            console.log('║                                                   ║');
            console.log('╠═══════════════════════════════════════════════════╣');
            console.log(`║  🌐 Port: ${PORT}                                     ║`);
            console.log(`║  📍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(25)}║`);
            console.log('║  💾 Database: PostgreSQL                          ║');
            console.log('║  ✅ Status: Ready to rock!                        ║');
            console.log('║                                                   ║');
            console.log('╠═══════════════════════════════════════════════════╣');
            console.log('║  📱 Pages:                                        ║');
            console.log('║     • /              - Landing page               ║');
            console.log('║     • /login         - Login page                 ║');
            console.log('║     • /register      - Register page              ║');
            console.log('║     • /dashboard     - Main app                   ║');
            console.log('║     • /premium       - Premium plans              ║');
            console.log('║     • /admin-reset   - Reset database             ║');
            console.log('║                                                   ║');
            console.log('╠═══════════════════════════════════════════════════╣');
            console.log('║  🔑 Demo Accounts:                                ║');
            console.log('║     • demo@example.com / demo123 (Free)           ║');
            console.log('║     • premium@example.com / demo123 (Premium)     ║');
            console.log('║                                                   ║');
            console.log('╚═══════════════════════════════════════════════════╝');
            console.log('');
        });
        
    } catch (error) {
        console.error('');
        console.error('╔═══════════════════════════════════════════════════╗');
        console.error('║  ❌ FAILED TO START SERVER                        ║');
        console.error('╚═══════════════════════════════════════════════════╝');
        console.error('');
        console.error('Error:', error.message);
        console.error('');
        console.error('Common issues:');
        console.error('  1. DATABASE_URL not set in environment variables');
        console.error('  2. PostgreSQL database not available');
        console.error('  3. Invalid database credentials');
        console.error('');
        console.error('Full error:', error);
        process.exit(1);
    }
};

// Run the server
startServer();
