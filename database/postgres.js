// ==========================================
// POSTGRESQL DATABASE FOR RENDER
// ==========================================

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ==========================================
// INITIALIZE DATABASE
// ==========================================
const initDatabase = async () => {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Initializing PostgreSQL database...');
        
        // Create Tables
        await client.query(`
            -- Users Table
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                avatar VARCHAR(500) DEFAULT '/images/default-avatar.png',
                is_premium BOOLEAN DEFAULT FALSE,
                premium_expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Artists Table
            CREATE TABLE IF NOT EXISTS artists (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                bio TEXT,
                image VARCHAR(500) DEFAULT '/images/default-artist.png',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Albums Table
            CREATE TABLE IF NOT EXISTS albums (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist_id INTEGER REFERENCES artists(id),
                cover_image VARCHAR(500) DEFAULT '/images/default-album.png',
                release_year INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Songs Table
            CREATE TABLE IF NOT EXISTS songs (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist_id INTEGER REFERENCES artists(id),
                album_id INTEGER REFERENCES albums(id),
                duration INTEGER DEFAULT 0,
                file_path VARCHAR(500) NOT NULL,
                cover_image VARCHAR(500),
                is_premium BOOLEAN DEFAULT FALSE,
                play_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Playlists Table
            CREATE TABLE IF NOT EXISTS playlists (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                user_id INTEGER REFERENCES users(id),
                cover_image VARCHAR(500) DEFAULT '/images/default-playlist.png',
                is_public BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Playlist Songs Table
            CREATE TABLE IF NOT EXISTS playlist_songs (
                id SERIAL PRIMARY KEY,
                playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
                song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(playlist_id, song_id)
            );

            -- Liked Songs Table
            CREATE TABLE IF NOT EXISTS liked_songs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
                liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, song_id)
            );

            -- Transactions Table
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                order_id VARCHAR(255) UNIQUE NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                payment_type VARCHAR(100),
                snap_token VARCHAR(500),
                snap_url VARCHAR(500),
                plan_type VARCHAR(50) DEFAULT 'monthly',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Play History Table
            CREATE TABLE IF NOT EXISTS play_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
                played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Seed data if empty
        await seedData(client);
        
        console.log('✅ PostgreSQL database initialized successfully');
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    } finally {
        client.release();
    }
};

// ==========================================
// SEED DATA
// ==========================================
const seedData = async (client) => {
    // Check if data exists
    const result = await client.query('SELECT COUNT(*) FROM artists');
    if (parseInt(result.rows[0].count) > 0) {
        console.log('📦 Database already seeded');
        return;
    }
    
    console.log('🌱 Seeding database...');
    
    // Seed Artists
    const artistsResult = await client.query(`
        INSERT INTO artists (name, bio, image) VALUES
        ('The Weeknd', 'Canadian singer and songwriter', '/images/artists/weeknd.jpg'),
        ('Dua Lipa', 'English singer and songwriter', '/images/artists/dualipa.jpg'),
        ('Ed Sheeran', 'English singer-songwriter', '/images/artists/edsheeran.jpg'),
        ('Taylor Swift', 'American singer-songwriter', '/images/artists/taylorswift.jpg'),
        ('Bruno Mars', 'American singer and songwriter', '/images/artists/brunomars.jpg')
        RETURNING id
    `);
    
    // Seed Albums
    await client.query(`
        INSERT INTO albums (title, artist_id, cover_image, release_year) VALUES
        ('After Hours', 1, '/images/albums/afterhours.jpg', 2020),
        ('Future Nostalgia', 2, '/images/albums/futurenostalgia.jpg', 2020),
        ('Divide', 3, '/images/albums/divide.jpg', 2017),
        ('1989', 4, '/images/albums/1989.jpg', 2014),
        ('24K Magic', 5, '/images/albums/24kmagic.jpg', 2016)
    `);
    
    // Seed Songs
    await client.query(`
        INSERT INTO songs (title, artist_id, album_id, duration, file_path, cover_image, is_premium) VALUES
        ('Blinding Lights', 1, 1, 200, '/music/sample1.mp3', '/images/albums/afterhours.jpg', FALSE),
        ('Save Your Tears', 1, 1, 215, '/music/sample2.mp3', '/images/albums/afterhours.jpg', FALSE),
        ('Levitating', 2, 2, 203, '/music/sample3.mp3', '/images/albums/futurenostalgia.jpg', FALSE),
        ('Dont Start Now', 2, 2, 183, '/music/sample4.mp3', '/images/albums/futurenostalgia.jpg', TRUE),
        ('Shape of You', 3, 3, 234, '/music/sample5.mp3', '/images/albums/divide.jpg', FALSE),
        ('Perfect', 3, 3, 263, '/music/sample6.mp3', '/images/albums/divide.jpg', TRUE),
        ('Shake It Off', 4, 4, 219, '/music/sample7.mp3', '/images/albums/1989.jpg', FALSE),
        ('Blank Space', 4, 4, 231, '/music/sample8.mp3', '/images/albums/1989.jpg', TRUE),
        ('24K Magic', 5, 5, 226, '/music/sample9.mp3', '/images/albums/24kmagic.jpg', FALSE),
        ('Uptown Funk', 5, 5, 269, '/music/sample10.mp3', '/images/albums/24kmagic.jpg', TRUE)
    `);
    
    // Create Demo Users
    const hashedPassword = await bcrypt.hash('demo123', 10);
    
    await client.query(`
        INSERT INTO users (username, email, password, is_premium) VALUES
        ('demo', 'demo@example.com', $1, FALSE)
    `, [hashedPassword]);
    
    // Premium user with expiry
    const premiumExpires = new Date();
    premiumExpires.setMonth(premiumExpires.getMonth() + 1);
    
    await client.query(`
        INSERT INTO users (username, email, password, is_premium, premium_expires_at) VALUES
        ('premium', 'premium@example.com', $1, TRUE, $2)
    `, [hashedPassword, premiumExpires]);
    
    console.log('✅ Database seeded successfully');
};

// ==========================================
// QUERY HELPER
// ==========================================
const query = async (text, params) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
        console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    
    return res;
};

// Get single row
const getOne = async (text, params) => {
    const res = await query(text, params);
    return res.rows[0];
};

// Get multiple rows
const getMany = async (text, params) => {
    const res = await query(text, params);
    return res.rows;
};

// Execute (insert, update, delete)
const execute = async (text, params) => {
    const res = await query(text, params);
    return res;
};

module.exports = {
    pool,
    initDatabase,
    query,
    getOne,
    getMany,
    execute
};
