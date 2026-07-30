// ============================================
// HARAZIMIYYA FORUM - CHAT LIST
// WhatsApp-style chat list with real-time updates
// ============================================

// Global variables
let currentUser = null;
let currentProfile = null;
let allChats = [];
let allMembers = [];
let allGroups = [];
let currentTab = 'all';
let onlineUsers = new Set();
let typingUsers = new Set();
let isSearching = false;
let selectedChatId = null;
let selectedChatType = null;

// DOM Elements
const chatListEl = document.getElementById('chatList');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const clearSearch = document.getElementById('clearSearch');
const tabs = document.querySelectorAll('.tab');
const fabBtn = document.getElementById('fabBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const openSidebar = document.getElementById('openSidebar');
const closeSidebar = document.getElementById('closeSidebar');
const logoutBtn = document.getElementById('logoutBtn');

// Modal elements
const groupModal = document.getElementById('groupModal');
const closeGroupModal = document.getElementById('closeGroupModal');
const cancelGroupBtn = document.getElementById('cancelGroupBtn');
const createGroupBtn = document.getElementById('createGroupBtn');
const groupNameInput = document.getElementById('groupNameInput');
const groupMemberSearch = document.getElementById('groupMemberSearch');
const groupMemberList = document.getElementById('groupMemberList');

// Delete modal
const deleteModal = document.getElementById('deleteModal');
const deleteForMe = document.getElementById('deleteForMe');
const deleteForAll = document.getElementById('deleteForAll');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('💬 Chat List loading...');
    initializeChatList();
});

async function initializeChatList() {
    if (!window.supabase) {
        setTimeout(initializeChatList, 100);
        return;
    }
    
    await loadUser();
    await ensureCommunityChat();
    await loadMembers();
    await loadGroups();
    await setupPresenceTracking();
    await loadChats();
    setupEventListeners();
    setupSidebar();
}

// ============================================================
// ENSURE COMMUNITY CHAT EXISTS
// ============================================================

async function ensureCommunityChat() {
    try {
        const { data, error } = await window.supabase
            .from('user_chats')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('chat_id', 'community')
            .maybeSingle();
        
        if (data) {
            console.log('✅ Community Chat already exists for user');
            return;
        }
        
        console.log('📌 Creating Community Chat for user...');
        
        const { data: latestMsg } = await window.supabase
            .from('chat_messages')
            .select('content, created_at, sender_id')
            .is('receiver_id', null)
            .is('group_id', null)
            .order('created_at', { ascending: false })
            .limit(1);
        
        let lastMessage = 'Welcome to Harazimiyya Community!';
        let lastMessageTime = new Date().toISOString();
        let lastSenderId = null;
        
        if (latestMsg && latestMsg.length > 0) {
            const { data: sender } = await window.supabase
                .from('profiles')
                .select('full_name')
                .eq('id', latestMsg[0].sender_id)
                .single();
            
            lastMessage = (sender?.full_name || 'Someone') + ': ' + (latestMsg[0].content || '');
            lastMessageTime = latestMsg[0].created_at;
            lastSenderId = latestMsg[0].sender_id;
        }
        
        const { error: insertError } = await window.supabase
            .from('user_chats')
            .insert([{
                user_id: currentUser.id,
                chat_id: 'community',
                chat_type: 'community',
                chat_name: 'Harazimiyya Community',
                last_message: lastMessage,
                last_message_time: lastMessageTime,
                last_message_sender_id: lastSenderId,
                unread_count: 0,
                is_pinned: true,
                is_deleted: false
            }]);
        
        if (insertError) {
            console.error('Error creating community chat:', insertError);
        } else {
            console.log('✅ Community Chat added to user_chats');
        }
        
    } catch (err) {
        console.error('Error ensuring community chat:', err);
    }
}

// ============================================================
// LOAD USER
// ============================================================

async function loadUser() {
    try {
        const { data: { user }, error } = await window.supabase.auth.getUser();
        if (error || !user) {
            window.location.href = '../index.html';
            return;
        }
        currentUser = user;
        
        const { data: profile, error: profileError } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (profileError) throw profileError;
        currentProfile = profile;
        
        document.getElementById('userName').textContent = profile.full_name || 'Member';
        updateSidebarAvatar();
        
        console.log('✅ User loaded:', user.email);
    } catch (err) {
        console.error('Error loading user:', err);
    }
}

