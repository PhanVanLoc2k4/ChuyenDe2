/**
 * ADMIN.JS - LOGIC QUẢN TRỊ HỆ THỐNG (DỮ LIỆU THỰC)
 */

let monthlyChart;

// 1. KHỞI TẠO HỆ THỐNG
document.addEventListener('DOMContentLoaded', async () => {
    // Kiểm tra quyền Admin
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) { window.location.href = '/login'; return; }
    const currentUser = JSON.parse(userStr);
    if (currentUser.role !== 'admin') {
        alert("Bạn không có quyền truy cập trang này!");
        window.location.href = '/';
        return;
    }

    // Hiển thị thông tin Admin
    const adminNameEl = document.querySelector('.admin-details h4');
    if (adminNameEl) adminNameEl.textContent = currentUser.name || "Admin System";

    await initAdminDashboard();
    
    // Đóng dropdown khi click ra ngoài
    document.addEventListener('click', (e) => {
        const container = document.querySelector('.date-picker-container');
        if (container && !container.contains(e.target)) {
            const dd = document.getElementById('dateDropdown');
            if (dd) dd.style.display = 'none';
        }
    });
});

async function initAdminDashboard() {
    initCharts(); 
    await refreshAllData();
}

async function refreshAllData() {
    const yearSelect = document.getElementById('selectYear');
    const monthSelect = document.getElementById('selectMonth');
    const year = yearSelect ? yearSelect.value : 'all';
    const month = monthSelect ? monthSelect.value : 'all';
    
    const params = new URLSearchParams();
    if (year !== 'all') params.append('year', year);
    if (month !== 'all') params.append('month', month);
    const queryStr = params.toString() ? '?' + params.toString() : '';

    await loadStats(queryStr); 
    await loadMonthlyChartData();
    await loadUsersTable(queryStr); 
    await loadClubsTable(); 
    await loadEventsTable(queryStr);
}

// 2. HELPER: FETCH VỚI AUTH TOKEN
async function fetchWithAuth(url, options = {}) {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const token = user.token;
    if (!token) { window.location.href = '/login'; return null; }

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
            window.location.href = '/login';
            return null;
        }
        return response;
    } catch (err) {
        console.error("Fetch Error:", err);
        return null;
    }
}

// 3. TẢI SỐ LIỆU TỔNG QUAN & TOP CLB
async function loadStats(queryStr = '') {
    try {
        const response = await fetchWithAuth('/api/admin/stats' + queryStr);
        if (!response) return;
        const data = await response.json();

        // Cập nhật Cards
        const totalUsersEl = document.getElementById('statTotalUsers');
        const totalClubsEl = document.getElementById('statTotalClubs');
        const totalEventsEl = document.getElementById('statTotalEvents');
        const summaryUsersEl = document.getElementById('summaryTotalUsers');

        if (totalUsersEl) totalUsersEl.textContent = data.totalUsers || 0;
        if (totalClubsEl) totalClubsEl.textContent = data.totalClubs || 0;
        if (totalEventsEl) totalEventsEl.textContent = data.totalEvents || 0;
        if (summaryUsersEl) summaryUsersEl.textContent = data.totalUsers || 0;
        
        // Cập nhật Top CLB
        const topTbody = document.getElementById('topClubsTableBody');
        if (topTbody && data.topClubs) {
            topTbody.innerHTML = data.topClubs.map(c => `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${c.logo_url || 'https://ui-avatars.com/api/?name=' + c.club_name}" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover;">
                            <span>${c.club_name}</span>
                        </div>
                    </td>
                    <td>${c.member_count}</td>
                    <td>${c.event_count}</td>
                    <td><span class="status-badge status-active">Hoạt động</span></td>
                    <td><button class="action-btn btn-view" onclick="viewClubDetail(${c.id})"><i class="fas fa-eye"></i></button></td>
                </tr>
            `).join('');
            if (data.topClubs.length === 0) topTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Chưa có dữ liệu</td></tr>';
        }
    } catch (err) {
        console.error("Lỗi tải stats:", err);
    }
}

