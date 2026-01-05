// ==========================================
// MUSIC PLAYER JAVASCRIPT
// ==========================================

// Player State
let audioPlayer = null;
let currentSong = null;
let playlist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffled = false;
let repeatMode = 0; // 0: off, 1: all, 2: one
let volume = 1;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    audioPlayer = document.getElementById('audio-player');
    
    if (!audioPlayer) return;
    
    // Audio event listeners
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', handleSongEnd);
    audioPlayer.addEventListener('loadedmetadata', updateDuration);
    audioPlayer.addEventListener('play', () => updatePlayButton(true));
    audioPlayer.addEventListener('pause', () => updatePlayButton(false));
    audioPlayer.addEventListener('error', handleAudioError);
    
    // Control buttons
    document.getElementById('btn-play')?.addEventListener('click', togglePlay);
    document.getElementById('btn-prev')?.addEventListener('click', playPrevious);
    document.getElementById('btn-next')?.addEventListener('click', playNext);
    document.getElementById('btn-shuffle')?.addEventListener('click', toggleShuffle);
    document.getElementById('btn-repeat')?.addEventListener('click', toggleRepeat);
    document.getElementById('btn-like-current')?.addEventListener('click', toggleCurrentLike);
    
    // Progress bar
    document.getElementById('progress-bar')?.addEventListener('click', seekTo);
    
    // Volume control
    document.getElementById('volume-bar')?.addEventListener('click', setVolume);
    document.getElementById('btn-volume')?.addEventListener('click', toggleMute);
    
    // Initialize volume
    const savedVolume = localStorage.getItem('spotify_volume');
    if (savedVolume) {
        volume = parseFloat(savedVolume);
        audioPlayer.volume = volume;
        updateVolumeUI();
    }
});

// ==========================================
// PLAY FUNCTIONS
// ==========================================
const playSong = async (songId) => {
    try {
        // Get song details first
        const songData = await apiRequest(`/music/songs/${songId}`);
        
        if (!songData.success) {
            showToast('Song not found', 'error');
            return;
        }
        
        const song = songData.song;
        
        // Check if premium required
        if (song.is_premium && (!currentUser || !currentUser.is_premium)) {
            showPremiumModal();
            return;
        }
        
        // Request to play (increments count and returns file path)
        const playData = await apiRequest(`/music/songs/${songId}/play`, {
            method: 'POST'
        });
        
        if (!playData.success) {
            if (playData.requires_premium) {
                showPremiumModal();
            } else {
                showToast(playData.message || 'Cannot play song', 'error');
            }
            return;
        }
        
        // Set current song
        currentSong = song;
        
        // Update player UI
        updatePlayerUI();
        
        // Play audio
        audioPlayer.src = playData.file_path;
        audioPlayer.play().catch(e => {
            console.error('Play error:', e);
            // For demo, use a sample audio if the file doesn't exist
            audioPlayer.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
            audioPlayer.play();
        });
        
        isPlaying = true;
        
    } catch (error) {
        console.error('Play song error:', error);
        showToast('Error playing song', 'error');
    }
};

const playMultipleSongs = async (songs, startIndex = 0) => {
    if (!songs || songs.length === 0) return;
    
    playlist = songs;
    currentIndex = startIndex;
    
    await playSong(playlist[currentIndex].id);
};

const playAlbum = async (albumId) => {
    try {
        const data = await apiRequest(`/music/albums/${albumId}`);
        if (data.success && data.album.songs.length > 0) {
            await playMultipleSongs(data.album.songs);
        }
    } catch (error) {
        console.error('Play album error:', error);
    }
};

const playArtist = async (artistId) => {
    try {
        const data = await apiRequest(`/music/artists/${artistId}`);
        if (data.success && data.artist.songs.length > 0) {
            await playMultipleSongs(data.artist.songs);
        }
    } catch (error) {
        console.error('Play artist error:', error);
    }
};

const playPlaylist = async (playlistId) => {
    try {
        const data = await apiRequest(`/music/playlists/${playlistId}`);
        if (data.success && data.playlist.songs.length > 0) {
            await playMultipleSongs(data.playlist.songs);
        }
    } catch (error) {
        console.error('Play playlist error:', error);
    }
};

const playLikedSongs = async () => {
    try {
        const data = await apiRequest('/music/liked');
        if (data.success && data.songs.length > 0) {
            await playMultipleSongs(data.songs);
        }
    } catch (error) {
        console.error('Play liked songs error:', error);
    }
};

// ==========================================
// PLAYBACK CONTROLS
// ==========================================
const togglePlay = () => {
    if (!audioPlayer.src) {
        showToast('Select a song to play', 'error');
        return;
    }
    
    if (audioPlayer.paused) {
        audioPlayer.play();
        isPlaying = true;
    } else {
        audioPlayer.pause();
        isPlaying = false;
    }
};

const playPrevious = () => {
    if (audioPlayer.currentTime > 3) {
        // Restart current song if more than 3 seconds played
        audioPlayer.currentTime = 0;
        return;
    }
    
    if (playlist.length > 0) {
        currentIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
        playSong(playlist[currentIndex].id);
    }
};

