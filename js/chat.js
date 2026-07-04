// js/chat.js - Complete Chat with Working Online Count & Profile Pictures
console.log("💬 Chat page loading...");

// ================= CLOUDINARY CONFIGURATION =================
const CLOUDINARY_CONFIG = {
    cloudName: 'df3koezfk',
    uploadPreset: 'community_upload',
    folder: 'community-app',
    subFolders: { image: 'Image', video: 'Video', audio: 'Voice-record', avatar: 'Avatars' }
};

function getCloudinaryUploadUrl() {
    return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`;
}

function safeUrl(url) {
    if (!url || url === 'null' || url === 'undefined' || url === '') return null;
    return url;
}

// Global variables
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let isSmallAdmin = false;
let messagesSubscription = null;
let pollingInterval = null;
let onlineUsersPolling = new Set();
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let recordedAudioBlob = null;
let recordedAudioUrl = null;
let currentFile = null;
let currentFileType = 'image';
let currentChatId = null;
let currentChatType = 'group';
let currentChatName = 'Community Chat';
let replyingTo = null;
let pendingReply = null;
let allMembers = [];
let allGroups = [];
let messageReactions = new Map();
let currentTheme = localStorage.getItem('chatTheme') || 'dark';
let searchTimeout = null;
let selectedGroupMembers = new Set();
let isUploadingAvatar = false;

// ================= RECENT SEARCHES STORAGE =================
const RECENT_SEARCHES_KEY = 'chat_recent_searches';
const MAX_RECENT_ITEMS = 7;

function getRecentSearches() {
    try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch (e) {
        console.error("Error loading recent searches:", e);
        return [];
    }
}

function saveRecentSearches(searches) {
    try {
        const trimmed = searches.slice(0, MAX_RECENT_ITEMS);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.error("Error saving recent searches:", e);
    }
}

function addToRecentSearches(type, id, name, avatarUrl) {
    let searches = getRecentSearches();
    searches = searches.filter(item => !(item.id === id && item.type === type));
    searches.unshift({
        type: type,
        id: id,
        name: name,
        avatar: avatarUrl || null,
        timestamp: Date.now()
    });
    if (searches.length > MAX_RECENT_ITEMS) {
        searches = searches.slice(0, MAX_RECENT_ITEMS);
    }
    saveRecentSearches(searches);
}

function renderRecentSearches() {
    const searches = getRecentSearches();
    const resultsDiv = document.getElementById('unifiedSearchResults');
    const searchInput = document.getElementById('unifiedSearchInput');
    
    if (!resultsDiv || !searchInput) return;
    
    if (searchInput.value.trim() !== '') return;
    
    if (searches.length === 0) return;
    
    let html = `<div class="search-section-title"><i class="fas fa-clock"></i> RECENT</div>`;
    
    searches.forEach(item => {
        const isGroup = item.type === 'group';
        const avatarHtml = item.avatar 
            ? `<img src="${item.avatar}" class="search-result-avatar-img" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=0c8f5f&color=fff'">`
            : `<i class="fas ${isGroup ? 'fa-users' : 'fa-user-circle'}"></i>`;
        
        html += `
            <div class="search-result-item" data-type="${item.type}" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-avatar="${item.avatar || ''}">
                <div class="search-result-avatar">
                    ${avatarHtml}
                </div>
                <div class="search-result-info">
                    <div class="search-result-name">${escapeHtml(item.name)}</div>
                    <div class="search-result-sub">${isGroup ? 'Group Chat' : 'Private Chat'}</div>
                </div>
                <span class="search-result-badge ${isGroup ? 'group' : 'member'}">
                    <i class="fas ${isGroup ? 'fa-comments' : 'fa-comment-dots'}"></i> ${isGroup ? 'Open Group' : 'Private Chat'}
                </span>
            </div>
        `;
    });
    
    resultsDiv.innerHTML = html;
    resultsDiv.classList.add('show');
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing chat...");
    initializeChat();
});

async function initializeChat() {
    if (!window.supabase) {
        setTimeout(initializeChat, 100);
        return;
    }
    setupSidebar();
    await loadChatData();
    initTheme();
    setupThemeToggle();
    createJumpToBottomButton();
    setupBackToCommunityButton();
    setupGroupCreation();
}

function showNotification(message, type = 'success', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    else if (type === 'info') icon = 'fa-info-circle';
    notification.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), duration);
}

function customConfirm(message, title = "⚠️ Warning") {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-confirm-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'custom-confirm-modal warning';
        modal.innerHTML = `
            <div class="custom-confirm-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="custom-confirm-title">${title}</div>
            <div class="custom-confirm-message">${message}</div>
            <div class="custom-confirm-buttons">
                <button class="custom-confirm-btn cancel" id="customConfirmCancel">Cancel</button>
                <button class="custom-confirm-btn confirm" id="customConfirmOk">Delete</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        const cancelBtn = document.getElementById('customConfirmCancel');
        const confirmBtn = document.getElementById('customConfirmOk');
        
        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(false);
        };
        
        confirmBtn.onclick = () => {
            overlay.remove();
            resolve(true);
        };
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        };
    });
}

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebar');
    const closeBtn = document.getElementById('closeSidebar');
    const overlay = document.getElementById('overlay');
    
    if (openBtn) openBtn.onclick = () => { sidebar.classList.add('active'); if (overlay) overlay.classList.add('active'); };
    if (closeBtn) closeBtn.onclick = () => { sidebar.classList.remove('active'); if (overlay) overlay.classList.remove('active'); };
    if (overlay) overlay.onclick = () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); };
}

function initTheme() {
    document.body.setAttribute('data-theme', currentTheme);
    updateThemeCheckmark();
}

function setTheme(theme) {
    currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('chatTheme', theme);
    updateThemeCheckmark();
    showNotification('Theme changed', 'success', 2000);
}

function updateThemeCheckmark() {
    document.querySelectorAll('.theme-option .fa-check').forEach(el => el.remove());
    const active = document.querySelector(`.theme-option[data-theme="${currentTheme}"]`);
    if (active) {
        const check = document.createElement('i');
        check.className = 'fas fa-check';
        active.appendChild(check);
    }
}

function setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    const dropdown = document.getElementById('themeDropdown');
    if (!toggle) return;
    
    toggle.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    };
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.onclick = (e) => {
            e.stopPropagation();
            setTheme(option.dataset.theme);
            dropdown.classList.remove('show');
        };
    });
    
    document.addEventListener('click', () => dropdown.classList.remove('show'));
}

function createJumpToBottomButton() {
    const existing = document.getElementById('jumpToBottomBtn');
    if (existing) existing.remove();
    
    const btn = document.createElement('button');
    btn.id = 'jumpToBottomBtn';
    btn.className = 'jump-to-bottom-btn';
    btn.innerHTML = '<i class="fas fa-arrow-down"></i>';
    btn.onclick = () => {
        scrollToBottom();
        btn.style.display = 'none';
    };
    document.body.appendChild(btn);
}

function scrollToBottom() {
    const container = document.getElementById('messages');
    if (container) container.scrollTop = container.scrollHeight;
}

function setupBackToCommunityButton() {
    const backBtn = document.getElementById('backToCommunityBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            currentChatId = null;
            currentChatType = 'group';
            currentChatName = 'Community Chat';
            document.getElementById('chatTitle').innerHTML = '👥 Community Chat';
            backBtn.style.display = 'none';
            
            const titleContainer = document.getElementById('chatTitleContainer');
            if (titleContainer) {
                const existingAvatar = titleContainer.querySelector('.private-chat-avatar');
                if (existingAvatar) existingAvatar.remove();
            }
            
            loadGroupMessages();
            showNotification('Back to Community Chat', 'info', 2000);
        };
    }
}

async function loadChatData() {
    try {
        const { data: { user }, error } = await window.supabase.auth.getUser();
        if (error || !user) {
            window.location.href = '../index.html';
            return;
        }
        currentUser = user;
        await loadUserProfile(user.id);
        await loadAllMembers();
        await loadGroups();
        await setupPresenceTracking();
        setupRealtimeSubscription();
        setupChatListeners();
        setupLogoutButtons();
        setupScrollListener();
        createUnifiedSearch();
    } catch (err) {
        console.error("Chat initialization error:", err);
    }
}

// ================= AVATAR FUNCTIONS (WHATSAPP STYLE) =================
function getAvatarUrl(profile) {
    if (profile && profile.avatar_url && profile.avatar_url !== 'null' && profile.avatar_url !== 'undefined' && profile.avatar_url !== '') {
        return profile.avatar_url;
    }
    const name = profile?.full_name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0c8f5f&color=fff&bold=true&size=128`;
}

