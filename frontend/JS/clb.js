/* =============================================================
   CLB.JS - PHIÊN BẢN CẬP NHẬT LOGO & COVER
   ============================================================= */

let clubsData = [];
let currentUser = null;
let userJoinedClubIds = []; // <--- Lưu danh sách ID các CLB đã tham gia
let userRequestedClubIds = []; // Danh sách yêu cầu tham gia

function initAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('reveal');
                }, index * 100); 
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    window.revealObserver = observer;
}

document.addEventListener("DOMContentLoaded", async () => {
    initAnimations();
    checkAuth();
    if (currentUser) {
        await fetchUserMemberships();
    }
    fetchClubs();
    setupEventListeners();
});

// 1. Kiểm tra đăng nhập
function checkAuth() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
        try {
            currentUser = JSON.parse(userStr);
        } catch (e) { currentUser = null; }
    }
    renderAuthSection();
}

// 2. Hiển thị thông tin User trên Header
function renderAuthSection() {
    const authSection = document.getElementById('authSection');
    const heroBtn = document.getElementById('heroCreateBtn');
    
    if (currentUser && (currentUser.isLoggedIn || currentUser.id)) {
        if (authSection) {
            authSection.innerHTML = `
                <div class="user-info cinematic-user" id="userInfo">
                    <span>${currentUser.name}</span>
                    <div class="user-avatar">${currentUser.name.charAt(0).toUpperCase()}</div>
                </div>`;
        }

        // Show Create button in Hero for Leaders/Admins
        if (heroBtn && (currentUser.role === 'leader' || currentUser.role === 'admin')) {
            heroBtn.style.display = 'flex';
        }
    }
}

// 2.5 Lấy danh sách ID các CLB mà User này đã tham gia & đang chờ duyệt
async function fetchUserMemberships() {
    const userId = currentUser.id || currentUser.user_id;
    if (!userId) return;

    try {
        const responseJoined = await fetch(`/api/user/clubs/${userId}`);
        if (responseJoined.ok) {
            const dataJoined = await responseJoined.json();
            userJoinedClubIds = dataJoined.map(c => Number(c.id));
        }

        const responseRequested = await fetch(`/api/user/requests/${userId}`);
        if (responseRequested.ok) {
            const dataRequested = await responseRequested.json();
            userRequestedClubIds = dataRequested.map(r => Number(r.club_id));
        }

    } catch (error) {
        console.error("Lỗi fetch memberships:", error);
    }
}

// 3. Lấy danh sách CLB từ API
async function fetchClubs() {
    try {
        const response = await fetch('/api/clubs');
        const data = await response.json();

        // File: clb.js - Hàm fetchClubs()
        clubsData = data.map(c => ({
            id: c.id,
            name: c.club_name,
            category: c.category_name || "Chung",
            description: c.description || "Chưa có mô tả.",
            creatorName: c.creator || "Ban quản trị",
            logo_url: c.logo_url || '',
            cover_url: c.cover_url || '',
            created_by: c.created_by,
            memberCount: c.member_count || 0
        }));

        renderCategoryFilters();
        renderClubs();
    } catch (error) {
        console.error("Lỗi tải CLB:", error);
    }
}

// 4. Tạo bộ lọc danh mục động
function renderCategoryFilters() {
    const filterContainer = document.getElementById('categoryFilter');
    if (!filterContainer) return;

    const categories = [...new Set(clubsData.map(c => c.category))];

    let html = `<div class="category-chip active" data-category="all">Tất cả</div>`;
    categories.forEach(cat => {
        html += `<div class="category-chip" data-category="${cat}">${cat}</div>`;
    });

    filterContainer.innerHTML = html;

    filterContainer.querySelectorAll('.category-chip').forEach(chip => {
        chip.addEventListener('click', function () {
            filterContainer.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            renderClubs();
        });
    });
}

