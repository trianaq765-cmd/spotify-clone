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
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
};

const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
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
    
    // Update username display
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
        userNameEl.textContent = currentUser.username;
    }
    
    // Update premium status
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
    // Sidebar navigation
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            navigateTo(section);
        });
    });
    
    // Create playlist
    document.querySelector('[data-action="create-playlist"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        openCreatePlaylistModal();
    });
    
    // User dropdown
    const userButton = document.getElementById('user-button');
    const dropdownMenu = document.getElementById('dropdown-menu');
    
    userButton?.addEventListener('click', () => {
        dropdownMenu.classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-dropdown')) {
            dropdownMenu?.classList.remove('active');
        }
    });
    
    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    // Search functionality
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
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === section) {
            item.classList.add('active');
        }
    });
    
    // Show/hide search bar
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
        searchContainer.style.display = section === 'search' ? 'block' : 'none';
    }
    
    // Load section content
    switch (section) {
        case 'home':
            loadHomeSection();
            break;
        case 'search':
            loadSearchSection();
            break;
        case 'library':
            loadLibrarySection();
            break;
        case 'liked':
            loadLikedSongs();
            break;
        case 'profile':
            loadProfileSection();
            break;
        default:
            loadHomeSection();
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
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest('/music/home');
        
        if (!data || !data.success) {
            contentArea.innerHTML = '<p>Failed to load content</p>';
            return;
        }
        
        const { topSongs, newReleases, featuredArtists, featuredAlbums } = data.data;
        
        let html = `
            <div class="home-content">
                <h1 class="greeting">${getGreeting()}</h1>
                
                <!-- Quick Access Grid -->
                <div class="quick-access">
                    ${featuredAlbums.slice(0, 6).map(album => `
                        <div class="quick-card" onclick="loadAlbum(${album.id})">
                            <img src="${album.cover_image || '/images/default-album.png'}" alt="${album.title}">
                            <span>${album.title}</span>
                            <button class="card-play-btn" onclick="event.stopPropagation(); playAlbum(${album.id})">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Top Songs Section -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Popular Songs</h2>
                        <a href="#" class="section-link" onclick="navigateTo('search'); return false;">Show all</a>
                    </div>
                    <div class="card-grid">
                        ${topSongs.map(song => createSongCard(song)).join('')}
                    </div>
                </section>
                
                <!-- Featured Artists Section -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Popular Artists</h2>
                    </div>
                    <div class="card-grid">
                        ${featuredArtists.map(artist => `
                            <div class="card" onclick="loadArtist(${artist.id})">
                                <div class="card-image artist">
                                    <img src="${artist.image || '/images/default-artist.png'}" alt="${artist.name}">
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
                
                <!-- New Releases Section -->
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
        contentArea.innerHTML = '<p>Error loading content. Please try again.</p>';
    }
};

const loadSearchSection = async () => {
    const contentArea = document.getElementById('content-area');
    
    try {
        const [songsData, artistsData, albumsData] = await Promise.all([
            apiRequest('/music/songs?limit=20'),
            apiRequest('/music/artists'),
            apiRequest('/music/albums')
        ]);
        
        let html = `
            <div class="search-content">
                <h1>Browse All</h1>
                
                <!-- All Songs -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">All Songs</h2>
                    </div>
                    <div class="song-list">
                        ${songsData.songs.map((song, index) => createSongRow(song, index + 1)).join('')}
                    </div>
                </section>
                
                <!-- All Artists -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Artists</h2>
                    </div>
                    <div class="card-grid">
                        ${artistsData.artists.map(artist => `
                            <div class="card" onclick="loadArtist(${artist.id})">
                                <div class="card-image artist">
                                    <img src="${artist.image || '/images/default-artist.png'}" alt="${artist.name}">
                                    <button class="card-play-btn" onclick="event.stopPropagation(); playArtist(${artist.id})">
                                        <i class="fas fa-play"></i>
                                    </button>
                                </div>
                                <div class="card-title">${artist.name}</div>
                                <div class="card-subtitle">${artist.song_count} songs</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
                
                <!-- All Albums -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Albums</h2>
                    </div>
                    <div class="card-grid">
                        ${albumsData.albums.map(album => `
                            <div class="card" onclick="loadAlbum(${album.id})">
                                <div class="card-image">
                                    <img src="${album.cover_image || '/images/default-album.png'}" alt="${album.title}">
                                    <button class="card-play-btn" onclick="event.stopPropagation(); playAlbum(${album.id})">
                                        <i class="fas fa-play"></i>
                                    </button>
                                </div>
                                <div class="card-title">${album.title}</div>
                                <div class="card-subtitle">${album.artist_name} • ${album.release_year}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            </div>
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading search:', error);
        contentArea.innerHTML = '<p>Error loading content</p>';
    }
};

const searchSongs = async (query) => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest(`/music/songs?search=${encodeURIComponent(query)}`);
        
        if (data.songs.length === 0) {
            contentArea.innerHTML = `
                <div class="search-results">
                    <h1>No results found for "${query}"</h1>
                    <p>Please make sure your words are spelled correctly, or use fewer or different keywords.</p>
                </div>
            `;
            return;
        }
        
        contentArea.innerHTML = `
            <div class="search-results">
                <h1>Results for "${query}"</h1>
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Songs</h2>
                    </div>
                    <div class="song-list">
                        ${data.songs.map((song, index) => createSongRow(song, index + 1)).join('')}
                    </div>
                </section>
            </div>
        `;
        
    } catch (error) {
        console.error('Search error:', error);
        contentArea.innerHTML = '<p>Error searching. Please try again.</p>';
    }
};

const loadLibrarySection = async () => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const [playlistsData, historyData] = await Promise.all([
            apiRequest('/music/playlists'),
            apiRequest('/music/history')
        ]);
        
        let html = `
            <div class="library-content">
                <h1>Your Library</h1>
                
                <!-- Playlists -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Playlists</h2>
                        <button class="btn-secondary" onclick="openCreatePlaylistModal()">
                            <i class="fas fa-plus"></i> Create Playlist
                        </button>
                    </div>
                    ${playlistsData.playlists.length > 0 ? `
                        <div class="card-grid">
                            <div class="card" onclick="navigateTo('liked')">
                                <div class="card-image">
                                    <div class="liked-songs-cover">
                                        <i class="fas fa-heart"></i>
                                    </div>
                                    <button class="card-play-btn">
                                        <i class="fas fa-play"></i>
                                    </button>
                                </div>
                                <div class="card-title">Liked Songs</div>
                                <div class="card-subtitle">Playlist</div>
                            </div>
                            ${playlistsData.playlists.map(playlist => `
                                <div class="card" onclick="loadPlaylist(${playlist.id})">
                                    <div class="card-image">
                                        <img src="${playlist.cover_image || '/images/default-playlist.png'}" alt="${playlist.name}">
                                        <button class="card-play-btn" onclick="event.stopPropagation(); playPlaylist(${playlist.id})">
                                            <i class="fas fa-play"></i>
                                        </button>
                                    </div>
                                    <div class="card-title">${playlist.name}</div>
                                    <div class="card-subtitle">${playlist.song_count} songs</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="empty-state">
                            <i class="fas fa-music"></i>
                            <h3>Create your first playlist</h3>
                            <p>It's easy, we'll help you</p>
                            <button class="btn-primary" onclick="openCreatePlaylistModal()">Create Playlist</button>
                        </div>
                    `}
                </section>
                
                <!-- Recently Played -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Recently Played</h2>
                    </div>
                    ${historyData.history.length > 0 ? `
                        <div class="card-grid">
                            ${historyData.history.map(song => createSongCard(song)).join('')}
                        </div>
                    ` : `
                        <p class="text-subdued">No listening history yet</p>
                    `}
                </section>
            </div>
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading library:', error);
        contentArea.innerHTML = '<p>Error loading library</p>';
    }
};