async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const maxWidth = 500;
        const maxHeight = 500;
        const quality = 0.7;
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Compression failed'));
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = () => reject(new Error('Failed to load image'));
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
    });
}

async function uploadAvatar(file) {
    if (isUploadingAvatar) {
        showNotification('Please wait, already uploading...', 'info');
        return;
    }
    
    isUploadingAvatar = true;
    const avatarContainer = document.querySelector('.user-avatar');
    
    avatarContainer.classList.add('loading');
    
    try {
        showNotification('Processing image...', 'info', 1000);
        
        const compressedImage = await compressImage(file);
        
        showNotification('Uploading avatar...', 'info', 1500);
        
        const folder = `${CLOUDINARY_CONFIG.folder}/${CLOUDINARY_CONFIG.subFolders.avatar}`;
        const formData = new FormData();
        formData.append('file', compressedImage);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', folder);
        
        const response = await fetch(getCloudinaryUploadUrl(), { method: 'POST', body: formData });
        
        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        
        const { error } = await window.supabase
            .from('profiles')
            .update({ avatar_url: data.secure_url })
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        currentProfile.avatar_url = data.secure_url;
        
        updateAvatarInUI(data.secure_url);
        
        showNotification('Profile picture updated!', 'success', 2000);
        
    } catch (err) {
        console.error("Avatar upload error:", err);
        showNotification('Failed to update profile picture', 'error');
    } finally {
        isUploadingAvatar = false;
        avatarContainer.classList.remove('loading');
    }
}

function updateAvatarInUI(avatarUrl) {
    const sidebarAvatar = document.querySelector('.user-avatar img');
    if (sidebarAvatar) {
        sidebarAvatar.src = avatarUrl;
    }
    
    const searchInput = document.getElementById('unifiedSearchInput');
    if (searchInput && searchInput.value) {
        const event = new Event('input');
        searchInput.dispatchEvent(event);
    }
    
    loadGroupMessages();
}

