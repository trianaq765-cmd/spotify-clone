// ==========================================
// MUSIC ROUTES (PostgreSQL Version)
// ==========================================

const express = require('express');
const router = express.Router();
const { getOne, getMany, execute } = require('../database/postgres');
const { verifyToken, optionalAuth } = require('../middleware/authMiddleware');

// ==========================================
// GET ALL SONGS
// ==========================================
router.get('/songs', optionalAuth, async (req, res) => {
    try {
        const { search, artist, album, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT 
                s.*,
                a.name as artist_name,
                al.title as album_title
            FROM songs s
            LEFT JOIN artists a ON s.artist_id = a.id
            LEFT JOIN albums al ON s.album_id = al.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (s.title ILIKE $${paramIndex} OR a.name ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (artist) {
            query += ` AND s.artist_id = $${paramIndex}`;
            params.push(artist);
            paramIndex++;
        }

        if (album) {
            query += ` AND s.album_id = $${paramIndex}`;
            params.push(album);
            paramIndex++;
        }

        query += ` ORDER BY s.play_count DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const songs = await getMany(query, params);

        // Add liked status if user is authenticated
        if (req.user) {
            const likedSongs = await getMany(
                'SELECT song_id FROM liked_songs WHERE user_id = $1',
                [req.user.id]
            );
            const likedIds = new Set(likedSongs.map(l => l.song_id));
            songs.forEach(song => {
                song.is_liked = likedIds.has(song.id);
            });
        }

        res.json({ success: true, songs });

    } catch (error) {
        console.error('Get songs error:', error);
        res.status(500).json({ success: false, message: 'Failed to get songs' });
    }
});

// ==========================================
// GET SINGLE SONG
// ==========================================
router.get('/songs/:id', optionalAuth, async (req, res) => {
    try {
        const song = await getOne(`
            SELECT 
                s.*,
                a.name as artist_name,
                al.title as album_title
            FROM songs s
            LEFT JOIN artists a ON s.artist_id = a.id
            LEFT JOIN albums al ON s.album_id = al.id
            WHERE s.id = $1
        `, [req.params.id]);

        if (!song) {
            return res.status(404).json({ success: false, message: 'Song not found' });
        }

        // Check premium requirement
        if (song.is_premium && (!req.user || !req.user.is_premium)) {
            song.file_path = null;
            song.requires_premium = true;
        }

        res.json({ success: true, song });

    } catch (error) {
        console.error('Get song error:', error);
        res.status(500).json({ success: false, message: 'Failed to get song' });
    }
});

// ==========================================
// PLAY SONG
// ==========================================
router.post('/songs/:id/play', optionalAuth, async (req, res) => {
    try {
        const song = await getOne('SELECT * FROM songs WHERE id = $1', [req.params.id]);

        if (!song) {
            return res.status(404).json({ success: false, message: 'Song not found' });
        }

        // Check premium requirement
        if (song.is_premium && (!req.user || !req.user.is_premium)) {
            return res.status(403).json({
                success: false,
                message: 'Premium subscription required',
                requires_premium: true
            });
        }

        // Increment play count
        await execute(
            'UPDATE songs SET play_count = play_count + 1 WHERE id = $1',
            [req.params.id]
        );

        // Add to play history if authenticated
        if (req.user) {
            await execute(
                'INSERT INTO play_history (user_id, song_id) VALUES ($1, $2)',
                [req.user.id, req.params.id]
            );
        }

        res.json({ success: true, file_path: song.file_path });

    } catch (error) {
        console.error('Play song error:', error);
        res.status(500).json({ success: false, message: 'Failed to play song' });
    }
});

// ==========================================
// GET ALL ARTISTS
// ==========================================
router.get('/artists', async (req, res) => {
    try {
        const artists = await getMany(`
            SELECT 
                a.*,
                COUNT(s.id) as song_count
            FROM artists a
            LEFT JOIN songs s ON a.id = s.artist_id
            GROUP BY a.id
            ORDER BY song_count DESC
        `);

        res.json({ success: true, artists });

    } catch (error) {
        console.error('Get artists error:', error);
        res.status(500).json({ success: false, message: 'Failed to get artists' });
    }
});

// ==========================================
// GET SINGLE ARTIST
// ==========================================
router.get('/artists/:id', async (req, res) => {
    try {
        const artist = await getOne('SELECT * FROM artists WHERE id = $1', [req.params.id]);

        if (!artist) {
            return res.status(404).json({ success: false, message: 'Artist not found' });
        }

        const songs = await getMany(`
            SELECT s.*, al.title as album_title
            FROM songs s
            LEFT JOIN albums al ON s.album_id = al.id
            WHERE s.artist_id = $1
            ORDER BY s.play_count DESC
        `, [req.params.id]);

        const albums = await getMany('SELECT * FROM albums WHERE artist_id = $1', [req.params.id]);

        res.json({
            success: true,
            artist: { ...artist, songs, albums }
        });

    } catch (error) {
        console.error('Get artist error:', error);
        res.status(500).json({ success: false, message: 'Failed to get artist' });
    }
});

// ==========================================
// GET ALL ALBUMS
// ==========================================
router.get('/albums', async (req, res) => {
    try {
        const albums = await getMany(`
            SELECT 
                al.*,
                a.name as artist_name,
                COUNT(s.id) as song_count
            FROM albums al
            LEFT JOIN artists a ON al.artist_id = a.id
            LEFT JOIN songs s ON al.id = s.album_id
            GROUP BY al.id, a.name
            ORDER BY al.release_year DESC
        `);

        res.json({ success: true, albums });

    } catch (error) {
        console.error('Get albums error:', error);
        res.status(500).json({ success: false, message: 'Failed to get albums' });
    }
});

// ==========================================
// GET SINGLE ALBUM
// ==========================================
router.get('/albums/:id', async (req, res) => {
    try {
        const album = await getOne(`
            SELECT al.*, a.name as artist_name
            FROM albums al
            LEFT JOIN artists a ON al.artist_id = a.id
            WHERE al.id = $1
        `, [req.params.id]);

        if (!album) {
            return res.status(404).json({ success: false, message: 'Album not found' });
        }

        const songs = await getMany('SELECT * FROM songs WHERE album_id = $1', [req.params.id]);

        res.json({
            success: true,
            album: { ...album, songs }
        });

    } catch (error) {
        console.error('Get album error:', error);
        res.status(500).json({ success: false, message: 'Failed to get album' });
    }
});

// ==========================================
// LIKE/UNLIKE SONG
// ==========================================
router.post('/songs/:id/like', verifyToken, async (req, res) => {
    try {
        const songId = req.params.id;
        const userId = req.user.id;

        const existing = await getOne(
            'SELECT id FROM liked_songs WHERE user_id = $1 AND song_id = $2',
            [userId, songId]
        );

        if (existing) {
            await execute(
                'DELETE FROM liked_songs WHERE user_id = $1 AND song_id = $2',
                [userId, songId]
            );
            res.json({ success: true, liked: false, message: 'Song removed from liked songs' });
        } else {
            await execute(
                'INSERT INTO liked_songs (user_id, song_id) VALUES ($1, $2)',
                [userId, songId]
            );
            res.json({ success: true, liked: true, message: 'Song added to liked songs' });
        }

    } catch (error) {
        console.error('Like song error:', error);
        res.status(500).json({ success: false, message: 'Failed to update like status' });
    }
});

// ==========================================
// GET LIKED SONGS
// ==========================================
router.get('/liked', verifyToken, async (req, res) => {
    try {
        const songs = await getMany(`
            SELECT 
                s.*,
                a.name as artist_name,
                al.title as album_title,
                ls.liked_at
            FROM liked_songs ls
            JOIN songs s ON ls.song_id = s.id
            LEFT JOIN artists a ON s.artist_id = a.id
            LEFT JOIN albums al ON s.album_id = al.id
            WHERE ls.user_id = $1
            ORDER BY ls.liked_at DESC
        `, [req.user.id]);

        songs.forEach(song => song.is_liked = true);

        res.json({ success: true, songs });

    } catch (error) {
        console.error('Get liked songs error:', error);
        res.status(500).json({ success: false, message: 'Failed to get liked songs' });
    }
});

// ==========================================
// GET PLAYLISTS
// ==========================================
router.get('/playlists', verifyToken, async (req, res) => {
    try {
        const playlists = await getMany(`
            SELECT 
                p.*,
                COUNT(ps.id) as song_count
            FROM playlists p
            LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
            WHERE p.user_id = $1
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `, [req.user.id]);

        res.json({ success: true, playlists });

    } catch (error) {
        console.error('Get playlists error:', error);
        res.status(500).json({ success: false, message: 'Failed to get playlists' });
    }
});

// ==========================================
// CREATE PLAYLIST
// ==========================================
router.post('/playlists', verifyToken, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Playlist name is required' });
        }

        const result = await execute(
            'INSERT INTO playlists (name, description, user_id) VALUES ($1, $2, $3) RETURNING *',
            [name, description || '', req.user.id]
        );

        res.status(201).json({
            success: true,
            message: 'Playlist created',
            playlist: result.rows[0]
        });

    } catch (error) {
        console.error('Create playlist error:', error);
        res.status(500).json({ success: false, message: 'Failed to create playlist' });
    }
});

// ==========================================
// GET PLAYLIST DETAILS
// ==========================================
router.get('/playlists/:id', optionalAuth, async (req, res) => {
    try {
        const playlist = await getOne('SELECT * FROM playlists WHERE id = $1', [req.params.id]);

        if (!playlist) {
            return res.status(404).json({ success: false, message: 'Playlist not found' });
        }

        if (!playlist.is_public && (!req.user || req.user.id !== playlist.user_id)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const songs = await getMany(`
            SELECT 
                s.*,
                a.name as artist_name,
                al.title as album_title,
                ps.added_at
            FROM playlist_songs ps
            JOIN songs s ON ps.song_id = s.id
            LEFT JOIN artists a ON s.artist_id = a.id
            LEFT JOIN albums al ON s.album_id = al.id
            WHERE ps.playlist_id = $1
            ORDER BY ps.added_at DESC
        `, [req.params.id]);

        res.json({
            success: true,
            playlist: { ...playlist, songs }
        });

    } catch (error) {
        console.error('Get playlist error:', error);
        res.status(500).json({ success: false, message: 'Failed to get playlist' });
    }
});

// ==========================================
// ADD SONG TO PLAYLIST
// ==========================================
router.post('/playlists/:id/songs', verifyToken, async (req, res) => {
    try {
        const { songId } = req.body;
        const playlistId = req.params.id;

        const playlist = await getOne(
            'SELECT * FROM playlists WHERE id = $1 AND user_id = $2',
            [playlistId, req.user.id]
        );
        
        if (!playlist) {
            return res.status(404).json({ success: false, message: 'Playlist not found' });
        }

        const song = await getOne('SELECT id FROM songs WHERE id = $1', [songId]);
        if (!song) {
            return res.status(404).json({ success: false, message: 'Song not found' });
        }

        const existing = await getOne(
            'SELECT id FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2',
            [playlistId, songId]
        );
        
        if (existing) {
            return res.status(400).json({ success: false, message: 'Song already in playlist' });
        }

        await execute(
            'INSERT INTO playlist_songs (playlist_id, song_id) VALUES ($1, $2)',
            [playlistId, songId]
        );

        res.json({ success: true, message: 'Song added to playlist' });

    } catch (error) {
        console.error('Add to playlist error:', error);
        res.status(500).json({ success: false, message: 'Failed to add song to playlist' });
    }
});

// ==========================================
// GET PLAY HISTORY
// ==========================================
router.get('/history', verifyToken, async (req, res) => {
    try {
        const history = await getMany(`
            SELECT DISTINCT ON (s.id)
                s.*,
                a.name as artist_name,
                al.title as album_title,
                ph.played_at
            FROM play_history ph
            JOIN songs s ON ph.song_id = s.id
            LEFT JOIN artists a ON s.artist_id = a.id
            LEFT JOIN albums al ON s.album_id = al.id
            WHERE ph.user_id = $1
            ORDER BY s.id, ph.played_at DESC
            LIMIT 20
        `, [req.user.id]);

        res.json({ success: true, history });

    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ success: false, message: 'Failed to get play history' });
    }
});

// ==========================================
// GET HOME DATA
// ==========================================
router.get('/home', optionalAuth, async (req, res) => {
    try {
        const topSongs = await getMany(`
            SELECT s.*, a.name as artist_name
            FROM songs s
            LEFT JOIN artists a ON s.artist_id = a.id
            ORDER BY s.play_count DESC
            LIMIT 10
        `);

        const newReleases = await getMany(`
            SELECT s.*, a.name as artist_name
            FROM songs s
            LEFT JOIN artists a ON s.artist_id = a.id
            ORDER BY s.created_at DESC
            LIMIT 10
        `);

        const featuredArtists = await getMany(`
            SELECT a.*, COUNT(s.id) as song_count
            FROM artists a
            LEFT JOIN songs s ON a.id = s.artist_id
            GROUP BY a.id
            ORDER BY song_count DESC
            LIMIT 6
        `);

        const featuredAlbums = await getMany(`
            SELECT al.*, a.name as artist_name
            FROM albums al
            LEFT JOIN artists a ON al.artist_id = a.id
            ORDER BY al.release_year DESC
            LIMIT 6
        `);

        res.json({
            success: true,
            data: { topSongs, newReleases, featuredArtists, featuredAlbums }
        });

    } catch (error) {
        console.error('Get home data error:', error);
        res.status(500).json({ success: false, message: 'Failed to get home data' });
    }
});

module.exports = router;