// ============================================================
// LOAD MEMBERS & GROUPS
// ============================================================

async function loadMembers() {
    try {
        const { data, error } = await window.supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('is_approved', true)
            .order('full_name');
        
        if (error) throw error;
        allMembers = data || [];
        console.log('✅ Members loaded:', allMembers.length);
    } catch (err) {
        console.error('Error loading members:', err);
    }
}

async function loadGroups() {
    try {
        const { data, error } = await window.supabase
            .from('chat_groups')
            .select('*')
            .order('name');
        
        if (error) throw error;
        allGroups = data || [];
        console.log('✅ Groups loaded:', allGroups.length);
    } catch (err) {
        console.error('Error loading groups:', err);
    }
}

// ============================================================
// PRESENCE TRACKING
// ============================================================

let presenceChannel = null;

async function setupPresenceTracking() {
    if (!currentUser) return;
    
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
        
        renderChats();
    });
    
    presenceChannel.on('presence', { event: 'join' }, ({ key }) => {
        if (key !== currentUser.id) {
            onlineUsers.add(key);
            renderChats();
        }
    });
    
    presenceChannel.on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== currentUser.id) {
            onlineUsers.delete(key);
            renderChats();
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

function isUserOnline(userId) {
    return onlineUsers.has(userId);
}

// ============================================================
// LOAD CHATS
// ============================================================

async function loadChats() {
    try {
        chatListEl.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading chats...</div>';
        
        const { data, error } = await window.supabase
            .rpc('get_user_chats', { p_user_id: currentUser.id });
        
        if (error) throw error;
        
        allChats = data || [];
        console.log('✅ Chats loaded:', allChats.length);
        
        renderChats();
        
    } catch (err) {
        console.error('Error loading chats:', err);
        chatListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error loading chats</h3>
                <p>Please refresh the page</p>
            </div>
        `;
    }
}

// ============================================================
// RENDER CHATS
// ============================================================

function renderChats() {
    let filteredChats = [...allChats];
    
    // Filter by tab
    switch(currentTab) {
        case 'community':
            filteredChats = filteredChats.filter(c => c.chat_type === 'community');
            break;
        case 'groups':
            filteredChats = filteredChats.filter(c => c.chat_type === 'group');
            break;
        case 'private':
            filteredChats = filteredChats.filter(c => c.chat_type === 'private');
            break;
        case 'all':
        default:
            break;
    }
    
    if (filteredChats.length === 0) {
        chatListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comment-slash"></i>
                <h3>No chats yet</h3>
                <p>Start a new conversation or create a group</p>
            </div>
        `;
        return;
    }
    
    // Sort: community first (if in 'all' tab), then by last_message_time
    if (currentTab === 'all') {
        filteredChats.sort((a, b) => {
            if (a.chat_type === 'community') return -1;
            if (b.chat_type === 'community') return 1;
            return new Date(b.last_message_time) - new Date(a.last_message_time);
        });
    } else {
        filteredChats.sort((a, b) => 
            new Date(b.last_message_time) - new Date(a.last_message_time)
        );
    }
    
    let html = '';
    
    filteredChats.forEach(chat => {
        const isCommunity = chat.chat_type === 'community';
        const avatarUrl = isCommunity ? null : chat.chat_avatar;
        const name = isCommunity ? 'Harazimiyya Community' : chat.chat_name || 'Unknown';
        const lastMessage = chat.last_message || 'No messages yet';
        const time = chat.last_message_time ? formatTime(chat.last_message_time) : '';
        const unread = chat.unread_count || 0;
        const isOnline = isCommunity ? false : isUserOnline(chat.chat_id);
        const isTyping = isCommunity ? false : typingUsers.has(chat.chat_id);
        const chatId = chat.chat_id;
        const chatType = chat.chat_type;
        
        const communityClass = isCommunity ? 'community-chat' : '';
        
        html += `
            <div class="chat-item ${communityClass}" 
                 data-chat-id="${chatId}" 
                 data-chat-type="${chatType}"
                 data-chat-name="${name}">
                <div class="chat-item-avatar">
                    ${isCommunity ? `
                        <div class="avatar-fallback" style="background: rgba(255,215,0,0.15); color: #ffd700;">
                            👑
                        </div>
                        <span class="community-crown">👑</span>
                    ` : `
                        ${avatarUrl ? 
                            `<img src="${avatarUrl}" onerror="this.classList.add('fallback'); this.innerHTML='<i class=\\'fas fa-user\\'></i>'; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\'/%3E'">` :
                            `<div class="avatar-fallback"><i class="fas fa-user"></i></div>`
                        }
                        ${isOnline ? `<span class="online-dot"></span>` : ''}
                    `}
                </div>
                
                <div class="chat-item-info">
                    <div class="chat-item-header">
                        <span class="chat-item-name">${escapeHtml(name)}</span>
                        <span class="chat-item-time">${time}</span>
                    </div>
                    <div class="chat-item-preview">
                        ${isTyping ? 
                            `<span class="typing-indicator">Typing...</span>` :
                            `<span class="last-message">${escapeHtml(lastMessage)}</span>`
                        }
                        ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    chatListEl.innerHTML = html;
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const chatId = item.dataset.chatId;
            const chatType = item.dataset.chatType;
            const chatName = item.dataset.chatName;
            openChat(chatId, chatType, chatName);
        });
        
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const chatId = item.dataset.chatId;
            const chatType = item.dataset.chatType;
            const chatName = item.dataset.chatName;
            showDeleteModal(chatId, chatType, chatName);
        });
    });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 172800000) return 'yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
// OPEN CHAT
// ============================================================

function openChat(chatId, chatType, chatName) {
    if (chatType === 'community') {
        window.location.href = `community.html`;
    } else {
        window.location.href = `chat-view.html?chatId=${chatId}&chatType=${chatType}&chatName=${encodeURIComponent(chatName)}`;
    }
}

// ============================================================
// SEARCH
// ============================================================

// ============================================================
// SEARCH - SEARCHES BOTH MEMBERS AND GROUPS
// ============================================================

searchInput.addEventListener('input', function() {
    const query = this.value.trim();
    
    if (query.length > 0) {
        clearSearch.style.display = 'flex';
        performSearch(query);
    } else {
        clearSearch.style.display = 'none';
        searchResults.classList.remove('show');
    }
});

clearSearch.addEventListener('click', function() {
    searchInput.value = '';
    searchResults.classList.remove('show');
    this.style.display = 'none';
});

function performSearch(query) {
    const q = query.toLowerCase();
    
    // Search members
    const matchedMembers = allMembers.filter(m => 
        m.full_name && m.full_name.toLowerCase().includes(q)
    ).filter(m => m.id !== currentUser.id);
    
    // Search groups
    const matchedGroups = allGroups.filter(g => 
        g.name && g.name.toLowerCase().includes(q)
    );
    
    if (matchedMembers.length === 0 && matchedGroups.length === 0) {
        searchResults.innerHTML = `
            <div class="search-no-results">
                <i class="fas fa-user-slash"></i> No members or groups found
            </div>
        `;
        searchResults.classList.add('show');
        return;
    }
    
    let html = '';
    
    // Members section
    if (matchedMembers.length > 0) {
        html += `<div class="search-section-title"><i class="fas fa-users"></i> MEMBERS (${matchedMembers.length})</div>`;
        matchedMembers.forEach(m => {
            const avatarUrl = m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.full_name)}&background=0c8f5f&color=fff`;
            html += `
                <div class="search-result-item" data-type="member" data-id="${m.id}" data-name="${escapeHtml(m.full_name)}">
                    <img src="${avatarUrl}" class="search-result-avatar" onerror="this.classList.add('fallback'); this.innerHTML='<i class=\\'fas fa-user\\'></i>'; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\'/%3E'">
                    <div class="search-result-info">
                        <div class="search-result-name">${escapeHtml(m.full_name)}</div>
                        <div class="search-result-sub">${escapeHtml(m.email)}</div>
                    </div>
                    <span class="search-result-badge member"><i class="fas fa-user"></i> Member</span>
                </div>
            `;
        });
    }
    
    // Groups section
    if (matchedGroups.length > 0) {
        html += `<div class="search-section-title"><i class="fas fa-layer-group"></i> GROUPS (${matchedGroups.length})</div>`;
        matchedGroups.forEach(g => {
            html += `
                <div class="search-result-item" data-type="group" data-id="${g.id}" data-name="${escapeHtml(g.name)}">
                    <div class="search-result-avatar fallback"><i class="fas fa-users"></i></div>
                    <div class="search-result-info">
                        <div class="search-result-name">${escapeHtml(g.name)}</div>
                        <div class="search-result-sub">Group Chat</div>
                    </div>
                    <span class="search-result-badge group"><i class="fas fa-users"></i> Group</span>
                </div>
            `;
        });
    }
    
    searchResults.innerHTML = html;
    searchResults.classList.add('show');
    
    document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', function() {
            const type = this.dataset.type;
            const id = this.dataset.id;
            const name = this.dataset.name;
            
            if (type === 'member') {
                openChat(id, 'private', name);
            } else if (type === 'group') {
                openChat(id, 'group', name);
            }
            
            searchResults.classList.remove('show');
            searchInput.value = '';
            clearSearch.style.display = 'none';
        });
    });
}
// ============================================================
// TABS
// ============================================================

