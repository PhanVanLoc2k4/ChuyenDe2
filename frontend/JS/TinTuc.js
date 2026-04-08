let currentUser = null;
let allFeedItems = [];

document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
        currentUser = JSON.parse(userStr);
        updateSidebarProfile();
    }

    loadClubsForEventForm(); // Load options cho form tạo sự kiện
    await loadFeed();
});

async function updateSidebarProfile() {
    if (!currentUser) return;
    
    // Sidebar elements
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const sidebarName = document.getElementById('sidebarName');
    const sidebarRole = document.getElementById('sidebarRole');
    const sidebarPostCount = document.getElementById('sidebarPostCount');
    const sidebarClubCount = document.getElementById('sidebarClubCount');

    // Create post section elements
    const createPostAvatar = document.getElementById('createPostAvatar');
    const modalPostAvatar = document.getElementById('modalPostAvatar');
    const modalPostName = document.getElementById('modalPostName');
    
    // Populate Sidebar
    if (sidebarName) sidebarName.textContent = currentUser.name || "Thành viên";
    if (sidebarRole) sidebarRole.textContent = currentUser.role === 'admin' ? "Quản trị viên" : "Thành viên CLB";
    
    const userInitials = (currentUser.name || "U").charAt(0).toUpperCase();
    const avatarHtml = currentUser.avatar ? 
        `<img src="${currentUser.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : 
        userInitials;

    if (sidebarAvatar) {
        sidebarAvatar.innerHTML = avatarHtml;
    }

    // Populate Create Post Section & Modal
    if (createPostAvatar) createPostAvatar.innerHTML = avatarHtml;
    if (modalPostAvatar) modalPostAvatar.innerHTML = avatarHtml;
    if (modalPostName) modalPostName.textContent = currentUser.name || "Người dùng";

    // Fetch real stats
    const uid = currentUser.user_id || currentUser.id;
    if (!uid) return;

    try {
        const res = await fetch(`/api/user/stats/${uid}`);
        if (res.ok) {
            const stats = await res.json();
            if (sidebarPostCount) sidebarPostCount.textContent = stats.postCount;
            if (sidebarClubCount) sidebarClubCount.textContent = stats.clubCount;
        }
    } catch (err) {
        console.error("Lỗi fetch user stats:", err);
    }
}

// Load Feed (Posts + Events)
async function loadFeed() {
    const feedContainer = document.getElementById('newsFeed');
    feedContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: #64748b;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Đang tải dòng thời gian...</p></div>';

    try {
        const postsRes = await fetch('/api/posts');
        const posts = postsRes.ok ? await postsRes.json() : [];

        const eventsRes = await fetch('/api/events');
        const events = eventsRes.ok ? await eventsRes.json() : [];

        // Gắn cờ loại
        posts.forEach(p => { p.feedType = 'post'; p.sortDate = new Date(p.created_at).getTime(); });
        events.forEach(e => { e.feedType = 'event'; e.sortDate = e.created_at ? new Date(e.created_at).getTime() : new Date(e.start_time).getTime() - 86400000; }); // nếu ko có created_at thì mượn start_time lùi 1 ngày

        // Trộn và sort mới nhất
        allFeedItems = [...posts, ...events].sort((a, b) => b.sortDate - a.sortDate);

        renderFeedItems('all');
    } catch (err) {
        console.error(err);
        feedContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: #c53030;">Lỗi tải dữ liệu. Vui lòng thử lại.</div>';
    }
}

function renderFeedItems(filterType = 'all') {
    const feedContainer = document.getElementById('newsFeed');
    
    let filtered = allFeedItems;
    if (filterType === 'events') {
        filtered = allFeedItems.filter(i => i.feedType === 'event');
    } else if (filterType === 'community') {
        // Lọc những bài đăng cộng đồng (không thuộc CLB)
        filtered = allFeedItems.filter(i => i.feedType === 'post' && (!i.club_id || i.type === 'Cộng đồng'));
    } else if (filterType === 'clubs') {
        // Lọc những mục thuộc CLB cụ thể
        filtered = allFeedItems.filter(i => i.club_id !== null && i.club_id !== undefined);
    }

    if (filtered.length === 0) {
        feedContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: #94a3b8;">Không có dữ liệu phù hợp.</div>';
        return;
    }

    feedContainer.innerHTML = filtered.map(item => {
        if (item.feedType === 'post') return renderPostHTML(item);
        if (item.feedType === 'event') return renderEventHTML(item);
        return '';
    }).join('');
}

function filterFeed(event, type) {
    const tabs = document.querySelectorAll('.feed-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    renderFeedItems(type);
}

// Render Post
function renderPostHTML(post) {
    const isLiked = post.user_liked === 1;
    const heartClass = isLiked ? 'fas fa-heart' : 'far fa-heart';
    const heartColor = isLiked ? 'color: #ef4444;' : '';
    
    // Check permission (standardized ID)
    const currentUid = currentUser ? (currentUser.user_id || currentUser.id) : null;
    const canManage = currentUser && (Number(currentUid) === Number(post.user_id) || currentUser.role === 'admin');
    
    // Debug log to console (Optional, remove after verify)
    if (currentUser) {
        console.log(`Checking permission for post ${post.id}: CurrentUserUID=${currentUid}, PostOwnerID=${post.user_id}, Result=${canManage}`);
    }
    
    const manageHtml = canManage ? `
        <div class="post-manage-menu">
            <button onclick="togglePostDropdown(event, 'post-${post.id}')" class="manage-btn">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div id="dropdown-post-${post.id}" class="action-dropdown">
                <button onclick="openEditPost(${post.id})" class="dropdown-item"><i class="fas fa-edit"></i> Sửa bài</button>
                <button onclick="deletePost(${post.id})" class="dropdown-item delete"><i class="fas fa-trash"></i> Xóa bài</button>
            </div>
        </div>
    ` : "";

    return `
    <div class="premium-post-card" id="post-${post.id}">
        <div class="post-header">
            <div class="user-info-side">
                <div class="user-avatar-wrapper">
                    ${post.author_avatar ? 
                        `<img src="${post.author_avatar}" class="avatar-img">` : 
                        `<div class="avatar-placeholder">${(post.author_name || 'U').charAt(0)}</div>`}
                </div>
                <div class="user-meta">
                    <span class="user-name">${post.author_name || 'Thành viên'}</span>
                    <span class="post-date"><i class="far fa-clock"></i> ${new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
            </div>
            <div class="header-right-side">
                <div class="post-type-badge">${post.type || 'Bài viết'}</div>
                ${manageHtml}
            </div>
        </div>

        <div class="post-body">
            ${post.title && post.title !== 'Trạng thái' ? `<h3 class="post-title">${post.title}</h3>` : ''}
            <div class="post-content">${post.content || ''}</div>
            ${post.image ? `
                <div class="post-media-container">
                    <img src="${post.image}" class="post-media-content" onerror="this.parentElement.style.display='none'">
                </div>
            ` : ''}
        </div>

        <div class="post-footer">
            <div class="post-actions-toolbar">
                <div class="action-item ${isLiked ? 'is-liked' : ''}" onclick="likePost(${post.id})">
                    <i class="${heartClass}" id="heart-icon-${post.id}" style="${heartColor}"></i>
                    <span class="count" id="like-count-${post.id}">${post.likes || 0}</span>
                    <span class="label">Yêu thích</span>
                </div>
                <div class="action-item comment-btn" onclick="toggleComments(${post.id})">
                    <i class="far fa-comment-dots"></i>
                    <span class="count" id="comment-count-${post.id}">${post.comments || 0}</span>
                    <span class="label">Bình luận</span>
                </div>
                <div class="action-item views-info">
                    <i class="far fa-eye"></i>
                    <span class="count">${post.views || 0}</span>
                    <span class="label">Lượt xem</span>
                </div>
            </div>
            
            <div id="comments-section-${post.id}" class="premium-comments-section" style="display: none;">
                <div class="comments-divider"></div>
                <div id="comments-list-${post.id}" class="comments-list">
                    <div class="loading-comments">Đang tải bình luận...</div>
                </div>
                <div class="comment-input-wrapper">
                    <input type="text" id="comment-input-${post.id}" placeholder="Chia sẻ suy nghĩ của bạn..." 
                           onkeyup="if(event.key === 'Enter') submitComment(${post.id})">
                    <button class="send-comment-btn" onclick="submitComment(${post.id})">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
}

// Render Event
function renderEventHTML(ev) {
    const isUpcoming = new Date(ev.start_time) > new Date();
    const isOngoing = new Date(ev.start_time) <= new Date() && new Date(ev.end_time) >= new Date();
    const statusClass = isOngoing ? 'badge-ongoing' : (isUpcoming ? 'badge-upcoming' : 'badge-ended');
    const statusText = isOngoing ? 'Đang diễn ra' : (isUpcoming ? 'Sắp diễn ra' : 'Đã kết thúc');

    return `
    <div class="event-card-compact" onclick="showEventDetail(${ev.id})">
        <div class="event-compact-content">
            <div class="event-category">#SựKiện${ev.club_name ? ' • ' + ev.club_name : ''}</div>
            <h3 class="event-title">${ev.event_name}</h3>
            <div class="event-meta">
                <span><i class="far fa-calendar-alt"></i> ${new Date(ev.start_time).toLocaleDateString('vi-VN')}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${ev.location}</span>
                <span class="event-status-mini ${statusClass}">${statusText}</span>
            </div>
            <p class="event-desc-short">${ev.description}</p>
        </div>
        ${ev.image ? `
        <div class="event-compact-thumb">
            <img src="${ev.image}" alt="thumb">
        </div>
        ` : ''}
    </div>
    `;
}


// --- POST ACTIONS ---

async function likePost(postId) {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    try {
        const response = await fetch(`/api/posts/like/${postId}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: (currentUser.user_id || currentUser.id) })
        });
        const result = await response.json();
        
        if (result.success) {
            const heartIcon = document.getElementById(`heart-icon-${postId}`);
            const countSpan = document.getElementById(`like-count-${postId}`);
            let currentLikes = parseInt(countSpan.textContent);
            
            if (result.liked) {
                heartIcon.classList.remove('far'); heartIcon.classList.add('fas'); heartIcon.style.color = '#ef4444';
                countSpan.textContent = currentLikes + 1;
            } else {
                heartIcon.classList.remove('fas'); heartIcon.classList.add('far'); heartIcon.style.color = '';
                countSpan.textContent = Math.max(0, currentLikes - 1);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

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
        
        if (comments.length === 0) { list.innerHTML = '<div style="font-size:13px; color:#94a3b8; text-align:center;">Chưa có bình luận.</div>'; return; }

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
                    <div style="font-size: 14px; color: #334155;">${c.content}</div>
                </div>
            </div>
        `).join('');
    } catch (err) { list.innerHTML = 'Lỗi tải bình luận'; }
}

async function submitComment(postId) {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    if (!content) return;
    
    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: (currentUser.user_id || currentUser.id), content })
        });
        if (res.ok) {
            input.value = '';
            loadComments(postId);
            const countSpan = document.getElementById(`comment-count-${postId}`);
            if(countSpan) countSpan.textContent = parseInt(countSpan.textContent) + 1;
        }
    } catch (err) { console.error(err); }
}

