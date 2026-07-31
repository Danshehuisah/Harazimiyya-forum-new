// ============================================
// HARAZIMIYYA FORUM - GALLERY
// UPDATED: Small Admin can delete ANY content
// FIXED: TikTok-style auto-play + manual play/pause working
// ============================================

console.log("🖼️ Gallery page loading...");

const CLOUDINARY_CONFIG = {
    cloudName: 'df3koezfk',
    uploadPreset: 'community_upload',
    folder: 'community-app',
    subFolders: { image: 'Image', video: 'Video' }
};

function getCloudinaryUploadUrl() { return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`; }
function isCloudinaryUrl(url) { return url && url.includes('cloudinary.com'); }
function getFallbackImageUrl() { return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%230b5e3b"/%3E%3Ctext x="50" y="150" fill="%23ffffff"%3EImage failed%3C/text%3E%3C/svg%3E'; }

let currentUser = null, currentProfile = null, isAdmin = false, isSmallAdmin = false;
let allMedia = [], selectedFile = null, viewedMedia = new Set(), currentLightbox = null;
let mediaReactions = new Map(), autoScrolled = false, currentTheme = 'dark';

// Auto-play video variables
let currentlyPlayingVideo = null, scrollTimeout = null;

// DOM Elements
const sidebar = document.getElementById("sidebar"), overlay = document.getElementById("overlay");
const openSidebar = document.getElementById("openSidebar"), closeSidebar = document.getElementById("closeSidebar");
const logoutBtn = document.getElementById("logoutBtn"), addMediaBtn = document.getElementById("addMediaBtn");
const galleryGrid = document.getElementById("galleryGrid");

let tiktokModal, tiktokTypeImage, tiktokTypeVideo, tiktokMediaTitle, tiktokMediaFile;
let tiktokDropZone, tiktokPreviewArea, tiktokProgress, tiktokSaveBtn, tiktokCancelBtn;
let tiktokCloseBtn, tiktokBrowseBtn, tiktokFileHint, deleteModal = null;
let selectedMediaId = null, selectedMediaUrl = null, selectedMediaType = null;
let contextMenu = null, longPressTimer = null, isLongPressActive = false;
let themeDropdown = null;

const themes = {
    dark: { name: 'Dark', bg: '#000000', text: '#ffffff', primary: '#0b5e3b', headerBg: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)' },
    nature: { name: 'Nature', bg: '#0a2f1f', text: '#e8f5e9', primary: '#4caf50', headerBg: 'linear-gradient(180deg, rgba(10,47,31,0.9) 0%, rgba(10,47,31,0.7) 100%)' }
};

function createThemeDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'theme-dropdown hidden';
    dropdown.id = 'themeDropdown';
    Object.keys(themes).forEach(themeKey => {
        const theme = themes[themeKey];
        const themeBtn = document.createElement('button');
        themeBtn.className = `theme-option ${currentTheme === themeKey ? 'active' : ''}`;
        themeBtn.setAttribute('data-theme', themeKey);
        themeBtn.innerHTML = `<span class="theme-color" style="background: ${theme.primary}"></span><span>${theme.name}</span>${currentTheme === themeKey ? '<i class="fas fa-check"></i>' : ''}`;
        themeBtn.onclick = (e) => { e.stopPropagation(); applyTheme(themeKey); themeDropdown.classList.add('hidden'); };
        dropdown.appendChild(themeBtn);
    });
    document.body.appendChild(dropdown);
    return dropdown;
}

function applyTheme(themeKey) {
    currentTheme = themeKey;
    const theme = themes[themeKey];
    document.documentElement.style.setProperty('--bg', theme.bg);
    document.documentElement.style.setProperty('--text-main', theme.text);
    document.documentElement.style.setProperty('--primary', theme.primary);
    document.body.style.background = theme.bg;
    document.body.setAttribute('data-theme', themeKey);
    const topBar = document.querySelector('.top-bar');
    if (topBar) topBar.style.background = theme.headerBg;
    localStorage.setItem('selectedTheme', themeKey);
    showNotification(`Theme changed to ${theme.name}`, 'success');
}

function toggleThemeDropdown(event) {
    event.stopPropagation();
    if (!themeDropdown) themeDropdown = createThemeDropdown();
    const btnPos = event.target.getBoundingClientRect();
    themeDropdown.style.top = (btnPos.bottom + 8) + 'px';
    themeDropdown.style.right = (window.innerWidth - btnPos.right) + 'px';
    themeDropdown.classList.toggle('hidden');
}

if (openSidebar) openSidebar.addEventListener('click', () => { sidebar.classList.add("active"); overlay.classList.add("active"); });
if (closeSidebar) closeSidebar.addEventListener('click', () => { sidebar.classList.remove("active"); overlay.classList.remove("active"); });
if (overlay) overlay.addEventListener('click', () => { sidebar.classList.remove("active"); overlay.classList.remove("active"); });

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function autoScrollToMedia() {
    if (!galleryGrid || autoScrolled || allMedia.length === 0) return;
    setTimeout(() => {
        let firstUnreadIndex = -1;
        for (let i = 0; i < allMedia.length; i++) { if (!viewedMedia.has(allMedia[i].id)) { firstUnreadIndex = i; break; } }
        if (firstUnreadIndex !== -1) {
            const mediaCards = galleryGrid.querySelectorAll('.media-card');
            if (mediaCards[firstUnreadIndex]) { mediaCards[firstUnreadIndex].scrollIntoView({ behavior: 'smooth', block: 'start' }); markMediaAsViewed(allMedia[firstUnreadIndex].id); }
        } else { galleryGrid.scrollTo({ top: galleryGrid.scrollHeight, behavior: 'smooth' }); if (allMedia.length > 0) markMediaAsViewed(allMedia[allMedia.length - 1].id); }
        autoScrolled = true;
    }, 500);
}

function markMediaAsViewed(mediaId) {
    if (!viewedMedia.has(mediaId)) {
        viewedMedia.add(mediaId);
        const mediaElement = document.querySelector(`.media-card[data-media-id="${mediaId}"]`);
        if (mediaElement) mediaElement.classList.remove('unseen');
        try { const viewed = JSON.parse(localStorage.getItem('viewedGalleryMedia') || '[]'); if (!viewed.includes(mediaId)) { viewed.push(mediaId); localStorage.setItem('viewedGalleryMedia', JSON.stringify(viewed)); } } catch (e) {}
    }
}

function loadViewedMedia() { try { const viewed = JSON.parse(localStorage.getItem('viewedGalleryMedia') || '[]'); viewed.forEach(id => viewedMedia.add(id)); } catch (e) {} }

async function loadReactions() {
    try {
        const { data, error } = await supabase.from('media_reactions').select('*');
        if (error) throw error;
        const reactionsMap = new Map();
        data.forEach(reaction => {
            if (!reactionsMap.has(reaction.media_id)) reactionsMap.set(reaction.media_id, { love: 0, like: 0, userReacted: null });
            const mr = reactionsMap.get(reaction.media_id);
            if (reaction.reaction_type === 'love') mr.love++;
            else if (reaction.reaction_type === 'like') mr.like++;
            if (reaction.user_id === currentUser?.id) mr.userReacted = reaction.reaction_type;
        });
        mediaReactions = reactionsMap;
        allMedia.forEach(item => updateMediaReactions(item.id));
    } catch (e) { console.error("Error loading reactions:", e); }
}

async function addReaction(mediaId, reactionType) {
    if (!currentUser) { showNotification('Please login to react', 'error'); return; }
    try {
        const { data: existing } = await supabase.from('media_reactions').select('*').eq('media_id', mediaId).eq('user_id', currentUser.id).eq('reaction_type', reactionType).maybeSingle();
        if (existing) { await supabase.from('media_reactions').delete().eq('id', existing.id); showNotification(`${reactionType} removed`, 'info'); }
        else {
            const { data: otherReaction } = await supabase.from('media_reactions').select('*').eq('media_id', mediaId).eq('user_id', currentUser.id).maybeSingle();
            if (otherReaction) await supabase.from('media_reactions').delete().eq('id', otherReaction.id);
            await supabase.from('media_reactions').insert([{ media_id: mediaId, user_id: currentUser.id, reaction_type: reactionType }]);
            showNotification(`Added ${reactionType}`, 'success');
        }
        await loadReactions();
    } catch (err) { console.error("Error adding reaction:", err); showNotification('Error adding reaction', 'error'); }
}

function updateMediaReactions(mediaId) {
    const mediaCard = document.querySelector(`.media-card[data-media-id="${mediaId}"]`);
    if (!mediaCard) return;
    const reactions = mediaReactions.get(mediaId);
    if (!reactions || (reactions.love === 0 && reactions.like === 0)) return;
    const existing = mediaCard.querySelector('.media-reactions');
    if (existing) existing.remove();
    const reactionsDiv = document.createElement('div');
    reactionsDiv.className = 'media-reactions';
    if (reactions.love > 0) { const loveDiv = document.createElement('div'); loveDiv.className = `reaction-icon love ${reactions.userReacted === 'love' ? 'active' : ''}`; loveDiv.innerHTML = '❤️'; if (reactions.love > 1) { const count = document.createElement('span'); count.className = 'reaction-count'; count.textContent = reactions.love; loveDiv.appendChild(count); } reactionsDiv.appendChild(loveDiv); }
    if (reactions.like > 0) { const likeDiv = document.createElement('div'); likeDiv.className = `reaction-icon like ${reactions.userReacted === 'like' ? 'active' : ''}`; likeDiv.innerHTML = '👍'; if (reactions.like > 1) { const count = document.createElement('span'); count.className = 'reaction-count'; count.textContent = reactions.like; likeDiv.appendChild(count); } reactionsDiv.appendChild(likeDiv); }
    mediaCard.appendChild(reactionsDiv);
}

function createDeleteModal() {
    const deleteModalHTML = `<div id="deleteModal" class="modal hidden"><div class="modal-content delete-modal"><i class="fas fa-exclamation-triangle" style="font-size: 48px;"></i><h3>Delete Media?</h3><p>This will permanently delete from Cloudinary and the gallery.</p><div class="modal-actions"><button id="confirmDeleteBtn" class="primary-btn" style="background: #dc3545;">Delete</button><button id="cancelDeleteBtn" class="ghost-btn">Cancel</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', deleteModalHTML);
    deleteModal = document.getElementById('deleteModal');
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => { deleteModal.classList.add('hidden'); selectedMediaId = null; selectedMediaUrl = null; selectedMediaType = null; });
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
}