const playNext = () => {
    if (playlist.length === 0) return;
    
    if (isShuffled) {
        currentIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentIndex = (currentIndex + 1) % playlist.length;
    }
    
    playSong(playlist[currentIndex].id);
};

const toggleShuffle = () => {
    isShuffled = !isShuffled;
    const btn = document.getElementById('btn-shuffle');
    btn.classList.toggle('active', isShuffled);
    showToast(isShuffled ? 'Shuffle on' : 'Shuffle off');
};

const toggleRepeat = () => {
    repeatMode = (repeatMode + 1) % 3;
    const btn = document.getElementById('btn-repeat');
    
    btn.classList.remove('active');
    btn.innerHTML = '<i class="fas fa-redo"></i>';
    
    if (repeatMode === 1) {
        btn.classList.add('active');
        showToast('Repeat all');
    } else if (repeatMode === 2) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-redo"></i><span style="font-size: 0.6rem; position: absolute;">1</span>';
        showToast('Repeat one');
    } else {
        showToast('Repeat off');
    }
};

const handleSongEnd = () => {
    if (repeatMode === 2) {
        // Repeat one
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else if (playlist.length > 0) {
        if (currentIndex < playlist.length - 1 || repeatMode === 1) {
            playNext();
        } else {
            isPlaying = false;
            updatePlayButton(false);
        }
    } else {
        isPlaying = false;
        updatePlayButton(false);
    }
};

// ==========================================
// PROGRESS & SEEK
// ==========================================
const updateProgress = () => {
    if (!audioPlayer.duration) return;
    
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    document.getElementById('progress').style.width = `${progress}%`;
    document.getElementById('time-current').textContent = formatTime(audioPlayer.currentTime);
};

const updateDuration = () => {
    document.getElementById('time-total').textContent = formatTime(audioPlayer.duration);
};

const seekTo = (e) => {
    const bar = document.getElementById('progress-bar');
    const rect = bar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = percent * audioPlayer.duration;
};

const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ==========================================
// VOLUME CONTROLS
// ==========================================
const setVolume = (e) => {
    const bar = document.getElementById('volume-bar');
    const rect = bar.getBoundingClientRect();
    volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioPlayer.volume = volume;
    localStorage.setItem('spotify_volume', volume);
    updateVolumeUI();
};

const toggleMute = () => {
    if (audioPlayer.volume > 0) {
        audioPlayer.dataset.prevVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
    } else {
        audioPlayer.volume = parseFloat(audioPlayer.dataset.prevVolume) || 1;
    }
    volume = audioPlayer.volume;
    updateVolumeUI();
};

const updateVolumeUI = () => {
    document.getElementById('volume-level').style.width = `${volume * 100}%`;
    
    const btn = document.getElementById('btn-volume');
    let icon = 'fa-volume-up';
    if (volume === 0) icon = 'fa-volume-mute';
    else if (volume < 0.5) icon = 'fa-volume-down';
    
    btn.innerHTML = `<i class="fas ${icon}"></i>`;
};

// ==========================================
// UI UPDATES
// ==========================================
const updatePlayerUI = () => {
    if (!currentSong) return;
    
    document.getElementById('player-cover').src = currentSong.cover_image || '/images/default-album.png';
    document.getElementById('player-title').textContent = currentSong.title;
    document.getElementById('player-artist').textContent = currentSong.artist_name || 'Unknown Artist';
    
    // Update like button
    const likeBtn = document.getElementById('btn-like-current');
    if (currentSong.is_liked) {
        likeBtn.classList.add('liked');
        likeBtn.innerHTML = '<i class="fas fa-heart"></i>';
    } else {
        likeBtn.classList.remove('liked');
        likeBtn.innerHTML = '<i class="far fa-heart"></i>';
    }
};

const updatePlayButton = (playing) => {
    const btn = document.getElementById('btn-play');
    btn.innerHTML = playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
};

// ==========================================
// LIKE CURRENT SONG
// ==========================================
const toggleCurrentLike = async () => {
    if (!currentSong) return;
    
    const btn = document.getElementById('btn-like-current');
    
    try {
        const data = await apiRequest(`/music/songs/${currentSong.id}/like`, {
            method: 'POST'
        });
        
        if (data.success) {
            currentSong.is_liked = data.liked;
            
            if (data.liked) {
                btn.classList.add('liked');
                btn.innerHTML = '<i class="fas fa-heart"></i>';
                showToast('Added to Liked Songs');
            } else {
                btn.classList.remove('liked');
                btn.innerHTML = '<i class="far fa-heart"></i>';
                showToast('Removed from Liked Songs');
            }
        }
    } catch (error) {
        console.error('Like error:', error);
    }
};

// ==========================================
// ERROR HANDLING
// ==========================================
const handleAudioError = (e) => {
    console.error('Audio error:', e);
    // Try to play a demo audio for testing
    if (!audioPlayer.src.includes('soundhelix')) {
        audioPlayer.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
        audioPlayer.play().catch(() => {
            showToast('Cannot play audio', 'error');
        });
    }
};