tabs.forEach(tab => {
    tab.addEventListener('click', function() {
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        currentTab = this.dataset.tab;
        renderChats();
    });
});

// ============================================================
// NEW GROUP
// ============================================================

fabBtn.addEventListener('click', () => {
    openGroupModal();
});

function openGroupModal() {
    groupNameInput.value = '';
    groupMemberList.innerHTML = '<div class="loading-members">Loading members...</div>';
    groupModal.classList.remove('hidden');
    loadGroupMembers();
}

function closeGroupModalFn() {
    groupModal.classList.add('hidden');
}

closeGroupModal.addEventListener('click', closeGroupModalFn);
cancelGroupBtn.addEventListener('click', closeGroupModalFn);

groupModal.addEventListener('click', (e) => {
    if (e.target === groupModal) closeGroupModalFn();
});

async function loadGroupMembers() {
    try {
        const { data, error } = await window.supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('is_approved', true)
            .order('full_name');
        
        if (error) throw error;
        
        let html = '';
        data.forEach(member => {
            if (member.id === currentUser.id) return;
            const avatarUrl = member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name)}&background=0c8f5f&color=fff`;
            html += `
                <div class="member-item" data-id="${member.id}">
                    <img src="${avatarUrl}" class="member-avatar-small" onerror="this.classList.add('fallback'); this.innerHTML='<i class=\\'fas fa-user\\'></i>'; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\'/%3E'">
                    <input type="checkbox" id="member_${member.id}" value="${member.id}" class="group-member-checkbox">
                    <label for="member_${member.id}">${escapeHtml(member.full_name)}</label>
                </div>
            `;
        });
        groupMemberList.innerHTML = html;
        
        groupMemberSearch.oninput = function() {
            const q = this.value.toLowerCase();
            document.querySelectorAll('.member-item').forEach(item => {
                const label = item.querySelector('label')?.textContent.toLowerCase() || '';
                item.style.display = label.includes(q) ? 'flex' : 'none';
            });
        };
        
    } catch (err) {
        console.error('Error loading members:', err);
        groupMemberList.innerHTML = '<div class="error">Error loading members</div>';
    }
}

createGroupBtn.addEventListener('click', async function() {
    const name = groupNameInput.value.trim();
    if (!name) {
        showNotification('Please enter a group name', 'error');
        return;
    }
    
    const selectedMembers = [];
    document.querySelectorAll('.group-member-checkbox:checked').forEach(cb => {
        selectedMembers.push(cb.value);
    });
    
    if (selectedMembers.length === 0) {
        showNotification('Please select at least one member', 'error');
        return;
    }
    
    this.disabled = true;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    
    try {
        const { data: group, error: groupError } = await window.supabase
            .from('chat_groups')
            .insert([{
                name: name,
                created_by: currentUser.id,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (groupError) throw groupError;
        
        const membersToAdd = [
            { group_id: group.id, user_id: currentUser.id, role: 'admin' },
            ...selectedMembers.map(id => ({ group_id: group.id, user_id: id, role: 'member' }))
        ];
        
        const { error: membersError } = await window.supabase
            .from('chat_group_members')
            .insert(membersToAdd);
        
        if (membersError) throw membersError;
        
        showNotification(`Group "${name}" created!`, 'success');
        closeGroupModalFn();
        await loadChats();
        
    } catch (err) {
        console.error('Error creating group:', err);
        showNotification('Failed to create group', 'error');
    } finally {
        this.disabled = false;
        this.innerHTML = 'Create Group';
    }
});

// ============================================================
// DELETE CHAT
// ============================================================

let deleteTarget = null;

function showDeleteModal(chatId, chatType, chatName) {
    deleteTarget = { chatId, chatType, chatName };
    deleteModal.classList.remove('hidden');
}

cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    deleteTarget = null;
});

deleteForMe.addEventListener('click', async function() {
    if (!deleteTarget) return;
    this.disabled = true;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    
    try {
        const { error } = await window.supabase
            .rpc('delete_chat_for_user', {
                p_user_id: currentUser.id,
                p_chat_id: deleteTarget.chatId
            });
        
        if (error) throw error;
        
        showNotification('Chat deleted', 'success');
        deleteModal.classList.add('hidden');
        await loadChats();
        
    } catch (err) {
        console.error('Error deleting chat:', err);
        showNotification('Failed to delete chat', 'error');
    } finally {
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-user"></i> Delete for Me';
        deleteTarget = null;
    }
});

deleteForAll.addEventListener('click', async function() {
    if (!deleteTarget) return;
    
    if (!confirm(`Delete this chat for everyone? This cannot be undone.`)) return;
    
    this.disabled = true;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    
    try {
        if (deleteTarget.chatType === 'group') {
            const { data: member, error: memberError } = await window.supabase
                .from('chat_group_members')
                .select('role')
                .eq('group_id', deleteTarget.chatId)
                .eq('user_id', currentUser.id)
                .single();
            
            if (memberError) throw memberError;
            
            if (member.role !== 'admin') {
                showNotification('Only group admins can delete for all', 'error');
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-users"></i> Delete for All';
                return;
            }
            
            await window.supabase.from('chat_group_members').delete().eq('group_id', deleteTarget.chatId);
            await window.supabase.from('chat_messages').delete().eq('group_id', deleteTarget.chatId);
            await window.supabase.from('chat_groups').delete().eq('id', deleteTarget.chatId);
            
            showNotification('Group deleted for everyone', 'success');
        } else {
            const { error } = await window.supabase
                .rpc('delete_chat_for_user', {
                    p_user_id: currentUser.id,
                    p_chat_id: deleteTarget.chatId
                });
            
            if (error) throw error;
            showNotification('Chat deleted', 'success');
        }
        
        deleteModal.classList.add('hidden');
        await loadChats();
        
    } catch (err) {
        console.error('Error deleting chat:', err);
        showNotification('Failed to delete chat', 'error');
    } finally {
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-users"></i> Delete for All';
        deleteTarget = null;
    }
});

// ============================================================
// SIDEBAR
// ============================================================

function setupSidebar() {
    if (openSidebar) {
        openSidebar.onclick = () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        };
    }
    
    if (closeSidebar) {
        closeSidebar.onclick = () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        };
    }
    
    if (overlay) {
        overlay.onclick = () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        };
    }
    
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (presenceChannel) {
                await presenceChannel.unsubscribe();
            }
            await window.supabase.auth.signOut();
            window.location.href = '../index.html';
        };
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

// ============================================================
// NOTIFICATION
// ============================================================

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    notification.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!groupModal.classList.contains('hidden')) closeGroupModalFn();
            if (!deleteModal.classList.contains('hidden')) deleteModal.classList.add('hidden');
        }
    });
}

console.log('✅ Chat List initialized successfully');