/* =============================================================
   PROFILE.JS - PHIÊN BẢN KẾT NỐI DATABASE 100%
   ============================================================= */

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?background=2563eb&color=fff&size=180&rounded=true&bold=true&name=User";

// State quản lý dữ liệu trang
let currentProfile = {}; 
let currentUser = null;
let isEditMode = false;
let newAvatarBase64 = null; 

// DOM elements
const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const dobInput = document.getElementById('dob');
const bioTextarea = document.getElementById('bio');
const hobbiesInput = document.getElementById('hobbies');
const genderRadios = document.querySelectorAll('input[name="gender"]');
const clubContainer = document.getElementById('clubChecklist');
const avatarImg = document.getElementById('avatarImg');
const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const uploadControlDiv = document.getElementById('uploadControl');
const viewAvatarHint = document.getElementById('viewAvatarHint');
const avatarInput = document.getElementById('avatarInput');

/**
 * 1. KHỞI TẠO KHI TRANG LOAD
 */
document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
        window.location.href = "/dangnhap";
        return;
    }
    currentUser = JSON.parse(userStr);
    
    setupEventListeners();
    // CHỈ GỌI MỘT HÀM DUY NHẤT
    await loadFullData(); 
});

/**
 * 2. LẤY TOÀN BỘ DỮ LIỆU TỪ DATABASE
 */
async function loadFullData() {
    // Ưu tiên id từ currentUser (được set lúc login)
    const userId = currentUser ? (currentUser.id || currentUser.user_id) : null;
    
    if (!userId) {
        console.error("No valid UserID found in currentUser");
        showToast("Không tìm thấy thông tin đăng nhập!", false);
        return;
    }

    console.log("🚀 Starting fetch for UserID:", userId);

    // KIỂM TRA QUYỀN: Nếu là admin thì ẩn phần điểm rèn luyện
    const isAdmin = currentUser && currentUser.role === 'admin';
    if (isAdmin) {
        const pointsBadge = document.getElementById('trainingPointsBadge');
        const historySection = document.getElementById('pointHistorySection');
        if (pointsBadge) pointsBadge.style.display = 'none';
        if (historySection) historySection.style.display = 'none';
    }

    try {
        const fetchPromises = [
            fetch(`/api/user/profile/${userId}`),
            fetch(`/api/user/clubs/${userId}`)
        ];

        // Chỉ fetch lịch sử điểm nếu không phải admin
        if (!isAdmin) {
            fetchPromises.push(fetch(`/api/points/history/${userId}`));
        }

        const responses = await Promise.all(fetchPromises);
        const profileRes = responses[0];
        const clubsRes = responses[1];
        const historyRes = !isAdmin ? responses[2] : null;

        if (!profileRes.ok) {
            const errData = await profileRes.json();
            throw new Error(errData.message || "Lỗi API Profile");
        }

        const profileData = await profileRes.json();
        const joinedClubs = await clubsRes.json();
        const pointHistory = historyRes ? await historyRes.json() : [];
        
        console.log("✅ Profile Data received from DB:", profileData);
        
        // Tính tổng điểm từ lịch sử để đảm bảo khớp hoàn toàn với danh sách hiển thị
        let totalPoints = 0;
        if (!isAdmin && pointHistory.length > 0) {
            totalPoints = pointHistory.reduce((sum, item) => sum + (item.points || 0), 0);
        } else if (!isAdmin) {
            // Nếu không có lịch sử, lấy từ profileData (phòng hờ)
            totalPoints = profileData.training_points || 0;
        }

        // Cập nhật hiển thị điểm tổng ở đầu trang
        const pointsDisplay = document.getElementById('displayPoints');
        if (pointsDisplay && !isAdmin) {
            pointsDisplay.textContent = totalPoints;
        }

        // Map data từ Database sang State (Dùng các key từ SELECT trong server.js)
        currentProfile = {
            id: userId,
            fullName: profileData.full_name || "",
            email: profileData.email || "",
            phone: profileData.phone || "",
            // Ép kiểu dob về YYYY-MM-DD
            dob: profileData.dob ? new Date(profileData.dob).toISOString().split('T')[0] : "",
            gender: profileData.gender || "Nam",
            bio: profileData.bio || "",
            hobbies: profileData.hobbies || "",
            avatar: profileData.avatar || DEFAULT_AVATAR,
            points: profileData.training_points || 0
        };
        
        console.log("📍 Render Form with:", currentProfile);
        renderProfileToForm();
        renderJoinedClubsUI(joinedClubs);
        renderPointHistoryUI(pointHistory);
        
    } catch (error) {
        console.error("❌ Lỗi tải dữ liệu Profile:", error);
        showToast("Lỗi: " + error.message, false);
    }
}

