
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
    // Ẩn view chọn CLB
    document.getElementById('noClubSelectedView').style.display = 'none';
    
    // Tải thông tin CLB trước khi hiện UI
    const loaded = await loadClubInfo();
    
    if (loaded) {
        document.getElementById('clubHero').style.display = 'flex';
        document.getElementById('clubDashboardContent').style.display = 'block';
        switchTab('feed'); 
        setupFormListeners();
    } else {
        // Nếu load thất bại (ID sai), quay lại trang CLB
        alert(`Không tìm thấy thông tin Câu lạc bộ (ID: ${clubId}). Vui lòng kiểm tra lại.`);
        window.location.href = "/clb";
    }
});

// Hàm load danh sách CLB của User khi chưa chọn CLB cụ thể
async function loadMyClubs() {
    const list = document.getElementById('myClubsList');
    list.innerHTML = '<div class="loading-placeholder">Đang tải danh sách CLB của bạn...</div>';

    try {
        const response = await fetch(`/api/user/clubs/${currentUser.id}`);
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
        const isLeader = currentUser && Number(currentUser.id) === Number(clubData.created_by);
        if (isLeader) {
            document.getElementById('navMembers').style.display = 'flex';
            document.getElementById('btnCreateEvent').style.display = 'flex';
            document.getElementById('navSettings').style.display = 'flex';
        } else {
            document.getElementById('navMembers').style.display = 'none';
            document.getElementById('btnCreateEvent').style.display = 'none';
            document.getElementById('navSettings').style.display = 'none';
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
    // Cập nhật trạng thái Active trên Sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === tabName) item.classList.add('active');
    });

    // Ẩn tất cả panes và hiện pane tương ứng
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Gọi hàm load dữ liệu cho từng tab
    if (tabName === 'feed') loadPosts();
    else if (tabName === 'events') loadEvents();
    else if (tabName === 'members') loadManagementData();
    else if (tabName === 'stats') loadClubStatistics();
    else if (tabName === 'settings') loadSettingsData();
}

// 2.5 Lấy thông tin hiện tại bỏ vào form Cài đặt
function loadSettingsData() {
    if (clubData) {
        document.getElementById('settingClubName').value = clubData.club_name || '';
        document.getElementById('settingClubCategory').value = clubData.category_name || '';
        document.getElementById('settingClubDesc').value = clubData.description || '';
    }
}

// 2.6 Tải dữ liệu Thống kê & Xếp hạng
async function loadClubStatistics(period = currentStatsPeriod) {
    if (!clubId) return;
    
    try {
        const response = await fetch(`/api/clubs/${clubId}/rankings?period=${period}`);
        if (!response.ok) return;
        
        const data = await response.json();
        console.log("Stats data received:", data);
        
        if (!data || !data.overview) {
            console.warn("Overview data is missing!");
            return;
        }

        // Cập nhật Overview
        document.getElementById('statTotalEvents').textContent = data.overview.totalEvents ?? 0;
        document.getElementById('statTotalPosts').textContent = data.overview.totalPosts ?? 0;
        document.getElementById('statTotalMembers').textContent = data.overview.totalMembers ?? 0;
        
        // Hiển thị số thành viên mới
        const newMembersBadge = document.getElementById('newMembersBadge');
        if (data.overview.newMembers > 0 && currentStatsPeriod !== 'all') {
            const periodText = currentStatsPeriod === 'month' ? 'tháng' : 'năm';
            newMembersBadge.textContent = `+${data.overview.newMembers} mới trong ${periodText}`;
            newMembersBadge.style.display = 'block';
        } else {
            newMembersBadge.style.display = 'none';
        }
        
        // Render Bảng xếp hạng Sự kiện
        renderRankingList('eventRankingsList', data.eventRankings || [], 'sự kiện');
        
        // Render Bảng xếp hạng Bài đăng
        renderRankingList('postRankingsList', data.postRankings || [], 'bài viết');
        
    } catch (err) {
        console.error("Lỗi load stats:", err);
    }
}

