// ============================================
// HARAZIMIYYA FORUM - CHAT VIEW
// Reusable chat UI for Private & Group chats
// ============================================

console.log("💬 Chat View loading...");

// ============================================================
// CONFIGURATION
// ============================================================

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

// ============================================================
// URL PARAMETERS
// ============================================================

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        chatId: params.get('chatId'),
        chatType: params.get('chatType'), // 'private' or 'group'
        chatName: params.get('chatName') ? decodeURIComponent(params.get('chatName')) : null,
        chatAvatar: params.get('chatAvatar')
    };
}

// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let isSmallAdmin = false;
let messagesSubscription = null;
let presenceChannel = null;
let onlineUsers = new Set();
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let recordedAudioBlob = null;
let recordedAudioUrl = null;
let currentFile = null;
let currentFileType = 'image';
let replyingTo = null;
let pendingReply = null;
let allMembers = [];
let messageReactions = new Map();
let currentTheme = localStorage.getItem('chatTheme') || 'dark';
let chatParams = null;
let chatName = '';
let chatAvatar = '';
let isTyping = false;
let typingTimeout = null;

// DOM Elements
const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const imageBtn = document.getElementById('imageBtn');
const videoBtn = document.getElementById('videoBtn');
const voiceBtn = document.getElementById('voiceBtn');
const fileInput = document.getElementById('fileInput');
const replyIndicator = document.getElementById('replyIndicator');
const cancelReplyBtn = document.getElementById('cancelReplyBtn');
const replyName = document.getElementById('replyName');
const replyPreview = document.getElementById('replyPreview');
const recordingTimerEl = document.getElementById('recordingTimer');
const themeToggle = document.getElementById('themeToggle');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const chatAvatarImg = document.getElementById('chatAvatarImg');
const chatAvatarFallback = document.getElementById('chatAvatarFallback');

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing chat view...");
    initializeChatView();
});

async function initializeChatView() {
    if (!window.supabase) {
        setTimeout(initializeChatView, 100);
        return;
    }
    
    chatParams = getUrlParams();
    
    if (!chatParams.chatId || !chatParams.chatType) {
        window.location.href = 'chat-list.html';
        return;
    }
    
    setupSidebar();
    await loadChatData();
    initTheme();
    setupThemeToggle();
    createJumpToBottomButton();
    setupPresenceTracking();
    setupMobileKeyboardFix(); // ← Added here
}

// ============================================================
// URL HELPERS
// ============================================================

function getChatId() {
    return chatParams.chatId;
}

function getChatType() {
    return chatParams.chatType;
}

function getChatName() {
    return chatParams.chatName || 'Chat';
}

function getChatAvatar() {
    return chatParams.chatAvatar || null;
}

// ============================================================
// SIDEBAR
// ============================================================

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebar');
    const closeBtn = document.getElementById('closeSidebar');
    const overlay = document.getElementById('overlay');
    
    if (openBtn) openBtn.onclick = () => { sidebar.classList.add('active'); if (overlay) overlay.classList.add('active'); };
    if (closeBtn) closeBtn.onclick = () => { sidebar.classList.remove('active'); if (overlay) overlay.classList.remove('active'); };
    if (overlay) overlay.onclick = () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); };
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (presenceChannel) await presenceChannel.unsubscribe();
            await window.supabase.auth.signOut();
            window.location.href = '../index.html';
        };
    }
}

// ============================================================
// LOAD CHAT DATA
// ============================================================

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
        await loadMessages();
        await setupRealtimeSubscription();
        setupChatListeners();
        setupLogoutButtons();
        updateHeader();
    } catch (err) {
        console.error("Chat initialization error:", err);
    }
}