// 4. TIẾP TỤC CÁC HÀM TẢI BẢNG
let searchTimeout;
async function loadUsersTable(queryStr = '') {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    // Luôn ưu tiên lấy đầy đủ bộ lọc từ UI để đảm bảo tính nhất quán
    const year = document.getElementById('selectYear')?.value || 'all';
    const month = document.getElementById('selectMonth')?.value || 'all';
    const search = document.getElementById('searchUser')?.value || '';
    const role = document.getElementById('filterRole')?.value || 'all';
    
    const params = new URLSearchParams();
    if (year !== 'all') params.append('year', year);
    if (month !== 'all') params.append('month', month);
    if (search) params.append('search', search);
    if (role !== 'all') params.append('role', role);
    const finalQueryStr = params.toString() ? '?' + params.toString() : '';

    try {
        const response = await fetchWithAuth('/api/admin/users' + finalQueryStr);
        if (!response) return;
        const users = await response.json();

        tbody.innerHTML = users.map(u => {
            const isLocked = u.status === 'locked';
            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${u.avatar || 'https://ui-avatars.com/api/?name=' + u.full_name}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                            <span>${u.full_name}</span>
                        </div>
                    </td>
                    <td>${u.email}</td>
                    <td><span class="status-badge ${u.role === 'admin' ? 'status-active' : (u.role === 'leader' ? 'status-pending' : '')}" 
                          style="${u.role === 'leader' ? 'background: #e0f2fe; color: #0369a1;' : ''}">${u.role}</span></td>
                    <td>${new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                    <td><span class="status-badge ${isLocked ? 'status-inactive' : 'status-active'}">${isLocked ? 'Bị khóa' : 'Hoạt động'}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn" title="${isLocked ? 'Mở khóa' : 'Khóa tài khoản'}" 
                                    style="color: ${isLocked ? '#059669' : '#dc2626'}"
                                    onclick="toggleUserStatus(${u.id}, '${u.status}')">
                                <i class="fas ${isLocked ? 'fa-user-check' : 'fa-user-lock'}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        if (users.length === 0) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Không tìm thấy người dùng nào</td></tr>';
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Lỗi tải dữ liệu người dùng</td></tr>';
    }
}

// Thêm sự kiện cho ô tìm kiếm với debounce
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchUser');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsersTable();
            }, 500);
        });
    }
});

async function toggleUserStatus(id, currentStatus) {
    const newStatus = currentStatus === 'locked' ? 'active' : 'locked';
    const actionText = newStatus === 'locked' ? 'Khóa' : 'Mở khóa';
    
    if (!confirm(`Xác nhận ${actionText} tài khoản này?`)) return;

    try {
        const res = await fetchWithAuth(`/api/admin/users/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (res && res.ok) {
            alert(`Đã ${actionText} tài khoản thành công!`);
            refreshAllData();
        } else {
            alert('Lỗi khi cập nhật trạng thái tài khoản');
        }
    } catch (err) {
        console.error("Toggle Status Error:", err);
        alert('Lỗi kết nối máy chủ');
    }
}

async function loadClubsTable() {
    const tbody = document.getElementById('clubTableBody');
    if (!tbody) return;

    try {
        const response = await fetch('/api/clubs');
        const clubs = await response.json();

        tbody.innerHTML = clubs.map(c => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${c.logo_url || 'https://ui-avatars.com/api/?name=' + c.club_name}" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover;">
                        <span>${c.club_name}</span>
                    </div>
                </td>
                <td>${c.category_name || 'Khác'}</td>
                <td>${c.creator || 'N/A'}</td>
                <td>${c.member_count || 0}</td>
                <td>${c.event_count || 0}</td>
                <td><span class="status-badge status-active">Đang chạy</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-view" onclick="viewClubDetail(${c.id})"><i class="fas fa-eye"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Lỗi tải dữ liệu CLB</td></tr>';
    }
}

async function loadEventsTable(queryStr = '') {
    const tbody = document.getElementById('eventTableBody');
    if (!tbody) return;

    try {
        const response = await fetch('/api/events' + queryStr);
        const events = await response.json();

        tbody.innerHTML = events.map(e => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${e.image || '/placeholder-event.png'}" style="width: 40px; height: 25px; border-radius: 4px; object-fit: cover;">
                        <span>${e.event_name}</span>
                    </div>
                </td>
                <td>${e.club_name}</td>
                <td>${new Date(e.start_time).toLocaleDateString('vi-VN')}</td>
                <td>${e.location}</td>
                <td>${e.participant_count}</td>
                <td><span class="status-badge status-active">Sắp tới</span></td>
                <td>
                    <button class="action-btn btn-view" onclick="viewEventDetail(${e.id})"><i class="fas fa-eye"></i></button>
                </td>
            </tr>
        `).join('');
        if (events.length === 0) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Không có sự kiện nào trong thời gian này</td></tr>';
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Lỗi tải dữ liệu sự kiện</td></tr>';
    }
}