function formatDobForInput(dob) {
    if (!dob) return "";
    try {
        // Nếu là định dạng ISO (có chữ T), cắt lấy phần ngày
        if (typeof dob === 'string' && dob.includes('T')) {
            return dob.split('T')[0];
        }
        // Nếu là đối tượng Date hoặc định dạng khác, ép kiểu về ISO
        return new Date(dob).toISOString().split('T')[0];
    } catch (e) {
        console.warn("Lỗi format ngày sinh:", dob, e);
        return "";
    }
}

/**
 * 3. HIỂN THỊ DỮ LIỆU CÁ NHÂN
 */
function renderProfileToForm() {
    fullNameInput.value = currentProfile.fullName;
    emailInput.value = currentProfile.email;
    phoneInput.value = currentProfile.phone;
    dobInput.value = currentProfile.dob;
    bioTextarea.value = currentProfile.bio;
    hobbiesInput.value = currentProfile.hobbies;
    avatarImg.src = currentProfile.avatar;

    genderRadios.forEach(radio => {
        radio.checked = (radio.value === currentProfile.gender);
    });
}

/**
 * 4. HIỂN THỊ DANH SÁCH CLB THỰC TẾ (Lấy từ DB)
 */
function renderJoinedClubsUI(clubs) {
    if (!clubContainer) return;

    if (!clubs || clubs.length === 0) {
        clubContainer.innerHTML = '<p style="color: #64748b; font-size: 0.9rem;">Bạn chưa tham gia câu lạc bộ nào.</p>';
        return;
    }

    // Hiển thị dưới dạng Tag nhãn (không dùng checkbox vì CLB phải đăng ký mới được vào)
    clubContainer.innerHTML = clubs.map(club => `
        <div class="club-tag" style="background: #eef2ff; color: #4338ca; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; border: 1px solid #e0e7ff; display: inline-block; margin: 4px;">
            <i class="fas fa-users" style="margin-right: 6px;"></i> ${club.name}
        </div>
    `).join('');
}

/**
 * 4.1 HIỂN THỊ LỊCH SỬ ĐIỂM RÈN LUYỆN
 */
function renderPointHistoryUI(history) {
    const historyContainer = document.getElementById('pointHistoryBody');
    if (!historyContainer) return;

    if (!history || history.length === 0) {
        historyContainer.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; color: #64748b; padding: 20px;">
                    Bạn chưa có lịch sử cộng điểm nào.
                </td>
            </tr>
        `;
        return;
    }

    historyContainer.innerHTML = history.map(item => {
        const date = new Date(item.created_at).toLocaleDateString('vi-VN');
        const points = item.points >= 0 ? `+${item.points}` : item.points;
        const pointClass = item.points >= 0 ? 'point-positive' : 'point-negative';

        return `
            <tr>
                <td style="white-space: nowrap;">${date}</td>
                <td>${item.reason || 'N/A'}</td>
                <td style="text-align: center;">
                    <span class="point-badge ${pointClass}">${points}</span>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * 5. XỬ LÝ LƯU THÔNG TIN (Update Database)
 */
async function handleSaveProfile() {
    const userId = currentUser.id || currentUser.user_id;

    let genderValue = "Nam";
    genderRadios.forEach(radio => { if (radio.checked) genderValue = radio.value; });

    // Tiền xử lý dữ liệu trước khi gửi
    const fullName = fullNameInput.value.trim();
    const phone = phoneInput.value.trim();
    const dob = dobInput.value ? dobInput.value : null; // Nếu không có ngày sinh thì gửi null
    const bio = bioTextarea.value.trim();
    const hobbies = hobbiesInput.value.trim();

    // Kiểm tra cơ bản
    if (!fullName) {
        return showToast("Họ và tên không được để trống!", false);
    }

    if (dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 16 || age > 100) {
            return showToast(`Tuổi không hợp lệ (${age} tuổi). Bạn phải từ 16 đến 100 tuổi!`, false);
        }
    }

    if (phone && !/^[0-9]{10,11}$/.test(phone.replace(/[\s\-\.]/g, ''))) {
        return showToast("Số điện thoại không hợp lệ (10-11 số)!", false);
    }

    const updatedData = {
        id: userId,
        full_name: fullName,
        phone: phone,
        dob: dob,
        gender: genderValue,
        bio: bio,
        hobbies: hobbies,
        avatar: newAvatarBase64 || currentProfile.avatar
    };

    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

        const response = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast("Đã cập nhật thông tin thành công! ✅");
            
            // Cập nhật State và localStorage để đồng bộ Header
            currentProfile = { 
                ...currentProfile, 
                ...updatedData, 
                fullName: updatedData.full_name,
                dob: updatedData.dob // Cập nhật lại ngày để form không bị mất giá trị
            };
            
            currentUser.name = updatedData.full_name;
            currentUser.avatar = updatedData.avatar;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            disableEditMode();
            // Nếu có đổi ảnh, cập nhật lại ảnh trên header (nếu có hàm global)
            if(window.renderAuthSection) window.renderAuthSection(); 
        } else {
            showToast(result.message || "Lỗi khi cập nhật từ máy chủ", false);
        }
    } catch (error) {
        console.error("Lỗi API Save:", error);
        showToast("Lỗi kết nối máy chủ", false);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Lưu thay đổi';
    }
}

