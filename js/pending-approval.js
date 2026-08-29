// js/pending-approval.js
// Handles the pending approval page with real-time updates

console.log("⏳ Pending Approval page loaded");

let currentUser = null;
let checkInterval = null;
let realtimeSubscription = null;
let isChecking = false;

// DOM Elements
const checkStatusBtn = document.getElementById('checkStatusBtn');
const logoutBtn = document.getElementById('logoutBtn');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-indicator span');

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    initializePendingPage();
});

async function initializePendingPage() {
    if (!window.supabase) {
        setTimeout(initializePendingPage, 100);
        return;
    }

    await loadCurrentUser();
    await setupRealtimeSubscription();
    setupPolling();
    setupEventListeners();
}

// ============================================================
// LOAD CURRENT USER
// ============================================================

async function loadCurrentUser() {
    try {
        const { data: { user }, error } = await window.supabase.auth.getUser();
        
        if (error || !user) {
            console.log("No user found, redirecting to login");
            window.location.href = '../index.html';
            return;
        }

        currentUser = user;
        console.log("User ID:", currentUser.id);

        // Check if user is already approved
        await checkApprovalStatus();

    } catch (err) {
        console.error("Error loading user:", err);
    }
}

// ============================================================
// CHECK APPROVAL STATUS
// ============================================================

async function checkApprovalStatus() {
    if (isChecking) return;
    isChecking = true;

    if (checkStatusBtn) {
        checkStatusBtn.disabled = true;
        checkStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
    }

    try {
        const { data: profile, error } = await window.supabase
            .from('profiles')
            .select('is_approved, role')
            .eq('id', currentUser.id)
            .single();

        if (error) {
            console.error("Error checking approval:", error);
            updateStatus('error', 'Failed to check status. Please try again.');
            return;
        }

        if (profile?.is_approved) {
            console.log("✅ User is approved! Redirecting...");
            updateStatus('approved', 'Approved! Redirecting...');
            
            // Redirect based on role
            if (profile.role === 'admin' || profile.role === 'small_admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'home.html';
            }
            return;
        }

        // Still pending
        updateStatus('pending', 'Waiting for approval...');

    } catch (err) {
        console.error("Error checking approval:", err);
        updateStatus('error', 'Error checking status. Please try again.');
    } finally {
        isChecking = false;
        if (checkStatusBtn) {
            checkStatusBtn.disabled = false;
            checkStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Check Status';
        }
    }
}

// ============================================================
// UPDATE STATUS UI
// ============================================================

function updateStatus(status, message) {
    if (statusDot) {
        statusDot.className = 'status-dot';
        if (status === 'pending') {
            statusDot.classList.add('pulse');
            statusDot.style.background = '#f59e0b';
        } else if (status === 'approved') {
            statusDot.style.background = '#10b981';
            statusDot.style.animation = 'none';
        } else if (status === 'error') {
            statusDot.style.background = '#ef4444';
            statusDot.style.animation = 'none';
        }
    }

    if (statusText) {
        statusText.textContent = message;
    }
}

// ============================================================
// REALTIME SUBSCRIPTION (LIVE UPDATES)
// ============================================================

async function setupRealtimeSubscription() {
    if (!currentUser) return;

    if (realtimeSubscription) {
        await realtimeSubscription.unsubscribe();
    }

    console.log("🔌 Setting up realtime subscription for approval status...");

    realtimeSubscription = window.supabase
        .channel('profile-updates')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${currentUser.id}`
        }, (payload) => {
            console.log("📨 Profile update received:", payload);
            
            if (payload.new?.is_approved === true) {
                console.log("✅ User approved via realtime!");
                updateStatus('approved', 'Approved! Redirecting...');
                
                // Small delay to show the success state
                setTimeout(() => {
                    if (payload.new?.role === 'admin' || payload.new?.role === 'small_admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'home.html';
                    }
                }, 1000);
            }
        })
        .subscribe((status) => {
            console.log("📡 Subscription status:", status);
        });
}

// ============================================================
// POLLING (FALLBACK)
// ============================================================

function setupPolling() {
    // Check every 10 seconds as fallback
    if (checkInterval) {
        clearInterval(checkInterval);
    }

    checkInterval = setInterval(async () => {
        // Only check if not already checking
        if (!isChecking) {
            await checkApprovalStatus();
        }
    }, 10000);

    console.log("⏰ Polling set to check every 10 seconds");
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // Check Status button
    if (checkStatusBtn) {
        checkStatusBtn.addEventListener('click', checkApprovalStatus);
    }

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            // Clean up
            if (realtimeSubscription) {
                await realtimeSubscription.unsubscribe();
            }
            if (checkInterval) {
                clearInterval(checkInterval);
            }
            
            await window.supabase.auth.signOut();
            window.location.href = '../index.html';
        });
    }
}

// ============================================================
// CLEANUP
// ============================================================

window.addEventListener('beforeunload', function() {
    if (checkInterval) {
        clearInterval(checkInterval);
    }
    if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
    }
});

console.log("✅ Pending Approval page initialized");