function changeStatsPeriod(period) {
    currentStatsPeriod = period;
    
    // UI update for all buttons
    ['btnMonth', 'btnYear', 'btnAll'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('active');
            btn.style.background = 'none';
            btn.style.color = '#64748b';
        }
    });
    
    let activeBtnId = 'btnMonth';
    if (period === 'year') activeBtnId = 'btnYear';
    else if (period === 'all') activeBtnId = 'btnAll';

    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'white';
        activeBtn.style.color = '#2563eb';
    }
    
    loadClubStatistics(period);
}

function renderRankingList(containerId, list, unit) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!list || list.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px; font-size:14px;">Chưa có dữ liệu xếp hạng.</div>`;
        return;
    }
    
    container.innerHTML = list.map((item, index) => {
        const medalColor = index === 0 ? '#fbbf24' : (index === 1 ? '#94a3b8' : (index === 2 ? '#b45309' : '#e2e8f0'));
        const medalIcon = index < 3 ? `<i class="fas fa-crown" style="color: ${medalColor}; font-size: 14px;"></i>` : `<span style="color: #64748b; font-weight:700;">${index + 1}</span>`;
        
        const avatar = item.avatar ? `<img src="${item.avatar}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">` : 
                                     `<div style="width: 36px; height: 36px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #475569; font-size: 13px;">${item.full_name.charAt(0)}</div>`;

        return `
            <div style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 12px 16px; border-radius: 12px; border: 1px solid #f1f5f9; transition: 0.2s;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 24px; display: flex; justify-content: center;">${medalIcon}</div>
                    ${avatar}
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 14px; font-weight: 600; color: #1e293b;">${item.full_name}</span>
                        <span style="font-size: 12px; color: #64748b;">Thành viên động</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 15px; font-weight: 800; color: #2563eb;">${item.count}</div>
                    <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${unit}</div>
                </div>
            </div>
        `;
    }).join('');
}

let currentSearchQuery = "";

function handleSearch(event) {
    currentSearchQuery = event.target.value.trim();
    if (event.key === 'Enter') {
        loadPosts();
    }
}