function updateSidebarAvatar() {
    const avatarContainer = document.querySelector('.user-avatar');
    if (avatarContainer && currentProfile) {
        const avatarUrl = getAvatarUrl(currentProfile);
        avatarContainer.innerHTML = `<img src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        avatarContainer.style.position = 'relative';
        avatarContainer.style.cursor = 'pointer';
        
        if (!avatarContainer.querySelector('.avatar-upload-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'avatar-upload-overlay';
            overlay.innerHTML = '<i class="fas fa-camera"></i>';
            avatarContainer.appendChild(overlay);
        }
        
        avatarContainer.onclick = (e) => {
            e.stopPropagation();
            if (isUploadingAvatar) {
                showNotification('Please wait, uploading...', 'info');
                return;
            }
            
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/webp';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (file.size > 2 * 1024 * 1024) {
                    showNotification('Image must be less than 2MB', 'error');
                    return;
                }
                
                if (!file.type.startsWith('image/')) {
                    showNotification('Please select an image file', 'error');
                    return;
                }
                
                await uploadAvatar(file);
            };
            input.click();
        };
    }
}

function updateUserAvatarInSearch() {
    const searchInput = document.getElementById('unifiedSearchInput');
    if (searchInput && searchInput.value) {
        const event = new Event('input');
        searchInput.dispatchEvent(event);
    }
}

async function loadUserProfile(userId) {
    try {
        const { data, error } = await window.supabase.from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;
        
        currentProfile = data;
        isAdmin = data.role === 'admin';
        isSmallAdmin = data.role === 'small_admin';
        
        console.log("User role:", data.role, "Is Admin:", isAdmin);
        
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = data.full_name || 'Member';
        }
        
        updateSidebarAvatar();
        
        currentChatId = null;
        currentChatType = 'group';
        currentChatName = 'Community Chat';
        const chatTitle = document.getElementById('chatTitle');
        if (chatTitle) chatTitle.innerHTML = '👥 Community Chat';
        await loadGroupMessages();
        
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

async function loadAllMembers() {
    try {
        const { data, error } = await window.supabase
            .from('profiles')
            .select('id, full_name, email, state, avatar_url, role')
            .eq('is_approved', true)
            .order('full_name');
        if (!error) allMembers = data || [];
        console.log("Members loaded:", allMembers.length);
    } catch (err) {
        console.error("Error loading members:", err);
    }
}

async function loadGroups() {
    try {
        const url = "https://lsbgpfvxmngjynvccujw.supabase.co";
        const key = "sb_publishable_JdRC9zq7TZFD-KFz7Shbqw_iDD30d9r";
        
        const response = await fetch(`${url}/rest/v1/chat_groups?select=*&order=created_at.desc`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            allGroups = data || [];
            console.log("Groups loaded:", allGroups.length);
        } else {
            allGroups = [];
        }
    } catch (err) {
        console.error("Error loading groups:", err);
        allGroups = [];
    }
}

window.deleteGroup = async function(groupId, groupName) {
    const group = allGroups.find(g => g.id === groupId);
    const isCreator = group && group.created_by === currentUser.id;
    
    let canDelete = false;
    if (isAdmin) canDelete = true;
    else if (isCreator) canDelete = true;
    else {
        showNotification("You can only delete groups you created", "error");
        return;
    }
    
    if (!canDelete) return;
    
    const confirmed = await customConfirm(
        `Are you sure you want to delete group "${groupName}"? This will delete ALL messages in this group and cannot be undone!`,
        "⚠️ Delete Group"
    );
    
    if (confirmed) {
        try {
            showNotification("Deleting group...", "info", 2000);
            
            const url = "https://lsbgpfvxmngjynvccujw.supabase.co";
            const key = "sb_publishable_JdRC9zq7TZFD-KFz7Shbqw_iDD30d9r";
            
            await fetch(`${url}/rest/v1/chat_group_members?group_id=eq.${groupId}`, {
                method: 'DELETE',
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            });
            
            await fetch(`${url}/rest/v1/chat_messages?group_id=eq.${groupId}`, {
                method: 'DELETE',
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            });
            
            const response = await fetch(`${url}/rest/v1/chat_groups?id=eq.${groupId}`, {
                method: 'DELETE',
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            });
            
            if (response.ok) {
                showNotification(`Group "${groupName}" deleted successfully`, "success");
                await loadGroups();
                createUnifiedSearch();
                
                if (currentChatId === groupId) {
                    currentChatId = null;
                    currentChatType = 'group';
                    currentChatName = 'Community Chat';
                    document.getElementById('chatTitle').innerHTML = '👥 Community Chat';
                    await loadGroupMessages();
                }
            } else {
                throw new Error('Failed to delete group');
            }
        } catch (err) {
            console.error("Error deleting group:", err);
            showNotification('Error deleting group: ' + err.message, 'error');
        }
    }
};

// ================= WORKING PRESENCE TRACKING (POLLING FALLBACK) =================
async function setupPresenceTracking() {
    console.log("🟢 Setting up presence tracking (polling mode)...");
    
    if (!currentUser || !currentUser.id) {
        console.log("Waiting for user...");
        setTimeout(setupPresenceTracking, 500);
        return;
    }
    
    console.log("User ID:", currentUser.id);
    
    async function updateMyPresence() {
        try {
            const { error } = await window.supabase
                .from('user_presence')
                .upsert({ 
                    user_id: currentUser.id, 
                    last_seen: new Date().toISOString(),
                    status: 'online',
                    updated_at: new Date().toISOString()
                });
            
            if (error) console.error("Presence update error:", error);
            else console.log("✅ Presence updated");
        } catch (err) {
            console.error("Presence update exception:", err);
        }
    }
    
    await updateMyPresence();
    
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(updateMyPresence, 30000);
    
    await loadOnlineUsersPolling();
    setInterval(() => loadOnlineUsersPolling(), 5000);
    
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log("Tab visible, refreshing presence...");
            updateMyPresence();
            loadOnlineUsersPolling();
        }
    });
    
    console.log("🟢 Presence tracking active");
}

async function loadOnlineUsersPolling() {
    try {
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
        
        const { data, error } = await window.supabase
            .from('user_presence')
            .select('user_id, last_seen, status')
            .eq('status', 'online')
            .gte('last_seen', thirtySecondsAgo);
        
        if (error) {
            console.error("Error loading online users:", error);
            return;
        }
        
        onlineUsersPolling.clear();
        
        if (data && data.length > 0) {
            data.forEach(presence => {
                if (presence.user_id !== currentUser.id) {
                    onlineUsersPolling.add(presence.user_id);
                }
            });
        }
        
        updateOnlineCountPolling();
        
        if (currentChatType === 'private' && currentChatId) {
            const isOnline = onlineUsersPolling.has(currentChatId);
            const onlineDot = isOnline ? '<span class="online-status-dot"></span>' : '';
            const titleElement = document.getElementById('chatTitle');
            if (titleElement) {
                const currentText = titleElement.innerHTML.split('<span')[0];
                titleElement.innerHTML = `${currentText} ${onlineDot}`;
            }
        }
        
        console.log(`📊 Online users count: ${onlineUsersPolling.size}`);
        
    } catch (err) {
        console.error("Load online users exception:", err);
    }
}

function updateOnlineCountPolling() {
    const countEl = document.getElementById('onlineCount');
    if (countEl) {
        const count = onlineUsersPolling.size;
        countEl.innerHTML = `<i class="fas fa-circle"></i> ${count} online`;
        
        if (count > 0) {
            countEl.style.animation = 'pulse 2s infinite';
        } else {
            countEl.style.animation = 'none';
        }
    }
}

async function cleanupPresence() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    try {
        await window.supabase
            .from('user_presence')
            .delete()
            .eq('user_id', currentUser.id);
        console.log("Presence cleaned up on logout");
    } catch (err) {
        console.error("Error cleaning presence:", err);
    }
}

// ================= REALTIME SUBSCRIPTION =================
function setupRealtimeSubscription() {
    if (messagesSubscription) messagesSubscription.unsubscribe();
    
    messagesSubscription = window.supabase
        .channel('chat_messages_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
            handleNewMessage(payload.new);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, () => {
            loadGroupMessages();
        })
        .subscribe();
}

function handleNewMessage(newMessage) {
    let isRelevant = false;
    
    if (currentChatId && currentChatType === 'private') {
        isRelevant = (newMessage.receiver_id === currentUser.id && newMessage.sender_id === currentChatId) ||
                    (newMessage.sender_id === currentUser.id && newMessage.receiver_id === currentChatId);
    } else if (currentChatId && currentChatType === 'group') {
        isRelevant = newMessage.group_id === currentChatId;
    } else {
        isRelevant = !newMessage.receiver_id && !newMessage.group_id;
    }
    
    if (isRelevant) loadGroupMessages();
}

// ================= LOAD MESSAGES WITH AVATARS =================
async function loadGroupMessages() {
    try {
        const container = document.getElementById('messages');
        if (!container) return;
        container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';
        
        let query = window.supabase.from('chat_messages').select(`
            *,
            sender:sender_id(id, full_name, email, role, avatar_url),
            parent:parent_id(id, content, message_type, file_url, created_at, sender:sender_id(id, full_name, email, role))
        `);
        
        if (currentChatId && currentChatType === 'private') {
            query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatId}),and(sender_id.eq.${currentChatId},receiver_id.eq.${currentUser.id})`);
        } else if (currentChatId && currentChatType === 'group') {
            query = query.eq('group_id', currentChatId);
        } else {
            query = query.is('receiver_id', null).is('group_id', null);
        }
        
        const { data: messages, error } = await query.order('created_at', { ascending: true });
        if (error) throw error;
        
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="empty-chat"><i class="fas fa-comments"></i><h3>No messages yet</h3><p>Be the first to send a message!</p></div>';
            return;
        }
        
        renderMessagesWithAvatars(messages);
        await loadReactions();
        setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
        console.error("Error loading messages:", err);
        const container = document.getElementById('messages');
        if (container) {
            container.innerHTML = '<div class="empty-chat"><i class="fas fa-exclamation-triangle"></i><h3>Error loading messages</h3><p>Please refresh the page</p></div>';
        }
    }
}

function getMessagePreview(msg) {
    if (!msg) return '';
    if (msg.message_type === 'text') {
        return msg.content && msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : (msg.content || 'Empty message');
    } else if (msg.message_type === 'image') return '📷 Image';
    else if (msg.message_type === 'video') return '🎥 Video';
    else if (msg.message_type === 'audio') return '🎵 Voice message';
    return '💬 Message';
}

function renderQuotedMessage(parentMsg) {
    if (!parentMsg) return '';
    const senderName = parentMsg.sender ? (parentMsg.sender.full_name || parentMsg.sender.email || 'Unknown') : 'Unknown';
    const contentPreview = getMessagePreview(parentMsg);
    return `
        <div class="quoted-message" onclick="window.scrollToMessage && window.scrollToMessage('${parentMsg.id}')">
            <div class="quoted-sender">${escapeHtml(senderName)}</div>
            <div class="quoted-content">${escapeHtml(contentPreview)}</div>
        </div>
    `;
}

