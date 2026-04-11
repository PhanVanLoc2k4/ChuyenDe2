let clubId = null;
let currentUser = null;
let clubData = null;
let currentStatsPeriod = 'month';

// Initialize Page
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    clubId = parseInt(urlParams.get('id'), 10);
    if (isNaN(clubId) || clubId <= 0) clubId = null;

    const userStr = localStorage.getItem('currentUser');
    if (userStr) currentUser = JSON.parse(userStr);

    if (!clubId) {
        // Chế độ: Chưa chọn CLB (Truy cập từ Header)
        document.getElementById('clubHero').style.display = 'none';
        document.getElementById('clubDashboardContent').style.display = 'none';
        document.getElementById('noClubSelectedView').style.display = 'block';

        // Ẩn các tab quản trị khác nếu chưa chọn CLB
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.tab !== 'feed') item.style.display = 'none';
        });

        if (currentUser) {
            loadMyClubs();
        } else {
            alert("Vui lòng đăng nhập để xem diễn đàn.");
            window.location.href = "/dangnhap";
        }
        return;
    }

    // Chế độ: Đã chọn CLB cụ thể
    document.getElementById('noClubSelectedView').style.display = 'none';

    // Tải thông tin CLB trước khi hiện UI
    const loaded = await loadClubInfo();

    if (loaded) {
        document.getElementById('clubHero').style.display = 'flex';
        document.getElementById('clubDashboardContent').style.display = 'block';
        switchTab('feed');
        if (typeof setupFormListeners === 'function') setupFormListeners();
    } else {
        alert(`Không tìm thấy thông tin Câu lạc bộ (ID: ${clubId}). Vui lòng kiểm tra lại.`);
        window.location.href = "/clb";
    }
});

// Hàm load danh sách CLB của User khi chưa chọn CLB cụ thể
async function loadMyClubs() {
    const list = document.getElementById('myClubsList');
    list.innerHTML = '<div class="loading-placeholder">Đang tải danh sách CLB của bạn...</div>';

    try {
        const response = await fetch(`/api/user/clubs/${currentUser.user_id || currentUser.id}`);
        const clubs = await response.json();

        if (clubs.length === 0) {
            list.innerHTML = `<p style="padding: 20px; color: #64748b;">Bạn chưa tham gia câu lạc bộ nào.</p>`;
            return;
        }

        list.innerHTML = clubs.map(c => `
            <div class="post-card" style="cursor: pointer; text-align: left; transition: 0.3s;" onclick="window.location.href='?id=${c.id}'">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 50px; height: 50px; background: #c53030; color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
                        ${c.name.charAt(0)}
                    </div>
                    <div>
                        <h4 style="margin: 0; font-size: 18px;">${c.name}</h4>
                        <span style="font-size: 13px; color: #64748b;">Nhấn để vào quản lý / thảo luận</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = 'Lỗi tải danh sách CLB.';
    }
}

// 1. Tải thông tin chung của CLB
async function loadClubInfo() {
    try {
        const response = await fetch(`/api/clubs/${clubId}`);
        if (!response.ok) return false;

        clubData = await response.json();

        document.getElementById('clubNameDisplay').textContent = clubData.club_name;
        document.getElementById('clubDescDisplay').textContent = clubData.description;
        document.getElementById('clubCategory').innerHTML = `<i class="fas fa-tag"></i> ${clubData.category_name}`;
        document.getElementById('clubLeaderName').innerHTML = `<i class="fas fa-crown"></i> Trưởng CLB: ${clubData.creator_name}`;

        if (clubData.logo_url) {
            document.getElementById('clubLogoLarge').innerHTML = `<img src="${clubData.logo_url}" alt="logo">`;
        } else {
            document.getElementById('clubLogoLarge').innerHTML = `<i class="fas fa-users"></i>`;
        }

        if (clubData.cover_url) {
            document.getElementById('clubHero').style.backgroundImage = `url('${clubData.cover_url}')`;
            document.getElementById('clubHero').style.backgroundSize = 'cover';
            document.getElementById('clubHero').style.backgroundPosition = 'center';
        }

        // Kiểm tra quyền Trưởng CLB
        const isLeader = currentUser && Number(currentUser.user_id || currentUser.id) === Number(clubData.created_by);
        
        // Luôn hiện Cài đặt cho thành viên, nhưng Phân quyền chỉ cho Leader
        document.getElementById('navSettings').style.display = 'flex';
        
        if (isLeader) {
            document.getElementById('navMembers').style.display = 'flex';
            document.getElementById('btnCreateEvent').style.display = 'flex';
        } else {
            document.getElementById('navMembers').style.display = 'none';
            document.getElementById('btnCreateEvent').style.display = 'none';
        }

        // Lấy số lượng thành viên sơ bộ
        const membersResp = await fetch(`/api/clubs/${clubId}/members`);
        if (membersResp.ok) {
            const members = await membersResp.json();
            document.getElementById('clubMemberCount').innerHTML = `<i class="fas fa-user-friends"></i> ${members.length} thành viên`;
        }

        return true;
    } catch (err) {
        console.error("Lỗi load CLB:", err);
        return false;
    }
}

// 2. Chuyển đổi Tab
function switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === tabName) item.classList.add('active');
    });

    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'feed') if (typeof loadPosts === 'function') loadPosts();
    if (tabName === 'events') if (typeof loadEvents === 'function') loadEvents();
    if (tabName === 'members') if (typeof loadManagementData === 'function') loadManagementData();
    if (tabName === 'stats') if (typeof loadClubStatistics === 'function') loadClubStatistics();
    if (tabName === 'settings') if (typeof loadSettingsData === 'function') loadSettingsData();
}

// --- UTILS ---
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
window.onclick = (event) => {
    if (event.target.classList.contains('modal')) event.target.style.display = 'none';
};

function togglePostDropdown(event, typeId) {
    event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${typeId}`);
    const isVisible = dropdown.style.display === 'block';
    document.querySelectorAll('.action-dropdown').forEach(d => d.style.display = 'none');
    if (!isVisible) dropdown.style.display = 'block';
}

document.addEventListener('click', () => {
    document.querySelectorAll('.action-dropdown').forEach(d => d.style.display = 'none');
});

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});
