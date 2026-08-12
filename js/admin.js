// js/admin.js - Complete with Islamic Green Theme & Friendly Messages
// UPDATED: Enhanced debugging for approve function
// FIXED: Notification position - moved lower to avoid covering hamburger menu on mobile
// ADDED: Collapsible sections with localStorage persistence

document.addEventListener('DOMContentLoaded', function() {
    console.log("📊 Admin dashboard is getting ready for you...");
    
    function checkAdminAuth() {
        if (!window.supabase) {
            console.log("⏳ Waiting for connection...");
            setTimeout(checkAdminAuth, 100);
            return;
        }
        
        initializeAdmin();
        initializeSidebar();
        setupJumpToTopButton();
    }
    
    checkAdminAuth();
});

// ================= SIDEBAR SETUP =================
function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebar');
    const closeBtn = document.getElementById('closeSidebar');
    const overlay = document.getElementById('overlay');
    
    if (!sidebar) return;
    
    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sidebar.classList.add('active');
            if (overlay) overlay.classList.add('active');
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
}

// ================= JUMP TO TOP BUTTON =================
function setupJumpToTopButton() {
    const jumpBtn = document.getElementById('jumpToTopBtn');
    if (!jumpBtn) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            jumpBtn.style.display = 'flex';
        } else {
            jumpBtn.style.display = 'none';
        }
    });
    
    jumpBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ================= USER DROPDOWN =================
function setupUserDropdown() {
    const dropdownBtn = document.getElementById('userDropdownBtn');
    const dropdown = document.getElementById('userDropdown');
    
    if (dropdownBtn && dropdown) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        
        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });
        
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// Global variables for role-based permissions
let currentUserRole = null;
let isBigAdmin = false;
let isSmallAdmin = false;
let currentUserId = null;

async function initializeAdmin() {
    try {
        console.log("🔐 Checking your admin access...");
        
        const { data: { user }, error: userError } = await window.supabase.auth.getUser();
        
        if (userError || !user) {
            console.log("No session found, redirecting to login");
            showIslamicNotification("Please log in first", "info");
            window.location.href = '../index.html';
            return;
        }
        
        currentUserId = user.id;
        console.log("👋 Welcome back,", user.email);
        
        // Get user profile
        const { data: profile, error: profileError } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (profileError) {
            console.error("Profile error:", profileError);
            
            if (profileError.code === 'PGRST116') {
                console.log("Setting up your admin profile...");
                
                const { error: insertError } = await window.supabase
                    .from('profiles')
                    .insert([{
                        id: user.id,
                        email: user.email,
                        full_name: user.user_metadata?.full_name || 'Admin User',
                        role: 'admin',
                        is_approved: true
                    }]);
                
                if (insertError) {
                    console.error("Failed to create profile:", insertError);
                    showIslamicNotification("Couldn't set up your profile. Please contact support.", "error");
                    window.location.href = '../index.html';
                    return;
                }
                
                window.location.reload();
                return;
            }
            
            showIslamicNotification("Error loading your profile. Please try again.", "error");
            window.location.href = '../index.html';
            return;
        }
        
        // Check user role
        currentUserRole = profile.role;
        isBigAdmin = profile.role === 'admin';
        isSmallAdmin = profile.role === 'small_admin';
        
        console.log("User role:", currentUserRole);
        console.log("Is Big Admin:", isBigAdmin);
        console.log("Is Small Admin:", isSmallAdmin);
        
        // Role-based access control - BOTH Big Admin AND Small Admin can access admin dashboard
        if (!isBigAdmin && !isSmallAdmin) {
            console.log("User is not an admin, redirecting to home");
            showIslamicNotification("This area is for admins only", "warning");
            window.location.href = 'home.html';
            return;
        }
        
        console.log("✅ Welcome,", profile.full_name, "as", currentUserRole);
        
        // Update UI with user name
        const adminNameElements = document.querySelectorAll('#adminName, #headerAdminName');
        adminNameElements.forEach(el => {
            if (el) el.textContent = profile.full_name || 'Admin';
        });
        
        // Setup user dropdown
        setupUserDropdown();
        
        // Load all sections (with role-based filtering)
        showIslamicNotification("Loading your dashboard...", "info", 2000);
        await loadStats();
        await loadPendingUsers();
        await loadAllMembers();
        await loadRecentActivity();
        
        // Restore collapsible section states
        restoreSectionStates();
        
        // Setup listeners
        setupAdminListeners();
        setupSearch();
        
    } catch (err) {
        console.error("Admin initialization error:", err);
        showIslamicNotification("Authentication error: " + err.message, "error");
    }
}

