const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://inte-qnwt.onrender.com';
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const historyList = document.getElementById('historyList');
const newChatButton = document.querySelector('.new-chat-btn');

let chats = JSON.parse(localStorage.getItem('inteChats') || '[]');
let activeChatId = localStorage.getItem('inteActiveChatId');
let deviceIsMobile = false;

function initialize() {
    if (!activeChatId || !getActiveChat()) {
        if (chats.length > 0) {
            activeChatId = chats[0].id;
        }
    }

    renderHistory();
    renderActiveChat();
    detectDeviceAndApply();
    userInput.focus();
}

function detectDeviceAndApply() {
    // Basic detection by viewport width and touch support
    const isSmall = window.matchMedia('(max-width: 700px)').matches;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    deviceIsMobile = isSmall || isTouch;

    const body = document.body;
    const sb = document.querySelector('.sidebar');
    if (deviceIsMobile) {
        body.classList.add('device-mobile');
        body.classList.remove('device-desktop');
        // ensure sidebar is hidden by default on mobile
        if (sb) sb.classList.remove('open');
    } else {
        body.classList.remove('device-mobile');
        body.classList.add('device-desktop');
        // ensure sidebar is visible on desktop (CSS places it)
        if (sb) sb.classList.remove('open');
    }
}

async function updateAuthUI() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        const authBtn = document.getElementById('authBtn');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');

        if (data?.user) {
            // show Google profile photo if available
            const photo = data.user.photos && data.user.photos[0] && data.user.photos[0].value;
            if (photo) {
                userAvatar.style.backgroundImage = `url(${photo})`;
                userAvatar.textContent = '';
            } else {
                userAvatar.style.backgroundImage = '';
                userAvatar.textContent = (data.user.displayName || 'U').charAt(0).toUpperCase();
            }
            userName.textContent = data.user.displayName || 'Usuario';
            if (authBtn) {
                authBtn.textContent = 'Cerrar sesión';
                authBtn.onclick = async () => {
                    await fetch('/api/logout', { method: 'POST' });
                    location.reload();
                };
            }
        } else {
            // not logged
            if (userAvatar) {
                userAvatar.style.backgroundImage = '';
                userAvatar.textContent = deviceIsMobile ? '📱' : 'j';
            }
            if (userName) userName.textContent = 'Invitado';
            if (authBtn) {
                authBtn.textContent = 'Iniciar sesión';
                authBtn.onclick = () => { window.location.href = '/auth/google'; };
            }
        }
    } catch (e) {
        console.error('Auth UI failed', e);
    }
}

function getActiveChat() {
    return chats.find((chat) => chat.id === activeChatId);
}

function saveChats() {
    localStorage.setItem('inteChats', JSON.stringify(chats));
    localStorage.setItem('inteActiveChatId', activeChatId || '');
}

function createNewChat() {
    const newChat = {
        id: `chat-${Date.now()}`,
        title: 'Nuevo chat',
        messages: [],
        createdAt: new Date().toISOString(),
    };

    chats.unshift(newChat);
    activeChatId = newChat.id;
    saveChats();
    renderHistory();
    renderActiveChat();
}

function startNewChat() {
    createNewChat();
    userInput.value = '';
    userInput.focus();
}

function renderHistory() {
    historyList.innerHTML = '';

    chats.forEach((chat) => {
        const item = document.createElement('div');
        item.className = 'chat-history-item';
        if (chat.id === activeChatId) {
            item.classList.add('active');
        }
        item.textContent = chat.title || 'Nuevo chat';
        item.title = chat.title || 'Nuevo chat';
        item.addEventListener('click', () => {
            activeChatId = chat.id;
            saveChats();
            renderHistory();
            renderActiveChat();
        });
        historyList.appendChild(item);
    });
}

function renderActiveChat() {
    const activeChat = getActiveChat();

    if (!activeChat) {
        chatContainer.style.display = 'none';
        startScreen.style.display = 'flex';
        return;
    }

    startScreen.style.display = 'none';
    chatContainer.style.display = 'flex';
    chatContainer.innerHTML = '';

    activeChat.messages.forEach((message) => {
        appendMessageBubble(message);
    });

    scrollToBottom();
}