async function downloadMedia(url, filename) {
    try {
        showNotification('Downloading...', 'info');
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename || 'media';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        showNotification('Download complete!', 'success');
    } catch (error) { showNotification('Download failed', 'error'); }
}

function createContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'longpress-menu hidden';
    menu.id = 'contextMenu';
    document.body.appendChild(menu);
    return menu;
}

function showContextMenu(event, mediaId) {
    event.preventDefault();
    event.stopPropagation();
    isLongPressActive = true;
    if (contextMenu) { contextMenu.remove(); contextMenu = null; }
    const video = event.target.closest('.media-card')?.querySelector('video');
    if (video && !video.paused) video.pause();
    const mediaCard = event.target.closest('.media-card');
    if (mediaCard) mediaCard.classList.add('menu-open');
    contextMenu = createContextMenu();
    const media = allMedia.find(m => m.id === mediaId);
    const canDelete = isAdmin || isSmallAdmin || (media && media.uploaded_by === currentUser?.id);
    let filename = media?.title || 'media';
    filename += media?.media_type === 'image' ? '.jpg' : '.mp4';
    let menuItems = `<button class="longpress-menu-item love-item" data-action="love" data-media-id="${mediaId}"><i class="fas fa-heart"></i><span>Love</span></button><button class="longpress-menu-item like-item" data-action="like" data-media-id="${mediaId}"><i class="fas fa-thumbs-up"></i><span>Like</span></button><button class="longpress-menu-item download-item" data-action="download" data-media-id="${mediaId}" data-filename="${filename}"><i class="fas fa-download"></i><span>Download</span></button>`;
    if (canDelete) menuItems += `<button class="longpress-menu-item delete-item" data-action="delete" data-media-id="${mediaId}"><i class="fas fa-trash"></i><span>Delete</span></button>`;
    contextMenu.innerHTML = menuItems;
    contextMenu.querySelectorAll('.longpress-menu-item').forEach(item => { item.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const action = item.dataset.action; const mid = item.dataset.mediaId; const fname = item.dataset.filename; const m = allMedia.find(m => m.id === mid); switch(action) { case 'love': addReaction(mid, 'love'); break; case 'like': addReaction(mid, 'like'); break; case 'download': if (m) downloadMedia(m.media_url, fname); break; case 'delete': openDeleteModal(mid); break; } hideContextMenu(); }); item.addEventListener('touchend', (e) => e.stopPropagation()); });
    const centerX = window.innerWidth / 2, centerY = window.innerHeight / 2;
    contextMenu.style.left = centerX + 'px';
    contextMenu.style.top = centerY + 'px';
    contextMenu.style.transform = 'translate(-50%, -50%)';
    contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
    if (contextMenu) { contextMenu.classList.add('hidden'); document.querySelectorAll('.media-card').forEach(card => card.classList.remove('menu-open')); setTimeout(() => { if (contextMenu && contextMenu.parentNode) { contextMenu.remove(); contextMenu = null; } }, 300); }
    setTimeout(() => { isLongPressActive = false; }, 500);
}

