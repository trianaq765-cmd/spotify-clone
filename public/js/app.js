// ==========================================
// MAIN APPLICATION JAVASCRIPT
// ==========================================

const API_URL = '/api';
let currentSection = 'home';
let currentUser = null;

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const getToken = () => localStorage.getItem('spotify_token');
const getUser = () => {
    const user = localStorage.getItem('spotify_user');
    return user ? JSON.parse(user) : null;
};

const clearAuth = () => {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('spotify_user');
};

const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
};

const getImageUrl = (url, fallbackSeed = 'default') => {
    if (!url || url.startsWith('/images/')) {
        return `https://picsum.photos/seed/${fallbackSeed}/300/300`;
    }
    return url;
};

const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });
        
        if (response.status === 401) {
            clearAuth();
            window.location.href = '/login';
            return null;
        }
        
        return response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
};

// ==========================================
// AUTHENTICATION CHECK
// ==========================================
const checkAuth = async () => {
    const token = getToken();
    if (!token) {
        window.location.href = '/login';
        return false;
    }
    
    try {
        const data = await apiRequest('/auth/me');
        if (data && data.success) {
            currentUser = data.user;
            updateUserUI();
            return true;
        } else {
            clearAuth();
            window.location.href = '/login';
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        clearAuth();
        window.location.href = '/login';
        return false;
    }
};

const updateUserUI = () => {
    if (!currentUser) return;
    
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
        userNameEl.textContent = currentUser.username;
    }
    
    const userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl && currentUser.avatar) {
        userAvatarEl.innerHTML = `<img src="${currentUser.avatar}" alt="${currentUser.username}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user\\'></i>'">`;
    }
    
    const upgradeBtn = document.getElementById('btn-upgrade-top');
    const premiumBanner = document.getElementById('premium-banner');
    
    if (currentUser.is_premium) {
        if (upgradeBtn) upgradeBtn.style.display = 'none';
        if (premiumBanner) premiumBanner.style.display = 'none';
    }
};

// ==========================================
// NAVIGATION
// ==========================================
const initNavigation = () => {
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            navigateTo(section);
        });
    });
    
    document.querySelector('[data-action="create-playlist"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        openCreatePlaylistModal();
    });
    
    const userButton = document.getElementById('user-button');
    const dropdownMenu = document.getElementById('dropdown-menu');
    
    userButton?.addEventListener('click', () => {
        dropdownMenu?.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-dropdown')) {
            dropdownMenu?.classList.remove('active');
        }
    });
    
    document.getElementById('btn-logout')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (e.target.value.trim()) {
                searchSongs(e.target.value.trim());
            } else {
                loadSearchSection();
            }
        }, 500);
    });
};

const navigateTo = (section) => {
    currentSection = section;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === section) {
            item.classList.add('active');
        }
    });
    
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
        searchContainer.style.display = section === 'search' ? 'block' : 'none';
    }
    
    switch (section) {
        case 'home': loadHomeSection(); break;
        case 'search': loadSearchSection(); break;
        case 'library': loadLibrarySection(); break;
        case 'liked': loadLikedSongs(); break;
        case 'profile': loadProfileSection(); break;
        default: loadHomeSection();
    }
};