// Hàm lấy dữ liệu thật từ DB
async function loadJoinedClubs() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const userId = user?.id || user?.user_id;
    if (!userId) return;

    const clubContainer = document.getElementById('clubChecklist');

    try {
        const response = await fetch(`/api/user/clubs/${userId}`);
        const clubs = await response.json();

        if (clubs.length === 0) {
            clubContainer.innerHTML = '<p class="hint">Bạn chưa tham gia CLB nào.</p>';
            return;
        }

        // Đổ dữ liệu vào giao diện dưới dạng tag
        clubContainer.innerHTML = clubs.map(club => `
            <div class="club-tag" style="
                background: ${club.role === 'Owner' ? '#fef2f2' : '#eff6ff'}; 
                color: ${club.role === 'Owner' ? '#991b1b' : '#1e40af'};
                border: 1px solid ${club.role === 'Owner' ? '#fecaca' : '#bfdbfe'};
                padding: 5px 12px; border-radius: 20px; display: inline-block; margin: 4px; font-size: 0.85rem;">
                <i class="fas ${club.role === 'Owner' ? 'fa-crown' : 'fa-users'}"></i> ${club.name}
            </div>
        `).join('');
    } catch (error) {
        console.error("Lỗi:", error);
    }
}

/**
 * 6. ĐIỀU KHIỂN GIAO DIỆN (UI)
 */
function enableEditMode() {
    isEditMode = true;
    [fullNameInput, phoneInput, dobInput, bioTextarea, hobbiesInput].forEach(el => el.disabled = false);
    genderRadios.forEach(r => r.disabled = false);
    
    uploadControlDiv.style.display = 'block';
    viewAvatarHint.style.display = 'none';
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-flex';
    cancelBtn.style.display = 'inline-flex';
}

function disableEditMode() {
    isEditMode = false;
    [fullNameInput, emailInput, phoneInput, dobInput, bioTextarea, hobbiesInput].forEach(el => el.disabled = true);
    genderRadios.forEach(r => r.disabled = true);

    uploadControlDiv.style.display = 'none';
    viewAvatarHint.style.display = 'block';
    editBtn.style.display = 'inline-flex';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    
    newAvatarBase64 = null;
    renderProfileToForm();
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.size > 2 * 1024 * 1024) return showToast("Ảnh không được quá 2MB", false);
    if (!file.type.startsWith('image/')) return showToast("Vui lòng chọn file ảnh", false);

    const reader = new FileReader();
    reader.onload = (e) => {
        newAvatarBase64 = e.target.result;
        avatarImg.src = newAvatarBase64;
        showToast("Đã chọn ảnh mới", true);
    };
    reader.readAsDataURL(file);
}

function showToast(message, isSuccess = true) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.style.cssText = `position:fixed; bottom:20px; right:20px; background:${isSuccess?'#28a745':'#dc3545'}; color:white; padding:12px 24px; border-radius:8px; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-family: sans-serif;`;
    toast.innerHTML = `<i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function setupEventListeners() {
    editBtn.addEventListener('click', enableEditMode);
    saveBtn.addEventListener('click', handleSaveProfile);
    cancelBtn.addEventListener('click', disableEditMode);
    avatarInput.addEventListener('change', handleAvatarUpload);
}