const loadLikedSongs = async () => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest('/music/liked');
        
        let html = `
            <div class="liked-songs-header" style="background: linear-gradient(transparent 0, rgba(0,0,0,.5) 100%), linear-gradient(135deg, #450af5, #c4efd9); padding: 80px 32px 24px; margin: -24px -32px 24px;">
                <h1 style="font-size: 4rem; margin-bottom: 24px;">Liked Songs</h1>
                <p>${currentUser?.username} • ${data.songs.length} songs</p>
            </div>
            
            ${data.songs.length > 0 ? `
                <div class="section">
                    <button class="btn-primary" onclick="playLikedSongs()" style="margin-bottom: 24px;">
                        <i class="fas fa-play"></i> Play All
                    </button>
                    <div class="song-list">
                        ${data.songs.map((song, index) => createSongRow(song, index + 1)).join('')}
                    </div>
                </div>
            ` : `
                <div class="empty-state" style="text-align: center; padding: 60px;">
                    <i class="fas fa-heart" style="font-size: 4rem; color: var(--text-subdued); margin-bottom: 24px;"></i>
                    <h3>Songs you like will appear here</h3>
                    <p class="text-subdued">Save songs by tapping the heart icon</p>
                </div>
            `}
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading liked songs:', error);
        contentArea.innerHTML = '<p>Error loading liked songs</p>';
    }
};

const loadArtist = async (artistId) => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest(`/music/artists/${artistId}`);
        const artist = data.artist;
        
        let html = `
            <div class="artist-header" style="display: flex; align-items: flex-end; gap: 24px; padding: 40px 0;">
                <img src="${artist.image || '/images/default-artist.png'}" alt="${artist.name}" 
                     style="width: 230px; height: 230px; border-radius: 50%; object-fit: cover; box-shadow: var(--shadow-lg);">
                <div>
                    <span class="text-subdued" style="font-size: 0.9rem;">Artist</span>
                    <h1 style="font-size: 4rem; margin: 16px 0;">${artist.name}</h1>
                    <p class="text-subdued">${artist.bio || ''}</p>
                </div>
            </div>
            
            <div class="section">
                <button class="btn-primary" onclick="playArtist(${artist.id})" style="margin-bottom: 24px;">
                    <i class="fas fa-play"></i> Play
                </button>
                
                <h2 class="section-title">Popular</h2>
                <div class="song-list">
                    ${artist.songs.map((song, index) => createSongRow(song, index + 1)).join('')}
                </div>
            </div>
            
            ${artist.albums.length > 0 ? `
                <section class="section">
                    <h2 class="section-title">Albums</h2>
                    <div class="card-grid">
                        ${artist.albums.map(album => `
                            <div class="card" onclick="loadAlbum(${album.id})">
                                <div class="card-image">
                                    <img src="${album.cover_image || '/images/default-album.png'}" alt="${album.title}">
                                </div>
                                <div class="card-title">${album.title}</div>
                                <div class="card-subtitle">${album.release_year}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            ` : ''}
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading artist:', error);
        contentArea.innerHTML = '<p>Error loading artist</p>';
    }
};

const loadAlbum = async (albumId) => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest(`/music/albums/${albumId}`);
        const album = data.album;
        
        const totalDuration = album.songs.reduce((acc, song) => acc + song.duration, 0);
        
        let html = `
            <div class="album-header" style="display: flex; align-items: flex-end; gap: 24px; padding: 40px 0;">
                <img src="${album.cover_image || '/images/default-album.png'}" alt="${album.title}" 
                     style="width: 230px; height: 230px; border-radius: 4px; object-fit: cover; box-shadow: var(--shadow-lg);">
                <div>
                    <span class="text-subdued" style="font-size: 0.9rem;">Album</span>
                    <h1 style="font-size: 3rem; margin: 16px 0;">${album.title}</h1>
                    <p>
                        <span class="text-bright">${album.artist_name}</span>
                        <span class="text-subdued"> • ${album.release_year} • ${album.songs.length} songs, ${formatDuration(totalDuration)}</span>
                    </p>
                </div>
            </div>
            
            <div class="section">
                <button class="btn-primary" onclick="playAlbum(${album.id})" style="margin-bottom: 24px;">
                    <i class="fas fa-play"></i> Play
                </button>
                
                <div class="song-list">
                    ${album.songs.map((song, index) => createSongRow({...song, artist_name: album.artist_name}, index + 1)).join('')}
                </div>
            </div>
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading album:', error);
        contentArea.innerHTML = '<p>Error loading album</p>';
    }
};