// ============================================================
// COLLAPSIBLE SECTIONS
// ============================================================

/**
 * Toggle a section's visibility
 * @param {string} sectionId - The ID of the section to toggle
 */
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const body = section.querySelector('.section-body');
    const icon = section.querySelector('.collapse-icon i');
    
    if (!body) return;
    
    // Toggle collapsed class on body
    body.classList.toggle('collapsed');
    
    // Toggle icon rotation
    if (icon) {
        if (body.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-right';
        } else {
            icon.className = 'fas fa-chevron-down';
        }
    }
    
    // Save state to localStorage
    const sectionStates = JSON.parse(localStorage.getItem('admin_section_states') || '{}');
    sectionStates[sectionId] = body.classList.contains('collapsed');
    localStorage.setItem('admin_section_states', JSON.stringify(sectionStates));
}

/**
 * Restore saved section states
 */
function restoreSectionStates() {
    const sectionStates = JSON.parse(localStorage.getItem('admin_section_states') || '{}');
    
    ['pendingSection', 'membersSection', 'activitySection'].forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (!section) return;
        
        const body = section.querySelector('.section-body');
        const icon = section.querySelector('.collapse-icon i');
        
        if (!body) return;
        
        const isCollapsed = sectionStates[sectionId] === true;
        
        if (isCollapsed) {
            body.classList.add('collapsed');
            if (icon) {
                icon.className = 'fas fa-chevron-right';
            }
        } else {
            body.classList.remove('collapsed');
            if (icon) {
                icon.className = 'fas fa-chevron-down';
            }
        }
    });
}

/**
 * Toggle ALL sections (expand or collapse all)
 */
function toggleAllSections() {
    const sections = ['pendingSection', 'membersSection', 'activitySection'];
    const allCollapsed = sections.every(id => {
        const section = document.getElementById(id);
        if (!section) return true;
        const body = section.querySelector('.section-body');
        return body && body.classList.contains('collapsed');
    });
    
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (!section) return;
        const body = section.querySelector('.section-body');
        if (!body) return;
        
        if (allCollapsed) {
            // Expand all
            body.classList.remove('collapsed');
            const icon = section.querySelector('.collapse-icon i');
            if (icon) icon.className = 'fas fa-chevron-down';
        } else {
            // Collapse all
            body.classList.add('collapsed');
            const icon = section.querySelector('.collapse-icon i');
            if (icon) icon.className = 'fas fa-chevron-right';
        }
    });
    
    // Save states
    const sectionStates = {};
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (!section) return;
        const body = section.querySelector('.section-body');
        sectionStates[id] = body && body.classList.contains('collapsed');
    });
    localStorage.setItem('admin_section_states', JSON.stringify(sectionStates));
    
    // Also update the toggle all button text
    const toggleBtn = document.querySelector('.section-controls .refresh-btn');
    if (toggleBtn) {
        const isAnyCollapsed = sections.some(id => {
            const section = document.getElementById(id);
            if (!section) return false;
            const body = section.querySelector('.section-body');
            return body && body.classList.contains('collapsed');
        });
        
        if (isAnyCollapsed) {
            toggleBtn.innerHTML = '<i class="fas fa-chevron-circle-down"></i> Expand All';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-chevron-circle-up"></i> Collapse All';
        }
    }
}

// FIXED: Notification position - moved lower to avoid covering hamburger menu on mobile
function showIslamicNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `islamic-notification ${type}`;
    
    let icon = 'fa-info-circle';
    let bgColor = '#0b5e3b';
    
    if (type === 'success') {
        icon = 'fa-check-circle';
        bgColor = '#0b5e3b';
    } else if (type === 'error') {
        icon = 'fa-exclamation-circle';
        bgColor = '#dc2626';
    } else if (type === 'warning') {
        icon = 'fa-exclamation-triangle';
        bgColor = '#094c31';
    }
    
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    notification.style.backgroundColor = bgColor;
    notification.style.color = 'white';
    
    // FIXED: Position notification lower on mobile to avoid covering hamburger menu
    // Desktop: top: 70px, Mobile: top: 80px (below header)
    if (window.innerWidth <= 768) {
        notification.style.top = '80px';
    } else {
        notification.style.top = '70px';
    }
    notification.style.right = '10px';
    notification.style.left = 'auto';
    notification.style.position = 'fixed';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