// 5. DATE FILTER LOGIC
function toggleDateDropdown() {
    const dd = document.getElementById('dateDropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function handleDateFilterChange() {
    const yearSelect = document.getElementById('selectYear');
    const monthSelect = document.getElementById('selectMonth');
    const monthContainer = document.getElementById('monthFilterContainer');
    const dateDisplay = document.getElementById('currentDateDisplay');
    const dateTitle = document.getElementById('dashboardDateText');

    const year = yearSelect ? yearSelect.value : 'all';
    const month = monthSelect ? monthSelect.value : 'all';

    if (year === 'all') {
        if (monthContainer) monthContainer.style.display = 'none';
        if (monthSelect) monthSelect.value = 'all';
        if (dateDisplay) dateDisplay.textContent = 'Tất cả thời gian';
        if (dateTitle) dateTitle.textContent = 'Thống kê hệ thống toàn thời gian';
    } else {
        if (monthContainer) monthContainer.style.display = 'block';
        if (month === 'all') {
            if (dateDisplay) dateDisplay.textContent = 'Năm ' + year;
            if (dateTitle) dateTitle.textContent = 'Thống kê hệ thống năm ' + year;
        } else {
            if (dateDisplay) dateDisplay.textContent = `Tháng ${month}/${year}`;
            if (dateTitle) dateTitle.textContent = `Thống kê hệ thống tháng ${month}/${year}`;
        }
    }
    refreshAllData();
}

// 6. UI & CHARTS (GIỮ LẠI ĐỂ HOẠT ĐỘNG)
async function loadMonthlyChartData() {
    try {
        const response = await fetchWithAuth('/api/admin/reports/monthly');
        if (!response || response.status !== 200) return;
        const reports = await response.json();
        if (monthlyChart) {
            monthlyChart.data.labels = reports.map(r => r.label);
            monthlyChart.data.datasets[0].data = reports.map(r => r.newClubs);
            monthlyChart.data.datasets[1].data = reports.map(r => r.newEvents);
            monthlyChart.update();
        }
    } catch (err) {}
}

function initCharts() {
    const monthlyCtx = document.getElementById('monthlyChart')?.getContext('2d');
    if (monthlyCtx) {
        monthlyChart = new Chart(monthlyCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'CLB mới', data: [], borderColor: '#c53030', backgroundColor: 'rgba(197,48,48,0.1)', fill: true, tension: 0.4 },
                    { label: 'Sự kiện', data: [], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
        });
    }
}

function showPage(page) {
    const pages = ['dashboard', 'users', 'clubs', 'events', 'settings', 'support', 'points'];
    pages.forEach(p => {
        const el = document.getElementById(p + '-page');
        if (el) el.style.display = 'none';
    });
    const targetPage = document.getElementById(page + '-page');
    if (targetPage) targetPage.style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    // Tự động tải dữ liệu tương ứng
    if (page === 'support') loadSupportRequests();
    if (page === 'points') loadPointsData();
}

// VIEW HANDLERS (Sử dụng ID thay vì tên)
function viewUserDetail(id) { alert('Xem chi tiết người dùng ID: ' + id); }

