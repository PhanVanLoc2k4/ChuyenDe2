/**
 * Chatbot AI & Club Chat for CLB Connect
 * Powered by Google Gemini 1.5 Flash & Socket.io
 */

const GEMINI_API_KEY = "AIzaSyBKBHOtsb1kfMVq5kkTMqK-j88O9JQDby8";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
const BOT_LOGO = "images/chatbot-logo.png";

// UI Elements
const launcher = document.getElementById('chatbotLauncher');
const container = document.getElementById('chatbotContainer');
const closeBtn = document.getElementById('chatbotClose');
const chatMessages = document.getElementById('chatbotMessages');
const chatInput = document.getElementById('chatbotInput');
const sendBtn = document.getElementById('chatbotSend');
const sidebar = document.getElementById('chatbotSidebar');
const chatbotTitle = document.getElementById('chatbotTitle');
const chatbotAvatar = document.getElementById('chatbotAvatar');
const chatbotStatus = document.getElementById('chatbotStatus');

// State
let isChatOpen = false;
let currentChannel = 'ai';
let joinedClubs = [];
let messagesByChannel = {
    'ai': []
};
let unreadCount = {};

// Socket.io
const socket = io();

const SYSTEM_PROMPT = "Bạn là trợ lý AI thông minh của CLB Connect. Hãy giúp đỡ sinh viên tìm kiếm CLB, giải đáp thắc mắc về sự kiện và các hoạt động tại BDU.";
let platformContext = "";
let userContext = "";

function getUser() {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
}

/**
 * Tải danh sách CLB và tham gia Rooms
 */
async function loadJoinedClubs() {
    const user = getUser();
    if (!user || !user.id) return;

    try {
        const res = await fetch(`/api/user/clubs/${user.id}`);
        const clubs = await res.json();

        if (JSON.stringify(clubs) !== JSON.stringify(joinedClubs)) {
            joinedClubs = clubs;
            renderSidebar();

            joinedClubs.forEach(club => {
                socket.emit('join_club', club.id);
                if (!messagesByChannel[club.id]) messagesByChannel[club.id] = [];
            });
        }
    } catch (e) {
        console.error("Lỗi tải CLB:", e);
    }
}

/**
 * Render Sidebar Logo
 */
function renderSidebar() {
    sidebar.innerHTML = `
        <div class="sidebar-item ${currentChannel === 'ai' ? 'active' : ''} ai-icon" onclick="switchChannel('ai')" title="Trợ lý AI">
            <i class="fas fa-robot"></i>
        </div>
    `;

    joinedClubs.forEach(club => {
        const div = document.createElement('div');
        div.className = `sidebar-item ${currentChannel == club.id ? 'active' : ''}`;
        div.onclick = () => switchChannel('club', club.id);
        div.title = club.club_name;

        const count = unreadCount[club.id] || 0;
        const logoPath = club.logo_url || BOT_LOGO;

        div.innerHTML = `
            <img src="${logoPath}" onerror="this.src='${BOT_LOGO}'">
            ${count > 0 ? `<div class="badge">${count}</div>` : ''}
        `;
        sidebar.appendChild(div);
    });
}

/**
 * Chuyển đổi kênh chat
 */
function switchChannel(type, id = null) {
    if (type === 'ai') {
        currentChannel = 'ai';
        chatbotTitle.textContent = "Trợ lý CLB Connect";
        chatbotAvatar.innerHTML = `<img src="${BOT_LOGO}" alt="AI">`;
        chatbotStatus.textContent = "Trực tuyến";
        renderMessages();
    } else {
        const club = joinedClubs.find(c => c.id == id);
        if (!club) return;

        currentChannel = id;
        unreadCount[id] = 0;
        chatbotTitle.textContent = club.club_name;
        chatbotAvatar.innerHTML = `<img src="${club.logo_url || BOT_LOGO}" onerror="this.src='${BOT_LOGO}'">`;
        chatbotStatus.textContent = "Đang tải tin nhắn...";

        fetch(`/api/clubs/${id}/messages`)
            .then(res => res.json())
            .then(data => {
                const currentUser = getUser();
                messagesByChannel[id] = data.map(m => ({
                    text: m.content,
                    side: (currentUser && m.user_id == currentUser.id) ? 'user' : 'bot',
                    avatar: m.userAvatar,
                    name: m.userName
                }));
                chatbotStatus.textContent = "Thành viên CLB";
                renderMessages();
            })
            .catch(err => {
                console.error("Lỗi tải tin nhắn:", err);
                chatbotStatus.textContent = "Thành viên CLB";
                renderMessages();
            });
    }
    renderSidebar();
}

/**
 * Hiển thị toàn bộ tin nhắn của kênh
 */
