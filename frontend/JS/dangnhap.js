/* =========================
   CHUYỂN ĐỔI TAB ĐĂNG NHẬP / ĐĂNG KÝ
========================= */
function switchTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.remove('form-hidden');
        registerForm.classList.add('form-hidden');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.remove('form-hidden');
        loginForm.classList.add('form-hidden');
    }
}

/* =========================
   XỬ LÝ ĐĂNG NHẬP (GỌI API)
========================= */
async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email || !password) {
        showToast('Vui lòng nhập email và mật khẩu!', 'warning');
        return;
    }

    try {
        // Gọi API Đăng nhập
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Gửi dữ liệu dưới dạng JSON (trùng với tên biến body bên Backend)
            body: JSON.stringify({ email: email, password: password }) 
        });

        // Parse kết quả trả về từ Backend
        const data = await response.json();

        if (response.ok) {
            showToast(data.message || 'Đăng nhập thành công!', 'success');
            
            // LƯU Ý MỚI: Cập nhật lưu thêm Token vào localStorage
            const userInfo = {
                isLoggedIn: true,
                token: data.token, // Lưu token để dùng cho các API bảo mật sau này
                id: data.user_id,
                code: data.user_code,
                name: data.name,
                avatar: data.avatar,
                role: data.role
            };
            localStorage.setItem('currentUser', JSON.stringify(userInfo));

            // Chuyển hướng về trang chủ sau 1.5s để thấy toast
            setTimeout(() => {
                if (data.role === 'admin') {
                    window.location.href = '/admin';
                } else {
                    window.location.href = '/'; // Sinh viên bình thường về trang chủ
                } 
            }, 1500);

        } else {
            // Xử lý lỗi (sai pass, không tìm thấy email...)
            showToast(`Lỗi: ${data.message}`, 'warning');
        }
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        showToast('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng hoặc server!', 'warning');
    }
}

/* =========================
   XỬ LÝ ĐĂNG KÝ (GỌI API)
========================= */
async function handleRegister() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const dob = document.getElementById('regDob').value;
    const gender = document.querySelector('input[name="regGender"]:checked').value;
    const password = document.getElementById('regPassword').value.trim();
    const confirm = document.getElementById('regConfirm').value.trim();
    const agree = document.getElementById('agreeTerms').checked;

    // Validate dữ liệu cơ bản ở Frontend
    if (!name || !email || !dob || !password || !confirm) {
        showToast('Vui lòng điền đầy đủ thông tin!', 'warning');
        return;
    }

    if (name.length < 2) {
        showToast('Họ và tên quá ngắn!', 'warning');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Email không đúng định dạng!', 'warning');
        return;
    }

    // Kiểm tra tuổi (16 - 100)
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (age < 16 || age > 100) {
        showToast(`Tuổi không hợp lệ (${age} tuổi). Bạn phải từ 16 đến 100 tuổi!`, 'warning');
        return;
    }

    if (password !== confirm) {
        showToast('Mật khẩu xác nhận không khớp!', 'warning');
        return;
    }

    if (password.length < 6) {
        showToast('Mật khẩu phải có ít nhất 6 ký tự!', 'warning');
        return;
    }

    if (!agree) {
        showToast('Bạn cần đồng ý với điều khoản dịch vụ!', 'warning');
        return;
    }

    try {
        // Gọi API Đăng ký
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Gửi lên name, email, password như backend đang mong đợi
            // (Hiện API backend của bạn không lưu 'username', nên mình không gửi lên để tránh dư thừa data)
            body: JSON.stringify({ 
                name: name, 
                email: email, 
                password: password,
                dob: dob,
                gender: gender 
            })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.', 'success');
            
            setTimeout(() => {
                // Tự động chuyển qua tab Login và điền sẵn email vừa đăng ký
                switchTab('login');
                document.getElementById('loginEmail').value = email;
                document.getElementById('loginPassword').value = ''; 
            }, 1500);
        } else {
            // Lỗi email đã tồn tại, thiếu thông tin...
            showToast(`Lỗi: ${data.message}`, 'warning');
        }
    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        showToast('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng hoặc server!', 'warning');
    }
}

// Mặc định chạy khi load trang
window.onload = function() {
    // Nếu user đã đăng nhập, có thể bạn muốn đá họ về trang chủ luôn?
    // if(localStorage.getItem('currentUser')) window.location.href = '/';
};

// Hàm hiển thị Toast Notification tùy chỉnh (Thay thế cho alert mặc định)
function showToast(message, type = 'warning') {
    let toastContainer = document.getElementById('thong-bao-toast');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'thong-bao-toast';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    
    let iconClass = 'fa-exclamation-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'info') iconClass = 'fa-info-circle';
    
    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${iconClass}"></i></div>
        <div class="toast-content">
            <div class="toast-title">Thông báo</div>
            <div class="toast-msg">${message}</div>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('active'), 10);
    
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 400); 
    }, 3000);
}