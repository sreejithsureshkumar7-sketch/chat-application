/**
 * SecureChat Application Module
 * Handles messaging, encryption, DOM manipulation with XSS protection
 * Uses Web Crypto API for AES-GCM encryption
 */

class ChatApplication {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.chats = [];
        this.messages = {};
        this.encryptionKey = null;
        this.init();
    }

    /**
     * Initialize the chat application
     */
    async init() {
        // Check authentication
        const authManager = new AuthManager();
        const session = authManager.getSession();

        if (!session) {
            window.location.href = 'index.html';
            return;
        }

        this.currentUser = session.user;

        // Setup UI
        this.setupUI();
        this.setupEventListeners();

        // Initialize encryption
        await this.initializeEncryption();

        // Load demo chats
        this.loadDemoChats();
    }

    /**
     * Setup user interface elements
     */
    setupUI() {
        // Display user info (using textContent for XSS protection)
        const displayUsername = document.getElementById('displayUsername');
        const userAvatarInitial = document.getElementById('userAvatarInitial');

        if (displayUsername) {
            displayUsername.textContent = this.currentUser.name;
        }

        if (userAvatarInitial) {
            const initial = this.currentUser.name.charAt(0).toUpperCase();
            userAvatarInitial.textContent = initial;
        }
    }

    /**
     * Setup DOM event listeners
     */
    setupEventListeners() {
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.showLogoutModal());
        }

        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettingsModal());
        }

        // New chat button
        const newChatBtn = document.getElementById('newChatBtn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => this.showNewChatModal());
        }

        // Message form
        const messageForm = document.getElementById('messageForm');
        if (messageForm) {
            messageForm.addEventListener('submit', (e) => this.handleSendMessage(e));
        }

        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('input', () => this.handleMessageInput());
        }

        // Modal overlays
        this.setupModalListeners();
    }

    /**
     * Setup modal event listeners
     */
    setupModalListeners() {
        // Settings modal
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');
        const closeSettingsBtn2 = document.getElementById('closeSettingsBtn2');
        const settingsOverlay = document.getElementById('settingsOverlay');

        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => this.closeModal('settingsModal'));
        }
        if (closeSettingsBtn2) {
            closeSettingsBtn2.addEventListener('click', () => this.closeModal('settingsModal'));
        }
        if (settingsOverlay) {
            settingsOverlay.addEventListener('click', () => this.closeModal('settingsModal'));
        }

        // Logout modal
        const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
        const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
        const logoutOverlay = document.getElementById('logoutOverlay');

        if (cancelLogoutBtn) {
            cancelLogoutBtn.addEventListener('click', () => this.closeModal('logoutModal'));
        }
        if (confirmLogoutBtn) {
            confirmLogoutBtn.addEventListener('click', () => this.handleLogout());
        }
        if (logoutOverlay) {
            logoutOverlay.addEventListener('click', () => this.closeModal('logoutModal'));
        }

        // New chat modal
        const closeNewChatBtn = document.getElementById('closeNewChatBtn');
        const cancelNewChatBtn = document.getElementById('cancelNewChatBtn');
        const startChatBtn = document.getElementById('startChatBtn');
        const newChatOverlay = document.getElementById('newChatOverlay');
        const newChatForm = document.getElementById('newChatForm');

        if (closeNewChatBtn) {
            closeNewChatBtn.addEventListener('click', () => this.closeModal('newChatModal'));
        }
        if (cancelNewChatBtn) {
            cancelNewChatBtn.addEventListener('click', () => this.closeModal('newChatModal'));
        }
        if (startChatBtn) {
            startChatBtn.addEventListener('click', () => this.handleNewChat());
        }
        if (newChatOverlay) {
            newChatOverlay.addEventListener('click', () => this.closeModal('newChatModal'));
        }
        if (newChatForm) {
            newChatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleNewChat();
            });
        }
    }

    /**
     * Initialize Web Crypto API encryption
     */
    async initializeEncryption() {
        try {
            // Generate or retrieve encryption key
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(this.currentUser.id + 'securechat_key'),
                { name: 'PBKDF2' },
                false,
                ['deriveBits', 'deriveKey']
            );

            this.encryptionKey = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: new TextEncoder().encode('securechat_salt_2024'),
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );

            console.log('✓ Encryption initialized successfully');
        } catch (error) {
            console.error('Encryption initialization failed:', error);
        }
    }

    /**
     * Encrypt message using AES-GCM
     * @param {string} message - Message to encrypt
     * @returns {Promise<string>} - Encrypted message (base64)
     */
    async encryptMessage(message) {
        try {
            if (!this.encryptionKey) {
                throw new Error('Encryption key not initialized');
            }

            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encodedMessage = new TextEncoder().encode(message);

            const encryptedData = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                this.encryptionKey,
                encodedMessage
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encryptedData.byteLength);
            combined.set(new Uint8Array(iv));
            combined.set(new Uint8Array(encryptedData), iv.length);

            // Convert to base64
            return btoa(String.fromCharCode.apply(null, combined));
        } catch (error) {
            console.error('Encryption failed:', error);
            return null;
        }
    }

    /**
     * Decrypt message using AES-GCM
     * @param {string} encryptedMessage - Encrypted message (base64)
     * @returns {Promise<string>} - Decrypted message
     */
    async decryptMessage(encryptedMessage) {
        try {
            if (!this.encryptionKey) {
                throw new Error('Encryption key not initialized');
            }

            // Convert from base64
            const binaryString = atob(encryptedMessage);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Extract IV and encrypted data
            const iv = bytes.slice(0, 12);
            const encryptedData = bytes.slice(12);

            const decryptedData = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                this.encryptionKey,
                encryptedData
            );

            return new TextDecoder().decode(decryptedData);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    /**
     * Load demo chats
     */
    loadDemoChats() {
        this.chats = [
            {
                id: 'chat_1',
                name: 'Alice Johnson',
                email: 'alice@example.com',
                lastMessage: 'Sounds good! See you tomorrow',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                unread: 0
            },
            {
                id: 'chat_2',
                name: 'Bob Smith',
                email: 'bob@example.com',
                lastMessage: 'Thanks for the help!',
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                unread: 2
            },
            {
                id: 'chat_3',
                name: 'Carol White',
                email: 'carol@example.com',
                lastMessage: 'Let me check and get back to you',
                timestamp: new Date(Date.now() - 86400000).toISOString(),
                unread: 0
            }
        ];

        // Demo messages
        this.messages = {
            'chat_1': [
                { id: 1, sender: 'alice', text: 'Hi! How are you?', timestamp: new Date(Date.now() - 7200000) },
                { id: 2, sender: this.currentUser.id, text: 'Great! How about you?', timestamp: new Date(Date.now() - 7000000) },
                { id: 3, sender: 'alice', text: 'Doing well! Meet tomorrow?', timestamp: new Date(Date.now() - 3600000) },
                { id: 4, sender: this.currentUser.id, text: 'Sounds good! See you tomorrow', timestamp: new Date(Date.now() - 3500000) }
            ],
            'chat_2': [
                { id: 1, sender: 'bob', text: 'Can you help me with this?', timestamp: new Date(Date.now() - 10800000) },
                { id: 2, sender: this.currentUser.id, text: 'Sure, what do you need?', timestamp: new Date(Date.now() - 10700000) },
                { id: 3, sender: 'bob', text: 'Thanks for the help!', timestamp: new Date(Date.now() - 7200000) }
            ],
            'chat_3': []
        };

        this.renderChatsList();
    }

    /**
     * Render chats list in sidebar
     */
    renderChatsList() {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;

        chatsList.innerHTML = '';

        this.chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            if (chat.id === this.currentChat?.id) {
                chatItem.classList.add('active');
            }

            // Create chat name element (using textContent for XSS protection)
            const nameEl = document.createElement('div');
            nameEl.className = 'chat-item-name';
            nameEl.textContent = chat.name;

            // Create preview element (using textContent for XSS protection)
            const previewEl = document.createElement('div');
            previewEl.className = 'chat-item-preview';
            previewEl.textContent = chat.lastMessage;

            chatItem.appendChild(nameEl);
            chatItem.appendChild(previewEl);

            chatItem.addEventListener('click', () => this.selectChat(chat));

            chatsList.appendChild(chatItem);
        });
    }

    /**
     * Select a chat and load messages
     * @param {object} chat - Chat object
     */
    selectChat(chat) {
        this.currentChat = chat;

        // Update header
        const chatTitle = document.getElementById('chatTitle');
        const chatSubtitle = document.getElementById('chatSubtitle');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (chatTitle) {
            chatTitle.textContent = chat.name;
        }
        if (chatSubtitle) {
            chatSubtitle.textContent = `${chat.email} • Online`;
        }

        // Enable message input
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.focus();
        }
        if (sendBtn) {
            sendBtn.disabled = false;
        }

        // Render messages
        this.renderMessages();

        // Update chat list UI
        this.renderChatsList();
    }

    /**
     * Render messages for current chat
     */
    renderMessages() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer || !this.currentChat) return;

        messagesContainer.innerHTML = '';

        const chatMessages = this.messages[this.currentChat.id] || [];

        if (chatMessages.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'welcome-message';
            emptyState.innerHTML = `
                <div class="welcome-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>
                <h2>Start the conversation</h2>
                <p>No messages yet. Say hello to start chatting!</p>
            `;
            messagesContainer.appendChild(emptyState);
            return;
        }

        chatMessages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.sender === this.currentUser.id ? 'sent' : 'received'}`;

            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'message-bubble';

            // Use textContent for XSS protection (NOT innerHTML)
            const textEl = document.createElement('div');
            textEl.className = 'message-text';
            textEl.textContent = msg.text;

            // Format timestamp
            const timeEl = document.createElement('div');
            timeEl.className = 'message-time';
            timeEl.textContent = this.formatTime(msg.timestamp);

            bubbleDiv.appendChild(textEl);
            bubbleDiv.appendChild(timeEl);
            messageDiv.appendChild(bubbleDiv);
            messagesContainer.appendChild(messageDiv);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Handle message input
     */
    handleMessageInput() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (messageInput && sendBtn) {
            const isEmpty = messageInput.value.trim().length === 0;
            sendBtn.disabled = isEmpty || !this.currentChat;
        }
    }

    /**
     * Handle send message
     * @param {Event} e - Form submit event
     */
    async handleSendMessage(e) {
        e.preventDefault();

        if (!this.currentChat) {
            this.showError('No chat selected');
            return;
        }

        const messageInput = document.getElementById('messageInput');
        const formError = document.getElementById('messageFormError');

        if (!messageInput) return;

        // Sanitize input
        const messageText = messageInput.value.trim();

        if (messageText.length === 0) {
            if (formError) {
                formError.textContent = 'Message cannot be empty';
            }
            return;
        }

        if (messageText.length > 500) {
            if (formError) {
                formError.textContent = 'Message is too long (max 500 characters)';
            }
            return;
        }

        // Encrypt message (best-effort demo encryption; falls back gracefully
        // if the Web Crypto API isn't available, e.g. when served over plain
        // http:// instead of https:// or localhost).
        const encryptedMessage = await this.encryptMessage(messageText);

        if (!encryptedMessage) {
            console.warn('Message encryption unavailable in this context; sending unencrypted (demo mode).');
        }

        // Create message object
        const newMessage = {
            id: Date.now(),
            sender: this.currentUser.id,
            text: messageText, // Store original for demo
            encryptedText: encryptedMessage,
            timestamp: new Date()
        };

        // Add to messages
        if (!this.messages[this.currentChat.id]) {
            this.messages[this.currentChat.id] = [];
        }

        this.messages[this.currentChat.id].push(newMessage);

        // Update last message in chat
        this.currentChat.lastMessage = messageText.substring(0, 50);
        this.currentChat.timestamp = new Date().toISOString();

        // Clear input
        messageInput.value = '';
        if (formError) {
            formError.textContent = '';
        }

        // Disable send button
        this.handleMessageInput();

        // Re-render
        this.renderMessages();
        this.renderChatsList();

        // Simulate recipient response after 1 second
        setTimeout(() => {
            this.simulateResponse();
        }, 1000);
    }

    /**
     * Simulate recipient response
     */
    simulateResponse() {
        if (!this.currentChat) return;

        const responses = [
            'That sounds great!',
            'I agree with you.',
            'Let me think about that.',
            'Sounds good to me!',
            'Thanks for letting me know.',
            'I appreciate it!'
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        const responseMessage = {
            id: Date.now(),
            sender: this.currentChat.id,
            text: randomResponse,
            timestamp: new Date()
        };

        this.messages[this.currentChat.id].push(responseMessage);

        // Update last message
        this.currentChat.lastMessage = randomResponse;
        this.currentChat.timestamp = new Date().toISOString();

        this.renderMessages();
        this.renderChatsList();
    }

    /**
     * Show logout confirmation modal
     */
    showLogoutModal() {
        const modal = document.getElementById('logoutModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    /**
     * Show settings modal
     */
    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    /**
     * Show new chat modal
     */
    showNewChatModal() {
        const modal = document.getElementById('newChatModal');
        if (modal) {
            modal.classList.add('active');
            const recipientEmail = document.getElementById('recipientEmail');
            if (recipientEmail) {
                recipientEmail.focus();
            }
        }
    }

    /**
     * Close modal
     * @param {string} modalId - Modal element ID
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }

        // Clear form if new chat modal
        if (modalId === 'newChatModal') {
            const newChatForm = document.getElementById('newChatForm');
            if (newChatForm) {
                newChatForm.reset();
            }
            document.getElementById('recipientEmailError').textContent = '';
            document.getElementById('chatNameError').textContent = '';
            document.getElementById('newChatFormError').textContent = '';
        }
    }

    /**
     * Handle new chat creation
     */
    handleNewChat() {
        const recipientEmail = document.getElementById('recipientEmail');
        const chatName = document.getElementById('chatName');

        const emailError = document.getElementById('recipientEmailError');
        const nameError = document.getElementById('chatNameError');
        const formError = document.getElementById('newChatFormError');

        // Validate email
        const emailValue = recipientEmail.value.trim();
        if (!emailValue) {
            emailError.textContent = 'Email is required';
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
            emailError.textContent = 'Invalid email format';
            return;
        }

        if (emailValue === this.currentUser.email) {
            emailError.textContent = 'Cannot create chat with yourself';
            return;
        }

        // Check for duplicate chat
        if (this.chats.find(c => c.email === emailValue)) {
            formError.textContent = 'Chat already exists with this user';
            return;
        }

        // Validate chat name (optional)
        const nameValue = chatName.value.trim();
        if (nameValue && nameValue.length > 100) {
            nameError.textContent = 'Chat name is too long';
            return;
        }

        // Create new chat
        const newChat = {
            id: 'chat_' + Date.now(),
            name: nameValue || emailValue.split('@')[0],
            email: emailValue,
            lastMessage: 'No messages yet',
            timestamp: new Date().toISOString(),
            unread: 0
        };

        this.chats.unshift(newChat);
        this.messages[newChat.id] = [];

        this.renderChatsList();
        this.closeModal('newChatModal');

        // Select new chat
        this.selectChat(newChat);
    }

    /**
     * Handle logout
     */
    handleLogout() {
        const authManager = new AuthManager();
        authManager.logout();
    }

    /**
     * Format timestamp to readable format
     * @param {Date} date - Date to format
     * @returns {string} - Formatted time
     */
    formatTime(date) {
        const now = new Date();
        const messageDate = new Date(date);

        if (messageDate.toDateString() === now.toDateString()) {
            return messageDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else {
            return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        console.error(message);
        // Could be shown as toast notification
    }
}

// Initialize chat application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('chat-body')) {
        window.chatApp = new ChatApplication();
    }
});
