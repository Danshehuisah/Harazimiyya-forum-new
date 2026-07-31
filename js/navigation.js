// js/navigation.js - Professional Back Button with Proper Page History
// FIXED: Correct path handling and sessionStorage persistence

console.log("🧭 Navigation handler initializing...");

// Page history stack - persists across page loads using sessionStorage
let pageHistory = [];
let isExiting = false;
let isNavigating = false;
let initializationComplete = false;

// Define all your app pages with correct paths
// IMPORTANT: Update these paths to match your actual file structure
const pages = {
    'index.html': { name: 'Login', path: '../index.html', isHome: false, order: 0 },
    'home.html': { name: 'Home', path: 'home.html', isHome: true, order: 1 },
    'admin.html': { name: 'Admin Dashboard', path: 'admin.html', isHome: true, order: 1 },
    'chat.html': { name: 'Chat', path: 'chat.html', isHome: false, order: 2 },
    'events.html': { name: 'Programs', path: 'events.html', isHome: false, order: 2 },
    'gallery.html': { name: 'Gallery', path: 'gallery.html', isHome: false, order: 2 },
    'map.html': { name: 'Map', path: 'map.html', isHome: false, order: 2 },
    'announcement.html': { name: 'Announcements', path: 'announcement.html', isHome: false, order: 2 },
    'sheikh-history.html': { name: 'Sheikh History', path: 'sheikh-history.html', isHome: false, order: 2 }
};

function getCurrentPageName() {
    const path = window.location.pathname;
    let pageName = path.split('/').pop();
    // Remove query parameters if any
    pageName = pageName.split('?')[0];
    return pageName || 'index.html';
}

function getCurrentDirectory() {
    const path = window.location.pathname;
    const parts = path.split('/');
    parts.pop(); // Remove the file name
    return parts.join('/') + '/';
}

function getFullPath(pageName) {
    const currentDir = getCurrentDirectory();
    // If page is in a subdirectory, adjust path
    if (pageName === 'index.html') {
        return '../' + pageName;
    }
    // For all other pages, they should be in the same directory as current page
    return currentDir + pageName;
}

function isHomePage() {
    const pageName = getCurrentPageName();
    return pageName === 'home.html' || pageName === 'admin.html';
}

function isLoginPage() {
    return getCurrentPageName() === 'index.html';
}

// ========== SESSIONSTORAGE FUNCTIONS ==========
function loadHistoryFromStorage() {
    const savedHistory = sessionStorage.getItem('pageHistory');
    if (savedHistory) {
        try {
            const parsed = JSON.parse(savedHistory);
            // Clean consecutive duplicates
            pageHistory = [];
            for (let i = 0; i < parsed.length; i++) {
                if (i === 0 || parsed[i] !== parsed[i-1]) {
                    pageHistory.push(parsed[i]);
                }
            }
            console.log("📦 Loaded history from storage:", pageHistory);
        } catch(e) {
            console.error("Failed to load history:", e);
            pageHistory = [];
        }
    } else {
        pageHistory = [];
        console.log("📦 No saved history found, starting fresh");
    }
}

function saveHistoryToStorage() {
    sessionStorage.setItem('pageHistory', JSON.stringify(pageHistory));
    console.log("💾 Saved history to storage:", pageHistory);
}