window.scrollToMessage = function(messageId) {
    const el = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.backgroundColor = 'rgba(12,143,95,0.3)';
        setTimeout(() => el.style.backgroundColor = '', 2000);
    }
};

function renderMessageContent(msg) {
    if (msg.message_type === 'text') {
        const textWithBreaks = (msg.content || '').replace(/\n/g, '<br>');
        return `<p style="white-space: pre-wrap; word-wrap: break-word; margin: 0;">${escapeHtml(textWithBreaks)}</p>`;
    }
    if (msg.message_type === 'image') {
        const url = safeUrl(msg.file_url);
        if (!url) return '<p>Image not available</p>';
        return `<img src="${url}" alt="Image" onclick="window.open('${url}', '_blank')" loading="lazy" style="max-width: 200px; max-height: 200px; border-radius: 12px; cursor: pointer;">`;
    }
    if (msg.message_type === 'video') {
        const url = safeUrl(msg.file_url);
        if (!url) return '<p>Video not available</p>';
        return `<video controls preload="metadata" style="max-width: 280px; max-height: 200px; border-radius: 12px;"><source src="${url}" type="video/mp4"></video>`;
    }
    if (msg.message_type === 'audio') {
        const url = safeUrl(msg.file_url);
        if (!url) return '<p>Audio not available</p>';
        return `<audio controls preload="metadata" style="width: 260px;"><source src="${url}"></audio>`;
    }
    return '<p>Unsupported message type</p>';
}