async function loadStats() {
    try {
        console.log("📊 Counting your community members...");
        
        let totalUsers = 0;
        let pendingUsers = 0;
        let adminCount = 0;
        let activeUsers = 0;
        
        try {
            const { count } = await window.supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });
            totalUsers = count || 0;
            console.log("Total users count:", totalUsers);
        } catch (e) {
            console.log("Still counting total members...");
        }
        
        try {
            const { count, data, error } = await window.supabase
                .from('profiles')
                .select('id, full_name, email, is_approved', { count: 'exact', head: false })
                .eq('is_approved', false);
            
            pendingUsers = count || 0;
            console.log("✅ Pending users count from database:", pendingUsers);
            
            // Log the actual pending users for debugging
            if (data && data.length > 0) {
                console.log("Pending users details:", data.map(u => ({ name: u.full_name, email: u.email, id: u.id })));
            } else {
                console.log("No pending users found in database");
            }
        } catch (e) {
            console.log("Error counting pending approvals:", e);
        }
        
        try {
            const { count } = await window.supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .in('role', ['admin', 'small_admin']);
            adminCount = count || 0;
        } catch (e) {
            console.log("Still counting admins...");
        }
        
        try {
            const { count } = await window.supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('is_approved', true);
            activeUsers = count || 0;
        } catch (e) {
            console.log("Still counting active members...");
        }
        
        console.log("📊 Community stats ready:", { totalUsers, pendingUsers, activeUsers, adminCount });
        
        const elements = {
            'totalUsers': totalUsers,
            'pendingUsers': pendingUsers,
            'activeUsers': activeUsers,
            'adminCount': adminCount,
            'pendingBadge': pendingUsers,
            'notificationCount': pendingUsers
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) {
                const oldValue = el.textContent;
                el.textContent = value || 0;
                if (oldValue != value) {
                    console.log(`Updated ${id} from ${oldValue} to ${value}`);
                }
            }
        });
        
        if (pendingUsers > 0 && (isBigAdmin || isSmallAdmin)) {
            showIslamicNotification(`🕌 You have ${pendingUsers} member${pendingUsers > 1 ? 's' : ''} waiting for approval`, 'info', 4000);
        } else if (pendingUsers === 0 && (isBigAdmin || isSmallAdmin)) {
            console.log("✅ No pending approvals - counter should show 0");
        }
        
    } catch (err) {
        console.error("Error loading stats:", err);
    }
}