function showExitConfirmation() {
    const existingDialog = document.querySelector('.exit-dialog-overlay');
    if (existingDialog) existingDialog.remove();
    
    const dialog = document.createElement('div');
    dialog.className = 'exit-dialog-overlay';
    dialog.innerHTML = `
        <div class="exit-dialog-content">
            <i class="fas fa-heart" style="font-size: 48px; color: #0b5e3b; margin-bottom: 20px;"></i>
            <h3>Exit Harazimiyya?</h3>
            <p>Are you sure you want to exit the app?</p>
            <div class="exit-dialog-buttons">
                <button class="exit-dialog-cancel" id="exitCancelBtn">Cancel</button>
                <button class="exit-dialog-confirm" id="exitConfirmBtn">Exit</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    
    if (!document.getElementById('exit-dialog-styles')) {
        const styles = document.createElement('style');
        styles.id = 'exit-dialog-styles';
        styles.textContent = `
            .exit-dialog-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
                display: flex; align-items: center; justify-content: center;
                z-index: 999999; animation: fadeIn 0.2s ease;
            }
            .exit-dialog-content {
                background: white; border-radius: 24px; padding: 24px;
                text-align: center; max-width: 280px; width: 85%;
                animation: slideUp 0.3s ease; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            }
            .exit-dialog-content h3 { color: #0b5e3b; margin: 16px 0 8px; font-size: 20px; }
            .exit-dialog-content p { color: #666; margin-bottom: 24px; font-size: 14px; }
            .exit-dialog-buttons { display: flex; gap: 12px; margin-top: 10px; }
            .exit-dialog-cancel, .exit-dialog-confirm {
                flex: 1; padding: 12px; border-radius: 12px;
                font-size: 16px; font-weight: 600; cursor: pointer;
            }
            .exit-dialog-cancel { background: #f0f0f0; border: none; color: #333; }
            .exit-dialog-confirm { background: #0b5e3b; border: none; color: white; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `;
        document.head.appendChild(styles);
    }
    
    const cancelBtn = document.getElementById('exitCancelBtn');
    const confirmBtn = document.getElementById('exitConfirmBtn');
    
    if (cancelBtn) {
        cancelBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            dialog.remove();
            isExiting = false;
        };
    }
    
    if (confirmBtn) {
        confirmBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            dialog.remove();
            isExiting = false;
            
            sessionStorage.removeItem('pageHistory');
            
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.exitApp().catch(function(err) {
                    console.error("Error exiting app:", err);
                });
            } else {
                window.close();
            }
        };
    }
    
    dialog.onclick = function(e) {
        if (e.target === dialog) {
            dialog.remove();
            isExiting = false;
        }
    };
}

// Main back button handler
function handleBackButton() {
    console.log("🔙 Back button pressed");
    console.log("Current page:", getCurrentPageName());
    console.log("📜 Page history stack:", pageHistory);
    
    if (isNavigating) {
        console.log("Already navigating, ignoring back button");
        return true;
    }
    
    // PRIORITY 1: Close lightbox if open
    const lightbox = document.querySelector('.lightbox-modal');
    if (lightbox) {
        console.log("Closing lightbox");
        const closeBtn = lightbox.querySelector('.lightbox-close');
        if (closeBtn) closeBtn.click();
        return true;
    }
    
    // PRIORITY 2: Close any modal dialog
    const modals = document.querySelectorAll('.modal:not(.hidden), .tiktok-upload-modal:not(.hidden)');
    if (modals.length > 0) {
        const topModal = modals[modals.length - 1];
        console.log("Closing modal:", topModal.className);
        const closeBtn = topModal.querySelector('.close-modal, .close-btn, .cancel-btn, .modal-close, .tiktok-close-btn');
        if (closeBtn) closeBtn.click();
        else topModal.classList.add('hidden');
        return true;
    }
    
    // PRIORITY 3: Close sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('active')) {
        const closeBtn = document.getElementById('closeSidebar');
        if (closeBtn) closeBtn.click();
        console.log("Closed sidebar");
        return true;
    }
    
    // PRIORITY 4: Close context menu if open
    const contextMenu = document.querySelector('.context-menu, .longpress-menu');
    if (contextMenu) {
        contextMenu.remove();
        console.log("Closed context menu");
        return true;
    }
    
    // PRIORITY 5: Close reply indicator if open
    const replyIndicator = document.getElementById('replyIndicator');
    if (replyIndicator) {
        const cancelBtn = document.getElementById('cancelReplyBtn');
        if (cancelBtn) cancelBtn.click();
        console.log("Closed reply indicator");
        return true;
    }
    
    // PRIORITY 6: Navigate through history properly
    if (pageHistory.length >= 2) {
        // Remove current page from history
        const currentPage = pageHistory.pop();
        console.log(`❌ Removed current page "${currentPage}" from history`);
        
        saveHistoryToStorage();
        
        // Get the previous page
        const previousPage = pageHistory[pageHistory.length - 1];
        console.log(`🔄 Navigating BACK to: ${previousPage}`);
        
        // Build the correct path
        let targetPath = previousPage;
        
        // Handle special case for index.html (login page)
        if (previousPage === 'index.html') {
            targetPath = '../index.html';
        }
        
        console.log(`📍 Target path: ${targetPath}`);
        
        if (targetPath !== window.location.pathname.split('/').pop()) {
            isNavigating = true;
            window.location.href = targetPath;
            setTimeout(() => { isNavigating = false; }, 500);
            return true;
        }
    }
    
    // PRIORITY 7: On home page with only 1 page in history - show exit confirmation
    if (isHomePage() && pageHistory.length <= 1) {
        if (!isExiting) {
            console.log("🏠 On home page - showing exit confirmation");
            isExiting = true;
            showExitConfirmation();
            setTimeout(function() { isExiting = false; }, 1000);
        }
        return true;
    }
    
    // PRIORITY 8: Not on home page but no history - go to home page
    if (!isLoginPage() && pageHistory.length <= 1) {
        console.log("📱 No history - going to home page");
        pageHistory = ['home.html'];
        saveHistoryToStorage();
        isNavigating = true;
        window.location.href = 'home.html';
        setTimeout(() => { isNavigating = false; }, 500);
        return true;
    }
    
    return false;
}