function setupContextMenu(element, mediaId) {
    let touchStart = 0, touchStartX, touchStartY, longPressTriggered = false;
    element.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); showContextMenu(e, mediaId); return false; });
    element.addEventListener('touchstart', (e) => { if (isLongPressActive) { e.preventDefault(); return; } touchStart = Date.now(); touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; longPressTriggered = false; if (longPressTimer) clearTimeout(longPressTimer); longPressTimer = setTimeout(() => { longPressTriggered = true; if (navigator.vibrate) navigator.vibrate(50); showContextMenu(e, mediaId); }, 500); }, { passive: true });
    element.addEventListener('touchmove', (e) => { if (touchStartX && touchStartY && !longPressTriggered) { const moveX = Math.abs(e.touches[0].clientX - touchStartX), moveY = Math.abs(e.touches[0].clientY - touchStartY); if (moveX > 20 || moveY > 20) { clearTimeout(longPressTimer); longPressTimer = null; } } }, { passive: true });
    element.addEventListener('touchend', (e) => { clearTimeout(longPressTimer); longPressTimer = null; if (longPressTriggered) { e.preventDefault(); e.stopPropagation(); } longPressTriggered = false; }, { passive: false });
    element.addEventListener('touchcancel', () => { clearTimeout(longPressTimer); longPressTimer = null; longPressTriggered = false; });
}

document.addEventListener('click', (e) => { if (contextMenu && !contextMenu.contains(e.target) && !e.target.closest('.longpress-menu-item')) hideContextMenu(); });
document.addEventListener('touchstart', (e) => { if (contextMenu && !contextMenu.contains(e.target) && !e.target.closest('.longpress-menu-item')) { setTimeout(() => { if (contextMenu && !contextMenu.contains(e.target)) hideContextMenu(); }, 100); } }, { passive: true });