function renderMessagesWithAvatars(messages) {
    const container = document.getElementById('messages');
    if (!container) return;
    
    let html = '';
    let lastDate = '';
    let lastSenderId = null;
    
    messages.forEach((msg, index) => {
        const isSent = msg.sender_id === currentUser.id;
        const isGroup = currentChatType === 'group';
        const showAvatar = !isSent && isGroup;
        
        const isConsecutiveSameSender = !isSent && lastSenderId === msg.sender_id && index > 0;
        const shouldShowAvatar = showAvatar && !isConsecutiveSameSender;
        
        const date = new Date(msg.created_at);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateStr = '';
        if (date.toDateString() === today.toDateString()) dateStr = 'Today';
        else if (date.toDateString() === yesterday.toDateString()) dateStr = 'Yesterday';
        else dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        if (lastDate !== dateStr) {
            html += `<div class="date-separator"><span>${dateStr}</span></div>`;
            lastDate = dateStr;
        }
        
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        let senderName = msg.sender ? (msg.sender.full_name || msg.sender.email || 'Unknown') : 'Unknown';
        const isAdminSender = msg.sender && msg.sender.role === 'admin';
        const crown = isAdminSender ? ' 👑' : '';
        const avatarUrl = msg.sender ? getAvatarUrl(msg.sender) : '';
        
        if (isSent) {
            html += `
                <div class="message sent" data-message-id="${msg.id}" data-sender-id="${msg.sender_id}">
                    <small>You</small>
                    ${renderQuotedMessage(msg.parent)}
                    <div class="message-content">${renderMessageContent(msg)}</div>
                    <span class="time">${timeStr} ✓</span>
                </div>
            `;
        } else {
            const avatarHtml = shouldShowAvatar ? `
                <img src="${avatarUrl}" class="message-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0c8f5f&color=fff'">
            ` : `<div style="width: 28px; flex-shrink: 0;"></div>`;
            
            html += `
                <div class="message-wrapper">
                    ${avatarHtml}
                    <div class="message-content-wrapper">
                        <div class="message received" data-message-id="${msg.id}" data-sender-id="${msg.sender_id}">
                            ${shouldShowAvatar ? `<small>${escapeHtml(senderName)}${crown}</small>` : '<small style="opacity:0.5;">&nbsp;</small>'}
                            ${renderQuotedMessage(msg.parent)}
                            <div class="message-content">${renderMessageContent(msg)}</div>
                            <span class="time">${timeStr}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        lastSenderId = msg.sender_id;
    });
    
    container.innerHTML = html;
    
    setTimeout(() => {
        messageReactions.forEach((_, messageId) => updateMessageReactions(messageId));
        setupMessageEventListeners();
    }, 100);
}

// ================= REACTIONS =================
async function loadReactions() {
    try {
        const { data: reactions, error } = await window.supabase.from('message_reactions').select('*');
        if (error) {
            if (error.code === '42P01') return;
            throw error;
        }
        
        messageReactions.clear();
        reactions.forEach(reaction => {
            if (!messageReactions.has(reaction.message_id)) {
                messageReactions.set(reaction.message_id, { likes: new Set(), loves: new Set() });
            }
            const msgReactions = messageReactions.get(reaction.message_id);
            if (reaction.reaction_type === 'like') msgReactions.likes.add(reaction.user_id);
            else if (reaction.reaction_type === 'love') msgReactions.loves.add(reaction.user_id);
        });
        
        messageReactions.forEach((_, messageId) => updateMessageReactions(messageId));
    } catch (err) {
        console.error("Error loading reactions:", err);
    }
}

function updateMessageReactions(messageId) {
    const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (!messageEl) return;
    
    const reactions = messageReactions.get(messageId);
    if (!reactions) return;
    
    const existingReactions = messageEl.querySelector('.message-reactions');
    if (existingReactions) existingReactions.remove();
    
    if (reactions.likes.size > 0 || reactions.loves.size > 0) {
        const reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'message-reactions';
        let html = '';
        
        if (reactions.likes.size > 0) {
            html += `<div class="reaction like-reaction" data-message-id="${messageId}" data-reaction-type="like" onclick="toggleReaction('${messageId}', 'like')">
                        <i class="fas fa-thumbs-up"></i><span class="reaction-count">${reactions.likes.size}</span>
                     </div>`;
        }
        if (reactions.loves.size > 0) {
            html += `<div class="reaction love-reaction" data-message-id="${messageId}" data-reaction-type="love" onclick="toggleReaction('${messageId}', 'love')">
                        <i class="fas fa-heart"></i><span class="reaction-count">${reactions.loves.size}</span>
                     </div>`;
        }
        
        reactionsDiv.innerHTML = html;
        messageEl.appendChild(reactionsDiv);
    }
}

async function toggleReaction(messageId, reactionType) {
    if (!currentUser) return;
    
    try {
        if (!messageReactions.has(messageId)) {
            messageReactions.set(messageId, { likes: new Set(), loves: new Set() });
        }
        
        const reactions = messageReactions.get(messageId);
        const userReactionSet = reactionType === 'like' ? reactions.likes : reactions.loves;
        const otherReactionSet = reactionType === 'like' ? reactions.loves : reactions.likes;
        
        const hasReaction = userReactionSet.has(currentUser.id);
        
        if (hasReaction) {
            await window.supabase.from('message_reactions')
                .delete()
                .eq('message_id', messageId)
                .eq('user_id', currentUser.id)
                .eq('reaction_type', reactionType);
            userReactionSet.delete(currentUser.id);
        } else {
            if (otherReactionSet.has(currentUser.id)) {
                const otherType = reactionType === 'like' ? 'love' : 'like';
                await window.supabase.from('message_reactions')
                    .delete()
                    .eq('message_id', messageId)
                    .eq('user_id', currentUser.id)
                    .eq('reaction_type', otherType);
                otherReactionSet.delete(currentUser.id);
            }
            
            await window.supabase.from('message_reactions')
                .insert([{
                    message_id: messageId,
                    user_id: currentUser.id,
                    reaction_type: reactionType
                }]);
            userReactionSet.add(currentUser.id);
        }
        
        updateMessageReactions(messageId);
        showNotification(hasReaction ? `Removed ${reactionType === 'like' ? '👍' : '❤️'}` : `Added ${reactionType === 'like' ? '👍' : '❤️'}`, 'success', 1500);
    } catch (err) {
        console.error("Error toggling reaction:", err);
        showNotification('Failed to update reaction', 'error');
    }
}

// ================= MESSAGE EVENT HANDLERS =================
function setupMessageEventListeners() {
    document.querySelectorAll('.message').forEach(msg => {
        msg.oncontextmenu = (e) => {
            e.preventDefault();
            const messageId = msg.dataset.messageId;
            const senderName = msg.querySelector('small')?.textContent || 'User';
            const messageContent = msg.querySelector('.message-content p')?.textContent || '';
            let messageType = 'text';
            if (msg.querySelector('img')) messageType = 'image';
            else if (msg.querySelector('video')) messageType = 'video';
            else if (msg.querySelector('audio')) messageType = 'audio';
            
            showContextMenu(e.clientX, e.clientY, messageId, senderName, messageContent, messageType);
        };
    });
}

function showContextMenu(x, y, messageId, senderName, messageContent, messageType) {
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    menu.innerHTML = `
        <button onclick="window.handleReplyAction('${messageId}', '${escapeHtml(senderName)}', '${escapeHtml(messageContent)}', '${messageType}')">
            <i class="fas fa-reply"></i> Reply
        </button>
        <button onclick="window.toggleReaction('${messageId}', 'like')">
            <i class="fas fa-thumbs-up"></i> Like
        </button>
        <button onclick="window.toggleReaction('${messageId}', 'love')">
            <i class="fas fa-heart"></i> Love
        </button>
        <button onclick="window.handleDeleteMessage('${messageId}')" style="color: var(--danger);">
            <i class="fas fa-trash"></i> Delete
        </button>
    `;
    
    document.body.appendChild(menu);
    
    setTimeout(() => {
        document.addEventListener('click', function removeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            }
        });
    }, 100);
}

window.handleReplyAction = function(messageId, senderName, messageContent, messageType) {
    cancelReply();
    replyingTo = { id: messageId, name: senderName };
    pendingReply = { id: messageId, name: senderName, content: messageContent, type: messageType };
    createReplyIndicator(senderName, messageContent, messageType);
    const contextMenu = document.querySelector('.context-menu');
    if (contextMenu) contextMenu.remove();
};

async function handleDeleteMessage(messageId) {
    const messageEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
    const senderId = messageEl?.dataset.senderId;
    
    if (!isAdmin && !isSmallAdmin && senderId !== currentUser.id) {
        showNotification("You can only delete your own messages", "error");
        return;
    }
    
    const confirmed = await customConfirm(
        "Are you sure you want to delete this message? This cannot be undone.",
        "🗑️ Delete Message"
    );
    
    if (confirmed) {
        try {
            await window.supabase.from('chat_messages').delete().eq('id', messageId);
            showNotification('Message deleted', 'success');
            loadGroupMessages();
        } catch (err) {
            showNotification('Error deleting message', 'error');
        }
    }
    const contextMenu = document.querySelector('.context-menu');
    if (contextMenu) contextMenu.remove();
}

window.handleDeleteMessage = handleDeleteMessage;

function createReplyIndicator(senderName, messageContent, messageType) {
    const existing = document.getElementById('replyIndicator');
    if (existing) existing.remove();
    
    let previewText = '';
    if (messageType === 'text') previewText = messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent;
    else if (messageType === 'image') previewText = '📷 Image';
    else if (messageType === 'video') previewText = '🎥 Video';
    else if (messageType === 'audio') previewText = '🎵 Voice message';
    
    const indicator = document.createElement('div');
    indicator.id = 'replyIndicator';
    indicator.className = 'reply-indicator';
    indicator.innerHTML = `
        <div class="reply-indicator-content">
            <i class="fas fa-reply"></i>
            <div class="reply-indicator-text">
                <span>Replying to ${escapeHtml(senderName)}</span>
                <p>${escapeHtml(previewText)}</p>
            </div>
        </div>
        <button class="reply-indicator-close" id="cancelReplyBtn"><i class="fas fa-times"></i></button>
    `;
    
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer && messagesContainer.parentNode) {
        messagesContainer.parentNode.insertBefore(indicator, messagesContainer);
    }
    
    const cancelBtn = document.getElementById('cancelReplyBtn');
    if (cancelBtn) cancelBtn.onclick = cancelReply;
}

function cancelReply() {
    const indicator = document.getElementById('replyIndicator');
    if (indicator) indicator.remove();
    replyingTo = null;
    pendingReply = null;
}

// ================= FILE UPLOAD & MEDIA =================
async function uploadFile(file) {
    try {
        let folder = CLOUDINARY_CONFIG.folder;
        if (file.type.startsWith('image/')) folder += '/' + CLOUDINARY_CONFIG.subFolders.image;
        else if (file.type.startsWith('video/')) folder += '/' + CLOUDINARY_CONFIG.subFolders.video;
        else if (file.type.startsWith('audio/')) folder += '/' + CLOUDINARY_CONFIG.subFolders.audio;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', folder);
        
        showNotification('📤 Uploading...', 'info', 2000);
        const response = await fetch(getCloudinaryUploadUrl(), { method: 'POST', body: formData });
        
        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        showNotification('✅ Uploaded', 'success', 1500);
        return data.secure_url;
    } catch (err) {
        console.error("Upload error:", err);
        showNotification('Upload failed: ' + err.message, 'error');
        throw err;
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) {
        showNotification('File too large (max 50MB)', 'error');
        return;
    }
    
    if (file.type.startsWith('image/')) {
        currentFileType = 'image';
        currentFile = file;
        showImagePreview(file);
    } else if (file.type.startsWith('video/')) {
        currentFileType = 'video';
        currentFile = file;
        showVideoPreview(file);
    } else {
        showNotification('Only images and videos supported', 'error');
    }
}

function showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const existing = document.getElementById('mediaPreview');
        if (existing) existing.remove();
        
        const chatInput = document.querySelector('.chat-input-area');
        const previewDiv = document.createElement('div');
        previewDiv.id = 'mediaPreview';
        previewDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-bottom: 10px;';
        previewDiv.innerHTML = `
            <img src="${e.target.result}" style="max-width: 60px; max-height: 60px; border-radius: 8px;">
            <div style="flex: 1;"><span>${file.name}</span><br><small>${(file.size / 1024).toFixed(1)} KB</small></div>
            <button id="cancelMediaBtn" class="media-btn" style="background: var(--danger);"><i class="fas fa-times"></i></button>
            <button id="sendMediaBtn" class="media-btn" style="background: var(--primary-color);"><i class="fas fa-paper-plane"></i></button>
        `;
        if (chatInput && chatInput.parentNode) {
            chatInput.parentNode.insertBefore(previewDiv, chatInput);
        }
        
        const cancelBtn = document.getElementById('cancelMediaBtn');
        const sendBtn = document.getElementById('sendMediaBtn');
        if (cancelBtn) cancelBtn.onclick = () => { currentFile = null; previewDiv.remove(); };
        if (sendBtn) sendBtn.onclick = async () => { previewDiv.remove(); await sendMessage(); };
    };
    reader.readAsDataURL(file);
}

function showVideoPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const existing = document.getElementById('mediaPreview');
        if (existing) existing.remove();
        
        const chatInput = document.querySelector('.chat-input-area');
        const previewDiv = document.createElement('div');
        previewDiv.id = 'mediaPreview';
        previewDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-bottom: 10px;';
        previewDiv.innerHTML = `
            <video src="${e.target.result}" style="max-width: 80px; max-height: 60px;"></video>
            <div style="flex: 1;"><span>${file.name}</span><br><small>${(file.size / (1024*1024)).toFixed(2)} MB</small></div>
            <button id="cancelMediaBtn" class="media-btn" style="background: var(--danger);"><i class="fas fa-times"></i></button>
            <button id="sendMediaBtn" class="media-btn" style="background: var(--primary-color);"><i class="fas fa-paper-plane"></i></button>
        `;
        if (chatInput && chatInput.parentNode) {
            chatInput.parentNode.insertBefore(previewDiv, chatInput);
        }
        
        const cancelBtn = document.getElementById('cancelMediaBtn');
        const sendBtn = document.getElementById('sendMediaBtn');
        if (cancelBtn) cancelBtn.onclick = () => { currentFile = null; previewDiv.remove(); };
        if (sendBtn) sendBtn.onclick = async () => { previewDiv.remove(); await sendMessage(); };
    };
    reader.readAsDataURL(file);
}

// ================= VOICE RECORDING =================
async function toggleVoiceRecording() {
    const voiceBtn = document.getElementById('voiceBtn');
    const timerDiv = document.getElementById('recordingTimer');
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        if (recordingTimer) clearInterval(recordingTimer);
        recordingSeconds = 0;
        if (timerDiv) timerDiv.style.display = 'none';
        if (voiceBtn) voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        if (voiceBtn) voiceBtn.style.backgroundColor = '';
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            recordedAudioBlob = audioBlob;
            recordedAudioUrl = URL.createObjectURL(audioBlob);
            showAudioPreview(recordedAudioUrl);
            stream.getTracks().forEach(track => track.stop());
            mediaRecorder = null;
        };
        
        mediaRecorder.start();
        if (voiceBtn) voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
        if (voiceBtn) voiceBtn.style.backgroundColor = '#dc2626';
        
        recordingSeconds = 0;
        if (timerDiv) {
            timerDiv.style.display = 'block';
            timerDiv.innerHTML = '🔴 Recording: 0s';
        }
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            if (timerDiv) timerDiv.innerHTML = `🔴 Recording: ${recordingSeconds}s`;
        }, 1000);
        
    } catch (err) {
        console.error("Microphone error:", err);
        showNotification("Could not access microphone", "error");
    }
}

function showAudioPreview(audioUrl) {
    const existing = document.getElementById('audioPreview');
    if (existing) existing.remove();
    
    const chatInput = document.querySelector('.chat-input-area');
    const previewDiv = document.createElement('div');
    previewDiv.id = 'audioPreview';
    previewDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-bottom: 10px;';
    previewDiv.innerHTML = `
        <audio controls src="${audioUrl}" style="flex: 1; height: 40px;"></audio>
        <button id="cancelAudioBtn" class="media-btn" style="background: var(--danger);"><i class="fas fa-times"></i></button>
        <button id="sendAudioBtn" class="media-btn" style="background: var(--primary-color);"><i class="fas fa-paper-plane"></i></button>
    `;
    if (chatInput && chatInput.parentNode) {
        chatInput.parentNode.insertBefore(previewDiv, chatInput);
    }
    
    const cancelBtn = document.getElementById('cancelAudioBtn');
    const sendBtn = document.getElementById('sendAudioBtn');
    
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
            recordedAudioBlob = null;
            recordedAudioUrl = null;
            previewDiv.remove();
        };
    }
    
    if (sendBtn) {
        sendBtn.onclick = async () => {
            if (recordedAudioBlob) {
                currentFile = new File([recordedAudioBlob], 'voice-message.webm', { type: 'audio/webm' });
                currentFileType = 'audio';
                previewDiv.remove();
                await sendMessage();
            }
        };
    }
}

// ================= SEND MESSAGE =================
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput ? messageInput.value.trim() : '';
    
    if (!message && !currentFile && !recordedAudioBlob) return;
    
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    const replyToSend = pendingReply ? { ...pendingReply } : null;
    
    try {
        const messageData = {
            sender_id: currentUser.id,
            message_type: 'text',
            content: message || '',
            created_at: new Date().toISOString(),
            read_at: null
        };
        
        if (replyToSend && replyToSend.id) messageData.parent_id = replyToSend.id;
        
        if (currentChatId && currentChatType === 'private') {
            messageData.receiver_id = currentChatId;
        } else if (currentChatId && currentChatType === 'group') {
            messageData.group_id = currentChatId;
        } else {
            messageData.receiver_id = null;
            messageData.group_id = null;
        }
        
        if (currentFile) {
            const fileUrl = await uploadFile(currentFile);
            messageData.message_type = currentFileType;
            messageData.content = '';
            messageData.file_url = fileUrl;
            currentFile = null;
        }
        
        if (recordedAudioBlob) {
            const fileUrl = await uploadFile(recordedAudioBlob);
            messageData.message_type = 'audio';
            messageData.content = '';
            messageData.file_url = fileUrl;
            if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
            recordedAudioBlob = null;
            recordedAudioUrl = null;
        }
        
        const { error } = await window.supabase.from('chat_messages').insert([messageData]);
        if (error) throw error;
        
        if (messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
        cancelReply();
        
        const mediaPreview = document.getElementById('mediaPreview');
        if (mediaPreview) mediaPreview.remove();
        
        showNotification('Message sent', 'success', 2000);
        setTimeout(() => loadGroupMessages(), 500);
        
    } catch (err) {
        console.error("Send error:", err);
        showNotification('Failed to send message: ' + err.message, 'error');
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }
}

// ================= CHAT LISTENERS =================
function setupChatListeners() {
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    const imageBtn = document.getElementById('imageBtn');
    const videoBtn = document.getElementById('videoBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    const fileInput = document.getElementById('fileInput');
    
    if (sendBtn) sendBtn.onclick = sendMessage;
    
    if (messageInput) {
        messageInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        };
        messageInput.oninput = function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        };
    }
    
    if (imageBtn && fileInput) {
        imageBtn.onclick = () => { fileInput.accept = 'image/*'; fileInput.click(); };
        videoBtn.onclick = () => { fileInput.accept = 'video/*'; fileInput.click(); };
        fileInput.onchange = handleFileSelect;
    }
    
    if (voiceBtn) voiceBtn.onclick = toggleVoiceRecording;
}

function setupLogoutButtons() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
            
            try {
                await window.supabase
                    .from('user_presence')
                    .delete()
                    .eq('user_id', currentUser.id);
            } catch (err) {
                console.error("Error clearing presence:", err);
            }
            
            await window.supabase.auth.signOut();
            window.location.href = '../index.html';
        };
    }
}

function setupScrollListener() {
    const container = document.getElementById('messages');
    if (!container) return;
    
    container.onscroll = () => {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        const jumpBtn = document.getElementById('jumpToBottomBtn');
        if (jumpBtn) {
            jumpBtn.style.display = isNearBottom ? 'none' : 'flex';
        }
    };
}

// ================= UNIFIED SEARCH WITH RECENT SEARCHES =================
function createUnifiedSearch() {
    console.log("Creating unified search");
    
    const container = document.getElementById('memberSelectorContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="unified-search-container">
            <div class="unified-search-wrapper">
                <i class="fas fa-search unified-search-icon"></i>
                <input type="text" class="unified-search-input" id="unifiedSearchInput" 
                       placeholder="Search members or groups..." autocomplete="off">
                <button class="unified-search-clear" id="unifiedSearchClear" style="display: none;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="unified-search-results" id="unifiedSearchResults"></div>
        </div>
    `;
    
    const searchInput = document.getElementById('unifiedSearchInput');
    const resultsDiv = document.getElementById('unifiedSearchResults');
    const clearBtn = document.getElementById('unifiedSearchClear');
    
    function performSearch(query) {
        const q = query.toLowerCase().trim();
        
        if (!q) {
            renderRecentSearches();
            if (clearBtn) clearBtn.style.display = 'none';
            return;
        }
        
        if (clearBtn) clearBtn.style.display = 'flex';
        
        const members = allMembers.filter(m => 
            (m.full_name && m.full_name.toLowerCase().includes(q)) ||
            (m.email && m.email.toLowerCase().includes(q))
        ).filter(m => m.id !== currentUser.id);
        
        let groups = allGroups.filter(g => g.name && g.name.toLowerCase().includes(q));
        
        if (members.length === 0 && groups.length === 0) {
            resultsDiv.innerHTML = `<div class="search-no-results"><i class="fas fa-user-slash"></i> No members or groups found</div>`;
            resultsDiv.classList.add('show');
            return;
        }
        
        let html = '';
        
        if (groups.length > 0) {
            html += `<div class="search-section-title"><i class="fas fa-layer-group"></i> GROUPS (${groups.length})</div>`;
            groups.forEach(g => {
                const isCreator = g.created_by === currentUser.id;
                let showDeleteButton = (isAdmin || isCreator);
                
                html += `
                    <div class="search-result-item" data-type="group" data-id="${g.id}" data-name="${escapeHtml(g.name)}">
                        <div class="search-result-avatar"><i class="fas fa-users"></i></div>
                        <div class="search-result-info">
                            <div class="search-result-name">${escapeHtml(g.name)}</div>
                            <div class="search-result-sub">Group Chat</div>
                        </div>
                        <span class="search-result-badge group"><i class="fas fa-comments"></i> Open Group</span>
                        ${showDeleteButton ? `<button class="search-result-delete" data-group-id="${g.id}" data-group-name="${escapeHtml(g.name)}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                `;
            });
        }
        
        if (members.length > 0) {
            html += `<div class="search-section-title"><i class="fas fa-users"></i> MEMBERS (${members.length})</div>`;
            members.forEach(m => {
                const avatarUrl = getAvatarUrl(m);
                html += `
                    <div class="search-result-item" data-type="member" data-id="${m.id}" data-name="${escapeHtml(m.full_name || m.email)}" data-avatar="${avatarUrl}">
                        <div class="search-result-avatar">
                            <img src="${avatarUrl}" class="search-result-avatar-img" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.full_name || 'User')}&background=0c8f5f&color=fff'">
                        </div>
                        <div class="search-result-info">
                            <div class="search-result-name">${escapeHtml(m.full_name || m.email)}</div>
                            <div class="search-result-sub">${escapeHtml(m.email)}</div>
                        </div>
                        <span class="search-result-badge member"><i class="fas fa-comment-dots"></i> Private Chat</span>
                    </div>
                `;
            });
        }
        
        resultsDiv.innerHTML = html;
        resultsDiv.classList.add('show');
    }
    
    resultsDiv.addEventListener('click', function(e) {
        const deleteBtn = e.target.closest('.search-result-delete');
        if (deleteBtn) {
            e.stopPropagation();
            const groupId = deleteBtn.getAttribute('data-group-id');
            const groupName = deleteBtn.getAttribute('data-group-name');
            window.deleteGroup(groupId, groupName);
            return;
        }
        
        const item = e.target.closest('.search-result-item');
        if (item) {
            const type = item.dataset.type;
            const id = item.dataset.id;
            const name = item.dataset.name;
            const avatar = item.dataset.avatar;
            
            addToRecentSearches(type, id, name, avatar);
            
            if (type === 'member') {
                currentChatId = id;
                currentChatType = 'private';
                currentChatName = name;
                
                const backBtn = document.getElementById('backToCommunityBtn');
                if (backBtn) backBtn.style.display = 'flex';
                
                const titleContainer = document.getElementById('chatTitleContainer');
                const existingAvatar = titleContainer.querySelector('.private-chat-avatar');
                if (existingAvatar) existingAvatar.remove();
                
                const isOnline = onlineUsersPolling.has(id);
                const onlineDot = isOnline ? '<span class="online-status-dot"></span>' : '';
                
                const avatarImg = document.createElement('img');
                avatarImg.src = avatar || getAvatarUrl({ full_name: name });
                avatarImg.className = 'private-chat-avatar';
                avatarImg.onerror = function() { 
                    this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0c8f5f&color=fff`;
                };
                
                titleContainer.insertBefore(avatarImg, titleContainer.firstChild);
                document.getElementById('chatTitle').innerHTML = `💬 ${name} ${onlineDot}`;
                loadGroupMessages();
            } else if (type === 'group') {
                currentChatId = id;
                currentChatType = 'group';
                currentChatName = name;
                document.getElementById('chatTitle').innerHTML = `👥 ${name}`;
                const backBtn = document.getElementById('backToCommunityBtn');
                if (backBtn) backBtn.style.display = 'none';
                loadGroupMessages();
            }
            
            resultsDiv.classList.remove('show');
            searchInput.value = '';
            if (clearBtn) clearBtn.style.display = 'none';
        }
    });
    
    searchInput.oninput = (e) => {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
    };
    
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim() === '') {
            renderRecentSearches();
        }
    });
    
    if (clearBtn) {
        clearBtn.onclick = () => {
            searchInput.value = '';
            resultsDiv.classList.remove('show');
            clearBtn.style.display = 'none';
            renderRecentSearches();
        };
    }
    
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            resultsDiv.classList.remove('show');
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ================= GROUP CREATION =================
function setupGroupCreation() {
    const createGroupBtn = document.getElementById('createGroupBtn');
    if (createGroupBtn) {
        createGroupBtn.onclick = () => openGroupModal();
    }
}

function openGroupModal() {
    let modal = document.getElementById('groupModal');
    if (modal) modal.remove();
    
    const modalHTML = `
        <div id="groupModal" class="modal hidden">
            <div class="modal-content group-modal-content">
                <div class="group-modal-header">
                    <h3><i class="fas fa-users"></i> Create New Group</h3>
                    <button class="close-modal-btn" id="closeGroupModalBtn"><i class="fas fa-times"></i></button>
                </div>
                <div class="group-modal-body">
                    <div class="form-group">
                        <label><i class="fas fa-heading"></i> Group Name *</label>
                        <input type="text" id="groupNameInput" placeholder="Enter group name" maxlength="50">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-search"></i> Search Members</label>
                        <div class="group-member-search">
                            <i class="fas fa-search search-icon"></i>
                            <input type="text" id="memberSearchInput" placeholder="Search members by name or email...">
                            <button class="clear-search" id="clearMemberSearch"><i class="fas fa-times"></i></button>
                        </div>
                        <div id="memberListForGroup" class="member-list-container">
                            <div class="loading-members">Loading members...</div>
                        </div>
                    </div>
                </div>
                <div class="group-modal-footer">
                    <button class="ghost-btn" id="cancelGroupBtn">Cancel</button>
                    <button class="primary-btn" id="createGroupConfirmBtn">Create Group</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modalEl = document.getElementById('groupModal');
    const closeBtn = document.getElementById('closeGroupModalBtn');
    const cancelBtn = document.getElementById('cancelGroupBtn');
    const createBtn = document.getElementById('createGroupConfirmBtn');
    
    if (closeBtn) closeBtn.onclick = () => closeGroupModal();
    if (cancelBtn) cancelBtn.onclick = () => closeGroupModal();
    if (createBtn) createBtn.onclick = () => createNewGroup();
    if (modalEl) modalEl.onclick = (e) => { if (e.target === modalEl) closeGroupModal(); };
    
    const nameInput = document.getElementById('groupNameInput');
    if (nameInput) nameInput.value = '';
    
    loadMemberListForModal();
    
    const searchInput = document.getElementById('memberSearchInput');
    const clearSearchBtn = document.getElementById('clearMemberSearch');
    
    if (searchInput) {
        searchInput.oninput = () => filterMemberList(searchInput.value);
    }
    if (clearSearchBtn) {
        clearSearchBtn.onclick = () => {
            if (searchInput) {
                searchInput.value = '';
                filterMemberList('');
                clearSearchBtn.style.display = 'none';
            }
        };
    }
    
    modalEl.classList.remove('hidden');
}

function filterMemberList(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const clearBtn = document.getElementById('clearMemberSearch');
    if (clearBtn) {
        clearBtn.style.display = term ? 'flex' : 'none';
    }
    
    const items = document.querySelectorAll('.member-checkbox-item');
    let visibleCount = 0;
    
    items.forEach(item => {
        const name = item.querySelector('label')?.textContent.toLowerCase() || '';
        const isVisible = name.includes(term);
        item.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) visibleCount++;
    });
    
    const container = document.getElementById('memberListForGroup');
    const noResults = container.querySelector('.no-results-message');
    
    if (visibleCount === 0 && term) {
        if (!noResults) {
            const msg = document.createElement('div');
            msg.className = 'no-results-message';
            msg.style.padding = '20px';
            msg.style.textAlign = 'center';
            msg.style.color = 'var(--text-muted)';
            msg.innerHTML = '<i class="fas fa-user-slash"></i> No members found';
            container.appendChild(msg);
        }
    } else if (noResults) {
        noResults.remove();
    }
}

async function loadMemberListForModal() {
    const memberList = document.getElementById('memberListForGroup');
    if (!memberList) return;
    
    memberList.innerHTML = '<div class="loading-members">Loading members...</div>';
    
    try {
        const { data, error } = await window.supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('is_approved', true)
            .order('full_name');
        
        if (error) throw error;
        
        let html = '';
        data.forEach(member => {
            if (member.id !== currentUser.id) {
                const avatarUrl = getAvatarUrl(member);
                html += `
                    <div class="member-checkbox-item" data-member-id="${member.id}">
                        <img src="${avatarUrl}" class="member-avatar-small" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name || 'User')}&background=0c8f5f&color=fff'">
                        <input type="checkbox" id="member_${member.id}" value="${member.id}" class="group-member-checkbox">
                        <label for="member_${member.id}" style="flex: 1; cursor: pointer;">${escapeHtml(member.full_name || member.email)}</label>
                    </div>
                `;
            }
        });
        memberList.innerHTML = html;
    } catch (err) {
        console.error("Error loading members:", err);
        memberList.innerHTML = '<div class="error">Error loading members</div>';
    }
}

function closeGroupModal() {
    const modal = document.getElementById('groupModal');
    if (modal) modal.classList.add('hidden');
    setTimeout(() => modal.remove(), 300);
}

async function createNewGroup() {
    const groupNameInput = document.getElementById('groupNameInput');
    const groupName = groupNameInput ? groupNameInput.value.trim() : '';
    
    if (!groupName) {
        showNotification('Please enter a group name', 'error');
        return;
    }
    
    const selectedMembers = [];
    const checkboxes = document.querySelectorAll('.group-member-checkbox:checked');
    checkboxes.forEach(cb => selectedMembers.push(cb.value));
    
    if (selectedMembers.length === 0) {
        showNotification('Please select at least one member', 'error');
        return;
    }
    
    const createBtn = document.getElementById('createGroupConfirmBtn');
    if (createBtn) {
        createBtn.disabled = true;
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    }
    
    try {
        const url = "https://lsbgpfvxmngjynvccujw.supabase.co";
        const key = "sb_publishable_JdRC9zq7TZFD-KFz7Shbqw_iDD30d9r";
        
        const response = await fetch(`${url}/rest/v1/chat_groups`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                name: groupName,
                created_by: currentUser.id,
                created_at: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        if (response.status !== 201) throw new Error(data.message || 'Failed to create group');
        
        const group = data[0];
        const membersToAdd = [{ user_id: currentUser.id, role: 'admin' }];
        selectedMembers.forEach(memberId => membersToAdd.push({ user_id: memberId, role: 'member' }));
        
        for (const member of membersToAdd) {
            await fetch(`${url}/rest/v1/chat_group_members`, {
                method: 'POST',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    group_id: group.id,
                    user_id: member.user_id,
                    role: member.role,
                    joined_at: new Date().toISOString()
                })
            });
        }
        
        showNotification(`Group "${groupName}" created successfully!`, 'success');
        closeGroupModal();
        await loadGroups();
        createUnifiedSearch();
        
        currentChatId = group.id;
        currentChatType = 'group';
        currentChatName = groupName;
        const chatTitle = document.getElementById('chatTitle');
        if (chatTitle) chatTitle.innerHTML = `👥 ${groupName}`;
        await loadGroupMessages();
        
    } catch (err) {
        console.error("Error creating group:", err);
        showNotification('Error creating group: ' + err.message, 'error');
    } finally {
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.innerHTML = 'Create Group';
        }
    }
}

window.toggleReaction = toggleReaction;
window.handleReplyAction = handleReplyAction;
window.handleDeleteMessage = handleDeleteMessage;
window.scrollToMessage = scrollToMessage;

console.log("✅ Chat.js loaded successfully with Realtime presence, profile pictures & recent searches (no timestamps)");

messages