// 5. Hiển thị danh sách CLB ra giao diện (SỬA ĐỔI PHẦN HIỂN THỊ ẢNH)
function renderClubs() {
    const grid = document.getElementById('clubsGrid');
    if (!grid) return;

    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || "";
    const activeChip = document.querySelector('.category-chip.active');
    const selectedCategory = activeChip ? activeChip.getAttribute('data-category') : "all";

    let list = clubsData.filter(club => {
        const matchSearch = club.name.toLowerCase().includes(searchTerm) ||
            club.description.toLowerCase().includes(searchTerm);
        const matchCategory = (selectedCategory === "all" || club.category === selectedCategory);
        return matchSearch && matchCategory;
    });

    if (list.length === 0) {
        grid.innerHTML = `<div class="no-results-cinema" style="grid-column: 1/-1; text-align: center; padding: 100px 20px;">
            <i class="fas fa-search" style="font-size: 50px; color: rgba(255,255,255,0.1); margin-bottom: 20px; display: block;"></i>
            <p style="color: var(--text-dim); font-size: 18px;">Không tìm thấy câu lạc bộ nào phù hợp với tìm kiếm của bạn.</p>
        </div>`;
        return;
    }

    grid.innerHTML = list.map(club => {
        const coverImg = club.cover_url || 'https://via.placeholder.com/600x400?text=Cinema+Connect';
        
        return `
        <div class="club-card cinematic-reveal" onclick="showClubDetail(${club.id})">
            <div class="club-cover-container">
                <img src="${coverImg}" class="club-cover-img" onerror="this.src='https://via.placeholder.com/600x400?text=Cinema+Connect'">
            </div>
            <div class="club-card-content">
                <div class="club-card-meta">
                    <span class="club-type">${club.category}</span>
                </div>
                <h3 class="club-title">${club.name}</h3>
                <p class="club-desc">${club.description}</p>
                <div class="club-card-footer">
                    <div class="club-members-count">
                        <i class="fas fa-users"></i>
                        <span>${club.memberCount || 0} thành viên</span>
                    </div>
                    <button class="btn-club-view">Chi tiết <i class="fas fa-arrow-right"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');

    // Trigger reveal animation
    if (window.revealObserver) {
        grid.querySelectorAll('.cinematic-reveal').forEach(card => window.revealObserver.observe(card));
    }
}

async function handleJoinClub(clubId, reason = "") {
    if (!currentUser) return alert("Vui lòng đăng nhập để tham gia!");

    try {
        const response = await fetch('/api/clubs/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                club_id: clubId,
                user_id: currentUser.id || currentUser.user_id,
                reason: reason
            })
        });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            location.reload();
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error("Lỗi khi tham gia CLB:", error);
    }
}

async function handleLeaveClub(clubId) {
    if (!currentUser) return alert("Vui lòng đăng nhập!");

    // Debug: Hiện log để biết hàm được gọi
    console.log("handleLeaveClub called", clubId);

    if (!confirm("Bạn có chắc chắn muốn rời câu lạc bộ này không?")) return;

    try {
        const userId = currentUser.id || currentUser.user_id;
        const response = await fetch('/api/clubs/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                club_id: Number(clubId),
                user_id: Number(userId)
            })
        });

        const result = await response.json();
        if (response.ok) {
            alert(result.message || "Đã rời câu lạc bộ!");
            location.reload();
        } else {
            alert("Lỗi: " + (result.message || "Không thể rời CLB"));
        }
    } catch (error) {
        console.error("Lỗi khi rời CLB:", error);
        alert("Lỗi kết nối máy chủ khi rời CLB.");
    }
}

async function handleDeleteClub(clubId) {
    if (!currentUser) return;
    if (!confirm("⚠️ CẢNH BÁO: Việc xóa câu lạc bộ sẽ xóa toàn bộ dữ liệu liên quan (thành viên, bài viết, sự kiện) và không thể khôi phục. Bạn có chắc chắn muốn HỦY câu lạc bộ này không?")) return;

    try {
        const userId = currentUser.id || currentUser.user_id;
        const response = await fetch(`/api/clubs/${clubId}?user_id=${userId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            location.reload();
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error("Lỗi khi xóa CLB:", error);
    }
}


function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// 6. Xử lý gửi Form tạo CLB mới (Cập nhật Logo & Cover)
async function handleCreateClub(event) {
    event.preventDefault();
    if (!currentUser) return alert("Vui lòng đăng nhập!");

    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    try {
        const logoFile = document.getElementById('clubLogo').files[0];
        const coverFile = document.getElementById('clubCover').files[0];

        // Chuyển đổi sang Base64 nếu có file
        const logoBase64 = logoFile ? await toBase64(logoFile) : '';
        const coverBase64 = coverFile ? await toBase64(coverFile) : '';

        const clubData = {
            club_name: document.getElementById('clubName').value,
            category_name: document.getElementById('clubCategory').value,
            description: document.getElementById('clubDescription').value,
            logo_url: logoBase64,
            cover_url: coverBase64,
            created_by: currentUser.id || currentUser.user_id
        };

        const response = await fetch('/api/clubs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clubData)
        });

        const result = await response.json();
        if (response.ok) {
            alert("Tạo câu lạc bộ thành công!");
            location.reload();
        } else {
            alert("Lỗi: " + result.message);
        }
    } catch (error) {
        console.error("Lỗi khi xử lý ảnh:", error);
        alert("Không thể xử lý ảnh. Vui lòng thử lại với ảnh khác.");
    }
}
// Giả sử đây là hàm tạo thẻ CLB của bạn
function createClubCard(club) {
    const card = document.createElement('div');
    card.className = 'club-card';
    // Khi click vào khung câu lạc bộ
    card.onclick = () => showClubDetail(club);

    card.innerHTML = `
        <img src="${club.logo}" alt="${club.name}">
        <h3>${club.name}</h3>
        <p>${club.category}</p>
    `;
    return card;
}

// Hàm showClubDetail đã được định nghĩa bên dưới (dòng 359), xóa bản cũ này đi để tránh xung đột


function showClubDetail(id) {
    const club = clubsData.find(c => c.id === id);
    if (!club) return;

    // 1. Khai báo các biến cần thiết trước khi render UI
    const currentUserId = currentUser ? Number(currentUser.id || currentUser.user_id) : null;
    const clubCreatorId = Number(club.created_by);
    const isMember = userJoinedClubIds.includes(Number(club.id));
    const isRequested = userRequestedClubIds.includes(Number(club.id));
    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role_name === 'admin');

    const modal = document.getElementById('clubModal');
    const modalBody = document.getElementById('modalBody');
    const modalJoinBtn = document.getElementById('modalJoinBtn');

    // 2. Cập nhật Tiêu đề và Category
    document.getElementById('modalClubName').textContent = club.name;
    document.getElementById('modalClubCategory').textContent = club.category;

    // 3. Render nội dung thân Modal
    modalBody.innerHTML = `
        <div class="modal-detail-content">
            <div class="detail-banner-wrapper">
                <img src="${club.cover_url || 'default-cover.jpg'}" class="detail-banner-img">
                <div class="detail-logo-overlay">
                    <img src="${club.logo_url || 'default-logo.png'}" class="detail-logo-img">
                </div>
            </div>

            <div class="detail-stats-grid">
                <div class="stat-card">
                    <i class="fas fa-users"></i>
                    <span class="stat-value">${club.memberCount || 0}</span>
                    <span class="stat-label">Thành viên</span>
                </div>
                <div class="stat-card">
                    <i class="fas fa-calendar-alt"></i>
                    <span class="stat-value" style="font-size: 14px;">Thứ 7 hàng tuần</span>
                    <span class="stat-label">Lịch sinh hoạt</span>
                </div>
                <div class="stat-card">
                    <i class="fas fa-map-marker-alt"></i>
                    <span class="stat-value" style="font-size: 14px;">Hội trường A</span>
                    <span class="stat-label">Địa điểm</span>
                </div>
            </div>

            <div class="detail-section">
                <h3 class="section-title">Giới thiệu chung</h3>
                <p class="section-text">${club.description}</p>
            </div>

            <div class="detail-section">
                <h3 class="section-title">Quyền lợi thành viên</h3>
                <ul class="benefits-list">
                    <li>Được đào tạo kỹ năng chuyên môn miễn phí.</li>
                    <li>Cấp giấy chứng nhận hoạt động ngoại khóa.</li>
                    <li>Mở rộng mạng lưới kết nối bạn bè cùng đam mê.</li>
                </ul>
            </div>

            ${!isAdmin && !isMember && !isRequested && currentUserId && clubCreatorId !== currentUserId ? `
                <div id="joinReasonSection" class="detail-section" style="background: rgba(255,193,7,0.05); padding: 20px; border-radius: 16px; border: 1px solid rgba(255,193,7,0.2); display: none;">
                    <h3 style="font-size: 16px; color: #ffc107; margin-bottom: 12px; font-weight: 800;">
                        <i class="fas fa-edit"></i> Lý do muốn tham gia?
                    </h3>
                    <textarea id="joinReasonInput" class="form-control" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 15px; color: white; font-family: inherit; font-size: 14px; outline: none;" rows="3" placeholder="Hãy giới thiệu ngắn gọn về bản thân và lý do bạn muốn tham gia CLB này..."></textarea>
                </div>
            ` : ''}
        </div>
    `;

    // 4. Logic xử lý nút bấm
    if (modalJoinBtn) {
        // Reset trạng thái nút
        modalJoinBtn.disabled = false;
        modalJoinBtn.style.display = "block";
        modalJoinBtn.style.opacity = "1";
        modalJoinBtn.style.cursor = "pointer";

        if (currentUserId && clubCreatorId === currentUserId) {
            modalJoinBtn.className = "btn-cinema-action";
            modalJoinBtn.innerHTML = `<i class="fas fa-trash-alt"></i> Giải thể Câu lạc bộ (Chủ CLB)`;
            modalJoinBtn.style.background = "#dc3545";
            modalJoinBtn.onclick = () => handleDeleteClub(club.id);
        } else if (isAdmin) {
            modalJoinBtn.className = "btn-cinema-action";
            modalJoinBtn.innerHTML = `<i class="fas fa-user-shield"></i> Quyền Quản trị viên (Admin)`;
            modalJoinBtn.style.background = "#6366f1";
            modalJoinBtn.onclick = () => window.location.href = `/DienDan?id=${club.id}`;
        } else if (isMember) {
            modalJoinBtn.className = "btn-cinema-action";
            modalJoinBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> Rời khỏi Câu lạc bộ`;
            modalJoinBtn.style.background = "#ed8936";
            modalJoinBtn.onclick = () => handleLeaveClub(club.id);
        } else if (isRequested) {
            modalJoinBtn.className = "btn-cinema-action";
            modalJoinBtn.innerHTML = `<i class="fas fa-hourglass-half"></i> Đang chờ duyệt...`;
            modalJoinBtn.style.background = "#eab308";
            modalJoinBtn.style.cursor = "default";
            modalJoinBtn.onclick = (e) => e.stopPropagation();
        } else {
            modalJoinBtn.className = "btn-cinema-action";
            modalJoinBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Tham gia CLB`;
            modalJoinBtn.style.background = "var(--cinema-red)";
            modalJoinBtn.onclick = () => prepareJoinStep(club.id);
        }

        // Bổ sung nút Di chuyển đến Diễn đàn nếu đã là thành viên
        const existingBtn = modalJoinBtn.parentNode.querySelector('.btn-dashboard-nav');
        if (existingBtn) existingBtn.remove();

        if (currentUserId && (clubCreatorId === currentUserId || isMember || isAdmin)) {
            const dashboardBtn = document.createElement('button');
            dashboardBtn.className = 'btn-join btn-dashboard-nav';
            dashboardBtn.innerHTML = `<i class="fas fa-external-link-alt"></i> Vào trang Câu lạc bộ`;
            dashboardBtn.style.background = "#4a5568";
            dashboardBtn.style.marginTop = "10px";
            dashboardBtn.style.width = "100%";
            dashboardBtn.style.display = "block";
            dashboardBtn.onclick = () => {
                window.location.href = `/DienDan?id=${club.id}`;
            };
            modalJoinBtn.parentNode.appendChild(dashboardBtn);
        }
    }

    modal.classList.add('active');
}

