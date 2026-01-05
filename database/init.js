// ==========================================
// DATABASE INITIALIZATION
// ==========================================

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'spotify.db');
let db;

const initDatabase = async () => {
    db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // ==========================================
    // CREATE TABLES
    // ==========================================
    
    // Users Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT DEFAULT '/images/default-avatar.png',
            is_premium INTEGER DEFAULT 0,
            premium_expires_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Artists Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS artists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            bio TEXT,
            image TEXT DEFAULT '/images/default-artist.png',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Albums Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist_id INTEGER,
            cover_image TEXT DEFAULT '/images/default-album.png',
            release_year INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (artist_id) REFERENCES artists(id)
        )
    `);

    // Songs Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist_id INTEGER,
            album_id INTEGER,
            duration INTEGER DEFAULT 0,
            file_path TEXT NOT NULL,
            cover_image TEXT,
            is_premium INTEGER DEFAULT 0,
            play_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (artist_id) REFERENCES artists(id),
            FOREIGN KEY (album_id) REFERENCES albums(id)
        )
    `);

    // Playlists Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            user_id INTEGER,
            cover_image TEXT DEFAULT '/images/default-playlist.png',
            is_public INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Playlist Songs Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS playlist_songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER,
            song_id INTEGER,
            added_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id),
            FOREIGN KEY (song_id) REFERENCES songs(id)
        )
    `);

    // Liked Songs Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS liked_songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            song_id INTEGER,
            liked_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (song_id) REFERENCES songs(id),
            UNIQUE(user_id, song_id)
        )
    `);

    // Transactions Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            order_id TEXT UNIQUE NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            payment_type TEXT,
            snap_token TEXT,
            snap_url TEXT,
            plan_type TEXT DEFAULT 'monthly',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Play History Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS play_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            song_id INTEGER,
            played_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (song_id) REFERENCES songs(id)
        )
    `);

    // ==========================================
    // SEED DATA
    // ==========================================
    await seedData();
    
    return db;
};

const seedData = async () => {
    // Check if data already exists
    const artistCount = db.prepare('SELECT COUNT(*) as count FROM artists').get();
    if (artistCount.count > 0) {
        console.log('📦 Database already seeded');
        return;
    }

    console.log('🌱 Seeding database...');

    // Seed Artists
    const artists = [
        { name: 'The Weeknd', bio: 'Canadian singer and songwriter', image: '/images/artists/weeknd.jpg' },
        { name: 'Dua Lipa', bio: 'English singer and songwriter', image: '/images/artists/dualipa.jpg' },
        { name: 'Ed Sheeran', bio: 'English singer-songwriter', image: '/images/artists/edsheeran.jpg' },
        { name: 'Taylor Swift', bio: 'American singer-songwriter', image: '/images/artists/taylorswift.jpg' },
        { name: 'Bruno Mars', bio: 'American singer and songwriter', image: '/images/artists/brunomars.jpg' }
    ];

    const insertArtist = db.prepare('INSERT INTO artists (name, bio, image) VALUES (?, ?, ?)');
    artists.forEach(artist => {
        insertArtist.run(artist.name, artist.bio, artist.image);
    });

    // Seed Albums
    const albums = [
        { title: 'After Hours', artist_id: 1, cover_image: '/images/albums/afterhours.jpg', release_year: 2020 },
        { title: 'Future Nostalgia', artist_id: 2, cover_image: '/images/albums/futurenostalgia.jpg', release_year: 2020 },
        { title: 'Divide', artist_id: 3, cover_image: '/images/albums/divide.jpg', release_year: 2017 },
        { title: '1989', artist_id: 4, cover_image: '/images/albums/1989.jpg', release_year: 2014 },
        { title: '24K Magic', artist_id: 5, cover_image: '/images/albums/24kmagic.jpg', release_year: 2016 }
    ];

    const insertAlbum = db.prepare('INSERT INTO albums (title, artist_id, cover_image, release_year) VALUES (?, ?, ?, ?)');
    albums.forEach(album => {
        insertAlbum.run(album.title, album.artist_id, album.cover_image, album.release_year);
    });

    // Seed Songs (using sample/demo audio files)
    const songs = [
        { title: 'Blinding Lights', artist_id: 1, album_id: 1, duration: 200, file_path: '/music/sample1.mp3', cover_image: '/images/albums/afterhours.jpg', is_premium: 0 },
        { title: 'Save Your Tears', artist_id: 1, album_id: 1, duration: 215, file_path: '/music/sample2.mp3', cover_image: '/images/albums/afterhours.jpg', is_premium: 0 },
        { title: 'Levitating', artist_id: 2, album_id: 2, duration: 203, file_path: '/music/sample3.mp3', cover_image: '/images/albums/futurenostalgia.jpg', is_premium: 0 },
        { title: "Don't Start Now", artist_id: 2, album_id: 2, duration: 183, file_path: '/music/sample4.mp3', cover_image: '/images/albums/futurenostalgia.jpg', is_premium: 1 },
        { title: 'Shape of You', artist_id: 3, album_id: 3, duration: 234, file_path: '/music/sample5.mp3', cover_image: '/images/albums/divide.jpg', is_premium: 0 },
        { title: 'Perfect', artist_id: 3, album_id: 3, duration: 263, file_path: '/music/sample6.mp3', cover_image: '/images/albums/divide.jpg', is_premium: 1 },
        { title: 'Shake It Off', artist_id: 4, album_id: 4, duration: 219, file_path: '/music/sample7.mp3', cover_image: '/images/albums/1989.jpg', is_premium: 0 },
        { title: 'Blank Space', artist_id: 4, album_id: 4, duration: 231, file_path: '/music/sample8.mp3', cover_image: '/images/albums/1989.jpg', is_premium: 1 },
        { title: '24K Magic', artist_id: 5, album_id: 5, duration: 226, file_path: '/music/sample9.mp3', cover_image: '/images/albums/24kmagic.jpg', is_premium: 0 },
        { title: 'Uptown Funk', artist_id: 5, album_id: 5, duration: 269, file_path: '/music/sample10.mp3', cover_image: '/images/albums/24kmagic.jpg', is_premium: 1 }
    ];

    const insertSong = db.prepare('INSERT INTO songs (title, artist_id, album_id, duration, file_path, cover_image, is_premium) VALUES (?, ?, ?, ?, ?, ?, ?)');
    songs.forEach(song => {
        insertSong.run(song.title, song.artist_id, song.album_id, song.duration, song.file_path, song.cover_image, song.is_premium);
    });

    // Create Demo User
    const hashedPassword = await bcrypt.hash('demo123', 10);
    db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run('demo', 'demo@example.com', hashedPassword);

    // Create Demo Premium User
    const premiumExpires = new Date();
    premiumExpires.setMonth(premiumExpires.getMonth() + 1);
    db.prepare('INSERT INTO users (username, email, password, is_premium, premium_expires_at) VALUES (?, ?, ?, ?, ?)').run('premium', 'premium@example.com', hashedPassword, 1, premiumExpires.toISOString());

    console.log('✅ Database seeded successfully');
};

const getDb = () => {
    if (!db) {
        db = new Database(dbPath);
    }
    return db;
};

module.exports = { initDatabase, getDb };