const loadPlaylist = async (playlistId) => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        const data = await apiRequest(`/music/playlists/${playlistId}`);
        const playlist = data.playlist;
        
        let html = `
            <div class="playlist-header" style="display: flex; align-items: flex-end; gap: 24px; padding: 40px 0;">
                <img src="${playlist.cover_image || '/images/default-playlist.png'}" alt="${playlist.name}" 
                     style="width: 230px; height: 230px; border-radius: 4px; object-fit: cover; box-shadow: var(--shadow-lg);">
                <div>
                    <span class="text-subdued" style="font-size: 0.9rem;">Playlist</span>
                    <h1 style="font-size: 3rem; margin: 16px 0;">${playlist.name}</h1>
                    <p class="text-subdued">${playlist.description || ''}</p>
                    <p><span class="text-bright">${currentUser?.username}</span> • ${playlist.songs.length} songs</p>
                </div>
            </div>
            
            <div class="section">
                ${playlist.songs.length > 0 ? `
                    <button class="btn-primary" onclick="playPlaylist(${playlist.id})" style="margin-bottom: 24px;">
                        <i class="fas fa-play"></i> Play
                    </button>
                    <div class="song-list">
                        ${playlist.songs.map((song, index) => createSongRow(song, index + 1)).join('')}
                    </div>
                ` : `
                    <div class="empty-state" style="text-align: center; padding: 40px;">
                        <p>This playlist is empty</p>
                        <p class="text-subdued">Find something you like and add it to this playlist</p>
                    </div>
                `}
            </div>
        `;
        
        contentArea.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading playlist:', error);
        contentArea.innerHTML = '<p>Error loading playlist</p>';
    }
};

