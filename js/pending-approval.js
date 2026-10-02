// js/pending-approval.js
// Handles pending approval with:
// 1. Persistent Supabase session
// 2. Manual approval check
// 3. Realtime approval updates
// 4. 10-second polling fallback
// 5. Full page refresh fallback
// 6. Logout only when the user explicitly chooses Logout

console.log("⏳ Pending Approval page loaded");

let currentUser = null;
let checkInterval = null;
let realtimeSubscription = null;
let isChecking = false;
let isRedirecting = false;

// DOM Elements
const checkStatusBtn = document.getElementById('checkStatusBtn');
const logoutBtn = document.getElementById('logoutBtn');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-indicator span');

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
    initializePendingPage();
});

async function initializePendingPage() {
    // Wait for Supabase client
    if (!window.supabase || !window.supabase.auth) {
        console.log("⏳ Waiting for Supabase...");
        setTimeout(initializePendingPage, 100);
        return;
    }

    console.log("✅ Supabase ready");

    // Setup buttons immediately
    setupEventListeners();

    // Load and verify the current session
    const sessionLoaded = await loadCurrentSession();

    if (!sessionLoaded) {
        return;
    }

    // Setup realtime approval monitoring
    await setupRealtimeSubscription();

    // Setup automatic polling fallback
    setupPolling();
}

// ============================================================
// LOAD CURRENT SESSION
// ============================================================

async function loadCurrentSession() {
    try {
        console.log("🔐 Checking existing Supabase session...");

        const {
            data: { session },
            error
        } = await window.supabase.auth.getSession();

        if (error) {
            console.error("Session error:", error);

            showStatus(
                'error',
                'Unable to restore your session. Refreshing...'
            );

            // Give the browser a moment, then use the refresh fallback
            setTimeout(() => {
                window.location.reload();
            }, 1500);

            return false;
        }

        // No session means the user has signed out or the session expired
        if (!session || !session.user) {
            console.log("❌ No active session found.");

            window.location.href = '../index.html';
            return false;
        }

        currentUser = session.user;

        console.log("✅ Existing session restored");
        console.log("👤 User ID:", currentUser.id);

        // Check approval immediately
        await checkApprovalStatus(false);

        return true;

    } catch (err) {
        console.error("Error loading current session:", err);

        showStatus(
            'error',
            'Something went wrong. Refreshing...'
        );

        setTimeout(() => {
            window.location.reload();
        }, 1500);

        return false;
    }
}

// ============================================================
// GET CURRENT USER AGAIN IF NECESSARY
// ============================================================

async function ensureCurrentUser() {
    if (currentUser) {
        return true;
    }

    try {
        const {
            data: { session },
            error
        } = await window.supabase.auth.getSession();

        if (error || !session || !session.user) {
            return false;
        }

        currentUser = session.user;
        return true;

    } catch (err) {
        console.error("Unable to restore current user:", err);
        return false;
    }
}

// ============================================================
// CHECK APPROVAL STATUS
// ============================================================

async function checkApprovalStatus(useRefreshFallback = true) {
    if (isChecking || isRedirecting) {
        return;
    }

    isChecking = true;

    setCheckingState(true);

    try {
        // STEP 1: Make sure the existing Supabase session exists
        const hasUser = await ensureCurrentUser();

        if (!hasUser) {
            console.warn("⚠️ No session found.");

            if (useRefreshFallback) {
                showStatus(
                    'error',
                    'Session needs to be restored. Refreshing...'
                );

                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                window.location.href = '../index.html';
            }

            return;
        }

        // STEP 2: Check the user's profile
        console.log("🔎 Checking approval for:", currentUser.id);

        const { data: profile, error } = await window.supabase
            .from('profiles')
            .select('is_approved, role')
            .eq('id', currentUser.id)
            .single();

        if (error) {
            console.error("❌ Approval check failed:", error);

            if (useRefreshFallback) {
                showStatus(
                    'error',
                    'Could not check approval. Refreshing...'
                );

                // FULL PAGE REFRESH FALLBACK
                setTimeout(() => {
                    window.location.reload();
                }, 1200);
            } else {
                showStatus(
                    'error',
                    'Could not check approval. Please try again.'
                );
            }

            return;
        }

        if (!profile) {
            console.error("❌ Profile not found.");

            showStatus(
                'error',
                'Your account profile could not be found.'
            );

            return;
        }

        // STEP 3: APPROVED
        if (profile.is_approved === true) {
            console.log("✅ User is approved!");

            isRedirecting = true;

            showStatus(
                'approved',
                'Approved! Redirecting...'
            );

            // Stop polling
            stopPolling();

            // Stop realtime subscription
            await stopRealtimeSubscription();

            // Small delay so the user can see the success message
            setTimeout(() => {
                redirectUserByRole(profile.role);
            }, 700);

            return;
        }

        // STEP 4: STILL WAITING
        console.log("⏳ User is still waiting for approval.");

        showStatus(
            'pending',
            // 'Waiting for approval...'
        );

    } catch (err) {
        console.error("❌ Unexpected approval check error:", err);

        if (useRefreshFallback) {
            showStatus(
                'error',
                'Unable to check status. Refreshing...'
            );

            setTimeout(() => {
                window.location.reload();
            }, 1200);
        } else {
            showStatus(
                'error',
                'Unable to check status. Please try again.'
            );
        }

    } finally {
        isChecking = false;

        if (!isRedirecting) {
            setCheckingState(false);
        }
    }
}

// ============================================================
// REDIRECT USER BASED ON ROLE
// ============================================================

function redirectUserByRole(role) {
    if (role === 'admin' || role === 'small_admin') {
        console.log("👑 Admin detected - opening admin dashboard");
        window.location.href = 'admin.html';
    } else {
        console.log("👤 Member detected - opening home");
        window.location.href = 'home.html';
    }
}

