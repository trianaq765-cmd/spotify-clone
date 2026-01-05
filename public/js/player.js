// ==========================================
// MUSIC PLAYER JAVASCRIPT
// ==========================================

let audioPlayer = null;
let currentSong = null;
let playlist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffled = false;
let repeatMode = 0;
let volume = 1;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    audioPlayer = document.getElementById('audio-player');
    
    if (!audioPlayer) {
        console.log('Audio player not found');
        return;
    }
    
    // Audio event listeners
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', handleSongEnd);
    audioPlayer.addEventListener('loadedmetadata', updateDuration);
    audioPlayer.addEventListener('play', () => updatePlayButton(true));
    audioPlayer.addEventListener('pause', () => updatePlayButton(false));
    audioPlayer.addEventListener('error', handleAudioError);
    audioPlayer.addEventListener('canplay', () => {
        console.log('Audio can play');
    });
    
    // Control buttons
    document.getElementById('btn-play')?.addEventListener('click', togglePlay);
    document.getElementById('btn-prev')?.addEventListener('click', playPrevious);
    document.getElementById('btn-next')?.addEventListener('click', playNext);
    document.getElementById('btn-shuffle')?.addEventListener('click', toggleShuffle);
    document.getElementById('btn-repeat')?.addEventListener('click', toggleRepeat);
    document.getElementById('btn-like-current')?.addEventListener('click', toggleCurrentLike);
    
    // Progress bar
    const progressBar = document.getElementById('progress-bar');
    progressBar?.addEventListener('click', seekTo);
    
    // Volume control
    const volumeBar = document.getElementById('volume-bar');
    volumeBar?.addEventListener('click', setVolume);
    document.getElementById('btn-volume')?.addEventListener('click', toggleMute);
    
    // Initialize volume
    const savedVolume = localStorage.getItem('spotify_volume');
    if (savedVolume) {
        volume = parseFloat(savedVolume);
        audioPlayer.volume = volume;
    }
    updateVolumeUI();
    
    console.log('Player initialized');
});

// ==========================================
// PLAY FUNCTIONS
// ==========================================
const playSong = async (songId) => {
    console.log('Playing song:', songId);
    
    try {
        // Get song details first
        const songData = await apiRequest(`/music/songs/${songId}`);
        
        if (!songData || !songData.success) {
            showToast('Song not found', 'error');
            return;
        }
        
        const song = songData.song;
        console.log('Song data:', song);
        
        // Check if premium required
        if (song.is_premium && (!currentUser || !currentUser.is_premium)) {
            showPremiumModal();
            return;
        }
        
        // Request to play
        const playData = await apiRequest(`/music/songs/${songId}/play`, {
            method: 'POST'
        });
        
        if (!playData || !playData.success) {
            if (playData?.requires_premium) {
                showPremiumModal();
            } else {
                showToast(playData?.message || 'Cannot play song', 'error');
            }
            return;
        }
        
        // Set current song
        currentSong = song;
        currentSong.file_path = playData.file_path;
        
        // Update player UI
        updatePlayerUI();
        
        // Play audio
        console.log('Playing audio from:', playData.file_path);
        audioPlayer.src = playData.file_path;
        
        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Audio playing successfully');
                isPlaying = true;
            }).catch(error => {
                console.error('Play error:', error);
                showToast('Click play button to start', 'error');
            });
        }
        
    } catch (error) {
        console.error('Play song error:', error);
        showToast('Error playing song', 'error');
    }
};

const playMultipleSongs = async (songs, startIndex = 0) => {
    if (!songs || songs.length === 0) {
        console.log('No songs to play');
        return;
    }
    
    playlist = songs;
    currentIndex = startIndex;
    
    console.log('Playing playlist with', songs.length, 'songs');
    await playSong(playlist[currentIndex].id);
};

const playAlbum = async (albumId) => {
    try {
        const data = await apiRequest(`/music/albums/${albumId}`);
        if (data && data.success && data.album.songs.length > 0) {
            await playMultipleSongs(data.album.songs);
        }
    } catch (error) {
        console.error('Play album error:', error);
    }
};

const playArtist = async (artistId) => {
    try {
        const data = await apiRequest(`/music/artists/${artistId}`);
        if (data && data.success && data.artist.songs.length > 0) {
            await playMultipleSongs(data.artist.songs);
        }
    } catch (error) {
        console.error('Play artist error:', error);
    }
};

const playPlaylist = async (playlistId) => {
    try {
        const data = await apiRequest(`/music/playlists/${playlistId}`);
        if (data && data.success && data.playlist.songs.length > 0) {
            await playMultipleSongs(data.playlist.songs);
        }
    } catch (error) {
        console.error('Play playlist error:', error);
    }
};

const playLikedSongs = async () => {
    try {
        const data = await apiRequest('/music/liked');
        if (data && data.success && data.songs.length > 0) {
            await playMultipleSongs(data.songs);
        } else {
            showToast('No liked songs yet', 'error');
        }
    } catch (error) {
        console.error('Play liked songs error:', error);
    }
};