// Add current page to history
function addToHistory() {
    const currentPageName = getCurrentPageName();
    
    if (currentPageName === 'index.html') {
        console.log("Login page - not adding to history");
        return;
    }
    
    const lastPage = pageHistory[pageHistory.length - 1];
    if (lastPage === currentPageName) {
        console.log(`Page "${currentPageName}" already at end of history, not adding duplicate`);
        return;
    }
    
    pageHistory.push(currentPageName);
    saveHistoryToStorage();
    console.log(`✅ Added "${currentPageName}" to history. History:`, pageHistory);
}

// Clear history
function clearHistory() {
    const currentPage = getCurrentPageName();
    
    if (currentPage !== 'index.html') {
        pageHistory = [currentPage];
        console.log(`History cleared, current page "${currentPage}" added as first entry`);
    } else {
        pageHistory = [];
        console.log("History cleared (login page)");
    }
    
    saveHistoryToStorage();
}

// Track navigation from link clicks
function trackNavigation() {
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (link && link.href && !link.href.startsWith('javascript:')) {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#')) {
                let targetPage = href.split('/').pop();
                targetPage = targetPage.split('?')[0];
                
                const currentPage = getCurrentPageName();
                
                console.log(`🔗 Link clicked: ${currentPage} → ${targetPage}`);
                
                if (targetPage !== currentPage && targetPage !== 'index.html') {
                    setTimeout(function() {
                        addToHistory();
                    }, 100);
                }
            }
        }
    });
}

// Setup back button handler
function setupBackButtonHandler() {
    // For Capacitor Android
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        const App = window.Capacitor.Plugins.App;
        App.addListener('backButton', function() {
            console.log("📱 Android back button pressed");
            handleBackButton();
        });
        console.log("✅ Capacitor back button handler set up");
    }
    
    // For Browser
    window.addEventListener('popstate', function(event) {
        console.log("🌐 Browser popstate event detected");
        event.preventDefault();
        event.stopPropagation();
        history.pushState(null, null, window.location.href);
        handleBackButton();
    });
    
    history.pushState(null, null, window.location.href);
    console.log("✅ Back button handler set up for browser");
}

// Debug helper
function showHistoryDebug() {
    console.log("=== HISTORY DEBUG ===");
    console.log("Current page:", getCurrentPageName());
    console.log("Current directory:", getCurrentDirectory());
    console.log("History stack:", pageHistory);
    console.log("History length:", pageHistory.length);
    console.log("Is home page:", isHomePage());
    console.log("Is login page:", isLoginPage());
    console.log("===================");
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    if (initializationComplete) {
        console.log("Navigation already initialized, skipping");
        return;
    }
    
    console.log("🚀 Initializing navigation handler...");
    console.log("Current page:", getCurrentPageName());
    console.log("Current path:", window.location.pathname);
    
    loadHistoryFromStorage();
    
    const currentPage = getCurrentPageName();
    
    if (isLoginPage()) {
        clearHistory();
    } else {
        const lastPage = pageHistory[pageHistory.length - 1];
        if (lastPage !== currentPage) {
            addToHistory();
        } else {
            console.log(`Current page "${currentPage}" already at end of history`);
        }
    }
    
    setupBackButtonHandler();
    trackNavigation();
    
    setTimeout(showHistoryDebug, 500);
    initializationComplete = true;
});

// Expose globally
window.handleBackButton = handleBackButton;
window.clearHistory = clearHistory;
window.getHistory = function() { return [...pageHistory]; };
window.addToHistory = addToHistory;
window.showHistoryDebug = showHistoryDebug;