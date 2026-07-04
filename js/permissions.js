// js/permissions.js - Handle microphone permissions for Capacitor
console.log("🎤 Permission handler initializing...");

// Check if running in Capacitor
const isCapacitor = !!window.Capacitor;

// Request microphone permission
async function requestMicrophonePermission() {
    console.log("Requesting microphone permission...");
    
    if (!isCapacitor) {
        // For web, just try to use the microphone directly
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log("✅ Web microphone permission granted");
            return true;
        } catch (err) {
            console.error("❌ Web microphone permission denied:", err);
            return false;
        }
    }
    
    // For Capacitor Android/iOS
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AndroidPermissions) {
        try {
            const permissions = window.Capacitor.Plugins.AndroidPermissions;
            
            // Check if permission is already granted
            const checkResult = await permissions.checkPermission({
                permission: 'android.permission.RECORD_AUDIO'
            });
            
            console.log("Permission check result:", checkResult);
            
            if (checkResult.hasPermission) {
                console.log("✅ Microphone permission already granted");
                return true;
            }
            
            // Request permission
            const requestResult = await permissions.requestPermission({
                permission: 'android.permission.RECORD_AUDIO'
            });
            
            console.log("Permission request result:", requestResult);
            
            if (requestResult.granted) {
                console.log("✅ Microphone permission granted");
                return true;
            } else {
                console.log("❌ Microphone permission denied");
                return false;
            }
            
        } catch (err) {
            console.error("Error requesting permission:", err);
            return false;
        }
    } else {
        // Fallback - try to use the microphone directly
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log("✅ Microphone access granted");
            return true;
        } catch (err) {
            console.error("❌ Microphone access denied:", err);
            return false;
        }
    }
}

// Show permission explanation dialog
function showPermissionExplanation() {
    const dialog = document.createElement('div');
    dialog.className = 'permission-dialog-overlay';
    dialog.innerHTML = `
        <div class="permission-dialog-content">
            <i class="fas fa-microphone" style="font-size: 48px; color: #0b5e3b; margin-bottom: 20px;"></i>
            <h3>Microphone Access Needed</h3>
            <p>To send voice messages, Harazimiyya needs access to your microphone.</p>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">Your voice messages are private and only shared in the chat.</p>
            <div class="permission-dialog-buttons">
                <button class="permission-dialog-cancel">Not Now</button>
                <button class="permission-dialog-allow">Allow Microphone</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add styles
    if (!document.getElementById('permission-dialog-styles')) {
        const styles = document.createElement('style');
        styles.id = 'permission-dialog-styles';
        styles.textContent = `
            .permission-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(5px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                animation: fadeIn 0.2s ease;
            }
            
            .permission-dialog-content {
                background: white;
                border-radius: 24px;
                padding: 24px;
                text-align: center;
                max-width: 300px;
                width: 85%;
                animation: slideUp 0.3s ease;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            }
            
            .permission-dialog-content h3 {
                color: #0b5e3b;
                margin: 16px 0 8px;
                font-size: 20px;
            }
            
            .permission-dialog-content p {
                color: #666;
                margin-bottom: 8px;
                font-size: 14px;
                line-height: 1.5;
            }
            
            .permission-dialog-buttons {
                display: flex;
                gap: 12px;
                margin-top: 20px;
            }
            
            .permission-dialog-cancel,
            .permission-dialog-allow {
                flex: 1;
                padding: 12px;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .permission-dialog-cancel {
                background: #f0f0f0;
                border: none;
                color: #333;
            }
            
            .permission-dialog-cancel:hover {
                background: #e0e0e0;
            }
            
            .permission-dialog-allow {
                background: #0b5e3b;
                border: none;
                color: white;
            }
            
            .permission-dialog-allow:hover {
                background: #094c31;
            }
        `;
        document.head.appendChild(styles);
    }
    
    return new Promise((resolve) => {
        const cancelBtn = dialog.querySelector('.permission-dialog-cancel');
        const allowBtn = dialog.querySelector('.permission-dialog-allow');
        
        cancelBtn.onclick = () => {
            dialog.remove();
            resolve(false);
        };
        
        allowBtn.onclick = async () => {
            dialog.remove();
            const granted = await requestMicrophonePermission();
            resolve(granted);
        };
        
        dialog.onclick = (e) => {
            if (e.target === dialog) {
                dialog.remove();
                resolve(false);
            }
        };
    });
}

// Main function to get microphone access
async function getMicrophoneAccess() {
    console.log("🎤 Getting microphone access...");
    
    if (!isCapacitor) {
        // For web, try directly
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            console.log("Web microphone access denied, showing explanation");
            return await showPermissionExplanation();
        }
    }
    
    // For Capacitor
    try {
        // First check if we need to ask for permission
        const hasPermission = await requestMicrophonePermission();
        
        if (hasPermission) {
            // Test if we can actually access the microphone
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                console.log("✅ Microphone test successful");
                return true;
            } catch (err) {
                console.error("Microphone test failed:", err);
                return false;
            }
        } else {
            console.log("Permission denied or not granted, showing explanation");
            return await showPermissionExplanation();
        }
        
    } catch (err) {
        console.error("Error in getMicrophoneAccess:", err);
        return await showPermissionExplanation();
    }
}

// Show notification helper
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<span>${message}</span>`;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#0b5e3b'};
        color: white;
        padding: 12px 24px;
        border-radius: 30px;
        z-index: 10000;
        font-size: 14px;
        white-space: nowrap;
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Expose functions globally
window.getMicrophoneAccess = getMicrophoneAccess;
window.requestMicrophonePermission = requestMicrophonePermission;
window.showPermissionExplanation = showPermissionExplanation;

console.log("🎤 Permission handler ready");