async function loadPendingUsers() {
    // BOTH Big Admin AND Small Admin can see pending approvals
    if (!isBigAdmin && !isSmallAdmin) {
        const section = document.getElementById('pendingSection');
        if (section) section.style.display = 'none';
        return;
    }
    
    try {
        console.log("🔍 Looking for members waiting for approval...");
        
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('is_approved', false)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        console.log("Pending users data from database:", data);
        console.log("Number of pending users:", data ? data.length : 0);
        
        const container = document.getElementById('pendingUsersGrid');
        if (!container) return;
        
        if (!data || data.length === 0) {
            console.log("No pending users, showing empty state");
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle" style="color: var(--islamic-green);"></i>
                    <p>No pending approvals</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        data.forEach(user => {
            html += `
                <div class="user-card pending" data-user-id="${user.id}">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div class="user-details">
                            <h4>${user.full_name || 'Pending Member'}</h4>
                        </div>
                        <div class="user-actions">
                            <button class="btn-islamic btn-approve" onclick="approveUser('${user.id}')">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="btn-islamic btn-reject" onclick="rejectUser('${user.id}')">
                                <i class="fas fa-times"></i> Decline
                            </button>
                            <button class="btn-details" onclick="viewUserDetails('${user.id}', '${user.full_name || ''}', '${user.email}')" title="View Details">
                                <i class="fas fa-info-circle"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        
        if (data.length > 0) {
            showIslamicNotification(`📬 Found ${data.length} member${data.length > 1 ? 's' : ''} waiting for your approval`, 'info');
        }
        
    } catch (err) {
        console.error("Error loading pending users:", err);
        const container = document.getElementById('pendingUsersGrid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state error">
                    <i class="fas fa-exclamation-triangle" style="color: #dc2626;"></i>
                    <p>Error loading requests</p>
                    <button class="btn-islamic btn-approve" onclick="loadPendingUsers()">
                        <i class="fas fa-sync-alt"></i> Try Again
                    </button>
                </div>
            `;
        }
    }
}

async function loadAllMembers() {
    try {
        console.log("👥 Loading all community members...");
        
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('membersGrid');
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users" style="color: var(--islamic-green);"></i>
                    <p>No members yet</p>
                </div>
            `;
            return;
        }
        
        window.allMembersData = data;
        renderMembers(data);
        
    } catch (err) {
        console.error("Error loading members:", err);
        const container = document.getElementById('membersGrid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state error">
                    <i class="fas fa-exclamation-triangle" style="color: #dc2626;"></i>
                    <p>Error loading members</p>
                </div>
            `;
        }
    }
}

// ===== RENDER MEMBERS - WITH ROLE-BASED PERMISSIONS =====
function renderMembers(members) {
    const container = document.getElementById('membersGrid');
    if (!container) return;
    
    if (!members || members.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users" style="color: var(--islamic-green);"></i>
                <p>No members found</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    members.forEach(user => {
        const isAdminUser = user.role === 'admin';
        const isSmallAdminUser = user.role === 'small_admin';
        const isPending = !user.is_approved;
        const isCurrentUser = user.id === currentUserId;
        
        let cardClass = 'user-card';
        if (isPending) cardClass += ' pending';
        else if (isAdminUser) cardClass += ' admin';
        
        // Role badges
        let roleBadge = '';
        if (isAdminUser) roleBadge = '<span class="badge admin">👑 Full Admin</span>';
        else if (isSmallAdminUser) roleBadge = '<span class="badge small-admin">⭐ Small Admin</span>';
        else if (isPending) roleBadge = '<span class="badge pending">⏳ Pending</span>';
        else roleBadge = '<span class="badge approved">👤 Member</span>';
        
        html += `
            <div class="${cardClass}" data-user-id="${user.id}">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div class="user-details">
                        <h4>${user.full_name || 'Unnamed Member'}</h4>
                        ${roleBadge}
                    </div>
                    <div class="user-actions">
        `;
        
        if (isBigAdmin) {
            // BIG ADMIN: Full control
            if (isPending) {
                html += `
                    <button class="btn-islamic btn-approve" onclick="approveUser('${user.id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn-islamic btn-reject" onclick="rejectUser('${user.id}')">
                        <i class="fas fa-times"></i> Decline
                    </button>
                `;
            } else {
                if (isAdminUser && !isCurrentUser) {
                    html += `
                        <button class="btn-islamic btn-remove-admin" onclick="removeAdmin('${user.id}')">
                            <i class="fas fa-user-minus"></i> Remove Admin
                        </button>
                    `;
                } else if (isSmallAdminUser) {
                    html += `
                        <button class="btn-islamic btn-admin" onclick="makeAdmin('${user.id}')">
                            <i class="fas fa-crown"></i> Make Full Admin
                        </button>
                        <button class="btn-islamic btn-remove-admin" onclick="demoteToMember('${user.id}')">
                            <i class="fas fa-user-minus"></i> Demote to Member
                        </button>
                    `;
                } else if (!isAdminUser && !isSmallAdminUser) {
                    html += `
                        <button class="btn-islamic btn-small-admin" onclick="promoteToSmallAdmin('${user.id}')" style="background: #f59e0b;">
                            <i class="fas fa-user-plus"></i> Make Small Admin
                        </button>
                        <button class="btn-islamic btn-admin" onclick="makeAdmin('${user.id}')">
                            <i class="fas fa-crown"></i> Make Full Admin
                        </button>
                    `;
                }
                
                if (!isCurrentUser) {
                    html += `
                        <button class="btn-islamic btn-revoke" onclick="revokeAccess('${user.id}')">
                            <i class="fas fa-ban"></i> Revoke
                        </button>
                    `;
                }
            }
        } 
        else if (isSmallAdmin) {
            // SMALL ADMIN: Can see pending users but NO Revoke button
            if (isPending) {
                // Small admin can approve/reject pending users
                html += `
                    <button class="btn-islamic btn-approve" onclick="approveUser('${user.id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn-islamic btn-reject" onclick="rejectUser('${user.id}')">
                        <i class="fas fa-times"></i> Decline
                    </button>
                `;
            } else {
                // For approved users, Small Admin only sees "View Only" - NO Revoke button
                html += `
                    <span class="badge view-only" style="background: #f59e0b; color: #fff; padding: 8px 12px;">
                        <i class="fas fa-eye"></i> View Only
                    </span>
                `;
            }
        }
        
        // View details button (available for both big and small admin)
        html += `
            <button class="btn-details" onclick="viewUserDetails('${user.id}', '${escapeHtml(user.full_name || '')}', '${user.email}')" title="View Details">
                <i class="fas fa-info-circle"></i>
            </button>
        `;
        
        html += `
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
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

// ===== PROMOTE TO SMALL ADMIN (Big Admin only) =====
window.promoteToSmallAdmin = async function(userId) {
    if (!isBigAdmin) {
        showIslamicNotification("Only Big Admin can promote to Small Admin", "error");
        return;
    }
    
    if (!confirm('Make this member a Small Admin?\n\nSmall Admins have:\n- Can approve/reject members\n- Can create events & announcements\n- Can set map locations\n- Can delete ANY user messages\n- CANNOT revoke/ban users')) return;
    
    try {
        const { data: user } = await window.supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();
        
        const { error } = await window.supabase
            .from('profiles')
            .update({ role: 'small_admin' })
            .eq('id', userId);
        
        if (error) throw error;
        
        showIslamicNotification(`⭐ ${user?.full_name || 'Member'} is now a Small Admin`, 'success');
        
        await Promise.all([
            loadStats(),
            loadAllMembers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Small admin promotion error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
    }
};

// ===== MAKE FULL ADMIN (Big Admin only) =====
window.makeAdmin = async function(userId) {
    if (!isBigAdmin) {
        showIslamicNotification("Only Big Admin can make Full Admins", "error");
        return;
    }
    
    if (!confirm('Make this member a Full Admin?')) return;
    
    try {
        const { data: user } = await window.supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();
        
        const { error } = await window.supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', userId);
        
        if (error) throw error;
        
        showIslamicNotification(`👑 ${user?.full_name || 'Member'} is now a Full Admin`, 'success');
        
        await Promise.all([
            loadStats(),
            loadAllMembers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Admin promotion error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
    }
};

// ===== DEMOTE TO MEMBER (Big Admin only) =====
window.demoteToMember = async function(userId) {
    if (!isBigAdmin) {
        showIslamicNotification("Only Big Admin can demote users", "error");
        return;
    }
    
    if (!confirm('Remove admin/small admin privileges?')) return;
    
    try {
        const { data: user } = await window.supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();
        
        const { error } = await window.supabase
            .from('profiles')
            .update({ role: 'member' })
            .eq('id', userId);
        
        if (error) throw error;
        
        showIslamicNotification(`⬇️ ${user?.full_name || 'User'} is now a regular member`, 'success');
        
        await Promise.all([
            loadStats(),
            loadAllMembers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Demote error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
    }
};

// ===== REMOVE FULL ADMIN (Big Admin only) =====
window.removeAdmin = async function(userId) {
    if (!isBigAdmin) {
        showIslamicNotification("Only Big Admin can remove admins", "error");
        return;
    }
    
    if (!confirm('Remove admin privileges?')) return;
    
    try {
        const { data: user } = await window.supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();
        
        const { error } = await window.supabase
            .from('profiles')
            .update({ role: 'member' })
            .eq('id', userId);
        
        if (error) throw error;
        
        showIslamicNotification(`⬇️ ${user?.full_name || 'User'} is no longer an admin`, 'success');
        
        await Promise.all([
            loadStats(),
            loadAllMembers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Admin removal error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
    }
};

// ===== REVOKE ACCESS (Big Admin only) - SMALL ADMIN CANNOT DO THIS =====
window.revokeAccess = async function(userId) {
    if (!isBigAdmin) {
        showIslamicNotification("Only Big Admin can revoke access", "error");
        return;
    }
    
    if (!confirm('Revoke access for this member? They will need re-approval to log in again.')) return;
    
    try {
        const { data: user } = await window.supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();
        
        const { error } = await window.supabase
            .from('profiles')
            .update({ is_approved: false })
            .eq('id', userId);
        
        if (error) throw error;
        
        showIslamicNotification(`⏳ Access revoked for ${user?.full_name || 'user'} - Needs re-approval`, 'warning');
        
        await Promise.all([
            loadStats(),
            loadAllMembers(),
            loadPendingUsers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Revoke error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
    }
};

// ===== APPROVE USER (Both Big Admin AND Small Admin can do this) - FIXED WITH FORCE UPDATE =====
window.approveUser = async function(userId) {
    if (!isBigAdmin && !isSmallAdmin) {
        showIslamicNotification("Only admins can approve users", "error");
        return;
    }
    
    // Show loading state on the approve button
    const approveBtn = document.querySelector(`.user-card[data-user-id="${userId}"] .btn-approve`);
    if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...';
    }
    
    try {
        console.log("✨ Approving member:", userId);
        
        // Get user details for notification
        const { data: user, error: fetchError } = await window.supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', userId)
            .single();
        
        if (fetchError) {
            console.error("Error finding user:", fetchError);
            showIslamicNotification("Couldn't find this member.", "error");
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.innerHTML = '<i class="fas fa-check"></i> Approve';
            }
            return;
        }
        
        console.log("Found user to approve:", user.full_name);
        
        // Update the user's approval status
        const { data: updateResult, error } = await window.supabase
            .from('profiles')
            .update({ is_approved: true })
            .eq('id', userId)
            .select();
        
        if (error) {
            console.error("Approve error:", error);
            showIslamicNotification("Unable to approve: " + error.message, "error");
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.innerHTML = '<i class="fas fa-check"></i> Approve';
            }
            return;
        }
        
        console.log("✅ Member approved successfully:", user.full_name);
        console.log("Update result:", updateResult);
        
        // VERIFY: Check if the user is now approved
        const { data: verifyData, error: verifyError } = await window.supabase
            .from('profiles')
            .select('is_approved')
            .eq('id', userId)
            .single();
        
        if (!verifyError && verifyData) {
            console.log("Verification - User is_approved status:", verifyData.is_approved);
        }
        
        showIslamicNotification(`🎉 ${user?.full_name || 'Member'} approved!`, 'success');
        
        // FORCE REFRESH: Clear cache and reload all data
        console.log("🔄 Force refreshing all dashboard data...");
        
        // Clear local cache
        window.allMembersData = null;
        
        // Reload all sections in sequence with a small delay to ensure fresh data
        await loadStats();
        await new Promise(resolve => setTimeout(resolve, 200));
        await loadPendingUsers();
        await new Promise(resolve => setTimeout(resolve, 200));
        await loadAllMembers();
        await new Promise(resolve => setTimeout(resolve, 200));
        await loadRecentActivity();
        
        console.log("✅ All data force refreshed after approval");
        
        // Also manually trigger a filter refresh to update the displayed list
        setTimeout(() => {
            if (window.allMembersData) {
                renderMembers(window.allMembersData);
            }
        }, 500);
        
    } catch (err) {
        console.error("Approval error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = '<i class="fas fa-check"></i> Approve';
        }
    }
};

// ===== REJECT USER - COMPLETE DELETION (Both Big Admin AND Small Admin can do this) =====
window.rejectUser = async function(userId) {
    if (!isBigAdmin && !isSmallAdmin) {
        showIslamicNotification("Only admins can reject users", "error");
        return;
    }
    
    if (!confirm('Delete this user permanently?')) return;
    
    // Show loading state on the reject button
    const rejectBtn = document.querySelector(`.user-card[data-user-id="${userId}"] .btn-reject`);
    if (rejectBtn) {
        rejectBtn.disabled = true;
        rejectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Declining...';
    }
    
    try {
        console.log("Declining member:", userId);
        
        const { data: user, error: fetchError } = await window.supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .single();
        
        if (fetchError) {
            console.error("Error finding user:", fetchError);
            showIslamicNotification("Couldn't find this member request.", "error");
            if (rejectBtn) {
                rejectBtn.disabled = false;
                rejectBtn.innerHTML = '<i class="fas fa-times"></i> Decline';
            }
            return;
        }
        
        showIslamicNotification("Deleting user account...", "info", 3000);
        
        const { error: profileError } = await window.supabase
            .from('profiles')
            .delete()
            .eq('id', userId);
        
        if (profileError) {
            console.error("Error deleting profile:", profileError);
            showIslamicNotification("Error deleting profile: " + profileError.message, "error");
            if (rejectBtn) {
                rejectBtn.disabled = false;
                rejectBtn.innerHTML = '<i class="fas fa-times"></i> Decline';
            }
            return;
        }
        
        console.log("✅ Profile deleted successfully");
        showIslamicNotification(`✅ ${user?.full_name || user?.email} deleted`, 'success');
        
        // Force refresh all data
        await Promise.all([
            loadStats(),
            loadPendingUsers(),
            loadAllMembers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Rejection error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
        if (rejectBtn) {
            rejectBtn.disabled = false;
            rejectBtn.innerHTML = '<i class="fas fa-times"></i> Decline';
        }
    }
};

// ===== VIEW USER DETAILS =====
window.viewUserDetails = function(userId, name, email) {
    const detailsPopup = document.createElement('div');
    detailsPopup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 2rem;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(11, 94, 59, 0.3);
        z-index: 10000;
        max-width: 90%;
        width: 400px;
        border: 2px solid #0b5e3b;
        animation: fadeIn 0.3s ease;
    `;
    
    detailsPopup.innerHTML = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <i class="fas fa-user-circle" style="font-size: 4rem; color: #0b5e3b;"></i>
            <h2 style="color: #0b5e3b; margin: 1rem 0 0.5rem;">Member Details</h2>
        </div>
        <div style="border-top: 1px solid rgba(11, 94, 59, 0.1); padding-top: 1.5rem;">
            <p style="margin: 0.8rem 0;"><strong style="color: #0b5e3b;">Name:</strong> ${name || 'Not provided'}</p>
            <p style="margin: 0.8rem 0;"><strong style="color: #0b5e3b;">Email:</strong> ${email}</p>
            <p style="margin: 0.8rem 0;"><strong style="color: #0b5e3b;">User ID:</strong> <small>${userId}</small></p>
        </div>
        <div style="text-align: center; margin-top: 2rem;">
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: #0b5e3b;
                color: white;
                border: none;
                padding: 0.8rem 2rem;
                border-radius: 50px;
                cursor: pointer;
                font-size: 1rem;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(11, 94, 59, 0.3);
            ">Close</button>
        </div>
    `;
    
    document.body.appendChild(detailsPopup);
    
    setTimeout(() => {
        document.addEventListener('click', function closePopup(e) {
            if (!detailsPopup.contains(e.target)) {
                detailsPopup.remove();
                document.removeEventListener('click', closePopup);
            }
        });
    }, 100);
};

// ===== FILTER MEMBERS =====
window.filterMembers = function(filterType) {
    console.log("🔍 Filtering members:", filterType);
    
    if (!window.allMembersData) {
        loadAllMembers();
        return;
    }
    
    let filtered = [];
    
    switch(filterType) {
        case 'pending':
            filtered = window.allMembersData.filter(u => !u.is_approved);
            break;
        case 'approved':
            filtered = window.allMembersData.filter(u => u.is_approved === true && u.role === 'member');
            break;
        case 'admin':
            filtered = window.allMembersData.filter(u => u.role === 'admin' || u.role === 'small_admin');
            break;
        case 'all':
        default:
            filtered = window.allMembersData;
            break;
    }
    
    renderMembers(filtered);
    showIslamicNotification(`Showing ${filtered.length} members`, 'info', 2000);
    document.getElementById('membersSection').scrollIntoView({ behavior: 'smooth' });
};

function setupSearch() {
    const searchBox = document.getElementById('memberSearch');
    if (!searchBox) return;
    
    searchBox.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (!window.allMembersData) return;
        
        if (searchTerm.length < 2) {
            renderMembers(window.allMembersData);
            return;
        }
        
        const filtered = window.allMembersData.filter(user => 
            user.full_name && user.full_name.toLowerCase().includes(searchTerm)
        );
        
        renderMembers(filtered);
        if (filtered.length > 0) {
            showIslamicNotification(`Found ${filtered.length} members`, 'info', 1500);
        }
    });
}

async function loadRecentActivity() {
    try {
        console.log("📝 Checking recent community activity...");
        
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        const container = document.getElementById('activityTimeline');
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history" style="color: #0b5e3b;"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        data.forEach((user, index) => {
            const date = new Date(user.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const action = user.is_approved ? 'joined' : 'requested to join';
            const icon = user.is_approved ? '✅' : '🆕';
            const hiddenClass = index >= 5 ? 'hidden' : '';
            
            html += `
                <div class="timeline-item ${hiddenClass}" data-index="${index}">
                    <div class="timeline-icon">
                        ${icon}
                    </div>
                    <div class="timeline-content">
                        <p><strong>${user.full_name || 'A new member'}</strong> ${action}</p>
                        <small>${date}</small>
                    </div>
                </div>
            `;
        });
        
        if (data.length > 5) {
            html += `
                <button class="view-all-btn" id="viewAllActivityBtn" onclick="toggleAllActivity()">
                    <i class="fas fa-chevron-down"></i> View All (${data.length - 5} more)
                </button>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (err) {
        console.error("Error loading activity:", err);
    }
}

window.toggleAllActivity = function() {
    const hiddenItems = document.querySelectorAll('.timeline-item.hidden');
    const viewBtn = document.getElementById('viewAllActivityBtn');
    
    if (hiddenItems.length > 0) {
        hiddenItems.forEach(item => {
            item.classList.add('show');
        });
        
        viewBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Show Less';
        
        viewBtn.onclick = function() {
            const allItems = document.querySelectorAll('.timeline-item');
            allItems.forEach((item, index) => {
                if (index >= 5) {
                    item.classList.remove('show');
                }
            });
            viewBtn.innerHTML = `<i class="fas fa-chevron-down"></i> View All (${allItems.length - 5} more)`;
            viewBtn.onclick = toggleAllActivity;
            document.getElementById('activitySection').scrollIntoView({ behavior: 'smooth' });
        };
        
        showIslamicNotification(`Showing all activities`, 'info', 2000);
    }
};

function setupAdminListeners() {
    const refreshPending = document.getElementById('refreshPending');
    if (refreshPending) {
        if (!isBigAdmin && !isSmallAdmin && refreshPending) refreshPending.style.display = 'none';
        else {
            refreshPending.addEventListener('click', async function(e) {
                e.preventDefault();
                const btn = this;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
                await loadPendingUsers();
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                showIslamicNotification("✨ Pending approvals updated!", "success", 1500);
            });
        }
    }
    
    const refreshMembers = document.getElementById('refreshMembers');
    if (refreshMembers) {
        refreshMembers.addEventListener('click', async function(e) {
            e.preventDefault();
            const btn = this;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            await loadAllMembers();
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            showIslamicNotification("👥 Member list updated!", "success", 1500);
        });
    }
    
    const refreshActivity = document.getElementById('refreshActivity');
    if (refreshActivity) {
        refreshActivity.addEventListener('click', async function(e) {
            e.preventDefault();
            const btn = this;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            await loadRecentActivity();
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            showIslamicNotification("📝 Activity timeline updated!", "success", 1500);
        });
    }
    
    const logoutBtns = document.querySelectorAll('#logoutBtn, .logout-btn-sidebar');
    logoutBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', async function() {
                await window.supabase.auth.signOut();
                showIslamicNotification("👋 See you next time, Admin!", "info", 2000);
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 2000);
            });
        }
    });
}

// Add animation styles dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .badge.small-admin {
        background: #f59e0b;
        color: white;
        border: none;
    }
    
    .badge.view-only {
        background: #f59e0b;
        color: white;
    }
    
    .btn-small-admin {
        background: #f59e0b;
        color: white;
        border: none;
    }
    
    .btn-small-admin:hover {
        background: #e67e22;
        transform: translateY(-2px);
    }
`;
document.head.appendChild(style);