// ==========================================
// PLAYBACK CONTROLS
// ==========================================
const togglePlay = () => {
    if (!audioPlayer.src || audioPlayer.src === window.location.href) {
        showToast('Select a song to play', 'error');
        return;
    }
    
    if (audioPlayer.paused) {
        audioPlayer.play().then(() => {
            isPlaying = true;
        }).catch(err => {
            console.error('Play error:', err);
        });
    } else {
        audioPlayer.pause();
        isPlaying = false;
    }
};

const playPrevious = () => {
    if (audioPlayer.currentTime > 3) {
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
    if (btn) {
        btn.classList.toggle('active', isShuffled);
    }
    showToast(isShuffled ? 'Shuffle on' : 'Shuffle off');
};

const toggleRepeat = () => {
    repeatMode = (repeatMode + 1) % 3;
    const btn = document.getElementById('btn-repeat');
    
    if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fas fa-redo"></i>';
        
        if (repeatMode === 1) {
            btn.classList.add('active');
            showToast('Repeat all');
        } else if (repeatMode === 2) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-redo"></i><span style="font-size:0.5rem;position:absolute;margin-left:-8px;">1</span>';
            showToast('Repeat one');
        } else {
            showToast('Repeat off');
        }
    }
};

const handleSongEnd = () => {
    console.log('Song ended');
    
    if (repeatMode === 2) {
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
    if (!audioPlayer.duration || isNaN(audioPlayer.duration)) return;
    
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    const progressEl = document.getElementById('progress');
    if (progressEl) {
        progressEl.style.width = `${progress}%`;
    }
    
    const currentEl = document.getElementById('time-current');
    if (currentEl) {
        currentEl.textContent = formatTime(audioPlayer.currentTime);
    }
};

const updateDuration = () => {
    const totalEl = document.getElementById('time-total');
    if (totalEl && audioPlayer.duration && !isNaN(audioPlayer.duration)) {
        totalEl.textContent = formatTime(audioPlayer.duration);
    }
};

const seekTo = (e) => {
    const bar = document.getElementById('progress-bar');
    if (!bar || !audioPlayer.duration) return;
    
    const rect = bar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = percent * audioPlayer.duration;
};

const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ==========================================
// VOLUME CONTROLS
// ==========================================
const setVolume = (e) => {
    const bar = document.getElementById('volume-bar');
    if (!bar) return;
    
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
        volume = 0;
    } else {
        const prevVol = parseFloat(audioPlayer.dataset.prevVolume) || 1;
        audioPlayer.volume = prevVol;
        volume = prevVol;
    }
    updateVolumeUI();
};

const updateVolumeUI = () => {
    const volumeLevel = document.getElementById('volume-level');
    if (volumeLevel) {
        volumeLevel.style.width = `${volume * 100}%`;
    }
    
    const btn = document.getElementById('btn-volume');
    if (btn) {
        let icon = 'fa-volume-up';
        if (volume === 0) icon = 'fa-volume-mute';
        else if (volume < 0.5) icon = 'fa-volume-down';
        btn.innerHTML = `<i class="fas ${icon}"></i>`;
    }
};

// ==========================================
// UI UPDATES
// ==========================================
const updatePlayerUI = () => {
    if (!currentSong) return;
    
    console.log('Updating player UI with:', currentSong);
    
    // Update cover image
    const coverEl = document.getElementById('player-cover');
    if (coverEl) {
        const coverUrl = currentSong.cover_image || 'https://picsum.photos/seed/default/300/300';
        coverEl.src = coverUrl;
        coverEl.onerror = () => {
            coverEl.src = 'https://picsum.photos/seed/default/300/300';
        };
    }
    
    // Update title
    const titleEl = document.getElementById('player-title');
    if (titleEl) {
        titleEl.textContent = currentSong.title || 'Unknown';
    }
    
    // Update artist
    const artistEl = document.getElementById('player-artist');
    if (artistEl) {
        artistEl.textContent = currentSong.artist_name || 'Unknown Artist';
    }
    
    // Update like button
    const likeBtn = document.getElementById('btn-like-current');
    if (likeBtn) {
        if (currentSong.is_liked) {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<i class="fas fa-heart"></i>';
        } else {
            likeBtn.classList.remove('liked');
            likeBtn.innerHTML = '<i class="far fa-heart"></i>';
        }
    }
};

const updatePlayButton = (playing) => {
    const btn = document.getElementById('btn-play');
    if (btn) {
        btn.innerHTML = playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    }
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
        
        if (data && data.success) {
            currentSong.is_liked = data.liked;
            
            if (data.liked) {
                btn?.classList.add('liked');
                if (btn) btn.innerHTML = '<i class="fas fa-heart"></i>';
                showToast('Added to Liked Songs');
            } else {
                btn?.classList.remove('liked');
                if (btn) btn.innerHTML = '<i class="far fa-heart"></i>';
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
    console.error('Audio src:', audioPlayer.src);
    console.error('Error code:', audioPlayer.error?.code);
    console.error('Error message:', audioPlayer.error?.message);
    
    showToast('Cannot play audio. Try another song.', 'error');
};
