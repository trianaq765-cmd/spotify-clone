// ==========================================
// POSTGRESQL DATABASE FOR RENDER
// Full Version with Sample Data
// ==========================================

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL is not set!');
    console.error('👉 Go to Render Dashboard → Environment → Add DATABASE_URL');
    console.error('👉 Get the External URL from your PostgreSQL database');
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS albums (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
                cover_image VARCHAR(500),
                release_year INTEGER,
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
// SEED DATA WITH IMAGES & MUSIC
// ==========================================
const seedData = async (client) => {
    try {
        const result = await client.query('SELECT COUNT(*) FROM artists');
        if (parseInt(result.rows[0].count) > 0) {
            console.log('📦 Already seeded');
            return;
        }
        
        console.log('🌱 Seeding with sample data...');
        
        // ==========================================
        // ARTISTS (8 artists with avatar images)
        // ==========================================
        await client.query(`
            INSERT INTO artists (name, bio, image) VALUES
            ('The Weeknd', 'Abel Makkonen Tesfaye, known professionally as the Weeknd, is a Canadian singer-songwriter and record producer known for his sonic versatility and dark lyricism.', 'https://i.pravatar.cc/300?img=33'),
            ('Dua Lipa', 'Dua Lipa is an English singer and songwriter. After working as a model, she signed with Warner Bros Records and released her self-titled debut album in 2017.', 'https://i.pravatar.cc/300?img=5'),
            ('Ed Sheeran', 'Edward Christopher Sheeran is an English singer-songwriter. Born in Halifax, West Yorkshire and raised in Framlingham, Suffolk, he began writing songs around the age of eleven.', 'https://i.pravatar.cc/300?img=12'),
            ('Taylor Swift', 'Taylor Alison Swift is an American singer-songwriter. Her discography spans multiple genres, and her narrative songwriting—often inspired by her personal life—has received widespread critical praise.', 'https://i.pravatar.cc/300?img=9'),
            ('Bruno Mars', 'Peter Gene Hernandez, known professionally as Bruno Mars, is an American singer-songwriter and record producer. He is known for his stage performances and retro showmanship.', 'https://i.pravatar.cc/300?img=68'),
            ('Ariana Grande', 'Ariana Grande-Butera is an American singer, songwriter, and actress. Her four-octave vocal range has received critical acclaim, and her personal life has been the subject of widespread media attention.', 'https://i.pravatar.cc/300?img=47'),
            ('Drake', 'Aubrey Drake Graham is a Canadian rapper, singer, and songwriter. An influential figure in contemporary popular music, Drake has been credited for popularizing singing and R&B sensibilities in hip hop.', 'https://i.pravatar.cc/300?img=51'),
            ('Billie Eilish', 'Billie Eilish Pirate Baird O''Connell is an American singer-songwriter. She first gained public attention in 2015 with her debut single "Ocean Eyes", written and produced by her brother Finneas.', 'https://i.pravatar.cc/300?img=44')
        `);
        
        // ==========================================
        // ALBUMS (13 albums with cover images)
        // ==========================================
        await client.query(`
            INSERT INTO albums (title, artist_id, cover_image, release_year) VALUES
            ('After Hours', 1, 'https://picsum.photos/seed/afterhours/300/300', 2020),
            ('Starboy', 1, 'https://picsum.photos/seed/starboy/300/300', 2016),
            ('Future Nostalgia', 2, 'https://picsum.photos/seed/futurenostalgia/300/300', 2020),
            ('Dua Lipa', 2, 'https://picsum.photos/seed/dualipa/300/300', 2017),
            ('Divide', 3, 'https://picsum.photos/seed/divide/300/300', 2017),
            ('Multiply', 3, 'https://picsum.photos/seed/multiply/300/300', 2014),
            ('1989', 4, 'https://picsum.photos/seed/ts1989/300/300', 2014),
            ('Lover', 4, 'https://picsum.photos/seed/lover/300/300', 2019),
            ('24K Magic', 5, 'https://picsum.photos/seed/24kmagic/300/300', 2016),
            ('Doo-Wops and Hooligans', 5, 'https://picsum.photos/seed/doowops/300/300', 2010),
            ('Positions', 6, 'https://picsum.photos/seed/positions/300/300', 2020),
            ('Scorpion', 7, 'https://picsum.photos/seed/scorpion/300/300', 2018),
            ('Happier Than Ever', 8, 'https://picsum.photos/seed/happier/300/300', 2021)
        `);
        
        // ==========================================
        // SONGS (30 songs with audio from SoundHelix)
        // ==========================================
        await client.query(`
            INSERT INTO songs (title, artist_id, album_id, duration, file_path, cover_image, is_premium, play_count) VALUES
            
            -- The Weeknd (4 songs)
            ('Blinding Lights', 1, 1, 200, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'https://picsum.photos/seed/blinding/300/300', FALSE, 15420),
            ('Save Your Tears', 1, 1, 215, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'https://picsum.photos/seed/saveyour/300/300', FALSE, 12350),
            ('Starboy', 1, 2, 230, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'https://picsum.photos/seed/starboysong/300/300', TRUE, 18900),
            ('The Hills', 1, 2, 242, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 'https://picsum.photos/seed/thehills/300/300', FALSE, 9800),
            
            -- Dua Lipa (4 songs)
            ('Levitating', 2, 3, 203, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 'https://picsum.photos/seed/levitating/300/300', FALSE, 14200),
            ('Dont Start Now', 2, 3, 183, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 'https://picsum.photos/seed/dontstart/300/300', TRUE, 13100),
            ('New Rules', 2, 4, 209, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', 'https://picsum.photos/seed/newrules/300/300', FALSE, 16500),
            ('Physical', 2, 3, 194, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 'https://picsum.photos/seed/physical/300/300', FALSE, 8900),
            
            -- Ed Sheeran (4 songs)
            ('Shape of You', 3, 5, 234, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', 'https://picsum.photos/seed/shapeofyou/300/300', FALSE, 25000),
            ('Perfect', 3, 5, 263, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', 'https://picsum.photos/seed/perfect/300/300', TRUE, 19800),
            ('Thinking Out Loud', 3, 6, 281, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', 'https://picsum.photos/seed/thinking/300/300', FALSE, 17600),
            ('Photograph', 3, 6, 258, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', 'https://picsum.photos/seed/photograph/300/300', FALSE, 14300),
            
            -- Taylor Swift (4 songs)
            ('Shake It Off', 4, 7, 219, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', 'https://picsum.photos/seed/shakeitoff/300/300', FALSE, 21000),
            ('Blank Space', 4, 7, 231, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', 'https://picsum.photos/seed/blankspace/300/300', TRUE, 18700),
            ('Cruel Summer', 4, 8, 178, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', 'https://picsum.photos/seed/cruelsummer/300/300', FALSE, 16200),
            ('Love Story', 4, 7, 235, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', 'https://picsum.photos/seed/lovestory/300/300', FALSE, 22100),
            
            -- Bruno Mars (4 songs)
            ('24K Magic', 5, 9, 226, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'https://picsum.photos/seed/24kmagicsong/300/300', FALSE, 15600),
            ('Uptown Funk', 5, 9, 269, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'https://picsum.photos/seed/uptownfunk/300/300', TRUE, 28000),
            ('Just The Way You Are', 5, 10, 221, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'https://picsum.photos/seed/justtheway/300/300', FALSE, 19400),
            ('Grenade', 5, 10, 223, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 'https://picsum.photos/seed/grenade/300/300', FALSE, 14800),
            
            -- Ariana Grande (3 songs)
            ('Positions', 6, 11, 172, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 'https://picsum.photos/seed/positionssong/300/300', FALSE, 13200),
            ('34 plus 35', 6, 11, 173, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 'https://picsum.photos/seed/3435/300/300', TRUE, 11800),
            ('Thank U Next', 6, 11, 207, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', 'https://picsum.photos/seed/thankunext/300/300', FALSE, 17900),
            
            -- Drake (3 songs)
            ('Gods Plan', 7, 12, 198, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 'https://picsum.photos/seed/godsplan/300/300', FALSE, 24500),
            ('In My Feelings', 7, 12, 217, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', 'https://picsum.photos/seed/inmyfeelings/300/300', TRUE, 19200),
            ('Hotline Bling', 7, 12, 267, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', 'https://picsum.photos/seed/hotlinebling/300/300', FALSE, 21800),
            
            -- Billie Eilish (4 songs)
            ('Happier Than Ever', 8, 13, 298, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', 'https://picsum.photos/seed/happiersong/300/300', FALSE, 12400),
            ('Bad Guy', 8, 13, 194, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', 'https://picsum.photos/seed/badguy/300/300', TRUE, 23600),
            ('Lovely', 8, 13, 200, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', 'https://picsum.photos/seed/lovely/300/300', FALSE, 18300),
            ('Ocean Eyes', 8, 13, 200, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', 'https://picsum.photos/seed/oceaneyes/300/300', FALSE, 15700)
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
        
        console.log('✅ Seeded: 8 artists, 13 albums, 30 songs, 2 users');
        
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
        
        return { success: true, message: 'Database reset complete!' };
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
