/**
 * Chatbot AI for CLB Connect
 * Powered by Google Gemini 1.5 Flash
 */

const GEMINI_API_KEY = "AIzaSyBg41GVTQ-S2jumeUQlHIImCv2qkrruY-8";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

// Chatbot UI Elements
const launcher = document.getElementById('chatbotLauncher');
const container = document.getElementById('chatbotContainer');
const closeBtn = document.getElementById('chatbotClose');
const chatMessages = document.getElementById('chatbotMessages');
const chatInput = document.getElementById('chatbotInput');
const sendBtn = document.getElementById('chatbotSend');

let isChatOpen = false;
let platformContext = ""; // Dữ liệu tóm tắt từ website
const SYSTEM_PROMPT = "Bạn là trợ lý AI thông minh của CLB Connect. Nhiệm vụ của bạn là giúp đỡ sinh viên tìm kiếm câu lạc bộ, giải đáp thắc mắc về sự kiện và các hoạt động ngoại khóa tại trường Đại học Bình Dương (BDU). Hãy trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp. Sử dụng dữ liệu thực tế được cung cấp trong ngữ cảnh để trả lời chính xác nhất. Nếu không biết câu trả lời, hãy hướng dẫn họ liên hệ với ban quản trị hoặc chuyển hướng tới trang liên quan.";

let chatHistory = [];
let userContext = ""; // Thông tin về người dùng hiện tại

// Keys for LocalStorage
const STORAGE_KEYS = {
    HISTORY: 'clb_chat_history',
    IS_OPEN: 'clb_chat_is_open',
    CONTEXT: 'clb_platform_context'
};

/**
 * Lấy thông tin người dùng từ hệ thống
 */
function loadUserContext() {
    try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.isLoggedIn && user.name) {
                userContext = `\n--- THÔNG TIN NGƯỜI DÙNG ---\n`;
                userContext += `Tên người dùng: ${user.name}\n`;
                userContext += `Vai trò: ${user.role || 'Thành viên'}\n`;
                userContext += `Lưu ý: Bạn đang trò chuyện trực tiếp với ${user.name}. Hãy xưng hô thân thiện và phù hợp với vai trò của họ.\n`;
                return;
            }
        }
    } catch (e) { console.error("Lỗi đọc thônh tin user:", e); }
    userContext = "\n--- THÔNG TIN NGƯỜI DÙNG ---\nNgười dùng chưa đăng nhập hoặc là khách ẩn danh.\n";
}

/**
 * Lưu trạng thái vào LocalStorage
 */
function saveChatState() {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(chatHistory));
    localStorage.setItem(STORAGE_KEYS.IS_OPEN, isChatOpen);
}

/**
 * Tải trạng thái từ LocalStorage
 */
function loadChatState() {
    const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
    const savedIsOpen = localStorage.getItem(STORAGE_KEYS.IS_OPEN);
    
    if (savedHistory) {
        chatHistory = JSON.parse(savedHistory);
        // Hiển thị lại các tin nhắn cũ lên UI
        chatHistory.forEach(msg => {
            if (msg.role === 'user' && !msg.parts[0].text.includes(SYSTEM_PROMPT)) {
                 addMessage(msg.parts[0].text, 'user', false);
            } else if (msg.role === 'model') {
                 addMessage(msg.parts[0].text, 'bot', false);
            }
        });
    }

    if (savedIsOpen === 'true') {
        isChatOpen = true;
        container.classList.add('active');
    }
}

/**
 * Lấy dữ liệu thực tế từ các API của nền tảng
 */
