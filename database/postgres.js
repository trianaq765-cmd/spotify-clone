// ==========================================
// POSTGRESQL DATABASE FOR RENDER
// Royalty-Free Music Version
// ==========================================

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL is not set!');
    console.error('👉 Go to Render Dashboard → Environment → Add DATABASE_URL');
    process.exit(1);
}

console.log('🔄 Connecting to PostgreSQL...');

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
    console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL error:', err.message);
});

// ==========================================
// INITIALIZE DATABASE
// ==========================================
const initDatabase = async () => {
    let client;
    
    try {
        console.log('🔄 Initializing database...');
        client = await pool.connect();
        console.log('✅ Connection successful');
        
        // Create all tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                avatar VARCHAR(500) DEFAULT 'https://ui-avatars.com/api/?background=1db954&color=fff&name=User',
                is_premium BOOLEAN DEFAULT FALSE,
                premium_expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS artists (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                bio TEXT,
                image VARCHAR(500),
                genre VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS albums (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
                cover_image VARCHAR(500),
                release_year INTEGER,
                genre VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS songs (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
                album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
                duration INTEGER DEFAULT 0,
                file_path VARCHAR(500) NOT NULL,
                cover_image VARCHAR(500),
                is_premium BOOLEAN DEFAULT FALSE,
                play_count INTEGER DEFAULT 0,
                genre VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS playlists (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                cover_image VARCHAR(500) DEFAULT 'https://picsum.photos/seed/playlist/300/300',
                is_public BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS playlist_songs (
                id SERIAL PRIMARY KEY,
                playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
                song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(playlist_id, song_id)
            );

            CREATE TABLE IF NOT EXISTS liked_songs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
                liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, song_id)
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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

            CREATE TABLE IF NOT EXISTS play_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
                played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log('✅ Tables ready');
        await seedData(client);
        console.log('✅ Database initialized');
        
    } catch (error) {
        console.error('❌ Database init error:', error.message);
        throw error;
    } finally {
        if (client) client.release();
    }
};

// ==========================================
// SEED DATA - ROYALTY FREE MUSIC
// All music from SoundHelix (royalty-free)
// All images from Picsum/Pravatar (free)
// ==========================================
const seedData = async (client) => {
    try {
        const result = await client.query('SELECT COUNT(*) FROM artists');
        if (parseInt(result.rows[0].count) > 0) {
            console.log('📦 Already seeded');
            return;
        }
        
        console.log('🌱 Seeding with royalty-free content...');
        
        // ==========================================
        // ARTISTS (Indie/Fictional - No Copyright Issues)
        // ==========================================
        await client.query(`
            INSERT INTO artists (name, bio, image, genre) VALUES
            (
                'Luna Eclipse',
                'Luna Eclipse is an electronic music producer known for dreamy synth-pop soundscapes and atmospheric beats. Based in Berlin, she has been producing music since 2018.',
                'https://i.pravatar.cc/300?img=1',
                'Electronic/Synth-pop'
            ),
            (
                'The Midnight Runners',
                'The Midnight Runners are an alternative rock band formed in 2015. Their energetic performances and catchy hooks have earned them a dedicated fanbase.',
                'https://i.pravatar.cc/300?img=11',
                'Alternative Rock'
            ),
            (
                'Skylar James',
                'Skylar James is a soulful R&B artist with a voice that captivates audiences worldwide. Her music blends contemporary R&B with classic soul influences.',
                'https://i.pravatar.cc/300?img=5',
                'R&B/Soul'
            ),
            (
                'Echo Valley',
                'Echo Valley is an indie folk duo creating heartfelt acoustic music. Their songs tell stories of love, nature, and the human experience.',
                'https://i.pravatar.cc/300?img=12',
                'Indie Folk'
            ),
            (
                'Neon Pulse',
                'Neon Pulse is an EDM producer and DJ known for high-energy tracks that dominate dance floors. His signature sound combines house, techno, and future bass.',
                'https://i.pravatar.cc/300?img=33',
                'EDM/Electronic'
            ),
            (
                'Sarah Mitchell',
                'Sarah Mitchell is a singer-songwriter with a gift for crafting intimate acoustic songs. Her gentle vocals and poetic lyrics create a deeply personal listening experience.',
                'https://i.pravatar.cc/300?img=9',
                'Acoustic/Singer-Songwriter'
            ),
            (
                'The Urban Collective',
                'The Urban Collective is a hip-hop group bringing fresh beats and conscious lyrics. Their music addresses social issues while keeping the vibe upbeat and positive.',
                'https://i.pravatar.cc/300?img=51',
                'Hip-Hop/R&B'
            ),
            (
                'Crystal Dawn',
                'Crystal Dawn is a pop artist known for catchy melodies and uplifting lyrics. Her music is perfect for those feel-good moments and summer vibes.',
                'https://i.pravatar.cc/300?img=44',
                'Pop/Dance'
            )
        `);
        
        // ==========================================
        // ALBUMS
        // ==========================================
        await client.query(`
            INSERT INTO albums (title, artist_id, cover_image, release_year, genre) VALUES
            -- Luna Eclipse Albums
            ('Midnight Dreams', 1, 'https://picsum.photos/seed/midnightdreams/300/300', 2023, 'Electronic'),
            ('Neon Nights', 1, 'https://picsum.photos/seed/neonnights/300/300', 2022, 'Synth-pop'),
            
            -- The Midnight Runners Albums
            ('Running Wild', 2, 'https://picsum.photos/seed/runningwild/300/300', 2023, 'Alternative Rock'),
            ('City Lights', 2, 'https://picsum.photos/seed/citylights/300/300', 2021, 'Rock'),
            
            -- Skylar James Albums
            ('Velvet Soul', 3, 'https://picsum.photos/seed/velvetsoul/300/300', 2023, 'R&B'),
            ('Midnight Confessions', 3, 'https://picsum.photos/seed/midnightconf/300/300', 2022, 'Soul'),
            
            -- Echo Valley Albums
            ('Mountain Songs', 4, 'https://picsum.photos/seed/mountainsongs/300/300', 2023, 'Folk'),
            ('Autumn Tales', 4, 'https://picsum.photos/seed/autumntales/300/300', 2021, 'Indie Folk'),
            
            -- Neon Pulse Albums
            ('Electric Atmosphere', 5, 'https://picsum.photos/seed/electricatm/300/300', 2023, 'EDM'),
            ('Bass Drop', 5, 'https://picsum.photos/seed/bassdrop/300/300', 2022, 'Electronic'),
            
            -- Sarah Mitchell Albums
            ('Quiet Moments', 6, 'https://picsum.photos/seed/quietmoments/300/300', 2023, 'Acoustic'),
            ('Stories Untold', 6, 'https://picsum.photos/seed/storiesuntold/300/300', 2021, 'Singer-Songwriter'),
            
            -- The Urban Collective Albums
            ('Street Wisdom', 7, 'https://picsum.photos/seed/streetwisdom/300/300', 2023, 'Hip-Hop'),
            ('Rise Up', 7, 'https://picsum.photos/seed/riseup/300/300', 2022, 'R&B'),
            
            -- Crystal Dawn Albums
            ('Sunshine Pop', 8, 'https://picsum.photos/seed/sunshinepop/300/300', 2023, 'Pop'),
            ('Dance Forever', 8, 'https://picsum.photos/seed/danceforever/300/300', 2022, 'Dance')
        `);
        
        // ==========================================
        // SONGS (Using SoundHelix - Royalty Free Music)
        // https://www.soundhelix.com/examples/mp3/
        // ==========================================
        await client.query(`
            INSERT INTO songs (title, artist_id, album_id, duration, file_path, cover_image, is_premium, play_count, genre) VALUES
            
            -- Luna Eclipse - Midnight Dreams (Album 1)
            ('Dreaming in Color', 1, 1, 367, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'https://picsum.photos/seed/dreaming/300/300', FALSE, 15420, 'Electronic'),
            ('Starlight Symphony', 1, 1, 423, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'https://picsum.photos/seed/starlight/300/300', FALSE, 12350, 'Synth-pop'),
            ('Digital Horizon', 1, 1, 298, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'https://picsum.photos/seed/digital/300/300', TRUE, 18900, 'Electronic'),
            
            -- Luna Eclipse - Neon Nights (Album 2)
            ('City Glow', 1, 2, 345, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 'https://picsum.photos/seed/cityglow/300/300', FALSE, 9800, 'Synth-pop'),
            
            -- The Midnight Runners - Running Wild (Album 3)
            ('Break Free', 2, 3, 312, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 'https://picsum.photos/seed/breakfree/300/300', FALSE, 14200, 'Rock'),
            ('Thunder Road', 2, 3, 287, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 'https://picsum.photos/seed/thunder/300/300', TRUE, 13100, 'Alternative'),
            ('Wild Hearts', 2, 3, 334, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', 'https://picsum.photos/seed/wildhearts/300/300', FALSE, 16500, 'Rock'),
            
            -- The Midnight Runners - City Lights (Album 4)
            ('Downtown Nights', 2, 4, 298, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 'https://picsum.photos/seed/downtown/300/300', FALSE, 8900, 'Alternative Rock'),
            
            -- Skylar James - Velvet Soul (Album 5)
            ('Velvet Touch', 3, 5, 267, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', 'https://picsum.photos/seed/velvet/300/300', FALSE, 25000, 'R&B'),
            ('Soul on Fire', 3, 5, 312, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', 'https://picsum.photos/seed/soulfire/300/300', TRUE, 19800, 'Soul'),
            ('Midnight Rain', 3, 5, 289, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', 'https://picsum.photos/seed/midrain/300/300', FALSE, 17600, 'R&B'),
            
            -- Skylar James - Midnight Confessions (Album 6)
            ('Confession', 3, 6, 276, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', 'https://picsum.photos/seed/confession/300/300', FALSE, 14300, 'Soul'),
            
            -- Echo Valley - Mountain Songs (Album 7)
            ('Mountain High', 4, 7, 245, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', 'https://picsum.photos/seed/mountain/300/300', FALSE, 21000, 'Folk'),
            ('River Flow', 4, 7, 298, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', 'https://picsum.photos/seed/river/300/300', TRUE, 18700, 'Indie Folk'),
            ('Forest Path', 4, 7, 267, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', 'https://picsum.photos/seed/forest/300/300', FALSE, 16200, 'Folk'),
            
            -- Echo Valley - Autumn Tales (Album 8)
            ('Falling Leaves', 4, 8, 234, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', 'https://picsum.photos/seed/leaves/300/300', FALSE, 22100, 'Indie'),
            
            -- Neon Pulse - Electric Atmosphere (Album 9)
            ('Electric Dreams', 5, 9, 356, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'https://picsum.photos/seed/electric/300/300', FALSE, 15600, 'EDM'),
            ('Bass Kingdom', 5, 9, 312, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'https://picsum.photos/seed/bass/300/300', TRUE, 28000, 'Electronic'),
            ('Neon Lights', 5, 9, 287, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'https://picsum.photos/seed/neonlights/300/300', FALSE, 19400, 'EDM'),
            
            -- Neon Pulse - Bass Drop (Album 10)
            ('Drop Zone', 5, 10, 298, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 'https://picsum.photos/seed/dropzone/300/300', FALSE, 14800, 'Electronic'),
            
            -- Sarah Mitchell - Quiet Moments (Album 11)
            ('Gentle Morning', 6, 11, 234, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 'https://picsum.photos/seed/morning/300/300', FALSE, 13200, 'Acoustic'),
            ('Whispered Words', 6, 11, 267, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 'https://picsum.photos/seed/whisper/300/300', TRUE, 11800, 'Singer-Songwriter'),
            ('Peaceful Heart', 6, 11, 289, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', 'https://picsum.photos/seed/peaceful/300/300', FALSE, 17900, 'Acoustic'),
            
            -- Sarah Mitchell - Stories Untold (Album 12)
            ('Untold Story', 6, 12, 256, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 'https://picsum.photos/seed/untold/300/300', FALSE, 15100, 'Singer-Songwriter'),
            
            -- The Urban Collective - Street Wisdom (Album 13)
            ('Street Life', 7, 13, 312, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', 'https://picsum.photos/seed/streetlife/300/300', FALSE, 24500, 'Hip-Hop'),
            ('Wisdom Flow', 7, 13, 287, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', 'https://picsum.photos/seed/wisdom/300/300', TRUE, 19200, 'Hip-Hop'),
            ('Urban Dreams', 7, 13, 334, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', 'https://picsum.photos/seed/urbandream/300/300', FALSE, 21800, 'R&B'),
            
            -- The Urban Collective - Rise Up (Album 14)
            ('Rising Sun', 7, 14, 298, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', 'https://picsum.photos/seed/risingsun/300/300', FALSE, 16400, 'Hip-Hop'),
            
            -- Crystal Dawn - Sunshine Pop (Album 15)
            ('Sunny Day', 8, 15, 245, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', 'https://picsum.photos/seed/sunny/300/300', FALSE, 12400, 'Pop'),
            ('Happy Vibes', 8, 15, 267, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', 'https://picsum.photos/seed/happy/300/300', TRUE, 23600, 'Pop'),
            ('Summer Love', 8, 15, 289, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', 'https://picsum.photos/seed/summerlove/300/300', FALSE, 18300, 'Pop'),
            
            -- Crystal Dawn - Dance Forever (Album 16)
            ('Dance All Night', 8, 16, 312, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', 'https://picsum.photos/seed/dancenight/300/300', FALSE, 15700, 'Dance')
        `);
        
        // ==========================================
        // DEMO USERS
        // ==========================================
        const hashedPassword = await bcrypt.hash('demo123', 10);
        
        // Free user
        await client.query(
            `INSERT INTO users (username, email, password, is_premium, avatar) VALUES ($1, $2, $3, $4, $5)`,
            ['demo', 'demo@example.com', hashedPassword, false, 'https://ui-avatars.com/api/?background=1db954&color=fff&name=Demo+User&size=200']
        );
        
        // Premium user
        const premiumExpires = new Date();
        premiumExpires.setMonth(premiumExpires.getMonth() + 1);
        
        await client.query(
            `INSERT INTO users (username, email, password, is_premium, premium_expires_at, avatar) VALUES ($1, $2, $3, $4, $5, $6)`,
            ['premium', 'premium@example.com', hashedPassword, true, premiumExpires, 'https://ui-avatars.com/api/?background=ffd700&color=000&name=Premium+User&size=200']
        );
        
        console.log('');
        console.log('✅ Database seeded successfully!');
        console.log('');
        console.log('📊 Content Summary:');
        console.log('   🎤 8 Artists (Indie/Fictional)');
        console.log('   💿 16 Albums');
        console.log('   🎵 32 Songs (24 free + 8 premium)');
        console.log('   👤 2 Demo users');
        console.log('');
        console.log('🎵 Music Source: SoundHelix (Royalty-Free)');
        console.log('🖼️ Images Source: Picsum/Pravatar (Free)');
        console.log('');
        
    } catch (error) {
        console.error('❌ Seed error:', error.message);
    }
};

// ==========================================
// RESET DATABASE FUNCTION
// ==========================================
const resetDatabase = async () => {
    let client;
    try {
        client = await pool.connect();
        
        console.log('🗑️ Dropping all tables...');
        await client.query(`
            DROP TABLE IF EXISTS play_history CASCADE;
            DROP TABLE IF EXISTS playlist_songs CASCADE;
            DROP TABLE IF EXISTS liked_songs CASCADE;
            DROP TABLE IF EXISTS playlists CASCADE;
            DROP TABLE IF EXISTS transactions CASCADE;
            DROP TABLE IF EXISTS songs CASCADE;
            DROP TABLE IF EXISTS albums CASCADE;
            DROP TABLE IF EXISTS artists CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
        `);
        
        console.log('✅ Tables dropped');
        client.release();
        
        // Reinitialize
        await initDatabase();
        
        return { success: true, message: 'Database reset complete! 8 artists, 16 albums, 32 songs created.' };
    } catch (error) {
        if (client) client.release();
        console.error('Reset error:', error);
        throw error;
    }
};

// ==========================================
// QUERY HELPERS
// ==========================================
const query = async (text, params) => {
    try {
        const res = await pool.query(text, params);
        return res;
    } catch (error) {
        console.error('Query error:', error.message);
        throw error;
    }
};

const getOne = async (text, params) => {
    const res = await query(text, params);
    return res.rows[0];
};

const getMany = async (text, params) => {
    const res = await query(text, params);
    return res.rows;
};

const execute = async (text, params) => {
    return await query(text, params);
};

module.exports = {
    pool,
    initDatabase,
    resetDatabase,
    query,
    getOne,
    getMany,
    execute
};