async function viewClubDetail(id) { 
    try {
        // Gọi đồng thời các API cần thiết
        const [clubRes, memberRes, rankingRes] = await Promise.all([
            fetch('/api/clubs/' + id),
            fetch('/api/clubs/' + id + '/members'),
            fetch('/api/clubs/' + id + '/rankings')
        ]);

        if (!clubRes.ok) throw new Error("Club not found");
        const club = await clubRes.json();
        const members = await memberRes.json();
        const rankings = await rankingRes.json(); // Lấy thống kê từ rankings
        
        // 1. Cập nhật Header Modal
        const titleEl = document.getElementById('detailClubTitle');
        const catEl = document.getElementById('detailClubCategory');
        const creatorEl = document.getElementById('detailClubCreator');
        const logoEl = document.getElementById('detailClubLogo');
        
        if (titleEl) titleEl.textContent = club.club_name;
        if (catEl) catEl.querySelector('span').textContent = club.category_name || 'Khác';
        if (creatorEl) creatorEl.querySelector('span').textContent = club.creator_name || 'N/A';
        if (logoEl) logoEl.src = club.logo_url || 'https://ui-avatars.com/api/?name=' + club.club_name;
        
        // 2. Cập nhật Số liệu thống kê
        const mCount = document.getElementById('detailMemberCount');
        const eCount = document.getElementById('detailEventCount');
        const pCount = document.getElementById('detailPostCount');
        
        if (mCount) mCount.textContent = rankings.overview?.totalMembers || 0;
        if (eCount) eCount.textContent = rankings.overview?.totalEvents || 0;
        if (pCount) pCount.textContent = rankings.overview?.totalPosts || 0;

        // 3. Đổ dữ liệu bảng thành viên
        const tbody = document.querySelector('#clubMembersTable tbody');
        if (tbody) {
            tbody.innerHTML = members.map(m => `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${m.avatar || 'https://ui-avatars.com/api/?name=' + m.name}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
                            <span>${m.name}</span>
                        </div>
                    </td>
                    <td><span class="status-badge" style="background: ${m.role === 'leader' ? '#fee2e2; color: #991b1b;' : '#f1f5f9; color: #475569;'}">${m.role}</span></td>
                    <td>${new Date(m.joined_at).toLocaleDateString('vi-VN')}</td>
                </tr>
            `).join('');
            if (members.length === 0) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Chưa có thành viên nào</td></tr>';
        }

        const modal = document.getElementById('clubDetailModal');
        if (modal) modal.classList.add('active');
    } catch(err) { 
        console.error("View Club Error:", err);
        alert('Lỗi tải chi tiết CLB'); 
    }
}

async function viewEventDetail(id) { 
    try {
        const [eventRes, regRes] = await Promise.all([
            fetch('/api/events/' + id),
            fetch('/api/events/' + id + '/registrations')
        ]);

        if (!eventRes.ok) throw new Error("Event not found");
        const eventData = await eventRes.json();
        const registrations = await regRes.json();

        // 1. Cập nhật thông tin Header
        document.getElementById('detailEventName').textContent = eventData.event_name;
        document.getElementById('detailEventClub').querySelector('span').textContent = eventData.club_name;
        document.getElementById('detailEventLocation').querySelector('span').textContent = eventData.location;
        document.getElementById('detailEventTime').querySelector('span').textContent = new Date(eventData.start_time).toLocaleString('vi-VN');
        document.getElementById('detailEventCreator').querySelector('span').textContent = eventData.creator_name || 'Hệ thống';
        document.getElementById('detailEventDesc').textContent = eventData.description || 'Không có mô tả.';
        document.getElementById('detailRegCount').textContent = registrations.length;

        // 2. Đổ dữ liệu bảng đăng ký
        const tbody = document.querySelector('#eventRegTable tbody');
        if (tbody) {
            tbody.innerHTML = registrations.map(r => `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${r.avatar || 'https://ui-avatars.com/api/?name=' + r.full_name}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
                            <span>${r.full_name}</span>
                        </div>
                    </td>
                    <td>${r.email}</td>
                    <td>${new Date(r.registered_at).toLocaleDateString('vi-VN')}</td>
                    <td><span class="status-badge ${r.status === 'approved' ? 'status-active' : 'status-pending'}">${r.status}</span></td>
                </tr>
            `).join('');
            if (registrations.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Chưa có người đăng ký nào</td></tr>';
        }

        const modal = document.getElementById('eventDetailModal');
        if (modal) modal.classList.add('active');
    } catch (err) {
        console.error("View Event Error:", err);
        alert('Lỗi tải chi tiết sự kiện');
    }
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active'); 
}

function deleteUser(id) { if (confirm('Xác nhận xóa người dùng này?')) alert('Đã yêu cầu xóa ID: ' + id); }
function deleteClub(id) { if (confirm('Xác nhận xóa câu lạc bộ này?')) alert('Đã yêu cầu xóa ID: ' + id); }

// --- SUPPORT MANAGEMENT ---
async function loadSupportRequests() {
    const tbody = document.getElementById('adminSupportTableBody');
    if (!tbody) return;

    try {
        const response = await fetchWithAuth('/api/support/admin/all');
        if (!response) return;
        const requests = await response.json();

        tbody.innerHTML = requests.map(r => `
            <tr>
                <td>
                    <div style="font-weight: 700; color: #1e293b;">${r.sender_name}</div>
                    <div style="font-size: 11px; color: #64748b;">${r.sender_email}</div>
                </td>
                <td><span class="status-badge" style="background: rgba(197, 48, 48, 0.1); color: var(--primary);">${r.category}</span></td>
                <td><div style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.subject}">${r.subject}</div></td>
                <td>${new Date(r.created_at).toLocaleDateString('vi-VN')}</td>
                <td><span class="status-badge status-${r.status}">${r.status}</span></td>
                <td>
                    <button class="action-btn btn-edit" title="Phản hồi" onclick="openReplyModal(${JSON.stringify(r).replace(/"/g, '&quot;')})">
                        <i class="fas fa-reply"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        if (requests.length === 0) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Không có yêu cầu nào</td></tr>';
    } catch (err) {
        console.error(err);
    }
}

let currentRequest = null;
function openReplyModal(request) {
    currentRequest = request;
    document.getElementById('replyRequestId').value = request.id;
    document.getElementById('replySenderInfo').textContent = `Người gửi: ${request.sender_name} (${request.sender_email})`;
    document.getElementById('replySubject').textContent = request.subject;
    document.getElementById('replyMessage').textContent = request.message;
    document.getElementById('adminReplyContent').value = request.reply_message || '';
    document.getElementById('adminReplyStatus').value = request.status === 'pending' ? 'processing' : request.status;
    
    document.getElementById('supportReplyModal').classList.add('active');
}

// Handle Admin Reply Form
const adminReplyForm = document.getElementById('adminReplyForm');
if (adminReplyForm) {
    adminReplyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('replyRequestId').value;
        const data = {
            reply_message: document.getElementById('adminReplyContent').value,
            status: document.getElementById('adminReplyStatus').value
        };

        try {
            const res = await fetchWithAuth(`/api/support/admin/reply/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });

            if (res && res.ok) {
                alert('Đã gửi phản hồi thành công!');
                closeModal('supportReplyModal');
                loadSupportRequests();
            } else {
                alert('Lỗi khi gửi phản hồi');
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi kết nối');
        }
    });
}