function createLightbox(src, type, mediaId, title) {
    if (currentLightbox) closeLightbox();
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox-modal';
    lightbox.setAttribute('data-media-id', mediaId);
    let filename = title || 'media';
    filename += type === 'image' ? '.jpg' : '.mp4';
    if (type === 'image') { lightbox.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:contain;" onerror="this.src='${getFallbackImageUrl()}'"><button class="lightbox-close"><i class="fas fa-times"></i></button><button class="lightbox-download" onclick="downloadMedia('${src}', '${filename}')"><i class="fas fa-download"></i> Download</button>`; }
    else { lightbox.innerHTML = `<video src="${src}" controls autoplay playsinline style="width:100%;height:100%;object-fit:contain;"></video><button class="lightbox-close"><i class="fas fa-times"></i></button><button class="lightbox-download" onclick="downloadMedia('${src}', '${filename}')"><i class="fas fa-download"></i> Download</button>`; }
    document.body.appendChild(lightbox);
    currentLightbox = lightbox;
    if (mediaId) markMediaAsViewed(mediaId);
    const closeBtn = lightbox.querySelector('.lightbox-close');
    if (closeBtn) closeBtn.onclick = closeLightbox;
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
}

function closeLightbox() { if (currentLightbox) { currentLightbox.remove(); currentLightbox = null; } }

function handleImageError(mediaId) { const img = document.querySelector(`.media-card[data-media-id="${mediaId}"] img.media-preview`); if (img) img.src = getFallbackImageUrl(); }

function createMediaCard(item) {
    const card = document.createElement("div");
    card.className = `media-card ${item.media_type}`;
    card.dataset.mediaId = item.id;
    if (!viewedMedia.has(item.id)) card.classList.add('unseen');
    const date = new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const uploaderName = item.uploader?.full_name || 'Unknown';
    const isCloudinary = isCloudinaryUrl(item.media_url);
    if (item.media_type === 'image') {
        card.innerHTML = `<span class="media-badge"><i class="fas fa-image"></i> Image</span><img src="${item.media_url}" alt="${item.title}" class="media-preview" loading="lazy" onerror="handleImageError('${item.id}')"><div class="media-info"><h4>${item.title}</h4><div class="media-meta"><span><i class="fas fa-calendar"></i> ${date}</span><span><i class="fas fa-eye"></i> ${item.views || 0}</span>${isCloudinary ? '<span><i class="fas fa-cloud"></i> Cloud</span>' : ''}</div><div class="media-uploader"><i class="fas fa-user"></i><span>Uploaded by: <strong>${uploaderName}</strong></span></div></div>`;
        const img = card.querySelector('img');
        if (img) setupContextMenu(img, item.id);
    } else {
        card.innerHTML = `<span class="media-badge"><i class="fas fa-video"></i> Video</span><div class="video-container" data-media-id="${item.id}"><video src="${item.media_url}" class="media-preview" playsinline preload="metadata" poster="${item.thumbnail_url || ''}"><source src="${item.media_url}" type="video/mp4"></video><div class="seek-control"><div class="seek-progress"><div class="seek-progress-fill"></div></div><div class="seek-handle"><i class="fas fa-circle"></i></div><div class="seek-time">0:00 / 0:00</div></div><div class="play-pause-btn"><i class="fas fa-play"></i></div></div><div class="media-info"><h4>${item.title}</h4><div class="media-meta"><span><i class="fas fa-calendar"></i> ${date}</span><span><i class="fas fa-eye"></i> ${item.views || 0}</span>${isCloudinary ? '<span><i class="fas fa-cloud"></i> Cloud</span>' : ''}</div><div class="media-uploader"><i class="fas fa-user"></i><span>Uploaded by: <strong>${uploaderName}</strong></span></div></div>`;
        const videoContainer = card.querySelector('.video-container');
        if (videoContainer) { setupContextMenu(videoContainer, item.id); setupVideoControls(card, item.id); }
    }
    return card;
}

// ================= FIXED: Video Controls with Auto-Play + Manual Play Working =================
function setupVideoControls(card, mediaId) {
    const video = card.querySelector('video');
    const videoContainer = card.querySelector('.video-container');
    const playPauseBtn = card.querySelector('.play-pause-btn');
    const seekControl = card.querySelector('.seek-control');
    const seekProgress = card.querySelector('.seek-progress-fill');
    const seekHandle = card.querySelector('.seek-handle');
    const seekTime = card.querySelector('.seek-time');
    
    if (!video) return;
    
    let isSeeking = false;
    let hideControlsTimeout;
    let userPaused = false;
    
    videoContainer.dataset.userPaused = 'false';
    
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    function updateSeekBar() {
        if (!isSeeking && video.duration) {
            const percent = (video.currentTime / video.duration) * 100;
            seekProgress.style.width = percent + '%';
            seekHandle.style.left = percent + '%';
            seekTime.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
        }
    }
    
    function showControls() {
        seekControl.classList.add('visible');
        playPauseBtn.classList.add('visible');
        clearTimeout(hideControlsTimeout);
        hideControlsTimeout = setTimeout(() => {
            if (!isSeeking && !card.classList.contains('menu-open')) {
                seekControl.classList.remove('visible');
                playPauseBtn.classList.remove('visible');
            }
        }, 3000);
    }
    
    function togglePlay() {
        if (card.classList.contains('menu-open')) return;
        if (video.paused) {
            video.play();
            videoContainer.dataset.userPaused = 'false';
            userPaused = false;
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            video.pause();
            videoContainer.dataset.userPaused = 'true';
            userPaused = true;
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
        showControls();
    }
    
    video.addEventListener('timeupdate', updateSeekBar);
    video.addEventListener('loadedmetadata', () => { seekTime.textContent = `0:00 / ${formatTime(video.duration)}`; });
    video.addEventListener('play', () => { playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>'; showControls(); });
    video.addEventListener('pause', () => { playPauseBtn.innerHTML = '<i class="fas fa-play"></i>'; showControls(); });
    
    videoContainer.addEventListener('click', (e) => {
        if (card.classList.contains('menu-open')) { e.preventDefault(); e.stopPropagation(); return; }
        if (e.target.closest('.seek-control') || e.target.closest('.seek-handle')) return;
        togglePlay();
    });
    
    if (playPauseBtn) {
        const newBtn = playPauseBtn.cloneNode(true);
        playPauseBtn.parentNode.replaceChild(newBtn, playPauseBtn);
        newBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
    }
    
    function handleSeekStart(e) { e.preventDefault(); e.stopPropagation(); isSeeking = true; seekControl.classList.add('seeking'); if (!video.paused) video.pause(); }
    function handleSeekMove(e) { if (!isSeeking) return; e.preventDefault(); e.stopPropagation(); let clientX = e.touches ? e.touches[0].clientX : e.clientX; const rect = seekControl.getBoundingClientRect(); let percent = (clientX - rect.left) / rect.width; percent = Math.max(0, Math.min(1, percent)); seekProgress.style.width = (percent * 100) + '%'; seekHandle.style.left = (percent * 100) + '%'; if (video.duration) { const newTime = percent * video.duration; video.currentTime = newTime; seekTime.textContent = `${formatTime(newTime)} / ${formatTime(video.duration)}`; } }
    function handleSeekEnd(e) { if (!isSeeking) return; e.preventDefault(); e.stopPropagation(); isSeeking = false; seekControl.classList.remove('seeking'); if (playPauseBtn.innerHTML.includes('pause') && !card.classList.contains('menu-open')) video.play(); showControls(); }
    
    seekControl.addEventListener('touchstart', handleSeekStart, { passive: false });
    seekControl.addEventListener('touchmove', handleSeekMove, { passive: false });
    seekControl.addEventListener('touchend', handleSeekEnd);
    seekControl.addEventListener('touchcancel', handleSeekEnd);
    seekControl.addEventListener('mousedown', handleSeekStart);
    window.addEventListener('mousemove', handleSeekMove);
    window.addEventListener('mouseup', handleSeekEnd);
    videoContainer.addEventListener('touchstart', () => { if (!card.classList.contains('menu-open')) setTimeout(() => { if (!contextMenu) showControls(); }, 100); }, { passive: true });
    showControls();
}

// ================= AUTO-PLAY ON SCROLL (TikTok Style) =================
function playVisibleVideo() {
    if (!galleryGrid) return;
    const videoContainers = galleryGrid.querySelectorAll('.video-container');
    if (videoContainers.length === 0) return;
    let visibleVideo = null, closestDistance = Infinity;
    videoContainers.forEach(container => {
        const rect = container.getBoundingClientRect();
        const containerCenter = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const distance = Math.abs(containerCenter - viewportCenter);
        if (rect.top < window.innerHeight && rect.bottom > 0 && distance < closestDistance) { closestDistance = distance; visibleVideo = container; }
    });
    if (visibleVideo && visibleVideo !== currentlyPlayingVideo) {
        if (currentlyPlayingVideo) { const prevVideo = currentlyPlayingVideo.querySelector('video'); if (prevVideo && !prevVideo.paused) prevVideo.pause(); }
        const newVideo = visibleVideo.querySelector('video');
        const userPaused = visibleVideo.dataset.userPaused === 'true';
        if (newVideo && !userPaused && newVideo.paused) newVideo.play().catch(err => console.log("Auto-play prevented:", err));
        currentlyPlayingVideo = visibleVideo;
    }
}

function setupAutoPlayVideos() {
    if (!galleryGrid) return;
    function handleScroll() { if (scrollTimeout) clearTimeout(scrollTimeout); scrollTimeout = setTimeout(playVisibleVideo, 100); }
    galleryGrid.addEventListener('scroll', handleScroll);
    galleryGrid.addEventListener('touchmove', handleScroll);
    galleryGrid.addEventListener('scrollend', playVisibleVideo);
    setTimeout(playVisibleVideo, 500);
    const observer = new MutationObserver(() => setTimeout(playVisibleVideo, 300));
    observer.observe(galleryGrid, { childList: true, subtree: true });
}

function setupTikTokVideoControls(card, mediaId) { setupVideoControls(card, mediaId); }

function initTikTokModal() {
    tiktokModal = document.getElementById('tiktokUploadModal');
    tiktokTypeImage = document.getElementById('tiktokTypeImage');
    tiktokTypeVideo = document.getElementById('tiktokTypeVideo');
    tiktokMediaTitle = document.getElementById('tiktokMediaTitle');
    tiktokMediaFile = document.getElementById('tiktokMediaFile');
    tiktokDropZone = document.getElementById('tiktokDropZone');
    tiktokPreviewArea = document.getElementById('tiktokPreviewArea');
    tiktokProgress = document.getElementById('tiktokProgress');
    tiktokSaveBtn = document.getElementById('tiktokSaveMediaBtn');
    tiktokCancelBtn = document.getElementById('tiktokCancelBtn');
    tiktokCloseBtn = document.getElementById('closeTiktokModal');
    tiktokBrowseBtn = document.getElementById('tiktokBrowseBtn');
    tiktokFileHint = document.getElementById('tiktokFileHint');
    if (!tiktokModal) { console.error("TikTok modal not found!"); return; }
    setupTikTokEventListeners();
}

function setupTikTokEventListeners() {
    if (tiktokTypeImage) tiktokTypeImage.addEventListener('click', (e) => { e.preventDefault(); setMediaType('image'); });
    if (tiktokTypeVideo) tiktokTypeVideo.addEventListener('click', (e) => { e.preventDefault(); setMediaType('video'); });
    if (tiktokMediaFile) tiktokMediaFile.addEventListener('change', handleTikTokFileSelect);
    if (tiktokDropZone) { tiktokDropZone.addEventListener('dragover', (e) => { e.preventDefault(); tiktokDropZone.classList.add('dragover'); }); tiktokDropZone.addEventListener('dragleave', () => tiktokDropZone.classList.remove('dragover')); tiktokDropZone.addEventListener('drop', (e) => { e.preventDefault(); tiktokDropZone.classList.remove('dragover'); const files = e.dataTransfer.files; if (files.length > 0 && tiktokMediaFile) { tiktokMediaFile.files = files; handleTikTokFileSelect({ target: { files: files } }); } }); }
    if (tiktokBrowseBtn) tiktokBrowseBtn.addEventListener('click', (e) => { e.preventDefault(); if (tiktokMediaFile) tiktokMediaFile.click(); });
    if (tiktokSaveBtn) tiktokSaveBtn.addEventListener('click', (e) => { e.preventDefault(); saveTikTokMedia(); });
    if (tiktokCancelBtn) tiktokCancelBtn.addEventListener('click', (e) => { e.preventDefault(); closeTikTokModal(); });
    if (tiktokCloseBtn) tiktokCloseBtn.addEventListener('click', (e) => { e.preventDefault(); closeTikTokModal(); });
    if (tiktokModal) tiktokModal.addEventListener('click', (e) => { if (e.target === tiktokModal) closeTikTokModal(); });
}

function setMediaType(type) {
    if (type === 'image') { if (tiktokTypeImage) tiktokTypeImage.classList.add('active'); if (tiktokTypeVideo) tiktokTypeVideo.classList.remove('active'); if (tiktokMediaFile) tiktokMediaFile.accept = 'image/*'; if (tiktokFileHint) tiktokFileHint.textContent = 'Supports: JPG, PNG, GIF (Max 50MB)'; }
    else { if (tiktokTypeVideo) tiktokTypeVideo.classList.add('active'); if (tiktokTypeImage) tiktokTypeImage.classList.remove('active'); if (tiktokMediaFile) tiktokMediaFile.accept = 'video/*'; if (tiktokFileHint) tiktokFileHint.textContent = 'Supports: MP4 (Max 50MB)'; }
    if (tiktokMediaFile) tiktokMediaFile.value = '';
    if (tiktokPreviewArea) tiktokPreviewArea.innerHTML = '';
    selectedFile = null;
}

function handleTikTokFileSelect(e) {
    const file = e.target.files[0];
    if (!file) { if (tiktokPreviewArea) tiktokPreviewArea.innerHTML = ''; selectedFile = null; return; }
    selectedFile = file;
    if (file.size > 50 * 1024 * 1024) { showNotification('File too large. Maximum size is 50MB.', 'error'); if (tiktokMediaFile) tiktokMediaFile.value = ''; selectedFile = null; return; }
    const isImage = tiktokTypeImage ? tiktokTypeImage.classList.contains('active') : true;
    if (isImage && !file.type.startsWith('image/')) { showNotification('Please select an image file', 'error'); if (tiktokMediaFile) tiktokMediaFile.value = ''; selectedFile = null; return; }
    if (!isImage && !file.type.startsWith('video/')) { showNotification('Please select a video file', 'error'); if (tiktokMediaFile) tiktokMediaFile.value = ''; selectedFile = null; return; }
    displayTikTokPreview(file);
}

function displayTikTokPreview(file) {
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    const isImage = file.type.startsWith('image/');
    let previewHTML = `<div class="tiktok-file-preview">${isImage ? `<img src="${URL.createObjectURL(file)}" class="tiktok-preview-thumb" alt="Preview">` : `<div class="tiktok-preview-thumb" style="background:#0b5e3b;display:flex;align-items:center;justify-content:center;"><i class="fas fa-video" style="font-size:30px;color:white;"></i></div>`}<div class="tiktok-preview-info"><div class="tiktok-preview-name">${file.name}</div><div class="tiktok-preview-size"><i class="fas fa-weight-hanging"></i> ${fileSize} MB</div></div><button class="tiktok-change-file" type="button">Change</button></div>`;
    if (isImage) { const reader = new FileReader(); reader.onload = (e) => { previewHTML += `<div class="tiktok-image-preview"><img src="${e.target.result}" alt="Full preview"></div>`; if (tiktokPreviewArea) tiktokPreviewArea.innerHTML = previewHTML; const changeBtn = tiktokPreviewArea ? tiktokPreviewArea.querySelector('.tiktok-change-file') : null; if (changeBtn) changeBtn.addEventListener('click', () => { if (tiktokMediaFile) tiktokMediaFile.click(); }); }; reader.readAsDataURL(file); }
    else { const videoURL = URL.createObjectURL(file); previewHTML += `<div class="tiktok-video-preview"><video src="${videoURL}" controls preload="metadata"></video></div>`; if (tiktokPreviewArea) tiktokPreviewArea.innerHTML = previewHTML; const changeBtn = tiktokPreviewArea ? tiktokPreviewArea.querySelector('.tiktok-change-file') : null; if (changeBtn) changeBtn.addEventListener('click', () => { if (tiktokMediaFile) tiktokMediaFile.click(); }); }
}

function openAddModal() {
    if (tiktokMediaTitle) tiktokMediaTitle.value = '';
    setMediaType('image');
    if (tiktokMediaFile) tiktokMediaFile.value = '';
    if (tiktokPreviewArea) tiktokPreviewArea.innerHTML = '';
    if (tiktokProgress) tiktokProgress.classList.add('hidden');
    if (tiktokSaveBtn) { tiktokSaveBtn.disabled = false; tiktokSaveBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><span>Upload to Cloudinary</span>'; }
    selectedFile = null;
    if (tiktokModal) { tiktokModal.classList.remove('hidden'); tiktokModal.style.display = 'flex'; }
}

async function saveTikTokMedia() {
    const title = tiktokMediaTitle ? tiktokMediaTitle.value.trim() : '';
    if (!title) { showNotification('Please enter a title', 'error'); return; }
    if (!selectedFile) { showNotification('Please select a file', 'error'); return; }
    if (selectedFile.size > 50 * 1024 * 1024) { showNotification('File too large. Maximum size is 50MB.', 'error'); return; }
    const type = tiktokTypeImage && tiktokTypeImage.classList.contains('active') ? 'image' : 'video';
    if (type === 'image' && !selectedFile.type.startsWith('image/')) { showNotification('Please select a valid image file', 'error'); return; }
    if (type === 'video' && !selectedFile.type.startsWith('video/')) { showNotification('Please select a valid video file', 'error'); return; }
    if (tiktokSaveBtn) { tiktokSaveBtn.disabled = true; tiktokSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Uploading...</span>'; }
    if (tiktokProgress) tiktokProgress.classList.remove('hidden');
    const progressFill = document.querySelector('.tiktok-progress-fill');
    const progressText = document.querySelector('.tiktok-progress-text');
    let progress = 0;
    const interval = setInterval(() => { progress += 5; if (progress <= 90) { if (progressFill) progressFill.style.width = progress + '%'; if (progressText) progressText.textContent = progress + '%'; } }, 200);
    try {
        const fileUrl = await uploadFileToCloudinary(selectedFile, type);
        clearInterval(interval);
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        const { error: dbError } = await supabase.from('gallery').insert([{ title, media_type: type, media_url: fileUrl, uploaded_by: currentUser.id, uploader_name: currentProfile?.full_name || 'Member' }]);
        if (dbError) throw dbError;
        setTimeout(() => { closeTikTokModal(); showNotification('Media uploaded successfully'); loadGallery(); }, 500);
    } catch (err) { clearInterval(interval); console.error("Error uploading media:", err); showNotification('Error: ' + err.message, 'error'); if (tiktokSaveBtn) { tiktokSaveBtn.disabled = false; tiktokSaveBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><span>Upload to Cloudinary</span>'; } if (tiktokProgress) tiktokProgress.classList.add('hidden'); }
}

function closeTikTokModal() {
    if (tiktokModal) { tiktokModal.classList.add('hidden'); tiktokModal.style.display = 'none'; }
    if (tiktokMediaTitle) tiktokMediaTitle.value = '';
    if (tiktokMediaFile) tiktokMediaFile.value = '';
    if (tiktokPreviewArea) tiktokPreviewArea.innerHTML = '';
    if (tiktokProgress) tiktokProgress.classList.add('hidden');
    if (tiktokSaveBtn) { tiktokSaveBtn.disabled = false; tiktokSaveBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><span>Upload to Cloudinary</span>'; }
    selectedFile = null;
    setMediaType('image');
}

async function uploadFileToCloudinary(file, type) {
    try {
        if (!file) throw new Error("No file to upload");
        let folder = CLOUDINARY_CONFIG.folder;
        if (type === 'image') folder += '/' + CLOUDINARY_CONFIG.subFolders.image;
        else if (type === 'video') folder += '/' + CLOUDINARY_CONFIG.subFolders.video;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', folder);
        showNotification('📤 Uploading to Cloudinary...', 'info');
        const response = await fetch(getCloudinaryUploadUrl(), { method: 'POST', body: formData });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || 'Cloudinary upload failed'); }
        const data = await response.json();
        showNotification('✅ Uploaded to Cloudinary', 'success');
        return data.secure_url;
    } catch (err) { console.error("Cloudinary upload error:", err); showNotification('Failed to upload to Cloudinary: ' + err.message, 'error'); throw err; }
}

function addThemeButton() {
    const topBar = document.querySelector('.top-bar');
    if (!topBar) return;
    if (document.getElementById('themeBtn')) return;
    const themeBtn = document.createElement('button');
    themeBtn.id = 'themeBtn';
    themeBtn.className = 'theme-btn';
    themeBtn.innerHTML = '<i class="fas fa-palette"></i>';
    themeBtn.title = 'Change Theme';
    themeBtn.addEventListener('click', toggleThemeDropdown);
    const addBtn = document.getElementById('addMediaBtn');
    if (addBtn) topBar.insertBefore(themeBtn, addBtn);
    else topBar.appendChild(themeBtn);
}

async function loadGallery() {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading gallery...</div>`;
    try {
        const { data, error } = await supabase.from("gallery").select(`*, uploader:profiles!uploaded_by(full_name, email, role)`).order("created_at", { ascending: true });
        if (error) throw error;
        allMedia = data || [];
        displayGallery(allMedia);
        await loadReactions();
        autoScrollToMedia();
        setTimeout(() => setupAutoPlayVideos(), 500);
    } catch (err) { console.error("Error loading gallery:", err); galleryGrid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error Loading Gallery</h3><p>Please try again later</p></div>`; }
}

function displayGallery(media) {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = "";
    if (!media || media.length === 0) { galleryGrid.innerHTML = `<div class="empty-state"><i class="fas fa-images"></i><h3>No Media Yet</h3><p>Be the first to share an image or video!</p></div>`; return; }
    media.forEach(item => { const card = createMediaCard(item); galleryGrid.appendChild(card); });
    setTimeout(() => setupAutoPlayVideos(), 300);
}

document.addEventListener("DOMContentLoaded", async () => { if (addMediaBtn) { addMediaBtn.classList.remove("hidden"); addMediaBtn.style.display = "inline-flex"; } setTimeout(async () => await init(), 100); });

async function init() {
    try {
        if (typeof supabase === 'undefined') { console.error("Supabase not loaded"); return; }
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) { window.location.href = "../index.html"; return; }
        currentUser = user;
        const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (profileError) { console.error("Profile error:", profileError); return; }
        currentProfile = profile;
        isAdmin = profile.role === 'admin';
        isSmallAdmin = profile.role === 'small_admin';
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = profile.full_name || 'Member';
        if (addMediaBtn) { addMediaBtn.classList.remove("hidden"); addMediaBtn.style.display = "inline-flex"; addMediaBtn.onclick = openAddModal; }
        createDeleteModal();
        loadViewedMedia();
        const savedTheme = localStorage.getItem('selectedTheme') || 'dark';
        applyTheme(savedTheme);
        addThemeButton();
        initTikTokModal();
        await loadGallery();
    } catch (err) { console.error("Initialization error:", err); }
}

if (logoutBtn) logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); window.location.href = "../index.html"; });

window.openDeleteModal = function(id) { const media = allMedia.find(m => m.id === id); if (media) { selectedMediaId = id; selectedMediaUrl = media.media_url; selectedMediaType = media.media_type; if (deleteModal) deleteModal.classList.remove('hidden'); hideContextMenu(); } };

async function confirmDelete() {
    if (!selectedMediaId || !selectedMediaUrl) return;
    const media = allMedia.find(m => m.id === selectedMediaId);
    const canDelete = isAdmin || isSmallAdmin || (media && media.uploaded_by === currentUser?.id);
    if (!canDelete) { showNotification('❌ You can only delete your own content', 'error'); return; }
    showNotification('🗑️ Deleting media...', 'info');
    try {
        if (isCloudinaryUrl(selectedMediaUrl)) { console.log("Would delete from Cloudinary"); }
        await supabase.from('media_reactions').delete().eq('media_id', selectedMediaId);
        await supabase.from('gallery').delete().eq('id', selectedMediaId);
        mediaReactions.delete(selectedMediaId);
        allMedia = allMedia.filter(m => m.id !== selectedMediaId);
        if (deleteModal) deleteModal.classList.add('hidden');
        showNotification('✅ Media deleted', 'success');
        await loadGallery();
    } catch (err) { console.error("Error deleting media:", err); showNotification('Error deleting media: ' + err.message, 'error'); }
    finally { selectedMediaId = null; selectedMediaUrl = null; selectedMediaType = null; }
}

window.handleImageError = handleImageError;
window.downloadMedia = downloadMedia;

window.addEventListener('load', function() {
    const modal = document.getElementById('tiktokUploadModal');
    const addBtn = document.getElementById('addMediaBtn');
    if (!modal || !addBtn) return;
    addBtn.classList.remove('hidden');
    addBtn.style.display = 'inline-flex';
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    newAddBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); const titleInput = document.getElementById('tiktokMediaTitle'), fileInput = document.getElementById('tiktokMediaFile'), previewArea = document.getElementById('tiktokPreviewArea'), progress = document.getElementById('tiktokProgress'); if (titleInput) titleInput.value = ''; if (fileInput) fileInput.value = ''; if (previewArea) previewArea.innerHTML = ''; if (progress) progress.classList.add('hidden'); modal.classList.remove('hidden'); modal.style.display = 'flex'; return false; };
    function closeModal() { modal.classList.add('hidden'); modal.style.display = 'none'; }
    const closeBtn = document.getElementById('closeTiktokModal'), cancelBtn = document.getElementById('tiktokCancelBtn');
    if (closeBtn) closeBtn.onclick = (e) => { e.preventDefault(); closeModal(); return false; };
    if (cancelBtn) cancelBtn.onclick = (e) => { e.preventDefault(); closeModal(); return false; };
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
});

