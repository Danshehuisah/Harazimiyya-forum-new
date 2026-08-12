// js/home.js - Fixed with group profile for all members and Android back button fix
console.log("🏠 HOME PAGE LOADING");

// Global variables
let currentUserId = null;
let currentUserProfile = null;
let isAdmin = false;
let clickTimer = null; // For double click detection

document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM loaded, initializing home page...");
    
    function initializeHome() {
        if (!window.supabase) {
            console.log("Waiting for Supabase...");
            setTimeout(initializeHome, 100);
            return;
        }
        
        loadHomeData();
        
        // Setup Android back button handler
        setupAndroidBackButton();
    }
    
    initializeHome();
});

// Make function globally available for the button
window.forceRefreshCount = function() {
    console.log("🔄 FORCE REFRESHING COUNT...");
    if (currentUserId) {
        forceRefreshUnreadCount(currentUserId);
    } else {
        alert("Please wait for page to load first");
    }
};

async function forceRefreshUnreadCount(userId) {
    try {
        console.log("🔍 Directly querying unread count for user:", userId);
        
        // Direct query to count unread messages from OTHER people
        const { count, error } = await window.supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .or(`receiver_id.is.null,receiver_id.eq.${userId}`)
            .is('read_at', null)
            .neq('sender_id', userId); // EXCLUDE messages sent by current user
        
        if (error) {
            console.error("Error in force refresh:", error);
            alert("Error refreshing count: " + error.message);
            return;
        }
        
        console.log(`✅ Database says unread messages from others: ${count}`);
        
        // Update the display
        const countEl = document.getElementById('messageCount');
        if (countEl) {
            const oldValue = countEl.textContent;
            countEl.textContent = count || 0;
            console.log(`Counter updated from ${oldValue} to ${count}`);
            
            // Visual feedback
            countEl.style.color = '#ffd700';
            setTimeout(() => {
                countEl.style.color = '';
            }, 500);
        }
        
    } catch (err) {
        console.error("Error in forceRefreshUnreadCount:", err);
        alert("Error refreshing count");
    }
}

async function loadHomeData() {
    try {
        const { data: { user }, error } = await window.supabase.auth.getUser();
        
        if (error || !user) {
            console.log("No user, redirecting to login");
            window.location.href = '../index.html';
            return;
        }
        
        currentUserId = user.id;
        console.log("User logged in:", user.email);
        console.log("User ID:", currentUserId);
        
        await loadUserProfile(user.id);
        await loadGroupProfile(); // Load Harazimiyya group profile for ALL members
        await loadAllCounts(user.id);
        
        setupSidebar();
        setupLogoutButtons();
        setupClickableBoxes();
        
        // Setup profile picture upload functionality
        setTimeout(() => {
            setupProfilePictureUploads();
        }, 500);
        
    } catch (err) {
        console.error("Home initialization error:", err);
    }
}