async function fetchPlatformData() {
    try {
        console.log("🔍 Đang đồng bộ dữ liệu hệ thống...");
        const [clubsRes, eventsRes, rankingsRes] = await Promise.all([
            fetch('/api/clubs'),
            fetch('/api/events'),
            fetch('/api/rankings')
        ]);

        const clubs = await clubsRes.json();
        const events = await eventsRes.json();
        const rankings = await rankingsRes.json();

        // Tạo chuỗi ngữ cảnh từ dữ liệu
        let context = "\n--- DỮ LIỆU CÂU LẠC BỘ ---\n";
        if (Array.isArray(clubs)) {
            clubs.forEach(c => context += `- ${c.club_name}: ${c.description}\n`);
        }

        context += "\n--- DANH SÁCH SỰ KIỆN ---\n";
        if (Array.isArray(events)) {
            events.slice(0, 10).forEach(e => context += `- ${e.event_name} (${e.club_name || 'Trường'}): ${e.location} - ${new Date(e.start_time).toLocaleDateString('vi-VN')}\n`);
        }

        context += "\n--- BẢNG XẾP HẠNG HỆ THỐNG ---\n";
        if (rankings) {
            context += "1. CLB năng động nhất: " + (rankings.mostActiveClubs?.[0]?.club_name || "N/A") + "\n";
            context += "2. Top sinh viên rèn luyện: " + (rankings.topMembers?.map(m => m.full_name).slice(0, 3).join(", ") || "N/A") + "\n";
            context += "3. CLB đông thành viên nhất: " + (rankings.biggestClubs?.[0]?.club_name || "N/A") + "\n";
        }

        platformContext = context;
        localStorage.setItem(STORAGE_KEYS.CONTEXT, platformContext);
        console.log("✅ Đã cập nhật kiến thức hệ thống.");
    } catch (error) {
        console.error("Lỗi lấy dữ liệu nền tảng:", error);
        platformContext = localStorage.getItem(STORAGE_KEYS.CONTEXT) || "";
    }
}

// Khởi tạo lịch sử chat
function initChatHistory() {
    chatHistory = []; // Lịch sử không cần chứa system prompt vì đã gửi riêng trong request
}

// Toggle Chat Window
async function toggleChat() {
    isChatOpen = !isChatOpen;
    container.classList.toggle('active', isChatOpen);
    saveChatState();

    if (isChatOpen) {
        chatInput.focus();

        // Nếu là lần đầu hoặc dữ liệu trống, khởi tạo
        if (chatMessages.children.length === 0) {
            await Promise.all([fetchPlatformData(), loadUserContext()]);
            initChatHistory();
            addMessage("Chào bạn! Tôi là trợ lý ảo của CLB Connect. Tôi đã đồng bộ dữ liệu mới nhất. Tôi có thể giúp gì cho bạn?", 'bot');
        }
    }
}

// Add Message to UI
function addMessage(text, side, shouldSave = true) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${side}`;
    
    if (side === 'bot') {
        msgDiv.innerHTML = marked.parse(text);
    } else {
        msgDiv.textContent = text;
    }
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (shouldSave) saveChatState();
}

// Show/Hide Typing Indicator
function toggleTyping(show) {
    const existing = document.getElementById('typingIndicator');
    if (show && !existing) {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'typing';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } else if (!show && existing) {
        existing.remove();
    }
}

// Send Message to Gemini
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // User message
    addMessage(text, 'user');
    chatInput.value = '';

    // Add to history
    chatHistory.push({ role: "user", parts: [{ text: text }] });

    // Bot is thinking
    toggleTyping(true);

    try {
        console.log("📤 Đang gửi yêu cầu tới Gemini AI...");
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: SYSTEM_PROMPT + userContext + platformContext }]
                },
                contents: chatHistory
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ Gemini API Error:", data);
            toggleTyping(false);
            const errorMsg = data.error ? data.error.message : "Lỗi không xác định từ API";
            addMessage(`Lỗi API: ${errorMsg}`, 'bot');
            return;
        }

        toggleTyping(false);

        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
            const botResponse = data.candidates[0].content.parts[0].text;
            addMessage(botResponse, 'bot');

            // Add to history
            chatHistory.push({ role: "model", parts: [{ text: botResponse }] });
        } else if (data.candidates && data.candidates[0].finishReason === "SAFETY") {
            addMessage("Nội dung này bị chặn do vi phạm quy tắc an toàn. Vui lòng thử câu hỏi khác.", 'bot');
        } else {
            console.warn("⚠️ Phản hồi không có nội dung:", data);
            addMessage("Tôi không nhận được câu trả lời từ AI. Có thể do nội dung không phù hợp hoặc lỗi hệ thống.", 'bot');
        }
    } catch (error) {
        console.error("❌ Lỗi mạng hoặc Runtime:", error);
        toggleTyping(false);
        addMessage("Không thể kết nối với máy chủ AI. Vui lòng kiểm tra kết nối mạng của bạn.", 'bot');
    }
}

// Event Listeners
launcher.addEventListener('click', toggleChat);
closeBtn.addEventListener('click', toggleChat);

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Khởi tạo và khôi phục trạng thái khi trang load
window.addEventListener('DOMContentLoaded', () => {
    loadUserContext();
    platformContext = localStorage.getItem(STORAGE_KEYS.CONTEXT) || "";
    loadChatState();
    
    // Tải dữ liệu ngầm để làm mới context
    fetchPlatformData();
});