const logout = async () => {
    try {
        await apiRequest('/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    clearAuth();
    window.location.href = '/login';
};

// ==========================================
// CONTENT LOADERS
// ==========================================
const loadHomeSection = async () => {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest('/music/home');
        
        if (!data || !data.success) {
            contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Failed to load content</p>';
            return;
        }
        
        const { topSongs, newReleases, featuredArtists, featuredAlbums } = data.data;
        
        let html = `
            <div class="home-content">
                <h1 class="greeting">${getGreeting()}</h1>
                
                <div class="quick-access">
                    ${featuredAlbums.slice(0, 6).map(album => `
                        <div class="quick-card" onclick="loadAlbum(${album.id})">
                            <img src="${getImageUrl(album.cover_image, 'album' + album.id)}" 
                                 alt="${album.title}"
                                 onerror="this.src='https://picsum.photos/seed/album${album.id}/300/300'">
                            <span>${album.title}</span>
                            <button class="card-play-btn" onclick="event.stopPropagation(); playAlbum(${album.id})">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Popular Songs</h2>
                        <a href="#" class="section-link" onclick="navigateTo('search'); return false;">Show all</a>
                    </div>
                    <div class="card-grid">
                        ${topSongs.map(song => createSongCard(song)).join('')}
                    </div>
                </section>
                
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Popular Artists</h2>
                    </div>
                    <div class="card-grid">
                        ${featuredArtists.map(artist => `
                            <div class="card" onclick="loadArtist(${artist.id})">
                                <div class="card-image artist">
                                    <img src="${getImageUrl(artist.image, 'artist' + artist.id)}" 
                                         alt="${artist.name}"
                                         onerror="this.src='https://i.pravatar.cc/300?img=${artist.id}'">
                                    <button class="card-play-btn" onclick="event.stopPropagation(); playArtist(${artist.id})">
                                        <i class="fas fa-play"></i>
                                    </button>
                                </div>
                                <div class="card-title">${artist.name}</div>
                                <div class="card-subtitle">Artist</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
                
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">New Releases</h2>
                    </div>
                    <div class="card-grid">
                        ${newReleases.map(song => createSongCard(song)).join('')}
                    </div>
                </section>
            </div>
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading home:', error);
        contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Error loading content</p>';
    }
};

const loadSearchSection = async () => {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const [songsData, artistsData, albumsData] = await Promise.all([
            apiRequest('/music/songs?limit=20'),
            apiRequest('/music/artists'),
            apiRequest('/music/albums')
        ]);
        
        let html = `
            <div class="search-content">
                <h1>Browse All</h1>
                
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">All Songs</h2>
                    </div>
                    <div class="song-list">
                        ${(songsData?.songs || []).map((song, index) => createSongRow(song, index + 1)).join('')}
                    </div>
                </section>
                
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Artists</h2>
                    </div>
                    <div class="card-grid">
                        ${(artistsData?.artists || []).map(artist => `
                            <div class="card" onclick="loadArtist(${artist.id})">
                                <div class="card-image artist">
                                    <img src="${getImageUrl(artist.image, 'artist' + artist.id)}" 
                                         alt="${artist.name}"
                                         onerror="this.src='https://i.pravatar.cc/300?img=${artist.id}'">
                                    <button class="card-play-btn" onclick="event.stopPropagation(); playArtist(${artist.id})">
                                        <i class="fas fa-play"></i>
                                    </button>
                                </div>
                                <div class="card-title">${artist.name}</div>
                                <div class="card-subtitle">${artist.song_count || 0} songs</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
                
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Albums</h2>
                    </div>
                    <div class="card-grid">
                        ${(albumsData?.albums || []).map(album => `
                            <div class="card" onclick="loadAlbum(${album.id})">
                                <div class="card-image">
                                    <img src="${getImageUrl(album.cover_image, 'album' + album.id)}" 
                                         alt="${album.title}"
                                         onerror="this.src='https://picsum.photos/seed/album${album.id}/300/300'">
                                    <button class="card-play-btn" onclick="event.stopPropagation(); playAlbum(${album.id})">
                                        <i class="fas fa-play"></i>
                                    </button>
                                </div>
                                <div class="card-title">${album.title}</div>
                                <div class="card-subtitle">${album.artist_name || 'Various'} • ${album.release_year || ''}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            </div>
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading search:', error);
        contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Error loading content</p>';
    }
};

const searchSongs = async (query) => {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest(`/music/songs?search=${encodeURIComponent(query)}`);
        
        if (!data?.songs || data.songs.length === 0) {
            contentArea.innerHTML = `
                <div style="text-align:center;padding:60px;">
                    <h1>No results found for "${query}"</h1>
                    <p style="color:var(--text-subdued);margin-top:16px;">Try different keywords</p>
                </div>
            `;
            return;
        }
        
        contentArea.innerHTML = `
            <div class="search-results">
                <h1>Results for "${query}"</h1>
                <section class="section" style="margin-top:24px;">
                    <div class="song-list">
                        ${data.songs.map((song, index) => createSongRow(song, index + 1)).join('')}
                    </div>
                </section>
            </div>
        `;
        
    } catch (error) {
        console.error('Search error:', error);
        contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Error searching</p>';
    }
};

const loadLibrarySection = async () => {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const [playlistsData, historyData] = await Promise.all([
            apiRequest('/music/playlists'),
            apiRequest('/music/history')
        ]);
        
        let html = `
            <div class="library-content">
                <h1>Your Library</h1>
                
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Playlists</h2>
                        <button class="btn-secondary" onclick="openCreatePlaylistModal()" style="padding:8px 16px;font-size:0.9rem;">
                            <i class="fas fa-plus"></i> Create
                        </button>
                    </div>
                    <div class="card-grid">
                        <div class="card" onclick="navigateTo('liked')">
                            <div class="card-image">
                                <div class="liked-songs-cover">
                                    <i class="fas fa-heart"></i>
                                </div>
                                <button class="card-play-btn" onclick="event.stopPropagation(); playLikedSongs()">
                                    <i class="fas fa-play"></i>
                                </button>
                            </div>
                            <div class="card-title">Liked Songs</div>
                            <div class="card-subtitle">Playlist</div>
                        </div>
                        ${(playlistsData?.playlists || []).map(playlist => `
                            <div class="card" onclick="loadPlaylist(${playlist.id})">
                                <div class="card-image">
                                    <img src="${getImageUrl(playlist.cover_image, 'playlist' + playlist.id)}" 
                                         alt="${playlist.name}"
                                         onerror="this.src='https://picsum.photos/seed/playlist${playlist.id}/300/300'">
                                    <button class="card-play-btn" onclick="event.stopPropagation(); playPlaylist(${playlist.id})">
                                        <i class="fas fa-play"></i>
                                    </button>
                                </div>
                                <div class="card-title">${playlist.name}</div>
                                <div class="card-subtitle">${playlist.song_count || 0} songs</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
                
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Recently Played</h2>
                    </div>
                    ${(historyData?.history || []).length > 0 ? `
                        <div class="card-grid">
                            ${historyData.history.map(song => createSongCard(song)).join('')}
                        </div>
                    ` : `
                        <p style="color:var(--text-subdued);">No listening history yet</p>
                    `}
                </section>
            </div>
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading library:', error);
        contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Error loading library</p>';
    }
};

const loadLikedSongs = async () => {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest('/music/liked');
        
        let html = `
            <div class="liked-songs-header" style="background: linear-gradient(transparent 0, rgba(0,0,0,.5) 100%), linear-gradient(135deg, #450af5, #c4efd9); padding: 80px 32px 24px; margin: -24px -32px 24px;">
                <h1 style="font-size: 3rem; margin-bottom: 24px;">Liked Songs</h1>
                <p>${currentUser?.username || 'User'} • ${data?.songs?.length || 0} songs</p>
            </div>
            
            ${(data?.songs || []).length > 0 ? `
                <div class="section">
                    <button class="btn-primary" onclick="playLikedSongs()" style="margin-bottom: 24px;">
                        <i class="fas fa-play"></i> Play All
                    </button>
                    <div class="song-list">
                        ${data.songs.map((song, index) => createSongRow(song, index + 1)).join('')}
                    </div>
                </div>
            ` : `
                <div class="empty-state">
                    <i class="fas fa-heart"></i>
                    <h3>Songs you like will appear here</h3>
                    <p>Save songs by tapping the heart icon</p>
                </div>
            `}
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading liked songs:', error);
        contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Error loading liked songs</p>';
    }
};

const loadArtist = async (artistId) => {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest(`/music/artists/${artistId}`);
        if (!data?.success) {
            contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Artist not found</p>';
            return;
        }
        
        const artist = data.artist;
        
        let html = `
            <div class="artist-header" style="display: flex; align-items: flex-end; gap: 24px; padding: 40px 0;">
                <img src="${getImageUrl(artist.image, 'artist' + artist.id)}" 
                     alt="${artist.name}" 
                     style="width: 230px; height: 230px; border-radius: 50%; object-fit: cover; box-shadow: var(--shadow-lg);"
                     onerror="this.src='https://i.pravatar.cc/300?img=${artist.id}'">
                <div>
                    <span style="font-size: 0.9rem; color: var(--text-subdued);">Artist</span>
                    <h1 style="font-size: 3rem; margin: 16px 0;">${artist.name}</h1>
                    <p style="color: var(--text-subdued);">${artist.bio || ''}</p>
                </div>
            </div>
            
            <div class="section">
                <button class="btn-primary" onclick="playArtist(${artist.id})" style="margin-bottom: 24px;">
                    <i class="fas fa-play"></i> Play
                </button>
                
                <h2 class="section-title" style="margin-bottom: 16px;">Popular</h2>
                <div class="song-list">
                    ${(artist.songs || []).map((song, index) => createSongRow({...song, artist_name: artist.name}, index + 1)).join('')}
                </div>
            </div>
            
            ${(artist.albums || []).length > 0 ? `
                <section class="section">
                    <h2 class="section-title">Albums</h2>
                    <div class="card-grid">
                        ${artist.albums.map(album => `
                            <div class="card" onclick="loadAlbum(${album.id})">
                                <div class="card-image">
                                    <img src="${getImageUrl(album.cover_image, 'album' + album.id)}" 
                                         alt="${album.title}"
                                         onerror="this.src='https://picsum.photos/seed/album${album.id}/300/300'">
                                </div>
                                <div class="card-title">${album.title}</div>
                                <div class="card-subtitle">${album.release_year || ''}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            ` : ''}
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading artist:', error);
        contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Error loading artist</p>';
    }
};

const loadAlbum = async (albumId) => {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest(`/music/albums/${albumId}`);
        if (!data?.success) {
            contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Album not found</p>';
            return;
        }
        
        const album = data.album;
        const totalDuration = (album.songs || []).reduce((acc, song) => acc + (song.duration || 0), 0);
        
        let html = `
            <div class="album-header" style="display: flex; align-items: flex-end; gap: 24px; padding: 40px 0;">
                <img src="${getImageUrl(album.cover_image, 'album' + album.id)}" 
                     alt="${album.title}" 
                     style="width: 230px; height: 230px; border-radius: 4px; object-fit: cover; box-shadow: var(--shadow-lg);"
                     onerror="this.src='https://picsum.photos/seed/album${album.id}/300/300'">
                <div>
                    <span style="font-size: 0.9rem; color: var(--text-subdued);">Album</span>
                    <h1 style="font-size: 3rem; margin: 16px 0;">${album.title}</h1>
                    <p>
                        <span style="font-weight: 600;">${album.artist_name || 'Various Artists'}</span>
                        <span style="color: var(--text-subdued);"> • ${album.release_year || ''} • ${(album.songs || []).length} songs, ${formatDuration(totalDuration)}</span>
                    </p>
                </div>
            </div>
            
            <div class="section">
                <button class="btn-primary" onclick="playAlbum(${album.id})" style="margin-bottom: 24px;">
                    <i class="fas fa-play"></i> Play
                </button>
                
                <div class="song-list">
                    ${(album.songs || []).map((song, index) => createSongRow({...song, artist_name: album.artist_name}, index + 1)).join('')}
                </div>
            </div>
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading album:', error);
        contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Error loading album</p>';
    }
};

const loadPlaylist = async (playlistId) => {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest(`/music/playlists/${playlistId}`);
        if (!data?.success) {
            contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Playlist not found</p>';
            return;
        }
        
        const playlist = data.playlist;
        
        let html = `
            <div class="playlist-header" style="display: flex; align-items: flex-end; gap: 24px; padding: 40px 0;">
                <img src="${getImageUrl(playlist.cover_image, 'playlist' + playlist.id)}" 
                     alt="${playlist.name}" 
                     style="width: 230px; height: 230px; border-radius: 4px; object-fit: cover; box-shadow: var(--shadow-lg);"
                     onerror="this.src='https://picsum.photos/seed/playlist${playlist.id}/300/300'">
                <div>
                    <span style="font-size: 0.9rem; color: var(--text-subdued);">Playlist</span>
                    <h1 style="font-size: 3rem; margin: 16px 0;">${playlist.name}</h1>
                    <p style="color: var(--text-subdued);">${playlist.description || ''}</p>
                    <p><span style="font-weight: 600;">${currentUser?.username || 'User'}</span> • ${(playlist.songs || []).length} songs</p>
                </div>
            </div>
            
            <div class="section">
                ${(playlist.songs || []).length > 0 ? `
                    <button class="btn-primary" onclick="playPlaylist(${playlist.id})" style="margin-bottom: 24px;">
                        <i class="fas fa-play"></i> Play
                    </button>
                    <div class="song-list">
                        ${playlist.songs.map((song, index) => createSongRow(song, index + 1)).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <p>This playlist is empty</p>
                        <p style="color: var(--text-subdued);">Find songs you like and add them here</p>
                    </div>
                `}
            </div>
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading playlist:', error);
        contentArea.innerHTML = '<p style="text-align:center;padding:40px;">Error loading playlist</p>';
    }
};

const loadProfileSection = async () => {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    let html = `
        <div class="profile-content">
            <div style="display: flex; align-items: center; gap: 24px; padding: 40px 0;">
                <div style="width: 150px; height: 150px; background: var(--bg-highlight); border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${currentUser?.avatar ? 
                        `<img src="${currentUser.avatar}" alt="${currentUser.username}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user\\' style=\\'font-size:4rem;color:var(--text-subdued)\\'></i>'">` :
                        `<i class="fas fa-user" style="font-size: 4rem; color: var(--text-subdued);"></i>`
                    }
                </div>
                <div>
                    <span style="color: var(--text-subdued);">Profile</span>
                    <h1 style="font-size: 3rem; margin: 8px 0;">${currentUser?.username || 'User'}</h1>
                    <p style="color: var(--text-subdued);">${currentUser?.email || ''}</p>
                    ${currentUser?.is_premium ? `
                        <span style="background: var(--spotify-green); color: #000; padding: 4px 12px; border-radius: 500px; font-size: 0.8rem; font-weight: 700; display: inline-block; margin-top: 8px;">
                            PREMIUM
                        </span>
                    ` : ''}
                </div>
            </div>
            
            <div class="section">
                <h2 class="section-title">Account</h2>
                <div style="background: var(--bg-elevated); border-radius: var(--border-radius); padding: 24px; margin-top: 16px;">
                    <div style="margin-bottom: 16px;">
                        <label style="font-size: 0.9rem; color: var(--text-subdued);">Email</label>
                        <p>${currentUser?.email || '-'}</p>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="font-size: 0.9rem; color: var(--text-subdued);">Username</label>
                        <p>${currentUser?.username || '-'}</p>
                    </div>
                    <div>
                        <label style="font-size: 0.9rem; color: var(--text-subdued);">Subscription</label>
                        <p>${currentUser?.is_premium ? 'Premium' : 'Free'}</p>
                    </div>
                    ${!currentUser?.is_premium ? `
                        <a href="/premium" class="btn-primary" style="margin-top: 24px; display: inline-flex;">
                            <i class="fas fa-crown"></i> Upgrade to Premium
                        </a>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    contentArea.innerHTML = html;
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================
const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
};

const createSongCard = (song) => {
    const coverUrl = getImageUrl(song.cover_image, 'song' + song.id);
    
    return `
        <div class="card" onclick="playSong(${song.id})">
            ${song.is_premium ? '<span class="premium-badge">PREMIUM</span>' : ''}
            <div class="card-image">
                <img src="${coverUrl}" 
                     alt="${song.title}"
                     onerror="this.src='https://picsum.photos/seed/song${song.id}/300/300'">
                <button class="card-play-btn" onclick="event.stopPropagation(); playSong(${song.id})">
                    <i class="fas fa-play"></i>
                </button>
            </div>
            <div class="card-title">${song.title}</div>
            <div class="card-subtitle">${song.artist_name || 'Unknown Artist'}</div>
        </div>
    `;
};

const createSongRow = (song, index) => {
    const isLiked = song.is_liked ? 'liked' : '';
    const isPremium = song.is_premium ? 'premium' : '';
    const coverUrl = getImageUrl(song.cover_image, 'song' + song.id);
    
    return `
        <div class="song-item ${isPremium}" data-song-id="${song.id}">
            <div class="song-number">${index}</div>
            <div class="song-play-icon" onclick="playSong(${song.id})">
                <i class="fas fa-play"></i>
            </div>
            <div class="song-info">
                <img src="${coverUrl}" 
                     alt="${song.title}" 
                     class="song-image"
                     onerror="this.src='https://picsum.photos/seed/song${song.id}/300/300'">
                <div class="song-details">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist_name || 'Unknown Artist'}</div>
                </div>
            </div>
            <div class="song-album">${song.album_title || '-'}</div>
            <div class="song-actions">
                <button class="btn-like-song ${isLiked}" onclick="event.stopPropagation(); toggleLike(${song.id}, this)">
                    <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                </button>
                <span class="song-duration">${formatDuration(song.duration)}</span>
            </div>
        </div>
    `;
};

// ==========================================
// PLAYLIST MODAL
// ==========================================
const openCreatePlaylistModal = () => {
    const modal = document.getElementById('create-playlist-modal');
    if (modal) modal.classList.add('active');
};

const closeCreatePlaylistModal = () => {
    const modal = document.getElementById('create-playlist-modal');
    if (modal) modal.classList.remove('active');
    const form = document.getElementById('create-playlist-form');
    if (form) form.reset();
};

const initPlaylistModal = () => {
    document.getElementById('close-playlist-modal')?.addEventListener('click', closeCreatePlaylistModal);
    document.getElementById('cancel-playlist')?.addEventListener('click', closeCreatePlaylistModal);
    
    document.getElementById('create-playlist-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('playlist-name')?.value?.trim();
        const description = document.getElementById('playlist-description')?.value?.trim();
        
        if (!name) {
            showToast('Please enter a playlist name', 'error');
            return;
        }
        
        try {
            const data = await apiRequest('/music/playlists', {
                method: 'POST',
                body: JSON.stringify({ name, description })
            });
            
            if (data?.success) {
                showToast('Playlist created!');
                closeCreatePlaylistModal();
                loadUserPlaylists();
                if (currentSection === 'library') {
                    loadLibrarySection();
                }
            } else {
                showToast(data?.message || 'Failed to create playlist', 'error');
            }
        } catch (error) {
            console.error('Create playlist error:', error);
            showToast('Error creating playlist', 'error');
        }
    });
};

const loadUserPlaylists = async () => {
    try {
        const data = await apiRequest('/music/playlists');
        const container = document.getElementById('user-playlists');
        
        if (container && data?.playlists) {
            container.innerHTML = data.playlists.map(playlist => `
                <a href="#" class="playlist-item" onclick="loadPlaylist(${playlist.id}); return false;">
                    ${playlist.name}
                </a>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading playlists:', error);
    }
};

// ==========================================
// LIKE FUNCTIONS
// ==========================================
const toggleLike = async (songId, button) => {
    try {
        const data = await apiRequest(`/music/songs/${songId}/like`, {
            method: 'POST'
        });
        
        if (data?.success) {
            const icon = button.querySelector('i');
            if (data.liked) {
                button.classList.add('liked');
                if (icon) icon.className = 'fas fa-heart';
                showToast('Added to Liked Songs');
            } else {
                button.classList.remove('liked');
                if (icon) icon.className = 'far fa-heart';
                showToast('Removed from Liked Songs');
            }
        }
    } catch (error) {
        console.error('Like error:', error);
        showToast('Error updating like', 'error');
    }
};

// ==========================================
// PREMIUM MODAL
// ==========================================
const showPremiumModal = () => {
    const modal = document.getElementById('premium-modal');
    if (modal) modal.classList.add('active');
};

const closePremiumModal = () => {
    const modal = document.getElementById('premium-modal');
    if (modal) modal.classList.remove('active');
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App initializing...');
    
    const isAuthenticated = await checkAuth();
    
    if (isAuthenticated) {
        console.log('User authenticated:', currentUser);
        initNavigation();
        initPlaylistModal();
        loadHomeSection();
        loadUserPlaylists();
        
        document.getElementById('close-premium-modal')?.addEventListener('click', closePremiumModal);
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }
});