async function loadUserProfile(userId) {
    try {
        const { data, error } = await window.supabase.from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;
        
        currentProfile = data;
        isAdmin = data.role === 'admin';
        isSmallAdmin = data.role === 'small_admin';
        
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = data.full_name || 'Member';
        }
        
        updateSidebarAvatar();
        
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

function updateSidebarAvatar() {
    const avatarContainer = document.querySelector('.user-avatar');
    if (avatarContainer && currentProfile) {
        const avatarUrl = currentProfile.avatar_url || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(currentProfile.full_name || 'User')}&background=0c8f5f&color=fff`;
        avatarContainer.innerHTML = `<img src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
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

// ============================================================
// HEADER
// ============================================================

function updateHeader() {
    chatName = getChatName();
    chatAvatar = getChatAvatar();
    
    chatTitle.textContent = chatName || 'Chat';
    
    // Set avatar
    if (chatAvatar) {
        chatAvatarImg.src = chatAvatar;
        chatAvatarImg.style.display = 'block';
        chatAvatarFallback.style.display = 'none';
    } else {
        chatAvatarImg.style.display = 'none';
        chatAvatarFallback.style.display = 'flex';
        chatAvatarFallback.innerHTML = chatName ? chatName.charAt(0).toUpperCase() : '<i class="fas fa-user"></i>';
    }
    
    // Set subtitle based on type
    if (getChatType() === 'private') {
        chatSubtitle.textContent = 'Online';
        chatSubtitle.className = 'header-subtitle online';
    } else {
        chatSubtitle.textContent = 'Group Chat';
        chatSubtitle.className = 'header-subtitle group';
    }
}

// ============================================================
// PRESENCE TRACKING (for private chats)
// ============================================================

async function setupPresenceTracking() {
    if (getChatType() !== 'private') return;
    
    if (presenceChannel) {
        await presenceChannel.unsubscribe();
    }
    
    presenceChannel = window.supabase.channel('online-users', {
        config: {
            presence: {
                key: currentUser.id
            }
        }
    });
    
    presenceChannel.on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        onlineUsers.clear();
        
        Object.keys(state).forEach(userId => {
            if (userId !== currentUser.id) {
                onlineUsers.add(userId);
            }
        });
        
        updateOnlineStatus();
    });
    
    presenceChannel.on('presence', { event: 'join' }, ({ key }) => {
        if (key !== currentUser.id) {
            onlineUsers.add(key);
            updateOnlineStatus();
        }
    });
    
    presenceChannel.on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== currentUser.id) {
            onlineUsers.delete(key);
            updateOnlineStatus();
        }
    });
    
    await presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
                user_id: currentUser.id,
                user_name: currentProfile?.full_name || 'User',
                avatar_url: currentProfile?.avatar_url || null,
                online_at: new Date().toISOString()
            });
            console.log('✅ Presence tracking active');
        }
    });
}

function updateOnlineStatus() {
    if (getChatType() !== 'private') return;
    
    const chatId = getChatId();
    const isOnline = onlineUsers.has(chatId);
    chatSubtitle.textContent = isOnline ? '🟢 Online' : 'Offline';
    chatSubtitle.className = isOnline ? 'header-subtitle online' : 'header-subtitle offline';
}

function isUserOnline(userId) {
    return onlineUsers.has(userId);
}

// ============================================================
// LOAD MESSAGES
// ============================================================