// Hàm xử lý bước 1: Hiển thị ô nhập lý do
function prepareJoinStep(clubId) {
    const reasonSection = document.getElementById('joinReasonSection');
    const modalJoinBtn = document.getElementById('modalJoinBtn');

    if (reasonSection) {
        reasonSection.style.display = 'block';
        reasonSection.style.animation = 'fadeIn 0.4s ease';

        modalJoinBtn.innerHTML = `<i class="fas fa-paper-plane"></i> Xác nhận gửi đơn`;
        modalJoinBtn.style.background = "#16a34a"; // Chuyển sang màu xanh lá khi xác nhận
        modalJoinBtn.onclick = () => {
            const reason = document.getElementById('joinReasonInput').value;
            handleJoinClub(clubId, reason);
        };

        // Scroll xuống ô nhập lý do
        reasonSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
        // Nếu không có ô lý do (chưa đăng nhập hoặc là chủ CLB - trường hợp này hiếm vì logic đã chặn)
        handleJoinClub(clubId);
    }
}

// Đảm bảo hàm đóng modal duy nhất hoạt động
function closeModal() {
    const modal = document.getElementById('clubModal');
    if (modal) modal.classList.remove('active');
}

// Hàm bổ sung để khớp với thuộc tính onclick="joinClubFromModal()" trong clb.ejs
function joinClubFromModal() {
    const name = document.getElementById('modalClubName').textContent;
    const club = clubsData.find(c => c.name === name);
    const reasonInput = document.getElementById('joinReasonInput');
    const reason = reasonInput ? reasonInput.value : "";

    if (club) {
        handleJoinClub(club.id, reason);
    } else {
        alert("Không tìm thấy thông tin câu lạc bộ để tham gia.");
    }
}

// 7. Event Listeners & Điều khiển Modal
function setupEventListeners() {
    document.getElementById('searchInput')?.addEventListener('input', renderClubs);
    document.getElementById('createClubForm')?.addEventListener('submit', handleCreateClub);
}

function showCreateClubModal() {
    if (!currentUser) return alert("Hãy đăng nhập trước!");
    document.getElementById('createClubModal').classList.add('active');
}

function closeCreateClubModal() {
    document.getElementById('createClubModal').classList.remove('active');
    document.getElementById('createClubForm')?.reset();
}