const loadProfileSection = async () => {
    const contentArea = document.getElementById('content-area');
    
    let html = `
        <div class="profile-content">
            <div class="profile-header" style="display: flex; align-items: center; gap: 24px; padding: 40px 0;">
                <div class="profile-avatar" style="width: 150px; height: 150px; background: var(--bg-highlight); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-user" style="font-size: 4rem; color: var(--text-subdued);"></i>
                </div>
                <div>
                    <span class="text-subdued">Profile</span>
                    <h1 style="font-size: 3rem; margin: 8px 0;">${currentUser.username}</h1>
                    <p class="text-subdued">${currentUser.email}</p>
                    ${currentUser.is_premium ? `
                        <span style="background: var(--spotify-green); color: #000; padding: 4px 12px; border-radius: 500px; font-size: 0.8rem; font-weight: 700;">
                            PREMIUM
                        </span>
                    ` : ''}
                </div>
            </div>
            
            <div class="section">
                <h2 class="section-title">Account</h2>
                <div style="background: var(--bg-elevated); border-radius: var(--border-radius); padding: 24px; margin-top: 16px;">
                    <div style="margin-bottom: 16px;">
                        <label class="text-subdued" style="font-size: 0.9rem;">Email</label>
                        <p>${currentUser.email}</p>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label class="text-subdued" style="font-size: 0.9rem;">Username</label>
                        <p>${currentUser.username}</p>
                    </div>
                    <div>
                        <label class="text-subdued" style="font-size: 0.9rem;">Subscription</label>
                        <p>${currentUser.is_premium ? 'Premium' : 'Free'}</p>
                    </div>
                    ${!currentUser.is_premium ? `
                        <a href="/premium" class="btn-primary" style="margin-top: 24px;">
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
    return `
        <div class="card" onclick="playSong(${song.id})">
            ${song.is_premium ? '<span class="premium-badge">PREMIUM</span>' : ''}
            <div class="card-image">
                <img src="${song.cover_image || '/images/default-album.png'}" alt="${song.title}">
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
    
    return `
        <div class="song-item ${isPremium}" data-song-id="${song.id}">
            <div class="song-number">${index}</div>
            <div class="song-play-icon" onclick="playSong(${song.id})">
                <i class="fas fa-play"></i>
            </div>
            <div class="song-info">
                <img src="${song.cover_image || '/images/default-album.png'}" alt="${song.title}" class="song-image">
                <div class="song-details">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist_name || 'Unknown Artist'}</div>
                </div>
            </div>
            <div class="song-album">${song.album_title || '-'}</div>
            <div class="song-actions">
                <button class="btn-like-song ${isLiked}" onclick="toggleLike(${song.id}, this)">
                    <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                </button>
                <span class="song-duration">${formatDuration(song.duration)}</span>
            </div>
        </div>
    `;
};

// ==========================================
// PLAYLIST FUNCTIONS
// ==========================================
const openCreatePlaylistModal = () => {
    document.getElementById('create-playlist-modal').classList.add('active');
};

const closeCreatePlaylistModal = () => {
    document.getElementById('create-playlist-modal').classList.remove('active');
    document.getElementById('create-playlist-form').reset();
};

const initPlaylistModal = () => {
    document.getElementById('close-playlist-modal')?.addEventListener('click', closeCreatePlaylistModal);
    document.getElementById('cancel-playlist')?.addEventListener('click', closeCreatePlaylistModal);
    
    document.getElementById('create-playlist-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('playlist-name').value.trim();
        const description = document.getElementById('playlist-description').value.trim();
        
        if (!name) {
            showToast('Please enter a playlist name', 'error');
            return;
        }
        
        try {
            const data = await apiRequest('/music/playlists', {
                method: 'POST',
                body: JSON.stringify({ name, description })
            });
            
            if (data.success) {
                showToast('Playlist created!');
                closeCreatePlaylistModal();
                loadUserPlaylists();
                if (currentSection === 'library') {
                    loadLibrarySection();
                }
            } else {
                showToast(data.message || 'Failed to create playlist', 'error');
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
        
        if (container && data.playlists) {
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
        
        if (data.success) {
            const icon = button.querySelector('i');
            if (data.liked) {
                button.classList.add('liked');
                icon.classList.replace('far', 'fas');
                showToast('Added to Liked Songs');
            } else {
                button.classList.remove('liked');
                icon.classList.replace('fas', 'far');
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
    document.getElementById('premium-modal').classList.add('active');
};

const closePremiumModal = () => {
    document.getElementById('premium-modal').classList.remove('active');
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();
    
    if (isAuthenticated) {
        initNavigation();
        initPlaylistModal();
        loadHomeSection();
        loadUserPlaylists();
        
        // Close premium modal
        document.getElementById('close-premium-modal')?.addEventListener('click', closePremiumModal);
        
        // Close modal on overlay click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }
});