async function loadMessages() {
    try {
        messagesEl.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';
        
        let query = window.supabase.from('chat_messages').select(`
            *,
            sender:sender_id(id, full_name, email, role, avatar_url),
            parent:parent_id(id, content, message_type, file_url, created_at, sender:sender_id(id, full_name, email, role))
        `);
        
        if (getChatType() === 'private') {
            const otherUserId = getChatId();
            query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`);
        } else if (getChatType() === 'group') {
            query = query.eq('group_id', getChatId());
        }
        
        const { data: messages, error } = await query.order('created_at', { ascending: true });
        if (error) throw error;
        
        // Mark messages as read
        if (messages && messages.length > 0) {
            await markMessagesAsRead(messages);
        }
        
        if (!messages || messages.length === 0) {
            messagesEl.innerHTML = '<div class="empty-chat"><i class="fas fa-comments"></i><h3>No messages yet</h3><p>Start the conversation!</p></div>';
            return;
        }
        
        renderMessages(messages);
        await loadReactions();
        setTimeout(() => scrollToBottom(), 100);
        
    } catch (err) {
        console.error("Error loading messages:", err);
        messagesEl.innerHTML = '<div class="empty-chat"><i class="fas fa-exclamation-triangle"></i><h3>Error loading messages</h3><p>Please refresh the page</p></div>';
    }
}

async function markMessagesAsRead(messages) {
    try {
        const unreadMessages = messages.filter(msg => 
            !msg.is_read && 
            msg.sender_id !== currentUser.id &&
            (msg.receiver_id === currentUser.id || msg.group_id === getChatId())
        );
        
        if (unreadMessages.length === 0) return;
        
        const messageIds = unreadMessages.map(msg => msg.id);
        
        await window.supabase
            .from('chat_messages')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .in('id', messageIds);
        
        // Reset unread count in user_chats
        await window.supabase
            .rpc('reset_unread_count', {
                p_user_id: currentUser.id,
                p_chat_id: getChatId()
            });
        
        console.log(`📖 Marked ${unreadMessages.length} messages as read`);
    } catch (err) {
        console.error('Error marking messages as read:', err);
    }
}

// ============================================================
// RENDER MESSAGES
// ============================================================

function renderMessages(messages) {
    let html = '';
    let lastDate = '';
    
    messages.forEach(msg => {
        const isSent = msg.sender_id === currentUser.id;
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
        // const crown = isAdminSender ? ' 👑' : '';
        const crown = isAdminSender ? ' ' : '';
        
        // For group chats, show sender name on received messages
        const showSenderName = !isSent && getChatType() === 'group';
        
        if (isSent) {
            html += `
                <div class="message sent" data-message-id="${msg.id}" data-sender-id="${msg.sender_id}">
                    <small>You</small>
                    ${renderQuotedMessage(msg.parent)}
                    <div class="message-content">${renderMessageContent(msg)}</div>
                    <span class="time">${timeStr} ✓${msg.is_read ? '✓' : ''}</span>
                </div>
            `;
        } else {
            html += `
                <div class="message received" data-message-id="${msg.id}" data-sender-id="${msg.sender_id}">
                    ${showSenderName ? `<small>${escapeHtml(senderName)}${crown}</small>` : ''}
                    ${renderQuotedMessage(msg.parent)}
                    <div class="message-content">${renderMessageContent(msg)}</div>
                    <span class="time">${timeStr}</span>
                </div>
            `;
        }
    });
    
    messagesEl.innerHTML = html;
    
    setTimeout(() => {
        messageReactions.forEach((_, messageId) => updateMessageReactions(messageId));
        setupMessageEventListeners();
    }, 100);
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

function getMessagePreview(msg) {
    if (!msg) return '';
    if (msg.message_type === 'text') {
        return msg.content && msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : (msg.content || 'Empty message');
    } else if (msg.message_type === 'image') return '📷 Image';
    else if (msg.message_type === 'video') return '🎥 Video';
    else if (msg.message_type === 'audio') return '🎵 Voice message';
    return '💬 Message';
}

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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============================================================
// SCROLL TO BOTTOM
// ============================================================

function scrollToBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
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
    
    if (messagesEl) {
        messagesEl.onscroll = () => {
            const isNearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 100;
            btn.style.display = isNearBottom ? 'none' : 'flex';
        };
    }
}

// ============================================================
// REALTIME SUBSCRIPTION
// ============================================================

function setupRealtimeSubscription() {
    if (messagesSubscription) messagesSubscription.unsubscribe();
    
    let filter = '';
    if (getChatType() === 'private') {
        filter = `receiver_id=eq.${currentUser.id}`;
    } else if (getChatType() === 'group') {
        filter = `group_id=eq.${getChatId()}`;
    }
    
    messagesSubscription = window.supabase
        .channel('chat_messages_channel')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_messages'
        }, payload => {
            handleNewMessage(payload.new);
        })
        .on('postgres_changes', { 
            event: 'DELETE', 
            schema: 'public', 
            table: 'chat_messages'
        }, () => {
            loadMessages();
        })
        .subscribe();
}

function handleNewMessage(newMessage) {
    // Check if message is relevant to this chat
    let isRelevant = false;
    
    if (getChatType() === 'private') {
        const otherUserId = getChatId();
        isRelevant = (newMessage.receiver_id === currentUser.id && newMessage.sender_id === otherUserId) ||
                    (newMessage.sender_id === currentUser.id && newMessage.receiver_id === otherUserId);
    } else if (getChatType() === 'group') {
        isRelevant = newMessage.group_id === getChatId();
    }
    
    if (isRelevant) {
        loadMessages();
    }
}

// ============================================================
// REACTIONS
// ============================================================

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

// ============================================================
// MESSAGE EVENT HANDLERS
// ============================================================

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

function createReplyIndicator(senderName, messageContent, messageType) {
    replyIndicator.style.display = 'flex';
    replyName.textContent = senderName;
    
    let previewText = '';
    if (messageType === 'text') previewText = messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent;
    else if (messageType === 'image') previewText = '📷 Image';
    else if (messageType === 'video') previewText = '🎥 Video';
    else if (messageType === 'audio') previewText = '🎵 Voice message';
    replyPreview.textContent = previewText;
}

function cancelReply() {
    replyIndicator.style.display = 'none';
    replyingTo = null;
    pendingReply = null;
}

cancelReplyBtn.addEventListener('click', cancelReply);

// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message && !currentFile && !recordedAudioBlob) return;
    
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
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
        
        if (getChatType() === 'private') {
            messageData.receiver_id = getChatId();
            messageData.group_id = null;
        } else if (getChatType() === 'group') {
            messageData.group_id = getChatId();
            messageData.receiver_id = null;
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
        
        messageInput.value = '';
        messageInput.style.height = 'auto';
        cancelReply();
        
        const mediaPreview = document.getElementById('mediaPreview');
        if (mediaPreview) mediaPreview.remove();
        
        setTimeout(() => loadMessages(), 500);
        
    } catch (err) {
        console.error("Send error:", err);
        showNotification('Failed to send message: ' + err.message, 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

// ============================================================
// FILE UPLOAD & MEDIA
// ============================================================

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
        
        const previewDiv = document.createElement('div');
        previewDiv.id = 'mediaPreview';
        previewDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-bottom: 10px;';
        previewDiv.innerHTML = `
            <img src="${e.target.result}" style="max-width: 60px; max-height: 60px; border-radius: 8px;">
            <div style="flex: 1;"><span>${file.name}</span><br><small>${(file.size / 1024).toFixed(1)} KB</small></div>
            <button id="cancelMediaBtn" class="media-btn" style="background: var(--danger);"><i class="fas fa-times"></i></button>
            <button id="sendMediaBtn" class="media-btn" style="background: var(--primary-color);"><i class="fas fa-paper-plane"></i></button>
        `;
        const chatInputArea = document.querySelector('.chat-input-area');
        if (chatInputArea && chatInputArea.parentNode) {
            chatInputArea.parentNode.insertBefore(previewDiv, chatInputArea);
        }
        
        document.getElementById('cancelMediaBtn').onclick = () => { currentFile = null; previewDiv.remove(); };
        document.getElementById('sendMediaBtn').onclick = async () => { previewDiv.remove(); await sendMessage(); };
    };
    reader.readAsDataURL(file);
}

function showVideoPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const existing = document.getElementById('mediaPreview');
        if (existing) existing.remove();
        
        const previewDiv = document.createElement('div');
        previewDiv.id = 'mediaPreview';
        previewDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-bottom: 10px;';
        previewDiv.innerHTML = `
            <video src="${e.target.result}" style="max-width: 80px; max-height: 60px;"></video>
            <div style="flex: 1;"><span>${file.name}</span><br><small>${(file.size / (1024*1024)).toFixed(2)} MB</small></div>
            <button id="cancelMediaBtn" class="media-btn" style="background: var(--danger);"><i class="fas fa-times"></i></button>
            <button id="sendMediaBtn" class="media-btn" style="background: var(--primary-color);"><i class="fas fa-paper-plane"></i></button>
        `;
        const chatInputArea = document.querySelector('.chat-input-area');
        if (chatInputArea && chatInputArea.parentNode) {
            chatInputArea.parentNode.insertBefore(previewDiv, chatInputArea);
        }
        
        document.getElementById('cancelMediaBtn').onclick = () => { currentFile = null; previewDiv.remove(); };
        document.getElementById('sendMediaBtn').onclick = async () => { previewDiv.remove(); await sendMessage(); };
    };
    reader.readAsDataURL(file);
}

// ============================================================
// VOICE RECORDING
// ============================================================

async function toggleVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        if (recordingTimer) clearInterval(recordingTimer);
        recordingSeconds = 0;
        recordingTimerEl.style.display = 'none';
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.style.backgroundColor = '';
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
        voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
        voiceBtn.style.backgroundColor = '#dc2626';
        
        recordingSeconds = 0;
        recordingTimerEl.style.display = 'block';
        recordingTimerEl.innerHTML = '🔴 Recording: 0s';
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            recordingTimerEl.innerHTML = `🔴 Recording: ${recordingSeconds}s`;
        }, 1000);
        
    } catch (err) {
        console.error("Microphone error:", err);
        showNotification("Could not access microphone", "error");
    }
}

function showAudioPreview(audioUrl) {
    const existing = document.getElementById('audioPreview');
    if (existing) existing.remove();
    
    const previewDiv = document.createElement('div');
    previewDiv.id = 'audioPreview';
    previewDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-bottom: 10px;';
    previewDiv.innerHTML = `
        <audio controls src="${audioUrl}" style="flex: 1; height: 40px;"></audio>
        <button id="cancelAudioBtn" class="media-btn" style="background: var(--danger);"><i class="fas fa-times"></i></button>
        <button id="sendAudioBtn" class="media-btn" style="background: var(--primary-color);"><i class="fas fa-paper-plane"></i></button>
    `;
    const chatInputArea = document.querySelector('.chat-input-area');
    if (chatInputArea && chatInputArea.parentNode) {
        chatInputArea.parentNode.insertBefore(previewDiv, chatInputArea);
    }
    
    document.getElementById('cancelAudioBtn').onclick = () => {
        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
        recordedAudioBlob = null;
        recordedAudioUrl = null;
        previewDiv.remove();
    };
    
    document.getElementById('sendAudioBtn').onclick = async () => {
        if (recordedAudioBlob) {
            currentFile = new File([recordedAudioBlob], 'voice-message.webm', { type: 'audio/webm' });
            currentFileType = 'audio';
            previewDiv.remove();
            await sendMessage();
        }
    };
}

// ============================================================
// THEME
// ============================================================

function initTheme() {
    // document.body.setAttribute('data-theme', currentTheme);
     const savedTheme = localStorage.getItem('chatTheme') || 'dark';
    if (document.body.getAttribute('data-theme') !== savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
    }
    currentTheme = savedTheme;
}

function setupThemeToggle() {
    themeToggle.addEventListener('click', () => {
        const themes = ['dark', 'light', 'sepia', 'forest'];
        const currentIndex = themes.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        currentTheme = themes[nextIndex];
        document.body.setAttribute('data-theme', currentTheme);
        localStorage.setItem('chatTheme', currentTheme);
        showNotification('Theme changed', 'success', 1500);
    });
}

// ============================================================
// NOTIFICATION
// ============================================================

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

// ============================================================
// CHAT LISTENERS
// ============================================================

function setupChatListeners() {
    sendBtn.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });
    
    imageBtn.addEventListener('click', () => { fileInput.accept = 'image/*'; fileInput.click(); });
    videoBtn.addEventListener('click', () => { fileInput.accept = 'video/*'; fileInput.click(); });
    fileInput.addEventListener('change', handleFileSelect);
    voiceBtn.addEventListener('click', toggleVoiceRecording);
}

// ============================================================
// LOGOUT
// ============================================================

function setupLogoutButtons() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (presenceChannel) await presenceChannel.unsubscribe();
            await window.supabase.auth.signOut();
            window.location.href = '../index.html';
        };
    }
}

// ============================================================
// WINDOW HELPERS
// ============================================================

window.toggleReaction = toggleReaction;
window.handleReplyAction = handleReplyAction;
window.scrollToMessage = function(messageId) {
    const el = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.backgroundColor = 'rgba(12,143,95,0.3)';
        setTimeout(() => el.style.backgroundColor = '', 2000);
    }
};

console.log("✅ Chat View loaded successfully");

// ============================================================
// FIX: Mobile Keyboard Scroll
// ============================================================

function setupMobileKeyboardFix() {
    const input = document.getElementById('messageInput');
    const messages = document.getElementById('messages');
    
    if (!input) return;
    
    // When input is focused, ensure it scrolls into view
    input.addEventListener('focus', function() {
        setTimeout(() => {
            this.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    });
    
    // Handle visual viewport changes (keyboard open/close)
    if ('visualViewport' in window) {
        let lastHeight = window.visualViewport.height;
        
        window.visualViewport.addEventListener('resize', () => {
            const currentHeight = window.visualViewport.height;
            
            if (currentHeight < lastHeight) {
                // Keyboard opened - scroll to bottom and input
                setTimeout(() => {
                    if (messages) {
                        messages.scrollTop = messages.scrollHeight;
                    }
                    const inputArea = document.querySelector('.chat-input-area');
                    if (inputArea) {
                        inputArea.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }
                }, 200);
            }
            
            lastHeight = currentHeight;
        });
    }
}

function setupMessageEventListeners() {
    document.querySelectorAll('.message').forEach(msg => {
        // Desktop right-click
        msg.oncontextmenu = (e) => {
            e.preventDefault();
            // Show context menu
        };
        
        // Mobile touch events
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let isSwiping = false;
        
        msg.addEventListener('touchstart', (e) => {
            const touch = e.changedTouches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
            isSwiping = false;
        }, { passive: true });
        
        msg.addEventListener('touchmove', (e) => {
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            
            // Only detect horizontal swipes (ignore vertical scrolling)
            if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                isSwiping = true;
                // Show swipe indicator
                handleSwipeToReply(msg, deltaX);
            }
        }, { passive: true });
        
        msg.addEventListener('touchend', (e) => {
            const deltaTime = Date.now() - touchStartTime;
            
            // If it was a long-press (500ms+ and not a swipe)
            if (!isSwiping && deltaTime > 500) {
                e.preventDefault();
                showContextMenu(/* ... */);
            }
            
            // Reset swipe
            if (isSwiping) {
                resetSwipeState(msg);
            }
        }, { passive: true });
    });
}

function handleSwipeToReply(msg, deltaX) {
    // Check if it's a received message (not sent by current user)
    if (msg.classList.contains('received')) {
        // Show swipe indicator
        const swipeAmount = Math.min(Math.abs(deltaX), 80);
        msg.style.transform = `translateX(${deltaX > 0 ? Math.min(deltaX, 80) : 0}px)`;
        msg.style.transition = 'none';
        
        // If swiped far enough, trigger reply
        if (swipeAmount > 60) {
            const messageId = msg.dataset.messageId;
            const senderName = msg.querySelector('small')?.textContent || 'User';
            const messageContent = msg.querySelector('.message-content p')?.textContent || '';
            let messageType = 'text';
            if (msg.querySelector('img')) messageType = 'image';
            else if (msg.querySelector('video')) messageType = 'video';
            else if (msg.querySelector('audio')) messageType = 'audio';
            
            window.handleReplyAction(messageId, senderName, messageContent, messageType);
            resetSwipeState(msg);
        }
    }
}

function resetSwipeState(msg) {
    msg.style.transition = 'transform 0.3s ease';
    msg.style.transform = 'translateX(0)';
    setTimeout(() => {
        msg.style.transition = '';
    }, 300);
}