setTimeout(() => { const addBtn = document.getElementById('addMediaBtn'), modal = document.getElementById('tiktokUploadModal'); if (addBtn && modal) addBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); modal.classList.remove('hidden'); modal.style.display = 'flex'; return false; }; }, 2000);

function adjustAddButtonForMobile() {
    const addBtn = document.getElementById('addMediaBtn');
    if (!addBtn) return;
    addBtn.style.display = 'inline-flex';
    addBtn.style.alignItems = 'center';
    addBtn.style.justifyContent = 'center';
    addBtn.style.textAlign = 'center';
    if (window.innerWidth <= 480) { addBtn.innerHTML = '<i class="fas fa-plus" style="font-size: 24px;"></i>'; addBtn.title = 'Add Media'; addBtn.style.padding = '0'; addBtn.style.width = '48px'; addBtn.style.height = '48px'; addBtn.style.borderRadius = '50%'; }
    else { addBtn.innerHTML = '<i class="fas fa-plus"></i> Add'; addBtn.style.padding = '10px 20px'; addBtn.style.width = 'auto'; addBtn.style.height = 'auto'; addBtn.style.borderRadius = '30px'; }
}
window.addEventListener('load', adjustAddButtonForMobile);
window.addEventListener('resize', adjustAddButtonForMobile);

function addVisibilityStyles() {
    const style = document.createElement('style');
    style.textContent = `#tiktokSaveMediaBtn { display: flex !important; visibility: visible !important; background: #0b5e3b !important; color: white !important; } .tiktok-actions { display: flex !important; } .tiktok-upload-container { background: #1a1a1a !important; width: 90% !important; max-width: 600px !important; border-radius: 24px !important; } .media-card.unseen::before { content: 'NEW'; position: absolute; top: 16px; left: 16px; background: #0b5e3b; color: white; padding: 6px 12px; border-radius: 30px; font-size: 0.7rem; font-weight: bold; z-index: 10; animation: pulse 2s infinite; } @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }`;
    document.head.appendChild(style);
}
addVisibilityStyles();

const originalLoadGallery = loadGallery;
loadGallery = async function() { autoScrolled = false; await originalLoadGallery(); };