// ================= LOAD GROUP PROFILE (HARAZIMIYYA) =================
async function loadGroupProfile() {
    try {
        console.log("Loading Harazimiyya group profile...");
        
        // Try to get group settings from database
        const { data, error } = await window.supabase
            .from('group_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle();
        
        if (error) {
            console.log("Group settings table not ready:", error.message);
            return;
        }
        
        console.log("Group profile data:", data);
        
        // Update group logo in sidebar - FOR ALL MEMBERS TO SEE
        const logoArea = document.querySelector('.logo-area');
        if (logoArea) {
            // Clear existing content
            logoArea.innerHTML = '';
            
            if (data && data.logo_url) {
                // Show the group logo as clickable image
                const img = document.createElement('img');
                img.src = data.logo_url;
                img.alt = "Harazimiyya Logo";
                img.style.cssText = "width: 32px; height: 32px; border-radius: 8px; object-fit: cover; cursor: pointer;";
                img.setAttribute('data-logo-url', data.logo_url);
                logoArea.appendChild(img);
            } else {
                // Show default mosque icon (also clickable)
                const icon = document.createElement('i');
                icon.className = 'fas fa-mosque';
                icon.style.cursor = 'pointer';
                icon.setAttribute('data-default', 'true');
                logoArea.appendChild(icon);
            }
            
            // Add group name
            const span = document.createElement('span');
            span.className = 'logo-text';
            span.textContent = data?.group_name || 'Harazimiyya';
            logoArea.appendChild(span);
        }
        
        console.log("Group profile loaded for all members");
        
    } catch (err) {
        console.error("Error loading group profile:", err);
    }
}

async function loadUserProfile(userId) {
    try {
        console.log("Loading profile for:", userId);
        
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        
        if (error) {
            console.error("Profile error:", error);
            return;
        }
        
        if (!data) {
            console.log("No profile found, creating one...");
            
            const { data: { user } } = await window.supabase.auth.getUser();
            
            const { error: insertError } = await window.supabase
                .from('profiles')
                .insert([{
                    id: userId,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || 'Member',
                    role: 'member',
                    is_approved: true
                }]);
            
            if (insertError) {
                console.error("Failed to create profile:", insertError);
                return;
            }
            
            return loadUserProfile(userId);
        }
        
        currentUserProfile = data;
        isAdmin = data.role === 'admin';
        
        console.log("Profile loaded:", data.full_name);
        console.log("Is Admin:", isAdmin);
        
        // Update user name in multiple places
        updateUserNames(data.full_name);
        
        // Load profile picture if exists
        if (data.avatar_url) {
            updateProfilePictures(data.avatar_url);
        }
        
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

// ===== Format name to show only last name after Welcome =====
function formatWelcomeName(fullName) {
    if (!fullName || fullName === 'Member') return 'Member';
    
    // Split the name by spaces
    const nameParts = fullName.trim().split(' ');
    
    // If there's at least 2 parts (first and last name)
    if (nameParts.length >= 2) {
        // Return the last part (assumes format: "First Last")
        return nameParts[nameParts.length - 1];
    }
    
    // If only one part, return that part
    return nameParts[0];
}

// ===== Update all user name displays =====
function updateUserNames(fullName) {
    // Update sidebar user name
    const sidebarUserName = document.getElementById('sidebarUserName');
    if (sidebarUserName) {
        sidebarUserName.textContent = fullName || 'Member';
    }
    
    // Update welcome message with formatted name
    const welcomeNameEl = document.getElementById('welcomeName');
    if (welcomeNameEl) {
        const formattedName = formatWelcomeName(fullName);
        welcomeNameEl.textContent = formattedName;
    }
}

// ===== Update profile pictures =====
function updateProfilePictures(avatarUrl) {
    // Update sidebar user avatar
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) {
        // Clear existing content
        userAvatar.innerHTML = '';
        
        if (avatarUrl) {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = "Profile";
            img.style.cssText = "width: 100%; height: 100%; border-radius: 16px; object-fit: cover;";
            userAvatar.appendChild(img);
        } else {
            const icon = document.createElement('i');
            icon.className = 'fas fa-user';
            userAvatar.appendChild(icon);
        }
    }
}

// ===== Show full-size logo viewer (for ALL members) =====
function showFullSizeLogo(logoUrl) {
    // Remove any existing viewer
    const existingViewer = document.querySelector('.logo-viewer');
    if (existingViewer) existingViewer.remove();
    
    const viewer = document.createElement('div');
    viewer.className = 'logo-viewer';
    viewer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20000;
        cursor: pointer;
        animation: fadeIn 0.2s ease;
    `;
    
    const img = document.createElement('img');
    if (logoUrl) {
        img.src = logoUrl;
    } else {
        // If no logo, show default mosque icon
        img.outerHTML = '<i class="fas fa-mosque" style="font-size: 100px; color: #0b5e3b;"></i>';
    }
    img.style.cssText = "max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 16px;";
    
    viewer.appendChild(img);
    document.body.appendChild(viewer);
    
    // Close on click
    viewer.addEventListener('click', function() {
        viewer.remove();
    });
}

// ===== Setup profile picture uploads =====
function setupProfilePictureUploads() {
    // Make user avatar clickable for profile picture upload (OWN PROFILE)
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) {
        userAvatar.style.cursor = 'pointer';
        userAvatar.title = 'Click to upload your profile picture';
        
        userAvatar.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            showProfilePictureOptions('user');
        });
    }
    
    // Make group logo clickable with different behaviors for admin vs members
    const logoArea = document.querySelector('.logo-area');
    if (logoArea) {
        // Get the logo element (img or i)
        const logoElement = logoArea.querySelector('img') || logoArea.querySelector('i');
        
        if (logoElement) {
            // For ALL members: single click to view full-size
            logoElement.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                if (isAdmin) {
                    // For admin: handle double click detection
                    if (clickTimer) {
                        // Double click detected
                        clearTimeout(clickTimer);
                        clickTimer = null;
                        
                        // Double click: view full-size logo
                        const logoUrl = logoElement.tagName === 'IMG' ? logoElement.src : null;
                        showFullSizeLogo(logoUrl);
                    } else {
                        // First click - wait to see if it's double click
                        clickTimer = setTimeout(() => {
                            // Single click for admin: show upload options
                            clickTimer = null;
                            showProfilePictureOptions('group');
                        }, 250);
                    }
                } else {
                    // For members: single click always views full-size
                    const logoUrl = logoElement.tagName === 'IMG' ? logoElement.src : null;
                    showFullSizeLogo(logoUrl);
                }
            });
            
            // For admin: also add double click listener
            if (isAdmin) {
                logoElement.addEventListener('dblclick', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Clear any pending single click
                    if (clickTimer) {
                        clearTimeout(clickTimer);
                        clickTimer = null;
                    }
                    
                    // Double click: view full-size logo
                    const logoUrl = logoElement.tagName === 'IMG' ? logoElement.src : null;
                    showFullSizeLogo(logoUrl);
                });
            }
            
            // Set appropriate title
            if (isAdmin) {
                logoElement.title = 'Single click: Edit logo | Double click: View full-size';
            } else {
                logoElement.title = 'Click to view full-size logo';
            }
        }
    }
}

// ===== Show profile picture options =====
function showProfilePictureOptions(type) {
    // Remove any existing modal
    const existingModal = document.querySelector('.profile-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'profile-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 24px;
        max-width: 320px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.2s ease;
    `;
    
    const title = type === 'user' ? 'Your Profile Picture' : 'Harazimiyya Group Logo';
    
    content.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #0b5e3b; font-size: 18px;">${title}</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <button id="uploadProfileBtn" style="padding: 12px; background: #0b5e3b; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                <i class="fas fa-upload"></i> Upload New Picture
            </button>
            <button id="deleteProfileBtn" style="padding: 12px; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                <i class="fas fa-trash"></i> Delete Picture
            </button>
            <button id="cancelProfileBtn" style="padding: 12px; background: #f0f0f0; color: #333; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                <i class="fas fa-times"></i> Cancel
            </button>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    document.getElementById('uploadProfileBtn').addEventListener('click', function() {
        fileInput.click();
    });
    
    document.getElementById('deleteProfileBtn').addEventListener('click', function() {
        modal.remove();
        if (type === 'user') {
            deleteProfilePicture();
        } else {
            deleteGroupLogo();
        }
        fileInput.remove();
    });
    
    document.getElementById('cancelProfileBtn').addEventListener('click', function() {
        modal.remove();
        fileInput.remove();
    });
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
            fileInput.remove();
        }
    });
    
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            modal.remove();
            if (type === 'user') {
                uploadProfilePicture(file);
            } else {
                uploadGroupLogo(file);
            }
        }
        fileInput.remove();
    });
}