// ============================================================
// BUTTON LOADING STATE
// ============================================================

function setCheckingState(checking) {
    if (!checkStatusBtn) {
        return;
    }

    if (checking) {
        checkStatusBtn.disabled = true;
        checkStatusBtn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Checking...';
    } else {
        checkStatusBtn.disabled = false;
        checkStatusBtn.innerHTML =
            '<i class="fas fa-sync-alt"></i> Check Approval Status';
    }
}

// ============================================================
// UPDATE STATUS UI
// ============================================================

function showStatus(status, message) {
    if (statusDot) {
        statusDot.className = 'status-dot';

        if (status === 'pending') {
            statusDot.classList.add('pulse');
            statusDot.style.background = '#f59e0b';
        }

        else if (status === 'approved') {
            statusDot.style.background = '#10b981';
            statusDot.style.animation = 'none';
        }

        else if (status === 'error') {
            statusDot.style.background = '#ef4444';
            statusDot.style.animation = 'none';
        }
    }

    if (statusText) {
        statusText.textContent = message;
    }
}

// Keep old function name available in case other code uses it
function updateStatus(status, message) {
    showStatus(status, message);
}

// ============================================================
// REALTIME APPROVAL SUBSCRIPTION
// ============================================================

async function setupRealtimeSubscription() {
    if (!currentUser || isRedirecting) {
        return;
    }

    try {
        await stopRealtimeSubscription();

        console.log(
            "🔌 Setting up realtime approval monitoring..."
        );

        realtimeSubscription = window.supabase
            .channel('profile-approval-' + currentUser.id)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${currentUser.id}`
                },
                async (payload) => {
                    console.log(
                        "📨 Profile update received:",
                        payload
                    );

                    if (
                        payload.new &&
                        payload.new.is_approved === true
                    ) {
                        console.log(
                            "✅ Approval received through realtime!"
                        );

                        isRedirecting = true;

                        showStatus(
                            'approved',
                            'Approved! Redirecting...'
                        );

                        stopPolling();

                        await stopRealtimeSubscription();

                        setTimeout(() => {
                            redirectUserByRole(
                                payload.new.role
                            );
                        }, 700);
                    }
                }
            )
            .subscribe((status) => {
                console.log(
                    "📡 Realtime subscription:",
                    status
                );

                if (status === 'SUBSCRIBED') {
                    console.log(
                        "✅ Live approval monitoring active"
                    );
                }

                if (status === 'CHANNEL_ERROR') {
                    console.warn(
                        "⚠️ Realtime unavailable. Polling will continue."
                    );
                }
            });

    } catch (err) {
        console.error(
            "Realtime setup error:",
            err
        );

        // This is not fatal.
        // Polling will continue as the fallback.
    }
}

// ============================================================
// STOP REALTIME
// ============================================================

async function stopRealtimeSubscription() {
    if (!realtimeSubscription) {
        return;
    }

    try {
        await window.supabase.removeChannel(
            realtimeSubscription
        );
    } catch (err) {
        console.warn(
            "Could not remove realtime channel:",
            err
        );
    }

    realtimeSubscription = null;
}

// ============================================================
// POLLING FALLBACK
// ============================================================

function setupPolling() {
    stopPolling();

    // Check every 10 seconds
    checkInterval = setInterval(async () => {
        if (!isChecking && !isRedirecting) {
            console.log(
                "⏰ Automatic approval check..."
            );

            // Do NOT force a page refresh for normal polling.
            await checkApprovalStatus(false);
        }
    }, 10000);

    console.log(
        "⏰ Approval polling enabled: every 10 seconds"
    );
}

// ============================================================
// STOP POLLING
// ============================================================

function stopPolling() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

    // CHECK APPROVAL STATUS BUTTON
    if (checkStatusBtn) {
        checkStatusBtn.addEventListener(
            'click',
            async function () {

                if (isChecking || isRedirecting) {
                    return;
                }

                console.log(
                    "🔄 Manual approval check requested"
                );

                // First attempt: internal check.
                // If it fails, use full page refresh fallback.
                await checkApprovalStatus(true);
            }
        );
    }

    // LOGOUT BUTTON
    if (logoutBtn) {
        logoutBtn.addEventListener(
            'click',
            async function () {

                try {
                    logoutBtn.disabled = true;

                    logoutBtn.innerHTML =
                        '<i class="fas fa-spinner fa-spin"></i> Logging out...';

                    // Stop automatic checks
                    stopPolling();

                    // Stop realtime monitoring
                    await stopRealtimeSubscription();

                    // IMPORTANT:
                    // This is the action that removes the
                    // user's Supabase authentication session.
                    const { error } =
                        await window.supabase.auth.signOut();

                    if (error) {
                        throw error;
                    }

                    console.log(
                        "👋 User signed out successfully."
                    );

                    // Next visit will require authentication.
                    window.location.href = '../index.html';

                } catch (err) {

                    console.error(
                        "Logout error:",
                        err
                    );

                    logoutBtn.disabled = false;

                    logoutBtn.innerHTML =
                        '<i class="fas fa-sign-out-alt"></i> Logout';

                    showStatus(
                        'error',
                        'Could not log out. Please try again.'
                    );
                }
            }
        );
    }
}

// ============================================================
// CLEANUP WHEN PAGE IS LEFT
// ============================================================

window.addEventListener(
    'beforeunload',
    function () {
        stopPolling();

        if (realtimeSubscription) {
            try {
                window.supabase.removeChannel(
                    realtimeSubscription
                );
            } catch (err) {
                console.warn(
                    "Realtime cleanup error:",
                    err
                );
            }
        }
    }
);

console.log(
    "✅ Pending Approval system ready"
);