// --- TRAINING POINTS MANAGEMENT ---
async function loadPointsData() {
    const tbody = document.getElementById('pointsTableBody');
    if (!tbody) return;

    try {
        const response = await fetchWithAuth('/api/points/all');
        if (!response) return;
        const history = await response.json();

        tbody.innerHTML = history.map(h => `
            <tr>
                <td>
                    <div style="font-weight: 700; color: #1e293b;">${h.user_name}</div>
                    <div style="font-size: 11px; color: #64748b;">${h.user_email}</div>
                </td>
                <td><span class="status-badge" style="background: rgba(37, 99, 235, 0.1); color: #2563eb;">+${h.points} điểm</span></td>
                <td><div style="max-width: 300px;">${h.reason}</div></td>
                <td>${h.admin_name || 'Hệ thống'}</td>
                <td>${new Date(h.created_at).toLocaleDateString('vi-VN')}</td>
            </tr>
        `).join('');
        if (history.length === 0) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Chưa có lịch sử cộng điểm</td></tr>';
    } catch (err) {
        console.error("Lỗi tải lịch sử điểm:", err);
    }
}

async function showAwardPointsModal() {
    const modal = document.getElementById('awardPointsModal');
    if (!modal) return;
    
    // Tải danh sách sinh viên cho datalist
    const dl = document.getElementById('studentList');
    if (dl && dl.children.length === 0) {
        try {
            const res = await fetchWithAuth('/api/admin/users');
            if (res) {
                const users = await res.json();
                dl.innerHTML = users.map(u => `<option value="${u.id}">${u.full_name} (${u.email})</option>`).join('');
            }
        } catch(err) {}
    }

    modal.classList.add('active');
}

const awardPointsForm = document.getElementById('awardPointsForm');
if (awardPointsForm) {
    awardPointsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const data = {
            user_id: document.getElementById('awardPointsUser').value,
            points: document.getElementById('awardPointsValue').value,
            reason: document.getElementById('awardPointsReason').value,
            created_by: currentUser.id
        };

        try {
            const res = await fetchWithAuth('/api/points/award', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (res && res.ok) {
                alert('Đã cộng điểm thành công!');
                closeModal('awardPointsModal');
                loadPointsData();
                awardPointsForm.reset();
            } else {
                const errData = await res.json();
                alert('Lỗi: ' + (errData.message || 'Không thể cộng điểm'));
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi kết nối');
        }
    });
}