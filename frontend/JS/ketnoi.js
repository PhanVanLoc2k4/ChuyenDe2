/**
 * KETNOI.JS - LOGIC XỬ LÝ KẾT NỐI NHÀ TRƯỜNG
 */

document.addEventListener('DOMContentLoaded', () => {
    loadMyRequests();
    
    // Handle form submission
    const form = document.getElementById('supportForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = {
                category: formData.get('category'),
                subject: formData.get('subject'),
                message: formData.get('message')
            };

            try {
                const response = await fetchWithAuth('/api/support/requests', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    alert('Yêu cầu của bạn đã được gửi thành công!');
                    form.reset();
                    switchTab('list');
                    loadMyRequests();
                } else {
                    const error = await response.json();
                    alert('Lỗi: ' + error.message);
                }
            } catch (err) {
                console.error(err);
                alert('Lỗi kết nối máy chủ');
            }
        });
    }
});

// Switch Tabs Logic
function switchTab(tabName) {
    const tabs = ['create', 'list', 'info'];
    tabs.forEach(t => {
        document.getElementById('tab-' + t).classList.add('hidden');
        // Update nav-link styles
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            if (link.innerText.includes(tabName === 'create' ? 'Gửi yêu cầu' : (tabName === 'list' ? 'Lịch sử' : 'Thông tin'))) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    });
    document.getElementById('tab-' + tabName).classList.remove('hidden');
}

// Load personal requests
async function loadMyRequests() {
    const listContainer = document.getElementById('requestsList');
    if (!listContainer) return;

    try {
        const response = await fetchWithAuth('/api/support/my-requests');
        if (!response) return;
        const requests = await response.json();

        if (requests.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #94a3b8;">
                    <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;"></i>
                    <p>Bạn chưa gửi yêu cầu nào. Hãy bắt đầu kết nối với nhà trường ngay!</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = requests.map(r => {
            const statusClass = 'status-' + r.status;
            const statusText = r.status === 'pending' ? 'Chờ xử lý' : 
                               (r.status === 'processing' ? 'Đang giải quyết' : 
                               (r.status === 'resolved' ? 'Đã phản hồi' : 'Đã đóng'));
            
            return `
                <div class="request-card">
                    <div class="card-header">
                        <span class="card-category">${r.category}</span>
                        <span class="card-status ${statusClass}">${statusText}</span>
                    </div>
                    <h3 class="card-subject">${r.subject}</h3>
                    <p class="card-message">${r.message}</p>
                    <div style="font-size: 12px; color: #94a3b8;">
                        <i class="fas fa-calendar-alt"></i> Gửi ngày: ${new Date(r.created_at).toLocaleString('vi-VN')}
                    </div>
                    
                    ${r.reply_message ? `
                        <div class="card-reply">
                            <div class="reply-header">
                                <i class="fas fa-reply"></i> Phản hồi từ: ${r.replier_name || 'Nhà trường'}
                            </div>
                            <div class="reply-content">${r.reply_message}</div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 10px;">
                                <i class="fas fa-clock"></i> Thời gian: ${new Date(r.replied_at).toLocaleString('vi-VN')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        listContainer.innerHTML = '<p style="text-align:center; color:red;">Lỗi tải dữ liệu</p>';
    }
}

// Helper: Fetch with Auth Token (Same as in admin.js)
async function fetchWithAuth(url, options = {}) {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const token = user.token;
    if (!token) { window.location.href = '/dangnhap'; return null; }

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await fetch(url, { ...defaultOptions, ...options });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('currentUser');
            window.location.href = '/dangnhap';
            return null;
        }
        return response;
    } catch (err) {
        console.error("Fetch Error:", err);
        return null;
    }
}