function renderMessages() {
    chatMessages.innerHTML = '';
    const messages = messagesByChannel[currentChannel] || [];

    messages.forEach(msg => {
        addMessageUI(msg.text, msg.side, false, msg.avatar, msg.name);
    });

    if (messages.length === 0) {
        const welcome = currentChannel === 'ai'
            ? "Chào bạn! Tôi là trợ lý ảo của CLB Connect. Tôi có thể giúp gì cho bạn?"
            : `Chào mừng bạn đến với kênh chat của ${chatbotTitle.textContent}! Hãy bắt đầu trò chuyện nhé.`;
        addMessageUI(welcome, 'bot', false, BOT_LOGO, 'Hệ thống');
    }
}

/**
 * Thêm tin nhắn đơn lẻ vào UI
 */
function addMessageUI(text, side, shouldSave = true, avatar = null, name = null) {
    const msgContainer = document.createElement('div');
    msgContainer.className = `msg-container ${side}`;
    msgContainer.style.display = 'flex';
    msgContainer.style.flexDirection = side === 'user' ? 'row-reverse' : 'row';
    msgContainer.style.gap = '10px';
    msgContainer.style.marginBottom = '12px';
    msgContainer.style.alignItems = 'flex-end';

    const avatarImg = document.createElement('img');
    avatarImg.src = avatar || (side === 'user' ? 'images/default-user.png' : BOT_LOGO);
    avatarImg.style.width = '28px';
    avatarImg.style.height = '28px';
    avatarImg.style.borderRadius = '8px';
    avatarImg.style.objectFit = 'cover';
    avatarImg.style.border = '1px solid rgba(255,255,255,0.1)';
    avatarImg.onerror = function () { this.src = BOT_LOGO; };

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${side}`;

    if (side === 'bot') {
        msgDiv.innerHTML = (typeof marked !== 'undefined') ? marked.parse(text) : text;
    } else {
        msgDiv.textContent = text;
    }

    msgContainer.appendChild(avatarImg);
    msgContainer.appendChild(msgDiv);

    chatMessages.appendChild(msgContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (shouldSave) {
        if (!messagesByChannel[currentChannel]) messagesByChannel[currentChannel] = [];
        messagesByChannel[currentChannel].push({ text, side, avatar, name });
    }
}

/**
 * Gửi tin nhắn
 */
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    const user = getUser();
    if (!user) return alert("Vui lòng đăng nhập!");

    chatInput.value = '';

    if (currentChannel === 'ai') {
        addMessageUI(text, 'user', true, user.avatar, user.name);
        handleGeminiChat(text);
    } else {
        socket.emit('send_club_message', {
            clubId: currentChannel,
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatar,
            message: text
        });
    }
}

async function handleGeminiChat(text) {
    toggleTyping(true);
    try {
        const history = (messagesByChannel['ai'] || []).map(m => ({
            role: m.side === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
        }));

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT + userContext + platformContext }] },
                contents: history
            })
        });

        const data = await response.json();
        toggleTyping(false);
        if (data.candidates?.[0]?.content) {
            addMessageUI(data.candidates[0].content.parts[0].text, 'bot', true, BOT_LOGO, 'Gemini AI');
        }
    } catch (e) {
        toggleTyping(false);
        addMessageUI("Lỗi AI.", 'bot');
    }
}

function toggleTyping(show) {
    const existing = document.getElementById('typingIndicator');
    if (show && !existing) {
        const div = document.createElement('div');
        div.id = 'typingIndicator';
        div.className = 'typing';
        div.innerHTML = '<span></span><span></span><span></span>';
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } else if (!show && existing) existing.remove();
}

// Socket Listener
socket.on('receive_club_message', (data) => {
    const { clubId, userId, userName, userAvatar, message } = data;
    const currentUser = getUser();
    const isMe = currentUser && userId == currentUser.id;

    if (!messagesByChannel[clubId]) messagesByChannel[clubId] = [];

    if (!isMe && currentChannel != clubId) {
        unreadCount[clubId] = (unreadCount[clubId] || 0) + 1;
        renderSidebar();
    }

    if (currentChannel == clubId) {
        addMessageUI(message, isMe ? 'user' : 'bot', true, userAvatar, userName);
    } else {
        messagesByChannel[clubId].push({
            text: message,
            side: isMe ? 'user' : 'bot',
            avatar: userAvatar,
            name: userName
        });
    }
});

// UI Controls
launcher.onclick = () => {
    isChatOpen = !isChatOpen;
    container.classList.toggle('active', isChatOpen);
    if (isChatOpen) {
        loadJoinedClubs();
        chatInput.focus();
    }
};

closeBtn.onclick = () => { container.classList.remove('active'); isChatOpen = false; };
sendBtn.onclick = sendMessage;
chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

window.onload = () => {
    const user = getUser();
    if (user) userContext = `\nNgười dùng: ${user.name}`;
    loadJoinedClubs();
};