// 3. Xử lý Tab BẢN TIN (Posts)
async function loadPosts() {
    const list = document.getElementById('postsList');
    list.innerHTML = '<div class="loading-placeholder">Đang tải bài viết...</div>';
    
    try {
        let url = `/api/posts?club_id=${clubId}`;
        if (currentSearchQuery) {
            url += `&search=${encodeURIComponent(currentSearchQuery)}`;
        }
        if (currentUser) {
            url += `&user_id=${currentUser.id || currentUser.user_id}`;
        }
        
        const response = await fetch(url);
        const posts = await response.json();
        window.currentPostsData = posts; // Cache for edit
        
        if (posts.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding: 40px; color: #64748b;">Chưa có bài viết nào trong CLB này, hoặc không có kết quả phù hợp.</p>';
            return;
        }

        list.innerHTML = posts.map(post => {
            const isLiked = post.user_liked === 1;
            const heartClass = isLiked ? 'fas fa-heart' : 'far fa-heart';
            const heartColor = isLiked ? 'color: #ef4444;' : '';
            
            const isLeader = currentUser && clubData && Number(currentUser.id) === Number(clubData.created_by);
            const isAuthor = currentUser && post.author_name === currentUser.full_name;
            const canManage = isLeader || isAuthor;

            const manageHtml = canManage ? `
                <div style="position: absolute; top: 15px; right: 15px; z-index: 20;">
                    <button onclick="togglePostDropdown(event, 'post-${post.id}')" style="background:none; border:none; cursor:pointer; color:#94a3b8; font-size: 18px; padding: 5px; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; transition: 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div id="dropdown-post-${post.id}" class="action-dropdown" style="display: none; position: absolute; right: 0; top: 35px; background: white; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden; min-width: 140px; border: 1px solid #e2e8f0;">
                        <button onclick="openEditPost(${post.id})" style="display: block; width: 100%; text-align: left; padding: 12px 16px; background: none; border: none; cursor: pointer; color: #475569; font-size: 13px; transition: 0.2s; font-weight: 500;" onmouseover="this.style.background='#f8fafc'"><i class="fas fa-edit" style="width: 20px; color: #94a3b8;"></i> Sửa bài</button>
                        <button onclick="deletePost(${post.id})" style="display: block; width: 100%; text-align: left; padding: 12px 16px; background: none; border: none; cursor: pointer; color: #ef4444; font-size: 13px; transition: 0.2s; font-weight: 500;" onmouseover="this.style.background='#fee2e2'"><i class="fas fa-trash" style="width: 20px; color: #ef4444;"></i> Xóa bài</button>
                    </div>
                </div>
            ` : "";

            return `
            <div class="post-card" style="position: relative;">
                ${manageHtml}
                <div class="post-user">
                    <div class="user-avatar" style="background: #c53030; color: white;">
                        ${post.author_avatar ? `<img src="${post.author_avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (post.author_name || 'U').charAt(0)}
                    </div>
                    <div class="post-user-info">
                        <h4>${post.author_name || 'Thành viên'}</h4>
                        <span><i class="fas fa-clock"></i> ${new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <span class="post-badge" style="margin-left: auto; background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 11px;">
                        ${post.type}
                    </span>
                </div>
                <h3 class="post-title">${post.title}</h3>
                <div class="post-content-body">${post.content}</div>
                ${post.image ? `<img src="${post.image}" class="post-img" onerror="this.style.display='none'">` : ''}
                <div class="post-stats" style="display: flex; gap: 20px; color: #64748b; font-size: 13px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                    <span style="cursor:pointer; display: flex; align-items: center; gap: 5px; transition: 0.2s;" onclick="likePost(${post.id})">
                        <i class="${heartClass}" id="heart-icon-${post.id}" style="${heartColor}"></i> 
                        <span id="like-count-${post.id}">${post.likes}</span> Yêu thích
                    </span>
                    <span style="cursor:pointer; color: #6366f1;" onclick="toggleComments(${post.id})"><i class="far fa-comment"></i> <span id="comment-count-${post.id}">${post.comments}</span> Bình luận</span>
                    <span><i class="far fa-eye"></i> ${post.views} Lượt xem</span>
                </div>
                
                <!-- Comment Section (Hidden by default) -->
                <div id="comments-section-${post.id}" style="display: none; margin-top: 15px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                    <div id="comments-list-${post.id}" style="max-height: 250px; overflow-y: auto; margin-bottom: 15px; padding-right: 5px;">
                        <div style="font-size:12px; color:#94a3b8; text-align:center;">Đang tải bình luận...</div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="text" id="comment-input-${post.id}" placeholder="Viết bình luận..." style="flex: 1; padding: 10px 15px; border: 1px solid #e2e8f0; border-radius: 20px; font-size: 13px; outline: none;" onkeyup="if(event.key === 'Enter') submitComment(${post.id})">
                        <button class="btn-primary" style="padding: 10px 18px; border-radius: 20px; font-size: 13px;" onclick="submitComment(${post.id})">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    } catch (err) {
        list.innerHTML = 'Lỗi tải bài viết.';
    }
}

// 3.5 Comments Logic
function toggleComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    if (section.style.display === 'none') {
        section.style.display = 'block';
        loadComments(postId);
    } else {
        section.style.display = 'none';
    }
}

async function loadComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    try {
        const response = await fetch(`/api/posts/${postId}/comments`);
        const comments = await response.json();
        
        if (comments.length === 0) {
            list.innerHTML = '<div style="font-size:13px; color:#94a3b8; text-align:center; padding: 10px;">Chưa có bình luận nào. Hãy là người đầu tiên!</div>';
            return;
        }

        list.innerHTML = comments.map(c => `
            <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                <div class="user-avatar" style="width: 30px; height: 30px; flex-shrink: 0; background: #cbd5e1; color: white; display: flex; justify-content: center; align-items: center; border-radius: 50%; font-size: 12px; font-weight: 600;">
                    ${c.author_avatar ? `<img src="${c.author_avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (c.author_name || 'U').charAt(0)}
                </div>
                <div style="background: #f8fafc; padding: 10px 14px; border-radius: 16px; border-top-left-radius: 4px; flex: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-weight: 600; font-size: 13px; color: #1e293b;">${c.author_name}</span>
                        <span style="font-size: 11px; color: #94a3b8;">${new Date(c.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div style="font-size: 14px; color: #334155; line-height: 1.4;">${c.content}</div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = '<div style="font-size:13px; color:#c53030; text-align:center;">Lỗi tải bình luận.</div>';
    }
}

async function submitComment(postId) {
    if (!currentUser) {
        alert("Vui lòng đăng nhập để bình luận.");
        return;
    }
    
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    if (!content) return;
    
    try {
        const response = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id || currentUser.user_id,
                content: content
            })
        });
        
        if (response.ok) {
            input.value = '';
            loadComments(postId); // Refresh comments list
            
            // Optimsic update for comment count
            const countSpan = document.getElementById(`comment-count-${postId}`);
            if(countSpan) countSpan.textContent = parseInt(countSpan.textContent) + 1;
            
        } else {
            alert('Lỗi đăng bình luận');
        }
    } catch (err) {
        console.error("Lỗi bình luận:", err);
    }
}