// ===== Upload profile picture (OWN PROFILE) =====
async function uploadProfilePicture(file) {
    if (!file || !currentUserId) return;
    
    try {
        // Show loading state
        showNotification('Uploading your profile picture...', 'info');
        
        // Check file type
        if (!file.type.startsWith('image/')) {
            showNotification('Please select an image file (JPEG, PNG, GIF, WEBP)', 'error');
            return;
        }
        
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('File too large. Max size is 5MB', 'error');
            return;
        }
        
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUserId}/profile.${fileExt}`;
        const filePath = fileName;
        
        console.log('Uploading to path:', filePath);
        
        const { error: uploadError } = await window.supabase.storage
            .from('profile-pictures')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: urlData } = window.supabase.storage
            .from('profile-pictures')
            .getPublicUrl(filePath);
        
        const publicUrl = urlData.publicUrl;
        console.log('File uploaded, public URL:', publicUrl);
        
        // Update profile with avatar URL
        const { error: updateError } = await window.supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', currentUserId);
        
        if (updateError) throw updateError;
        
        // Update UI
        updateProfilePictures(publicUrl);
        
        showNotification('✅ Your profile picture updated!', 'success');
        
    } catch (err) {
        console.error("Error uploading profile picture:", err);
        
        if (err.message && err.message.includes('Bucket not found')) {
            showNotification('Storage bucket not configured. Please contact admin.', 'error');
        } else if (err.message && err.message.includes('mime type')) {
            showNotification('Please select a valid image file (JPEG, PNG, GIF, WEBP)', 'error');
        } else {
            showNotification('❌ Failed to upload picture: ' + (err.message || 'Unknown error'), 'error');
        }
    }
}

// ===== Delete profile picture (OWN PROFILE) =====
async function deleteProfilePicture() {
    if (!currentUserId) return;
    
    try {
        // Show confirmation
        if (!await confirmAction('Delete your profile picture?')) return;
        
        // Update profile to remove avatar URL
        const { error } = await window.supabase
            .from('profiles')
            .update({ avatar_url: null })
            .eq('id', currentUserId);
        
        if (error) throw error;
        
        // Update UI
        updateProfilePictures(null);
        
        showNotification('✅ Your profile picture deleted!', 'success');
        
    } catch (err) {
        console.error("Error deleting profile picture:", err);
        showNotification('❌ Failed to delete picture', 'error');
    }
}

// ===== Upload group logo (HARAZIMIYYA GROUP PROFILE - ADMIN ONLY) =====
async function uploadGroupLogo(file) {
    if (!file || !isAdmin) {
        showNotification('Only admin can change group logo', 'error');
        return;
    }
    
    try {
        // Show loading state
        showNotification('Uploading group logo...', 'info');
        
        // Check file type
        if (!file.type.startsWith('image/')) {
            showNotification('Please select an image file (JPEG, PNG, GIF, WEBP)', 'error');
            return;
        }
        
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            showNotification('File too large. Max size is 10MB', 'error');
            return;
        }
        
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `group-logo.${fileExt}`;
        const filePath = fileName;
        
        console.log('Uploading group logo to:', filePath);
        
        const { error: uploadError } = await window.supabase.storage
            .from('group-assets')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: urlData } = window.supabase.storage
            .from('group-assets')
            .getPublicUrl(filePath);
        
        const publicUrl = urlData.publicUrl;
        console.log('Group logo uploaded, URL:', publicUrl);
        
        // Update group_settings
        const { error: upsertError } = await window.supabase
            .from('group_settings')
            .upsert({ 
                id: 1, 
                logo_url: publicUrl,
                group_name: 'Harazimiyya',
                updated_at: new Date().toISOString(), 
                updated_by: currentUserId 
            });
        
        if (upsertError) throw upsertError;
        
        // Update UI for ALL members to see
        await loadGroupProfile(); // Reload the group profile to show new logo
        
        // Re-setup click handlers for the new logo
        setupProfilePictureUploads();
        
        showNotification('✅ Harazimiyya group logo updated! All members can now see it.', 'success');
        
    } catch (err) {
        console.error("Error uploading group logo:", err);
        
        if (err.message && err.message.includes('Bucket not found')) {
            showNotification('Storage bucket not configured. Please contact admin.', 'error');
        } else if (err.message && err.message.includes('mime type')) {
            showNotification('Please select a valid image file (JPEG, PNG, GIF, WEBP)', 'error');
        } else {
            showNotification('❌ Failed to upload group logo: ' + (err.message || 'Unknown error'), 'error');
        }
    }
}

// ===== Delete group logo (HARAZIMIYYA GROUP PROFILE - ADMIN ONLY) =====
async function deleteGroupLogo() {
    if (!isAdmin) {
        showNotification('Only admin can delete group logo', 'error');
        return;
    }
    
    try {
        // Show confirmation
        if (!await confirmAction('Delete Harazimiyya group logo?')) return;
        
        // Update settings to remove logo URL
        const { error } = await window.supabase
            .from('group_settings')
            .update({ logo_url: null })
            .eq('id', 1);
        
        if (error) throw error;
        
        // Update UI for ALL members
        await loadGroupProfile(); // Reload to show default icon
        
        // Re-setup click handlers for the new icon
        setupProfilePictureUploads();
        
        showNotification('✅ Harazimiyya group logo deleted! All members will see the default icon.', 'success');
        
    } catch (err) {
        console.error("Error deleting group logo:", err);
        showNotification('❌ Failed to delete group logo', 'error');
    }
}

// ===== Confirm action helper =====
function confirmAction(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            animation: fadeIn 0.2s ease;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 24px;
            max-width: 280px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.2s ease;
        `;
        
        content.innerHTML = `
            <p style="margin: 0 0 20px 0; color: #333; font-size: 16px;">${message}</p>
            <div style="display: flex; gap: 12px;">
                <button id="confirmYesBtn" style="flex: 1; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer;">Yes</button>
                <button id="confirmNoBtn" style="flex: 1; padding: 10px; background: #f0f0f0; color: #333; border: none; border-radius: 8px; cursor: pointer;">No</button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        document.getElementById('confirmYesBtn').onclick = function() {
            modal.remove();
            resolve(true);
        };
        
        document.getElementById('confirmNoBtn').onclick = function() {
            modal.remove();
            resolve(false);
        };
        
        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.remove();
                resolve(false);
            }
        };
    });
}

// ===== Show notification =====
function showNotification(message, type) {
    // Remove existing notification
    const existing = document.querySelector('.home-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'home-notification';
    
    let bgColor = '#3b82f6'; // info blue
    if (type === 'success') bgColor = '#10b981';
    if (type === 'error') bgColor = '#ef4444';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${bgColor};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10002;
        animation: slideIn 0.3s ease;
        font-size: 14px;
        max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ================= LOAD ALL COUNTS =================
async function loadAllCounts(userId) {
    try {
        await Promise.all([
            loadAnnouncementCount(),
            loadEventCount(),
            loadUnreadMessageCount(userId)
        ]);
        
        console.log("All counts loaded successfully");
        
    } catch (err) {
        console.error("Error loading counts:", err);
    }
}

// ================= ANNOUNCEMENT COUNT =================
async function loadAnnouncementCount() {
    try {
        const { count, error } = await window.supabase
            .from('announcements')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.log("Announcements table not ready:", error.message);
            return;
        }
        
        const countEl = document.getElementById('announcementCount');
        if (countEl) {
            countEl.textContent = count || 0;
            console.log(`Announcement count: ${count || 0}`);
        }
        
    } catch (err) {
        console.error("Error loading announcements:", err);
    }
}

// ================= EVENT COUNT =================
async function loadEventCount() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        const { count, error } = await window.supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .gte('date', todayStr)
            .not('status', 'in', '("cancelled","completed")');
        
        if (error) {
            console.log("Events table not ready:", error.message);
            return;
        }
        
        const countEl = document.getElementById('eventCount');
        if (countEl) {
            countEl.textContent = count || 0;
            console.log(`Upcoming events count: ${count || 0}`);
        }
        
    } catch (err) {
        console.error("Error loading events:", err);
    }
}

// ================= FIXED UNREAD MESSAGES COUNT =================
async function loadUnreadMessageCount(userId) {
    try {
        console.log("📨 Counting unread messages from OTHER people for user:", userId);
        
        const { count, error } = await window.supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .or(`receiver_id.is.null,receiver_id.eq.${userId}`)
            .is('read_at', null)
            .neq('sender_id', userId);
        
        if (error) {
            console.error("Error counting unread messages:", error);
            const countEl = document.getElementById('messageCount');
            if (countEl) countEl.textContent = '0';
            return;
        }
        
        console.log(`✅ Unread messages from others: ${count}`);
        
        const countEl = document.getElementById('messageCount');
        if (countEl) {
            countEl.textContent = count || 0;
        }
        
    } catch (err) {
        console.error("Error in loadUnreadMessageCount:", err);
        const countEl = document.getElementById('messageCount');
        if (countEl) countEl.textContent = '0';
    }
}

// ================= UPDATED SIDEBAR SETUP WITH BODY CLASS =================
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebar');
    const closeBtn = document.getElementById('closeSidebar');
    const overlay = document.getElementById('overlay');
    const body = document.body;
    
    if (!sidebar) return;
    
    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sidebar.classList.add('active');
            if (overlay) overlay.classList.add('active');
            body.classList.add('sidebar-open');
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            body.classList.remove('sidebar-open');
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            body.classList.remove('sidebar-open');
        });
    }
}

// ================= LOGOUT BUTTONS =================
function setupLogoutButtons() {
    const logoutBtns = document.querySelectorAll('#logoutBtn, .logout-btn-sidebar');
    
    logoutBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', async () => {
                await window.supabase.auth.signOut();
                window.location.href = '../index.html';
            });
        }
    });
}

// ================= CLICKABLE BOXES =================
function setupClickableBoxes() {
    const announcementBox = document.getElementById('announcementBox');
    const eventBox = document.getElementById('eventBox');
    const messageBox = document.getElementById('messageBox');
    
    if (announcementBox) {
        announcementBox.addEventListener('click', () => {
            window.location.href = 'announcement.html';
        });
    }
    
    if (eventBox) {
        eventBox.addEventListener('click', () => {
            window.location.href = 'events.html';
        });
    }
    
    if (messageBox) {
        messageBox.addEventListener('click', () => {
            window.location.href = 'chat-list.html';
        });
    }
}

// ================= ANDROID BACK BUTTON FIX FOR SIDEBAR =================
function setupAndroidBackButton() {
    console.log("📱 Setting up Android back button handler for sidebar");
    
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (!sidebar || !overlay) {
        console.log("Sidebar or overlay not found");
        return;
    }
    
    // Track if sidebar is open
    let isSidebarOpen = false;
    
    // Watch for sidebar class changes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'class') {
                isSidebarOpen = sidebar.classList.contains('active');
                console.log("Sidebar state changed:", isSidebarOpen ? "OPEN" : "CLOSED");
            }
        });
    });
    
    observer.observe(sidebar, { attributes: true });
    
    // Handle Android back button
    function handleBackButton() {
        if (isSidebarOpen) {
            console.log("🔙 Back pressed - closing sidebar");
            // Close sidebar
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
            
            // Prevent default back behavior
            return true;
        }
        // Let default back behavior happen (navigate away)
        return false;
    }
    
    // For Android Chrome and modern browsers
    window.addEventListener('popstate', function(event) {
        if (handleBackButton()) {
            // If we handled it, push a new state to stay on same page
            history.pushState(null, null, window.location.href);
            event.preventDefault();
        }
    });
    
    // For older Android browsers
    document.addEventListener('backbutton', function(event) {
        if (handleBackButton()) {
            event.preventDefault();
        }
    }, false);
    
    // Initialize history state
    history.pushState(null, null, window.location.href);
    
    // Also handle hardware back button through touch events (edge swipe)
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            // Potential edge swipe detection
            const touch = event.changedTouches[0];
            if (touch && touch.clientX < 30) { // Swipe from left edge
                if (isSidebarOpen) {
                    // This might be a back gesture, close sidebar
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                    document.body.classList.remove('sidebar-open');
                    event.preventDefault();
                }
            }
        }
        lastTouchEnd = now;
    }, false);
    
    console.log("✅ Android back button handler setup complete");
}

// Add animation styles if they don't exist
if (!document.getElementById('homeAnimationStyles')) {
    const style = document.createElement('style');
    style.id = 'homeAnimationStyles';
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
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from {
                transform: translateY(20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
}

messageBox