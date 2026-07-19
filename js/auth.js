/**
 * SecureChat Authentication Module
 * Handles login, registration, session management, and XSS protection
 * Security: Uses sessionStorage for temporary auth state
 */

class AuthManager {
    constructor() {
        this.sessionKey = 'securechat_session';
        this.userKey = 'securechat_user';
        this.init();
    }

    /**
     * Initialize authentication system
     */
    init() {
        this.setupEventListeners();
        this.checkExistingSession();
    }

    /**
     * Setup DOM event listeners
     */
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target));
        });

        // Password visibility toggles
        document.querySelectorAll('.password-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });

        // Form submissions
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
    }

    /**
     * Switch between login and register tabs
     * @param {HTMLElement} tab - Clicked tab element
     */
    switchTab(tab) {
        const tabName = tab.getAttribute('data-tab');

        // Update tab active state
        document.querySelectorAll('.auth-tab').forEach(t => {
            t.classList.remove('active');
        });
        tab.classList.add('active');

        // Update form visibility
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.querySelector(`[data-tab-content="${tabName}"]`).classList.add('active');

        // Clear previous errors
        this.clearAllErrors();
    }

    /**
     * Toggle password field visibility
     * @param {Event} e - Click event
     */
    togglePasswordVisibility(e) {
        e.preventDefault();
        const targetId = e.currentTarget.getAttribute('data-target');
        const input = document.getElementById(targetId);

        if (input.type === 'password') {
            input.type = 'text';
            e.currentTarget.classList.add('active');
        } else {
            input.type = 'password';
            e.currentTarget.classList.remove('active');
        }
    }

    /**
     * Validate email format (basic validation)
     * @param {string} email - Email to validate
     * @returns {boolean}
     */
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.length <= 254;
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {object} - Validation result with errors
     */
    validatePassword(password) {
        const errors = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain uppercase letter');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain lowercase letter');
        }

        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain number');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Sanitize and validate input (XSS Protection)
     * @param {string} input - User input
     * @param {string} type - Input type (email, password, text)
     * @returns {object} - Sanitized input and validation result
     */
    sanitizeInput(input, type = 'text') {
        // Remove leading/trailing whitespace
        let sanitized = input.trim();

        // Check for empty input
        if (sanitized.length === 0) {
            return {
                isValid: false,
                value: '',
                error: 'This field cannot be empty'
            };
        }

        // Check for only spaces
        if (/^\s+$/.test(input)) {
            return {
                isValid: false,
                value: '',
                error: 'Input cannot contain only spaces'
            };
        }

        // Remove potentially dangerous characters (basic XSS protection)
        // Match actual attack patterns (script tags, javascript: URIs, inline
        // event-handler attributes) rather than bare substrings like "eval",
        // which would otherwise reject legitimate words such as "evaluate".
        const xssPattern = /<script[\s>]|javascript\s*:|<\/?[a-z]+[^>]*\son\w+\s*=/gi;
        if (xssPattern.test(sanitized)) {
            return {
                isValid: false,
                value: '',
                error: 'Input contains invalid characters'
            };
        }

        // Type-specific validation
        if (type === 'email') {
            if (!this.validateEmail(sanitized)) {
                return {
                    isValid: false,
                    value: sanitized,
                    error: 'Invalid email format'
                };
            }
        }

        return {
            isValid: true,
            value: sanitized,
            error: null
        };
    }

    /**
     * Clear all error messages
     */
    clearAllErrors() {
        document.querySelectorAll('.form-error').forEach(error => {
            error.textContent = '';
        });
    }

    /**
     * Display error message
     * @param {string} elementId - Error element ID
     * @param {string} message - Error message
     */
    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
        }
    }

    /**
     * Handle login form submission
     * @param {Event} e - Form submit event
     */
    handleLogin(e) {
        e.preventDefault();
        this.clearAllErrors();

        // Get form inputs
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');

        // Sanitize and validate email
        const emailValidation = this.sanitizeInput(emailInput.value, 'email');
        if (!emailValidation.isValid) {
            this.showError('loginEmailError', emailValidation.error);
            return;
        }

        // Sanitize and validate password
        const passwordValidation = this.sanitizeInput(passwordInput.value, 'password');
        if (!passwordValidation.isValid) {
            this.showError('loginPasswordError', passwordValidation.error);
            return;
        }

        // Create session (demo authentication)
        const user = {
            id: this.generateUserId(),
            email: emailValidation.value,
            name: emailValidation.value.split('@')[0],
            loginTime: new Date().toISOString(),
            sessionToken: this.generateSessionToken()
        };

        // Store session in sessionStorage (cleared on tab close)
        this.createSession(user);

        // Redirect to chat
        window.location.href = 'chat.html';
    }

    /**
     * Handle registration form submission
     * @param {Event} e - Form submit event
     */
    handleRegister(e) {
        e.preventDefault();
        this.clearAllErrors();

        // Get form inputs
        const usernameInput = document.getElementById('registerUsername');
        const emailInput = document.getElementById('registerEmail');
        const passwordInput = document.getElementById('registerPassword');
        const confirmPasswordInput = document.getElementById('registerConfirmPassword');
        const acceptTermsCheckbox = document.getElementById('acceptTerms');

        // Validate username
        const usernameValidation = this.sanitizeInput(usernameInput.value, 'text');
        if (!usernameValidation.isValid) {
            this.showError('registerUsernameError', usernameValidation.error);
            return;
        }

        if (usernameValidation.value.length > 100) {
            this.showError('registerUsernameError', 'Username must be less than 100 characters');
            return;
        }

        // Validate email
        const emailValidation = this.sanitizeInput(emailInput.value, 'email');
        if (!emailValidation.isValid) {
            this.showError('registerEmailError', emailValidation.error);
            return;
        }

        // Validate password strength
        const passwordValidation = this.validatePassword(passwordInput.value);
        if (!passwordValidation.isValid) {
            this.showError('registerPasswordError', passwordValidation.errors[0]);
            return;
        }

        // Check password match
        if (passwordInput.value !== confirmPasswordInput.value) {
            this.showError('registerConfirmPasswordError', 'Passwords do not match');
            return;
        }

        // Check terms acceptance
        if (!acceptTermsCheckbox.checked) {
            this.showError('acceptTermsError', 'You must accept the terms to continue');
            return;
        }

        // Create new user account (demo)
        const newUser = {
            id: this.generateUserId(),
            email: emailValidation.value,
            name: usernameValidation.value,
            password: this.hashPassword(passwordInput.value), // Demo hashing
            createdAt: new Date().toISOString(),
            sessionToken: this.generateSessionToken()
        };

        // Store new user session
        this.createSession(newUser);

        // Show success message and redirect
        setTimeout(() => {
            window.location.href = 'chat.html';
        }, 500);
    }

    /**
     * Create user session in sessionStorage
     * @param {object} user - User object
     */
    createSession(user) {
        const sessionData = {
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            token: user.sessionToken,
            createdAt: new Date().toISOString()
        };

        // Use sessionStorage (cleared when tab closes)
        sessionStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
        sessionStorage.setItem(this.userKey, JSON.stringify(sessionData.user));
    }

    /**
     * Get current user session
     * @returns {object|null} - Session data or null
     */
    getSession() {
        const sessionData = sessionStorage.getItem(this.sessionKey);
        return sessionData ? JSON.parse(sessionData) : null;
    }

    /**
     * Get current user info
     * @returns {object|null} - User data or null
     */
    getCurrentUser() {
        const userData = sessionStorage.getItem(this.userKey);
        return userData ? JSON.parse(userData) : null;
    }

    /**
     * Check for existing session and redirect if needed
     */
    checkExistingSession() {
        const session = this.getSession();
        const path = window.location.pathname;
        const isLoginPage = path.endsWith('index.html') || path === '/' || path.endsWith('/');
        const isChatPage = path.endsWith('chat.html');

        // If on login page and session exists, redirect to chat
        if (session && isLoginPage) {
            window.location.href = 'chat.html';
        }

        // If on chat page and no session, redirect to login
        if (!session && isChatPage) {
            window.location.href = 'index.html';
        }
    }

    /**
     * Logout and clear session
     */
    logout() {
        sessionStorage.removeItem(this.sessionKey);
        sessionStorage.removeItem(this.userKey);
        window.location.href = 'index.html';
    }

    /**
     * Generate unique user ID
     * @returns {string} - User ID
     */
    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate session token
     * @returns {string} - Session token
     */
    generateSessionToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Simple hash function for demo (NOT for production)
     * In production, use proper backend hashing (bcrypt, argon2)
     * @param {string} password - Password to hash
     * @returns {string} - Hashed password
     */
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
}

// Initialize authentication manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('auth-body')) {
        window.authManager = new AuthManager();
    }
});