function appendMessageBubble({ sender, text }) {
    const row = document.createElement('div');
    row.className = 'chat-row';
    if (sender === 'user') {
        row.classList.add('user-row');
    }

    const avatar = document.createElement('div');
    avatar.className = `msg-avatar ${sender === 'user' ? 'user-icon' : 'bot-icon'}`;
    // show different avatar marker depending on device (antifaz)
    if (sender === 'user') {
        avatar.textContent = deviceIsMobile ? '📱' : '🖥️';
    } else {
        avatar.textContent = deviceIsMobile ? '🤖' : 'I';
    }

    const textBubble = document.createElement('div');
    textBubble.className = 'msg-text';
    textBubble.textContent = text;

    if (sender === 'bot') {
        row.appendChild(avatar);
        row.appendChild(textBubble);
    } else {
        row.appendChild(textBubble);
        row.appendChild(avatar);
    }

    chatContainer.appendChild(row);
}

function addMessageToChat(text, sender) {
    const activeChat = getActiveChat();
    if (!activeChat) {
        createNewChat();
    }

    const chat = getActiveChat();
    const message = { sender, text, createdAt: new Date().toISOString() };
    chat.messages.push(message);
    saveChats();
    appendMessageBubble(message);
    scrollToBottom();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function setActiveChatTitle(title) {
    const activeChat = getActiveChat();
    if (!activeChat) return;
    const truncated = title.length > 30 ? `${title.slice(0, 30)}...` : title;
    activeChat.title = truncated || 'Nuevo chat';
    saveChats();
    renderHistory();
}

async function sendInputMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    if (!getActiveChat()) {
        createNewChat();
    }

    if (getActiveChat().messages.length === 0) {
        setActiveChatTitle(message);
    }

    addMessageToChat(message, 'user');
    userInput.value = '';
    userInput.disabled = true;

    const loadingRow = createLoadingMessage();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => null);
            const errorText = data?.error || 'Error en la respuesta del servidor';
            throw new Error(errorText);
        }

        const data = await response.json();
        removeLoadingMessage(loadingRow);
        addMessageToChat(data.response, 'bot');
    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage(loadingRow);
        addMessageToChat(error.message || 'Ocurrió un error. Intenta de nuevo.', 'bot');
    } finally {
        userInput.disabled = false;
        userInput.focus();
    }
}

function createLoadingMessage() {
    const loadingRow = document.createElement('div');
    loadingRow.className = 'chat-row';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar bot-icon';
    avatar.textContent = 'I';

    const textBubble = document.createElement('div');
    textBubble.className = 'msg-text';
    textBubble.innerHTML = '<span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>';

    loadingRow.appendChild(avatar);
    loadingRow.appendChild(textBubble);
    chatContainer.appendChild(loadingRow);
    scrollToBottom();

    return loadingRow;
}

function removeLoadingMessage(loadingRow) {
    if (loadingRow && loadingRow.parentNode) {
        loadingRow.remove();
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendInputMessage();
    }
}

function toggleSidebar() {
    const sb = document.querySelector('.sidebar');
    if (!sb) return;
    sb.classList.toggle('open');
}

function closeSidebarOnResize() {
    const sb = document.querySelector('.sidebar');
    if (!sb) return;
    if (window.innerWidth > 700) {
        sb.classList.remove('open');
    }
}

// close overlay sidebar when clicking outside (mobile)
document.addEventListener('click', (e) => {
    const sb = document.querySelector('.sidebar');
    const menu = e.target.closest('.menu-btn');
    if (!sb) return;
    if (sb.classList.contains('open')) {
        if (!sb.contains(e.target) && !menu) {
            sb.classList.remove('open');
        }
    }
});

newChatButton.addEventListener('click', startNewChat);
userInput.addEventListener('keypress', handleKeyPress);
window.addEventListener('resize', closeSidebarOnResize);

initialize();
// update auth UI after init
updateAuthUI();
