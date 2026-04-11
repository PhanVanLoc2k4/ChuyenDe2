/* =============================================================
   CLB.JS - PHIÊN BẢN CẬP NHẬT LOGO & COVER
   ============================================================= */

let clubsData = []; 
let currentUser = null;
let userJoinedClubIds = []; // <--- Lưu danh sách ID các CLB đã tham gia
let userRequestedClubIds = []; // Danh sách yêu cầu tham gia

document.addEventListener("DOMContentLoaded", async () => {
    checkAuth();      
    if (currentUser) {
        await fetchUserMemberships(); // <--- Lấy danh sách đã tham gia trước khi render
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
    if (!authSection) return;
    if (currentUser && (currentUser.isLoggedIn || currentUser.id)) {
        authSection.innerHTML = `
            <div class="user-info" id="userInfo" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <span>Xin chào, <strong>${currentUser.name}</strong></span>
                <div class="user-avatar" style="width: 35px; height: 35px; background: #c53030; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                    ${currentUser.name.charAt(0).toUpperCase()}
                </div>
            </div>`;
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
        if(responseRequested.ok) {
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
            created_by: c.created_by 
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
        chip.addEventListener('click', function() {
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
        grid.innerHTML = `<p style="text-align:center; grid-column: 1/-1; padding: 20px;">Không tìm thấy câu lạc bộ nào.</p>`;
        return;
    }

    grid.innerHTML = list.map(club => {
        const coverImg = club.cover_url || 'https://via.placeholder.com/400x150?text=CLB+Connect';
        const logoImg = club.logo_url || 'https://via.placeholder.com/80?text=LOGO';

        // --- LOGIC XỬ LÝ NÚT BẤM (CẬP NHẬT) ---
        let actionBtn = '';
        const currentUserId = currentUser ? Number(currentUser.id || currentUser.user_id) : null;
        const clubCreatorId = Number(club.created_by);
        const isMember = userJoinedClubIds.includes(Number(club.id));
        const isRequested = userRequestedClubIds.includes(Number(club.id));

        if (currentUserId && clubCreatorId === currentUserId) {
            // Nếu là chủ CLB
            actionBtn = `<button class="btn-join" style="background: #28a745; cursor: default;" onclick="event.stopPropagation()">
                            <i class="fas fa-crown"></i> Chủ CLB
                         </button>`;
        } 
        else if (isMember) {
            // Nếu đã là thành viên (nhưng không phải chủ)
            actionBtn = `<button class="btn-join" style="background: #28a745; cursor: default;" onclick="event.stopPropagation()">
                            <i class="fas fa-check-circle"></i> Đã tham gia
                         </button>`;
        }
        else if (isRequested) {
            // Nếu đang chờ duyệt
            actionBtn = `<button class="btn-join" style="background: #eab308; cursor: default;" onclick="event.stopPropagation()">
                            <i class="fas fa-hourglass-half"></i> Chờ duyệt
                         </button>`;
        }
        else {
            // Nếu chưa tham gia
            actionBtn = `<button class="btn-join" onclick="event.stopPropagation(); handleJoinClub(${club.id})">
                            Tham gia
                         </button>`;
        }
        // -----------------------------

        return `
        <div class="club-card" onclick="showClubDetail(${club.id})">
            <div class="club-cover" style="background-image: url('${coverImg}'); background-size: cover; background-position: center; height: 120px; position: relative;">
                <img src="${logoImg}" class="club-logo-img" 
                    style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid white; position: absolute; bottom: -30px; left: 20px; background: white; object-fit: cover;"
                    onerror="this.src='https://via.placeholder.com/80?text=LOGO'">
            </div>
            <div class="club-info" style="padding-top: 35px;">
                <div class="club-category-tag">${club.category}</div>
                <div class="club-name">${club.name}</div>
                <p class="club-description">${club.description}</p>
                <div class="club-footer">
                    <span><i class="fas fa-user-tie"></i> ${club.creatorName}</span>
                    ${actionBtn} 
                </div>
            </div>
        </div>`;
    }).join('');
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
        reader.onload = function(e) {
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

    const modal = document.getElementById('clubModal');
    const modalBody = document.getElementById('modalBody');
    const modalJoinBtn = document.getElementById('modalJoinBtn');
    
    // 2. Cập nhật Tiêu đề và Category
    document.getElementById('modalClubName').textContent = club.name;
    document.getElementById('modalClubCategory').textContent = club.category;

    // 3. Render nội dung thân Modal
    modalBody.innerHTML = `
        <div class="modal-detail-content">
            <div class="detail-banner-wrapper" style="position: relative; margin-bottom: 50px;">
                <img src="${club.cover_url || 'default-cover.jpg'}" style="width: 100%; height: 220px; object-fit: cover; border-radius: 15px;">
                <div style="position: absolute; bottom: -40px; left: 30px; display: flex; align-items: flex-end; gap: 15px;">
                    <img src="${club.logo_url || 'default-logo.png'}" style="width: 100px; height: 100px; border-radius: 20px; border: 5px solid white; background: white; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div style="background: #f1f5f9; padding: 15px; border-radius: 12px; text-align: center;">
                    <i class="fas fa-users" style="color: #c53030;"></i>
                    <div style="font-weight: bold; font-size: 18px;">${club.memberCount || 0}</div>
                    <div style="font-size: 12px; color: #64748b;">Thành viên</div>
                </div>
                <div style="background: #f1f5f9; padding: 15px; border-radius: 12px; text-align: center;">
                    <i class="fas fa-calendar-alt" style="color: #c53030;"></i>
                    <div style="font-weight: bold; font-size: 14px;">Thứ 7 hàng tuần</div>
                    <div style="font-size: 12px; color: #64748b;">Lịch sinh hoạt</div>
                </div>
                <div style="background: #f1f5f9; padding: 15px; border-radius: 12px; text-align: center;">
                    <i class="fas fa-map-marker-alt" style="color: #c53030;"></i>
                    <div style="font-weight: bold; font-size: 14px;">Hội trường A</div>
                    <div style="font-size: 12px; color: #64748b;">Địa điểm</div>
                </div>
            </div>

            <div class="modal-detail-section">
                <h3 style="font-size: 18px; color: #1a2639; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                    <span style="width: 4px; height: 18px; background: #c53030; display: inline-block; border-radius: 2px;"></span>
                    Giới thiệu chung
                </h3>
                <p style="color: #4a5568; line-height: 1.7;">${club.description}</p>
            </div>

            <div class="modal-detail-section" style="margin-top: 20px;">
                <h3 style="font-size: 18px; color: #1a2639; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                    <span style="width: 4px; height: 18px; background: #c53030; display: inline-block; border-radius: 2px;"></span>
                    Quyền lợi thành viên
                </h3>
                <ul style="padding-left: 20px; color: #4a5568;">
                    <li>Được đào tạo kỹ năng chuyên môn miễn phí.</li>
                    <li>Cấp giấy chứng nhận hoạt động ngoại khóa.</li>
                    <li>Mở rộng mạng lưới kết nối bạn bè cùng đam mê.</li>
                </ul>
            </div>

            ${!isMember && !isRequested && currentUserId && clubCreatorId !== currentUserId ? `
                <div id="joinReasonSection" class="modal-detail-section" style="margin-top: 25px; background: #fffbeb; padding: 15px; border-radius: 12px; border: 1px solid #fef3c7; display: none;">
                    <h3 style="font-size: 16px; color: #92400e; margin-bottom: 10px;">
                        <i class="fas fa-edit"></i> Lý do muốn tham gia?
                    </h3>
                    <textarea id="joinReasonInput" style="width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; font-family: inherit; font-size: 14px; outline: none;" rows="3" placeholder="Hãy giới thiệu ngắn gọn về bản thân và lý do bạn muốn tham gia CLB này..."></textarea>
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
            modalJoinBtn.innerHTML = `<i class="fas fa-trash-alt"></i> Giải thể Câu lạc bộ (Chủ CLB)`;
            modalJoinBtn.style.background = "#dc3545"; 
            modalJoinBtn.onclick = () => handleDeleteClub(club.id);
        } else if (isMember) {
            modalJoinBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> Rời khỏi Câu lạc bộ`;
            modalJoinBtn.style.background = "#ed8936"; 
            modalJoinBtn.onclick = () => handleLeaveClub(club.id);
        } else if (isRequested) {
            modalJoinBtn.innerHTML = `<i class="fas fa-hourglass-half"></i> Đang chờ duyệt...`;
            modalJoinBtn.style.background = "#eab308"; 
            modalJoinBtn.style.cursor = "default";
            modalJoinBtn.onclick = (e) => e.stopPropagation();
        } else {
            modalJoinBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Tham gia CLB`;
            modalJoinBtn.style.background = "#c53030"; 
            modalJoinBtn.onclick = () => prepareJoinStep(club.id);
        }

        // Bổ sung nút Di chuyển đến Diễn đàn nếu đã là thành viên
        const existingBtn = modalJoinBtn.parentNode.querySelector('.btn-dashboard-nav');
        if (existingBtn) existingBtn.remove();

        if (currentUserId && (clubCreatorId === currentUserId || isMember)) {
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

    modal.style.display = 'flex'; 
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
    if (modal) modal.style.display = 'none';
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