// --- POST MANAGEMENT ---

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
    // Search in allFeedItems
    const post = allFeedItems.find(p => p.id === id && p.feedType === 'post');
    if (!post) return;
    
    document.getElementById('editPostId').value = post.id;
    document.getElementById('editPostTitle').value = post.title || '';
    document.getElementById('editPostType').value = post.type || 'Cộng đồng';
    document.getElementById('editPostContent').value = post.content || '';
    document.getElementById('editPostImageName').textContent = 'Chọn ảnh khác...';
    
    document.getElementById('editPostModal').classList.add('active');
}

async function deletePost(id) {
    if(!confirm("Bạn có chắc chắn muốn xóa bài viết này cùng tất cả bình luận/lượt thích của nó không?")) return;
    try {
        const response = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
        if(response.ok) {
            alert("Xóa thành công.");
            loadFeed(); // Refresh feed
        } else {
            alert("Lỗi khi xóa bài viết.");
        }
    } catch(err) { console.error(err); }
}

async function submitEditPost(event) {
    event.preventDefault();
    if (!currentUser) return alert("Hết phiên làm việc, vui lòng đăng nhập!");
    
    const id = document.getElementById('editPostId').value;
    const title = document.getElementById('editPostTitle').value;
    const type = document.getElementById('editPostType').value;
    const content = document.getElementById('editPostContent').value;
    const imageInput = document.getElementById('editPostImage');
    
    let base64Image = null;
    if (imageInput.files && imageInput.files[0]) {
        base64Image = await toBase64(imageInput.files[0]);
    }

    try {
        const res = await fetch(`/api/posts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                title,
                type,
                content,
                image: base64Image
            })
        });

        if (res.ok) {
            alert("Cập nhật thành công!");
            closeModal('editPostModal');
            loadFeed();
        } else {
            const data = await res.json();
            alert(data.message || "Lỗi cập nhật!");
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi hệ thống!");
    }
}

// --- EVENT ACTIONS & MODALS ---

let currentDetailEventId = null;

function showEventDetail(eventId) {
    const ev = allFeedItems.find(i => i.id === eventId && i.feedType === 'event');
    if (!ev) return;
    currentDetailEventId = ev.id;
    
    document.getElementById('detailEventTitle').textContent = "Chi tiết sự kiện";
    document.getElementById('detailEventName').textContent = ev.event_name;
    document.getElementById('detailEventClub').textContent = ev.club_name || "CLB Công Đồng";
    document.getElementById('detailDateTime').textContent = `${new Date(ev.start_time).toLocaleTimeString('vi-VN')} - ${new Date(ev.start_time).toLocaleDateString('vi-VN')}`;
    document.getElementById('detailLocation').textContent = ev.location;
    document.getElementById('detailDescription').textContent = ev.description;
    
    // Default stats
    document.getElementById('detailRegistered').textContent = "0";

    const imgEl = document.getElementById('detailEventImage');
    if (ev.image) { imgEl.src = ev.image; imgEl.style.display = 'block'; }
    else { imgEl.style.display = 'none'; }
    
    const isUpcoming = new Date(ev.start_time) > new Date();
    const statusEl = document.getElementById('detailEventStatus');
    statusEl.textContent = isUpcoming ? "Sắp diễn ra" : "Đã kết thúc";
    statusEl.className = 'detail-status-pill ' + (isUpcoming ? 'badge-upcoming' : 'badge-ended');

    // Setup register button
    const btnReg = document.getElementById('detailRegisterBtn');
    if (!isUpcoming) {
        btnReg.style.background = '#94a3b8';
        btnReg.innerHTML = '<i class="fas fa-check"></i> Đã kết thúc';
        btnReg.disabled = true;
    } else {
        btnReg.style.background = '#c53030';
        btnReg.innerHTML = '<i class="fas fa-user-plus"></i> Tham gia sự kiện';
        btnReg.disabled = false;
        
        // Cập nhật trạng thái nếu đã đăng ký (Tuỳ chọn: cần API check, nhưng tạm thời hardcode hoặc pass)
        if (ev.is_registered) {
            btnReg.style.background = '#059669';
            btnReg.innerHTML = '<i class="fas fa-check"></i> Đã tham gia';
        }
    }

    document.getElementById('eventDetailModal').classList.add('active');
}

async function toggleRegisterFromDetail() {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    if (!currentDetailEventId) return;

    try {
        const response = await fetch('/api/events/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: currentDetailEventId, user_id: currentUser.id })
        });
        const result = await response.json();
        alert(result.message);
        
        if(response.ok) {
            const btnReg = document.getElementById('detailRegisterBtn');
            btnReg.style.background = '#059669';
            btnReg.innerHTML = '<i class="fas fa-check"></i> Đã tham gia';
            // Cập nhật local state
            const ev = allFeedItems.find(i => i.id === currentDetailEventId);
            if (ev) ev.is_registered = true;
        }
    } catch (err) { alert("Lỗi hệ thống khi đăng ký!"); }
}

// --- CREATE MODAL (POST / EVENT) ---

function openCreatePostModal(type = 'text') {
    if (type === 'event') {
        document.getElementById('createEventModal').classList.add('active');
    } else {
        document.getElementById('createPostModal').classList.add('active');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ============= CREATE POST =============
let mediaFile = null;

function previewMedia(input) {
    if (input.files && input.files[0]) {
        mediaFile = input.files[0];
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('previewImage').src = e.target.result;
            document.getElementById('previewImage').style.display = 'block';
            document.getElementById('mediaPreview').style.display = 'block';
            document.getElementById('uploadArea').style.display = 'none';
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function removeMedia() {
    document.getElementById('postMedia').value = '';
    document.getElementById('mediaPreview').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
    mediaFile = null;
}

async function createPost() {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const content = document.getElementById('postContent').value.trim();
    if (!content && !mediaFile) return alert('Nhập nội dung hoặc chọn ảnh.');

    let base64Image = null;
    if (mediaFile) base64Image = await toBase64(mediaFile);

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                club_id: null, // Public post
                user_id: (currentUser.user_id || currentUser.id),
                title: 'Trạng thái',
                content: content,
                type: 'Cộng đồng',
                image: base64Image
            })
        });

        if (res.ok) {
            alert("Đã đăng bài thành công!");
            closeModal('createPostModal');
            document.getElementById('postContent').value = '';
            removeMedia();
            loadFeed();
        } else {
            alert('Lỗi đăng bài.');
        }
    } catch(err) { console.error(err); }
}

// ============= CREATE EVENT =============

async function loadClubsForEventForm() {
    if (!currentUser) return;
    try {
        const response = await fetch(`/api/user/clubs/${currentUser.id}`);
        const clubs = await response.json();
        const select = document.getElementById('eventClub');
        if (select) {
            select.innerHTML = '<option value="">Chọn CLB tổ chức</option>' + clubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    } catch(e) {}
}

let eventBase64 = null;
function previewEventImage(input) {
    if(input.files && input.files[0]) {
        toBase64(input.files[0]).then(b => {
             eventBase64 = b;
             document.getElementById('eventImageName').textContent = input.files[0].name;
             document.getElementById('eventImageName').style.color = '#c53030';
        });
    }
}

async function createEventSubmit() {
    if (!currentUser) return alert("Cần đăng nhập!");
    const clubId = document.getElementById('eventClub').value;
    if (!clubId) return alert("Chọn CLB tổ chức!");

    const eventName = document.getElementById('eventName').value;
    const loc = document.getElementById('eventLocation').value;
    const desc = document.getElementById('eventDescription').value;
    const stTime = document.getElementById('eventStartDate').value + 'T' + document.getElementById('eventStartTime').value;
    const edTime = document.getElementById('eventEndDate').value + 'T' + document.getElementById('eventEndTime').value;

    try {
        const res = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                club_id: clubId,
                user_id: (currentUser.user_id || currentUser.id), // Add user_id if needed by backend
                event_name: eventName,
                description: desc,
                location: loc,
                start_time: stTime,
                end_time: edTime,
                image: eventBase64
            })
        });

        if (res.ok) {
            alert("Tạo sự kiện thành công!");
            closeModal('createEventModal');
            document.getElementById('createEventForm').reset();
            eventBase64 = null;
            document.getElementById('eventImageName').textContent = 'Click để tải ảnh lên';
            loadFeed();
        } else alert("Lỗi khi tạo!");
    } catch (err) { console.error(err); }
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// Dropdown Toggle
function togglePostDropdown(event, id) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${id}`);
    
    // Đóng tất cả các dropdown khác trước khi mở
    document.querySelectorAll('.action-dropdown').forEach(d => {
        if (d !== dropdown) d.style.display = 'none';
    });
    
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
}

// Window Click to close dropdowns
window.addEventListener('click', () => {
    document.querySelectorAll('.action-dropdown').forEach(d => {
        d.style.display = 'none';
    });
});

// Delete Post
async function deletePost(postId) {
    if (!confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) return;
    
    try {
        const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
        if (res.ok) {
            alert("Đã xóa bài viết thành công!");
            loadFeed();
        } else {
            alert("Lỗi khi xóa bài viết.");
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi kết nối server.");
    }
}

// Open Edit Post
function openEditPost(postId) {
    const post = allFeedItems.find(p => p.id === postId && p.feedType === 'post');
    if (!post) return;
    
    document.getElementById('editPostId').value = post.id;
    document.getElementById('editPostTitle').value = post.title || "";
    document.getElementById('editPostContent').value = post.content || "";
    document.getElementById('editPostType').value = post.type || "Cộng đồng";
    document.getElementById('editPostImageName').textContent = post.image ? "Đã có ảnh (Click để thay đổi)" : "Chọn ảnh tải lên";
    
    openModal('editPostModal');
}

// Submit Edit Post
async function submitEditPost(event) {
    event.preventDefault();
    const id = document.getElementById('editPostId').value;
    const title = document.getElementById('editPostTitle').value;
    const content = document.getElementById('editPostContent').value;
    const type = document.getElementById('editPostType').value;
    const imageFile = document.getElementById('editPostImage').files[0];
    
    let imageBase64 = null;
    if (imageFile) {
        imageBase64 = await toBase64(imageFile);
    } else {
        // Giữ nguyên ảnh cũ nếu ko thay đổi
        const post = allFeedItems.find(p => p.id == id);
        imageBase64 = post ? post.image : null;
    }
    
    try {
        const res = await fetch(`/api/posts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, type, image: imageBase64 })
        });
        
        if (res.ok) {
            alert("Cập nhật thành công!");
            closeModal('editPostModal');
            loadFeed();
        } else {
            alert("Lỗi khi cập nhật bài viết.");
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi hệ thống.");
    }
}