async function likePost(postId) {
    if (!currentUser) {
        alert("Vui lòng đăng nhập để thích bài viết.");
        return;
    }
    try {
        const response = await fetch(`/api/posts/like/${postId}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id || currentUser.user_id })
        });
        const result = await response.json();
        
        if (result.success) {
            const heartIcon = document.getElementById(`heart-icon-${postId}`);
            const countSpan = document.getElementById(`like-count-${postId}`);
            let currentLikes = parseInt(countSpan.textContent);
            
            if (result.liked) {
                heartIcon.classList.remove('far');
                heartIcon.classList.add('fas');
                heartIcon.style.color = '#ef4444'; // Red filled heart
                countSpan.textContent = currentLikes + 1;
            } else {
                heartIcon.classList.remove('fas');
                heartIcon.classList.add('far');
                heartIcon.style.color = ''; // Empty heart
                countSpan.textContent = Math.max(0, currentLikes - 1);
            }
        } else {
            alert(result.message || 'Lỗi khi thích bài viết');
        }
    } catch (e) {
        console.error(e);
    }
}

// 4. Xử lý Tab SỰ KIỆN (Events)
async function loadEvents() {
    const list = document.getElementById('eventsList');
    list.innerHTML = '<div class="loading-placeholder">Đang tải sự kiện...</div>';

    try {
        let fetchUrl = `/api/events?club_id=${clubId}`;
        if (currentUser) {
            fetchUrl += `&user_id=${currentUser.id}`;
        }
        const response = await fetch(fetchUrl);
        const events = await response.json();
        window.currentEventsData = events; // Cache for edit

        if (events.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding: 40px; color: #64748b;">Chưa có sự kiện nào được tạo.</p>';
            return;
        }

        const isLeader = currentUser && clubData && Number(currentUser.id) === Number(clubData.created_by);

        list.innerHTML = events.map(ev => {
            const mgmtHtml = isLeader ? `
                <div style="position: absolute; top: 15px; right: 15px; z-index: 20;">
                    <button onclick="togglePostDropdown(event, 'event-${ev.id}')" style="background:none; border:none; cursor:pointer; color:#94a3b8; font-size: 18px; padding: 5px; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; transition: 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div id="dropdown-event-${ev.id}" class="action-dropdown" style="display: none; position: absolute; right: 0; top: 35px; background: white; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden; min-width: 140px; border: 1px solid #e2e8f0;">
                        <button onclick="event.stopPropagation(); openEditEvent(${ev.id})" style="display: block; width: 100%; text-align: left; padding: 12px 16px; background: none; border: none; cursor: pointer; color: #475569; font-size: 13px; transition: 0.2s; font-weight: 500;" onmouseover="this.style.background='#f8fafc'"><i class="fas fa-edit" style="width: 20px; color: #94a3b8;"></i> Sửa sự kiện</button>
                        <button onclick="event.stopPropagation(); deleteEvent(${ev.id})" style="display: block; width: 100%; text-align: left; padding: 12px 16px; background: none; border: none; cursor: pointer; color: #ef4444; font-size: 13px; transition: 0.2s; font-weight: 500;" onmouseover="this.style.background='#fee2e2'"><i class="fas fa-trash" style="width: 20px; color: #ef4444;"></i> Xóa sự kiện</button>
                    </div>
                </div>
            ` : "";

            return `
            <div class="post-card event-card" style="position: relative; overflow: hidden; padding: 0; display: flex; flex-direction: row; min-height: 220px;">
                <div style="flex: 1; padding: 25px; position: relative;" ${isLeader ? `onclick="openEventRegistrations(${ev.id})" style="cursor:pointer;" title="Nhấn để xem danh sách đăng ký"` : ''}>
                    ${mgmtHtml}
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div class="event-date-box" style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 12px; text-align: center; min-width: 70px;">
                            <span style="display: block; font-size: 12px; color: #c53030; font-weight: 700; text-transform: uppercase;">Tháng ${new Date(ev.start_time).getMonth() + 1}</span>
                            <span style="display: block; font-size: 24px; font-weight: 800; color: #1a2639;">${new Date(ev.start_time).getDate()}</span>
                        </div>
                        ${!isLeader ? 
                            (ev.is_registered 
                                ? `<button onclick="cancelEventRegistration(${ev.id}, event)" class="btn-registered">
                                        <i class="fas fa-check-circle icon-default"></i><i class="fas fa-times icon-hover"></i>
                                        <span class="text-default">Đã đăng ký</span><span class="text-hover">Hủy tham gia</span>
                                   </button>` 
                                : `<button class="btn-action btn-approve" onclick="registerForEvent(${ev.id}, event)">Đăng ký tham gia</button>`) 
                            : `<span style="font-size: 12px; color: #c53030; font-weight: bold; background: #fef2f2; padding: 5px 10px; border-radius: 8px; margin-right: 25px;"><i class="fas fa-users"></i> DS Đăng ký</span>`}
                    </div>
                    <h3 class="post-title" style="padding-right: 30px;">${ev.event_name}</h3>
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 10px;">
                        <i class="fas fa-map-marker-alt"></i> ${ev.location}
                    </p>
                    <div class="post-content-body" style="padding-right: 15px;">${ev.description}</div>
                    <div style="font-size: 13px; color: #64748b; margin-top: 15px;">
                        <i class="far fa-clock"></i> ${new Date(ev.start_time).toLocaleTimeString('vi-VN')} - ${new Date(ev.end_time).toLocaleTimeString('vi-VN')}
                    </div>
                </div>
                ${ev.image ? `
                <div style="width: 250px; flex-shrink: 0; background-image: url('${ev.image}'); background-size: cover; background-position: center; position: relative;">
                    <!-- Hiệu ứng chuyển vân mờ -->
                    <div style="position: absolute; top:0; left:0; width: 50px; height: 100%; background: linear-gradient(to right, white, transparent);"></div>
                </div>
                ` : ''}
            </div>
            `;
        }).join('');
    } catch (err) {
        list.innerHTML = 'Lỗi tải sự kiện.';
    }
}

// 5. Xử lý Tab THÀNH VIÊN & DUYỆT (Management)
async function loadManagementData() {
    // Chỉ Leader mới load dữ liệu này
    await loadJoinRequests();
    await loadMembers();
}

async function loadJoinRequests() {
    const tbody = document.getElementById('requestsTableBody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Đang tải...</td></tr>';

    try {
        const response = await fetch(`/api/clubs/${clubId}/requests`);
        const requests = await response.json();

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #94a3b8;">Không có yêu cầu nào chờ duyệt.</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(req => `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="last-post-avatar">${req.name.charAt(0)}</div>
                        <div>
                            <div style="font-weight: 600;">${req.name}</div>
                            <div style="font-size: 12px; color: #64748b;">${req.email}</div>
                        </div>
                    </div>
                </td>
                <td>${new Date(req.requested_at).toLocaleDateString('vi-VN')}</td>
                <td>
                    <button class="btn-action btn-approve" onclick="handleRequest(${req.request_id}, 'approve')">Duyệt</button>
                    <button class="btn-action btn-reject" onclick="handleRequest(${req.request_id}, 'reject')">Từ chối</button>
                </td>
            </tr>
        `).join('');
    } catch (err) { tbody.innerHTML = 'Lỗi tải yêu cầu.'; }
}

async function loadMembers() {
    const tbody = document.getElementById('membersTableBody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Đang tải...</td></tr>';

    try {
        const response = await fetch(`/api/clubs/${clubId}/members`);
        const members = await response.json();

        tbody.innerHTML = members.map(m => `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="last-post-avatar" style="background:#f1f5f9; color:#475569;">${m.name.charAt(0)}</div>
                        <div>
                            <div style="font-weight: 600;">${m.name}</div>
                            <div style="font-size: 12px; color: #64748b;">${m.email}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge" style="background: #e2e8f0; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">
                        ${m.role || 'Thành viên'}
                    </span>
                </td>
                <td>
                    <select class="role-select" onchange="promoteMember(${m.member_record_id}, this.value)">
                        <option value="">-- Cấp quyền --</option>
                        <option value="Phó CLB">Phó CLB</option>
                        <option value="Ban quản lý">Ban quản lý</option>
                        <option value="Thành viên">Thành viên (Gỡ quyền)</option>
                    </select>
                </td>
            </tr>
        `).join('');
    } catch (err) { tbody.innerHTML = 'Lỗi tải thành viên.'; }
}

// 6. Xử lý Tab THỐNG KÊ (Legacy removal)
// Đã được thay thế bằng loadClubStatistics ở phía trên

// --- HÀNH ĐỘNG ---

async function handleRequest(requestId, action) {
    try {
        const response = await fetch('/api/clubs/requests/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_id: requestId, action })
        });
        const result = await response.json();
        alert(result.message);
        loadManagementData();
    } catch (err) { alert("Lỗi xử lý yêu cầu."); }
}

async function promoteMember(memberRecordId, newRole) {
    if (!newRole) return;
    try {
        const response = await fetch('/api/clubs/members/promote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_record_id: memberRecordId, new_role: newRole })
        });
        const result = await response.json();
        alert(result.message);
        loadMembers();
    } catch (err) { alert("Lỗi phân quyền."); }
}

async function registerForEvent(eventId, eventObj) {
    if (eventObj) eventObj.stopPropagation();
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    try {
        const response = await fetch('/api/events/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: eventId, user_id: currentUser.id })
        });
        const result = await response.json();
        alert(result.message);
        if(response.ok) {
            loadEvents();
        }
    } catch (err) { alert("Lỗi đăng ký sự kiện."); }
}

async function cancelEventRegistration(eventId, eventObj) {
    if (eventObj) eventObj.stopPropagation();
    if (!confirm("Bạn có chắc muốn hủy tham gia sự kiện này?")) return;

    try {
        const response = await fetch('/api/events/register', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: eventId, user_id: currentUser.id })
        });
        const result = await response.json();
        alert(result.message);
        if (response.ok) {
            loadEvents();
        }
    } catch (err) { alert("Lỗi hủy đăng ký sự kiện."); }
}

// --- FORM HANDLERS ---
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// --- EDIT / DELETE CONTENT ---
function togglePostDropdown(event, typeId) {
    event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${typeId}`);
    const isVisible = dropdown.style.display === 'block';
    
    // Hide all first
    document.querySelectorAll('.action-dropdown').forEach(d => d.style.display = 'none');
    
    if (!isVisible) dropdown.style.display = 'block';
}

// Click outside to close dropdowns
document.addEventListener('click', () => {
    document.querySelectorAll('.action-dropdown').forEach(d => d.style.display = 'none');
});

function openEditPost(id) {
    if (!window.currentPostsData) return;
    const post = window.currentPostsData.find(p => p.id === id);
    if (!post) return;
    document.getElementById('editPostId').value = post.id;
    document.getElementById('editPostTitle').value = post.title;
    document.getElementById('editPostType').value = post.type;
    document.getElementById('editPostContent').value = post.content;
    openModal('editPostModal');
}

async function deletePost(id) {
    if(!confirm("Bạn có chắc chắn muốn xóa bài viết này cùng tất cả bình luận/lượt thích của nó không?")) return;
    try {
        const response = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
        if(response.ok) {
            alert("Xóa thành công.");
            loadPosts();
        } else {
            alert("Lỗi khi xóa bài viết.");
        }
    } catch(err) { console.error(err); }
}

function openEditEvent(id) {
    if (!window.currentEventsData) return;
    const ev = window.currentEventsData.find(e => e.id === id);
    if (!ev) return;
    document.getElementById('editEventId').value = ev.id;
    document.getElementById('editEventName').value = ev.event_name;
    document.getElementById('editEventDesc').value = ev.description;
    document.getElementById('editEventLoc').value = ev.location;
    // Format cho type datetime-local (bỏ đuôi Z và giây)
    const st = new Date(ev.start_time);
    st.setMinutes(st.getMinutes() - st.getTimezoneOffset());
    document.getElementById('editEventStart').value = st.toISOString().slice(0,16);

    const et = new Date(ev.end_time);
    et.setMinutes(et.getMinutes() - et.getTimezoneOffset());
    document.getElementById('editEventEnd').value = et.toISOString().slice(0,16);
    
    openModal('editEventModal');
}

async function deleteEvent(id) {
    if(!confirm("Xóa sự kiện này sẽ tự động xóa tất cả đăng ký tham gia. Tiếp tục?")) return;
    try {
        const response = await fetch(`/api/events/${id}`, { method: 'DELETE' });
        if(response.ok) {
            alert("Xóa thành công.");
            loadEvents();
        } else {
            alert("Lỗi khi xóa sự kiện.");
        }
    } catch(err) { console.error(err); }
}

async function openEventRegistrations(id) {
    const container = document.getElementById('registrationsContainer');
    const headerCount = document.getElementById('registrationsCount');
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: #94a3b8;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 15px; font-size: 14px;">Đang tải danh sách...</p></div>';
    headerCount.innerText = "Đang kiểm tra...";
    openModal('eventRegistrationsModal');

    try {
        const response = await fetch(`/api/events/${id}/registrations`);
        const users = await response.json();
        
        if(users.length === 0) {
            headerCount.innerText = "Chưa có lượt đăng ký nào";
            container.innerHTML = `
                <div style="text-align:center; padding: 50px 20px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
                    <div style="width: 60px; height: 60px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto;">
                        <i class="fas fa-user-xmark" style="font-size: 24px; color: #94a3b8;"></i>
                    </div>
                    <h3 style="color: #475569; font-size: 16px; margin: 0 0 5px 0;">Danh sách trống</h3>
                    <p style="color: #64748b; font-size: 13px; margin: 0;">Sự kiện này hiện chưa có thành viên nào ghi danh tham gia.</p>
                </div>`;
            return;
        }

        headerCount.innerText = `Tổng cộng: ${users.length} học sinh đã tham gia`;
        
        container.innerHTML = '<div style="display: flex; flex-direction: column; gap: 12px;">' + users.map(u => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; transition: 0.2s;" onmouseover="this.style.boxShadow='0 4px 15px rgba(0,0,0,0.05)'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.boxShadow='none'; this.style.borderColor='#e2e8f0';">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); color: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; border: 2px solid white; box-shadow: 0 2px 8px rgba(37,99,235,0.15);">
                        ${u.full_name.charAt(0)}
                    </div>
                    <div>
                        <div style="font-weight: 700; color: #1e293b; font-size: 15px;">${u.full_name}</div>
                        <div style="font-size: 13px; color: #64748b; margin-top: 4px;"><i class="fas fa-envelope" style="color: #cbd5e1; width: 14px;"></i> ${u.email}</div>
                    </div>
                </div>
                <div style="text-align: right; background: #f8fafc; padding: 10px 15px; border-radius: 8px;">
                    <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fas fa-clock"></i> Cập nhật lúc</div>
                    <div style="font-size: 14px; font-weight: 700; color: #334155; margin-top: 4px;">${new Date(u.registered_at).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit', year: 'numeric'})}</div>
                </div>
            </div>
        `).join('') + '</div>';
    } catch(err) {
        headerCount.innerText = "Lỗi kết nối";
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: #ef4444;"><i class="fas fa-exclamation-circle fa-2x"></i><p style="margin-top: 15px;">Lỗi tải dữ liệu. Vui lòng thử lại sau.</p></div>';
    }
}

function setupFormListeners() {
    // Form Đăng bài
    document.getElementById('postForm').onsubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) return alert("Vui lòng đăng nhập!");
        
        const imageFile = document.getElementById('postImage').files[0];
        const imageBase64 = imageFile ? await toBase64(imageFile) : '';

        const data = {
            title: document.getElementById('postTitle').value,
            content: document.getElementById('postContent').value,
            type: document.getElementById('postType').value,
            image: imageBase64,
            club_id: Number(clubId),
            user_id: Number(currentUser.id)
        };

        try {
            const resp = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const res = await resp.json();
            if (resp.ok) {
                alert("Đăng bài thành công!");
                closeModal('createPostModal');
                loadPosts();
                loadClubStatistics(); // Làm mới thống kê
                e.target.reset(); // Xóa sạch form
            } else {
                alert("Lỗi: " + res.message);
            }
        } catch (err) { alert("Lỗi đăng bài."); }
    };
    
    // Form Edit Bài
    document.getElementById('editPostForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('editPostId').value;
        const post = window.currentPostsData.find(p => p.id == id);
        if(!post) return;
        
        const imageFile = document.getElementById('editPostImage').files[0];
        const imageBase64 = imageFile ? await toBase64(imageFile) : post.image; // Keep old if not changed
        
        const data = {
            title: document.getElementById('editPostTitle').value,
            content: document.getElementById('editPostContent').value,
            type: document.getElementById('editPostType').value,
            image: imageBase64
        };
        
        try {
            const resp = await fetch(`/api/posts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                alert("Cập nhật bài viết thành công!");
                closeModal('editPostModal');
                loadPosts();
                e.target.reset();
            } else alert("Lỗi cập nhật.");
        } catch (err) { alert("Lỗi cập nhật bài viết."); }
    };

    // Form Tạo sự kiện
    document.getElementById('eventForm').onsubmit = async (e) => {
        e.preventDefault();
        
        const imageFile = document.getElementById('eventImage').files[0];
        const imageBase64 = imageFile ? await toBase64(imageFile) : '';

        const data = {
            event_name: document.getElementById('eventName').value,
            description: document.getElementById('eventDesc').value,
            location: document.getElementById('eventLoc').value,
            start_time: document.getElementById('eventStart').value,
            end_time: document.getElementById('eventEnd').value,
            club_id: Number(clubId),
            created_by: Number(currentUser.id),
            image: imageBase64
        };

        try {
            const resp = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const res = await resp.json();
            alert(res.message);
            closeModal('createEventModal');
            loadEvents();
            loadClubStatistics(); // Làm mới thống kê
            e.target.reset();
        } catch (err) { alert("Lỗi tạo sự kiện."); }
    };
    
    // Form Edit sự kiện
    document.getElementById('editEventForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('editEventId').value;
        const ev = window.currentEventsData.find(evt => evt.id == id);
        if(!ev) return;
        
        const imageFile = document.getElementById('editEventImage').files[0];
        const imageBase64 = imageFile ? await toBase64(imageFile) : ev.image;

        const data = {
            event_name: document.getElementById('editEventName').value,
            description: document.getElementById('editEventDesc').value,
            location: document.getElementById('editEventLoc').value,
            start_time: document.getElementById('editEventStart').value,
            end_time: document.getElementById('editEventEnd').value,
            image: imageBase64
        };

        try {
            const resp = await fetch(`/api/events/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                alert("Cập nhật sự kiện thành công!");
                closeModal('editEventModal');
                loadEvents();
                e.target.reset();
            } else alert("Lỗi cập nhật.");
        } catch (err) { alert("Lỗi cập nhật sự kiện."); }
    };
}

// ==========================================
// 8. CẬP NHẬT THÔNG TIN CLB (SETTINGS TAB)
// ==========================================
async function saveClubSettings(e) {
    e.preventDefault();
    if (!currentUser) return alert("Vui lòng đăng nhập!");

    const name = document.getElementById('settingClubName').value;
    const category = document.getElementById('settingClubCategory').value;
    const desc = document.getElementById('settingClubDesc').value;
    const logoFile = document.getElementById('settingClubLogo').files[0];
    const coverFile = document.getElementById('settingClubCover').files[0];

    // Ngăn chặn việc bấm liên tục
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
    submitBtn.disabled = true;

    try {
        const payload = {
            club_name: name,
            category_name: category,
            description: desc,
            logo_url: clubData.logo_url || '',
            cover_url: clubData.cover_url || ''
        };

        if (logoFile) payload.logo_url = await toBase64(logoFile);
        if (coverFile) payload.cover_url = await toBase64(coverFile);

        const response = await fetch(`/api/clubs/${clubId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (response.ok) {
            alert(result.message);
            location.reload(); // Load lại trang để cập nhật Header của CLB
        } else {
            alert(result.message);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch(err) {
        alert("Lỗi cập nhật Cài đặt CLB.");
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}


// --- MODAL UTILS ---
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
window.onclick = (event) => {
    if (event.target.classList.contains('modal')) event.target.style.display = 'none';
};
