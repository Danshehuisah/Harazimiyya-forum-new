// js/auth.js - COMPLETE FIXED VERSION WITH OTP VERIFICATION & GOOGLE OAUTH
// UPDATED: Added Google OAuth login/signup

document.addEventListener('DOMContentLoaded', function() {
    console.log("✨ Getting things ready for you...");
    
    // Wait for Supabase to be ready
    function waitForSupabase() {
        if (window.supabase && window.supabase.auth) {
            console.log("✅ All set! Let's get you started...");
            initializeAuth();
        } else {
            console.log("⏳ Just a moment...");
            setTimeout(waitForSupabase, 100);
        }
    }
    
    waitForSupabase();
});

function initializeAuth() {
    // Get DOM elements
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const forgotPassword = document.getElementById('forgotPassword');
    const backToLogin = document.getElementById('backToLogin');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const authCard = document.getElementById('authCard');
    const registerCard = document.getElementById('registerCard');
    const forgotCard = document.getElementById('forgotCard');
    
    // Google buttons
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const googleRegisterBtn = document.getElementById('googleRegisterBtn');
    
    // Password toggle elements
    const togglePassword = document.getElementById('togglePassword');
    const toggleRegPassword = document.getElementById('toggleRegPassword');
    const toggleRegConfirmPassword = document.getElementById('toggleRegConfirmPassword');
    
    const password = document.getElementById('password');
    const regPassword = document.getElementById('regPassword');
    const regConfirmPassword = document.getElementById('regConfirmPassword');

    // ================= PASSWORD VISIBILITY TOGGLE =================
    function setupPasswordToggle(toggleBtn, inputField) {
        if (toggleBtn && inputField) {
            toggleBtn.addEventListener('click', function() {
                const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
                inputField.setAttribute('type', type);
                
                const icon = this.querySelector('i');
                if (type === 'text') {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }
    }

    setupPasswordToggle(togglePassword, password);
    setupPasswordToggle(toggleRegPassword, regPassword);
    setupPasswordToggle(toggleRegConfirmPassword, regConfirmPassword);

   // ================= GOOGLE OAUTH =================
async function signInWithGoogle() {
    try {
        const googleBtn = document.activeElement;
        if (googleBtn) {
            googleBtn.disabled = true;
            googleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redirecting to Google...';
        }

        // Get the current origin (works for localhost AND GitHub Pages)
        const origin = window.location.origin;
        
        // Determine the correct redirect path
        let redirectTo;
        
        // Check if running on GitHub Pages
        if (origin.includes('github.io')) {
            // GitHub Pages: use the full path with repository name
            // Example: https://yourusername.github.io/repository-name/www/html/auth-callback.html
            const path = window.location.pathname;
            const basePath = path.substring(0, path.lastIndexOf('/'));
            redirectTo = origin + basePath + '/auth-callback.html';
        } else {
            // Local development
            redirectTo = origin + '/www/html/auth-callback.html';
        }

        console.log("🔄 Redirecting to:", redirectTo);

        const { data, error } = await window.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        });

        if (error) throw error;

    } catch (err) {
        console.error("Google sign in error:", err);
        showCustomAlert('Could not sign in with Google. Please try again.', 'error');
        
        const googleBtn = document.querySelector('#googleLoginBtn, #googleRegisterBtn');
        if (googleBtn) {
            googleBtn.disabled = false;
            googleBtn.innerHTML = `
                <img src="https://www.google.com/favicon.ico" alt="Google" class="google-icon">
                Continue with Google
            `;
        }
    }
}

    // Setup Google buttons
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', signInWithGoogle);
    }
    if (googleRegisterBtn) {
        googleRegisterBtn.addEventListener('click', signInWithGoogle);
    }

    // ================= SWITCH FORMS =================
    if (showRegister) {
        showRegister.addEventListener('click', () => {
            authCard.classList.add('hidden');
            registerCard.classList.remove('hidden');
            if (forgotCard) forgotCard.classList.add('hidden');
        });
    }

    if (showLogin) {
        showLogin.addEventListener('click', () => {
            registerCard.classList.add('hidden');
            authCard.classList.remove('hidden');
            if (forgotCard) forgotCard.classList.add('hidden');
        });
    }
    
    if (forgotPassword) {
        forgotPassword.addEventListener('click', () => {
            authCard.classList.add('hidden');
            forgotCard.classList.remove('hidden');
        });
    }
    
    if (backToLogin) {
        backToLogin.addEventListener('click', () => {
            forgotCard.classList.add('hidden');
            authCard.classList.remove('hidden');
        });
    }

    // ================= EMAIL VALIDATION =================
    function isValidGmail(email) {
        const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
        return gmailRegex.test(email);
    }

    // ================= FRIENDLY CUSTOM ALERT =================
    function showCustomAlert(message, type = 'info') {
        const existingAlert = document.querySelector('.custom-alert');
        if (existingAlert) existingAlert.remove();
        
        const alert = document.createElement('div');
        alert.className = `custom-alert ${type}`;
        
        let icon = 'fa-info-circle';
        let bgColor = '#3b82f6';
        
        if (type === 'success' || message.includes('✅') || message.includes('CHECK YOUR GMAIL')) {
            icon = 'fa-check-circle';
            bgColor = '#10b981';
        } else if (type === 'error' || message.includes('❌') || message.includes('sorry')) {
            icon = 'fa-exclamation-circle';
            bgColor = '#ef4444';
        } else if (type === 'warning') {
            icon = 'fa-exclamation-triangle';
            bgColor = '#f59e0b';
        }
        
        alert.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;
        
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
            max-width: 400px;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            font-size: 15px;
            line-height: 1.5;
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    }

    // ================= FORGOT PASSWORD =================
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', async () => {
            const email = document.getElementById('resetEmail').value.trim();
            
            if (!email) {
                showCustomAlert('🤔 Oops! Please enter your email address so we can help you.', 'error');
                return;
            }
            
            if (!isValidGmail(email)) {
                showCustomAlert('📧 For now, we only support Gmail addresses. Please use your Gmail account.', 'error');
                return;
            }
            
            resetPasswordBtn.disabled = true;
            resetPasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

            try {
                const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + 'html/reset-password.html',
                });
                
                if (error) throw error;
                
                showCustomAlert('✅ Done! We\'ve sent a password reset link to your email. Please check your inbox (and spam folder just in case!).', 'success');
                
                setTimeout(() => {
                    forgotCard.classList.add('hidden');
                    authCard.classList.remove('hidden');
                    document.getElementById('resetEmail').value = '';
                }, 3000);
                
            } catch (err) {
                console.error("Reset password error:", err);
                
                if (err.message.includes('Email not found')) {
                    showCustomAlert('🤷 Hmm, we don\'t have an account with that email. Would you like to create one?', 'error');
                } else if (err.message.includes('rate limit')) {
                    showCustomAlert('⏰ Too many attempts! Please wait a few minutes before trying again.', 'error');
                } else {
                    showCustomAlert('😕 Something went wrong. Please check your internet connection and try again.', 'error');
                }
            } finally {
                resetPasswordBtn.disabled = false;
                resetPasswordBtn.innerHTML = 'Send Reset Link';
            }
        });
    }

    // ================= LOGIN =================
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (!email || !password) {
                showCustomAlert('🔑 Please enter both your email and password to continue.', 'error');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

            try {
                const { data, error } = await window.supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                console.log("✅ Login successful, checking approval status...");

                const { data: profile, error: profileError } = await window.supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                if (profileError) {
                    console.warn("Profile fetch warning:", profileError);
                    await window.supabase.auth.signOut();
                    showCustomAlert('❌ Account setup incomplete. Please contact admin.', 'error');
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = 'Login';
                    return;
                }

                if (!profile.is_approved) {
                    console.log("User not approved yet");
                    await window.supabase.auth.signOut();
                    showCustomAlert('⏳ Your account is waiting for admin approval. You\'ll receive an email once approved!', 'warning');
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = 'Login';
                    return;
                }

                console.log("✅ User approved, role:", profile.role);
                
                if (profile.role === 'admin' || profile.role === 'small_admin') {
                    console.log("Admin or Small Admin detected - redirecting to admin dashboard");
                    window.location.href = 'html/admin.html';
                } else {
                    console.log("Regular member - redirecting to home");
                    window.location.href = 'html/home.html';
                }

            } catch (err) {
                console.error("Login error:", err);
                
                if (err.message.includes('Email not confirmed')) {
                    showCustomAlert('📧 Please check your email and click the confirmation link to activate your account.', 'error');
                } else if (err.message.includes('Invalid login credentials')) {
                    showCustomAlert('🔐 Hmm, the email or password doesn\'t match. Want to try again or reset your password?', 'error');
                } else {
                    showCustomAlert('😓 Sorry, we couldn\'t log you in. Please check your internet connection and try again.', 'error');
                }
                
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'Login';
            }
        });
    }

    // ================= REGISTER WITH OTP VERIFICATION =================
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirmPassword').value;

            if (!name || !email || !password) {
                showCustomAlert('📝 Please fill in all the fields to create your account.', 'error');
                return;
            }

            if (name.length < 2) {
                showCustomAlert('👤 Please enter your full name so we know what to call you!', 'error');
                return;
            }

            if (!isValidGmail(email)) {
                showCustomAlert('📧 For now, we only support Gmail addresses. Please use your Gmail account.', 'error');
                return;
            }

            if (password.length < 6) {
                showCustomAlert('🔒 For your security, please use at least 6 characters for your password.', 'error');
                return;
            }

            if (password !== confirm) {
                showCustomAlert('🤔 The passwords don\'t match. Let\'s try again!', 'error');
                return;
            }

            registerBtn.disabled = true;
            registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating your account...';

            try {
                const { data, error } = await window.supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name
                        }
                    }
                });

                if (error) throw error;

                const isRealRegistration = data?.user?.identities && data.user.identities.length > 0;
                const hasConfirmationSent = data?.user?.confirmation_sent_at !== null;
                
                if (isRealRegistration && hasConfirmationSent) {
                    // ===== AUTO-CREATE PROFILE =====
                    try {
                        console.log("📝 Creating profile for new user:", data.user.id);
                        
                        const { error: profileError } = await window.supabase
                            .from('profiles')
                            .insert([{
                                id: data.user.id,
                                email: email,
                                full_name: name,
                                role: 'member',
                                is_approved: false,
                                created_at: new Date().toISOString()
                            }]);
                        
                        if (profileError) {
                            console.error("Error creating profile:", profileError);
                            showCustomAlert('⚠️ Account created but profile setup had an issue. Please contact admin.', 'warning');
                        } else {
                            console.log("✅ Profile created successfully");
                        }
                    } catch (profileErr) {
                        console.error("Profile creation error:", profileErr);
                    }
                    
                    // ===== NEW OTP FLOW: Store email and redirect to OTP verification page =====
                    localStorage.setItem('pending_verification_email', email);
                    
                    showCustomAlert('🎉 Account created! We\'ve sent an 8-digit code to your email.', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'html/otp-verification.html';
                    }, 1500);
                    
                    // Clear form
                    document.getElementById('regName').value = '';
                    document.getElementById('regEmail').value = '';
                    document.getElementById('regPassword').value = '';
                    document.getElementById('regConfirmPassword').value = '';
                    
                } else {
                    // This email is already registered
                    showCustomAlert('📧 This email is already registered. Would you like to log in instead?', 'error');
                    registerBtn.disabled = false;
                    registerBtn.innerHTML = 'Create Account';
                    
                    setTimeout(() => {
                        registerCard.classList.add('hidden');
                        authCard.classList.remove('hidden');
                        document.getElementById('email').value = email;
                    }, 3000);
                }

            } catch (err) {
                console.error("Registration error:", err);
                
                if (err.message.includes('User already registered')) {
                    showCustomAlert('👋 Hey! You already have an account with this email. Want to log in instead?', 'error');
                    
                    setTimeout(() => {
                        registerCard.classList.add('hidden');
                        authCard.classList.remove('hidden');
                        document.getElementById('email').value = email;
                    }, 2000);
                } else {
                    showCustomAlert('😕 Something went wrong. Please check your internet connection and try again.', 'error');
                }
                
                registerBtn.disabled = false;
                registerBtn.innerHTML = 'Create Account';
            }
        });
    }

    // ================= CHECK EXISTING SESSION =================
    window.supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
            try {
                const { data: profile } = await window.supabase
                    .from('profiles')
                    .select('role, is_approved')
                    .eq('id', session.user.id)
                    .single();
                
                if (profile && profile.is_approved) {
                    if (profile.role === 'admin' || profile.role === 'small_admin') {
                        console.log("Existing session: Admin or Small Admin - redirecting to admin dashboard");
                        window.location.href = 'html/admin.html';
                    } else {
                        console.log("Existing session: Regular member - redirecting to home");
                        window.location.href = 'html/home.html';
                    }
                }
            } catch (err) {
                console.log("👋 Welcome back!");
            }
        }
    });
}

// Add animation styles
const authStyles = document.createElement('style');
authStyles.textContent = `
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
`;
document.head.appendChild(authStyles);