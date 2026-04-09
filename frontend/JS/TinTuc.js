let currentUser = null;
let allFeedItems = [];
let isSubmitting = false; // Prevent double-clicks

document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
        currentUser = JSON.parse(userStr);
        updateSidebarProfile();
    }

    loadClubsForForms(); // Load options cho form tạo bài viết và sự kiện
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
        const uid = currentUser ? (currentUser.user_id || currentUser.id) : null;
        const postsRes = await fetch(`/api/posts${uid ? `?user_id=${uid}` : ''}`);
        const posts = postsRes.ok ? await postsRes.json() : [];

        const eventsRes = await fetch(`/api/events${uid ? `?user_id=${uid}` : ''}`);
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
    <div class="premium-post-card" id="post-${post.id}" style="box-sizing: border-box; max-width: 100%;">
        <div class="post-header">
            <div class="user-info-side">
                <div class="user-avatar-wrapper" style="width: 45px; height: 45px; flex-shrink: 0;">
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
                <div class="post-media-container" style="max-height: 500px; width: 100%; overflow: hidden; border-radius: 12px; margin-top: 15px;">
                    <img src="${post.image}" class="post-media-content" style="width: 100%; height: auto; max-height: 500px; object-fit: cover;" onerror="this.parentElement.style.display='none'">
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
    const now = new Date();
    const startTime = new Date(ev.start_time);
    const endTime = ev.end_time ? new Date(ev.end_time) : new Date(startTime.getTime() + 3600000); // Mặc định 1 tiếng nếu ko có end_time
    
    const isUpcoming = startTime > now;
    const isEnded = endTime < now;
    const isOngoing = !isUpcoming && !isEnded;

    const statusClass = isOngoing ? 'badge-ongoing' : (isUpcoming ? 'badge-upcoming' : 'badge-ended');
    const statusText = isOngoing ? 'Đang diễn ra' : (isUpcoming ? 'Sắp diễn ra' : 'Đã kết thúc');

    const isLiked = ev.user_liked === 1;
    const heartClass = isLiked ? 'fas fa-heart' : 'far fa-heart';
    const heartColor = isLiked ? 'color: #ef4444;' : '';

    return `
    <div class="post-card event-post ${statusClass}" id="event-${ev.id}">
        <div class="post-header">
            <div class="club-avatar">${(ev.club_name || 'C').charAt(0)}</div>
            <div class="post-author-info">
                <div class="post-author">
                    ${ev.club_name || 'CLB Cộng đồng'}
                    <span class="event-badge">Sự kiện</span>
                </div>
                <div class="post-time">
                    <i class="far fa-clock"></i> 
                    ${new Date(ev.created_at || ev.start_time).toLocaleDateString('vi-VN')}
                </div>
            </div>
            <div class="event-status-mini ${statusClass}">${statusText}</div>
        </div>

        <div class="event-highlight">
            <div class="event-date-chip">
                <i class="far fa-calendar-alt"></i>
                ${new Date(ev.start_time).toLocaleDateString('vi-VN')}
            </div>
            <div class="event-location-chip">
                <i class="fas fa-map-marker-alt"></i>
                ${ev.location}
            </div>
        </div>

        <div class="post-content" onclick="showEventDetail(${ev.id})">
            <h3 class="post-title">${ev.event_name}</h3>
            <p class="post-text">${ev.description ? ev.description.trim() : ''}</p>
            ${ev.image ? `
            <div class="post-media">
                <div class="media-grid">
                    <img src="${ev.image}" alt="Event Banner">
                </div>
            </div>
            ` : ''}
        </div>

        <div class="post-stats">
            <div class="stat-group">
                <div class="stat-item" onclick="likeEvent(${ev.id}, event)">
                    <i class="${heartClass}" id="event-heart-icon-${ev.id}" style="${heartColor}"></i>
                    <span id="event-like-count-${ev.id}">${ev.likes || 0}</span>
                </div>
                <div class="stat-item" onclick="toggleEventComments(${ev.id}, event)">
                    <i class="far fa-comment-dots"></i>
                    <span>${ev.comments || 0}</span>
                </div>
            </div>
            <div class="stat-item views-info">
                <i class="far fa-eye"></i>
                <span>${ev.views || 0} lượt xem</span>
            </div>
        </div>

        <div class="post-actions">
            <button class="action-btn" onclick="showEventDetail(${ev.id})">
                <i class="fas fa-search-plus"></i> Chi tiết
            </button>
            <button class="action-btn btn-join" id="join-btn-${ev.id}" onclick="showEventDetail(${ev.id})">
                <i class="fas ${ev.is_registered ? 'fa-check-circle' : 'fa-user-plus'}"></i>
                ${ev.is_registered ? 'Đã đăng ký' : 'Tham gia ngay'}
            </button>
        </div>

        <div id="event-comments-section-${ev.id}" class="premium-comments-section" style="display: none;">
            <div class="comments-divider"></div>
            <div id="event-comments-list-${ev.id}" class="comments-list">
                <div class="loading-comments">Đang tải bình luận...</div>
            </div>
            <div class="comment-input-wrapper">
                <input type="text" id="event-comment-input-${ev.id}" placeholder="Hỏi gì đó về sự kiện này..." 
                       onkeyup="if(event.key === 'Enter') submitEventComment(${ev.id})">
                <button class="send-comment-btn" onclick="submitEventComment(${ev.id})">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    </div>
    `;
}


// --- POST ACTIONS ---

async function likePost(postId) {
    if (isSubmitting) return;
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    isSubmitting = true;
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
    } finally {
        isSubmitting = false;
    }
}

async function likeEvent(eventId) {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    try {
        const response = await fetch(`/api/events/like/${eventId}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: (currentUser.user_id || currentUser.id) })
        });
        const result = await response.json();
        
        if (result.success) {
            const heartIcon = document.getElementById(`event-heart-icon-${eventId}`);
            const countSpan = document.getElementById(`event-like-count-${eventId}`);
            let currentLikes = parseInt(countSpan.textContent);
            
            if (result.liked) {
                heartIcon.classList.remove('far'); heartIcon.classList.add('fas'); heartIcon.style.color = '#ef4444';
                countSpan.textContent = currentLikes + 1;
            } else {
                heartIcon.classList.remove('fas'); heartIcon.classList.add('far'); heartIcon.style.color = '';
                countSpan.textContent = Math.max(0, currentLikes - 1);
            }
        }
    } catch (e) { console.error(e); }
}

async function toggleEventComments(eventId) {
    const section = document.getElementById(`event-comments-section-${eventId}`);
    if (section.style.display === 'none') {
        section.style.display = 'block';
        await loadEventComments(eventId);
    } else {
        section.style.display = 'none';
    }
}

async function loadEventComments(eventId) {
    const container = document.getElementById(`event-comments-list-${eventId}`);
    try {
        const res = await fetch(`/api/events/${eventId}/comments`);
        const comments = await res.json();
        
        if (comments.length === 0) {
            container.innerHTML = '<div style="padding: 15px; color: #a0aec0; text-align: center; font-size: 13px;">Chưa có câu hỏi hay bình luận nào.</div>';
            return;
        }

        container.innerHTML = comments.map(c => `
            <div class="comment-item" style="display: flex; gap: 12px; margin-bottom: 16px; padding: 8px 0;">
                <div class="comment-user-avatar" style="width: 35px; height: 35px; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: #e2e8f0; display: flex; align-items: center; justify-content: center;">
                    ${c.author_avatar ? `<img src="${c.author_avatar}" style="width: 100%; height: 100%; object-fit: cover; display: block;">` : (c.author_name ? c.author_name[0] : '?')}
                </div>
                <div class="comment-content-wrapper">
                    <div class="comment-user-name">${c.author_name}</div>
                    <div class="comment-text">${c.content}</div>
                    <div class="comment-time">${new Date(c.created_at).toLocaleString('vi-VN')}</div>
                </div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = 'Lỗi tải bình luận.'; }
}

async function submitEventComment(eventId) {
    if (isSubmitting) return;
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const input = document.getElementById(`event-comment-input-${eventId}`);
    const content = input.value.trim();
    if (!content) return;

    isSubmitting = true;
    try {
        const res = await fetch(`/api/events/${eventId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: (currentUser.user_id || currentUser.id),
                content: content 
            })
        });
        if (res.ok) {
            input.value = '';
            await loadEventComments(eventId);
        }
    } catch (e) { 
        alert("Lỗi gửi bình luận."); 
    } finally {
        isSubmitting = false;
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
    if (isSubmitting) return;
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    if (!content) return;
    
    isSubmitting = true;
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
    } catch (err) { 
        console.error(err); 
    } finally {
        isSubmitting = false;
    }
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
    
    // Use actual stats from the feed item
    document.getElementById('detailRegistered').textContent = ev.participant_count || "0";
    document.getElementById('detailLikes').textContent = ev.likes || "0";

    const imgEl = document.getElementById('detailEventImage');
    if (ev.image) { imgEl.src = ev.image; imgEl.style.display = 'block'; }
    else { imgEl.style.display = 'none'; }
    
    const now = new Date();
    const startTime = new Date(ev.start_time);
    const endTime = ev.end_time ? new Date(ev.end_time) : new Date(startTime.getTime() + 3600000);
    
    const isUpcoming = startTime > now;
    const isEnded = endTime < now;
    const isOngoing = !isUpcoming && !isEnded;

    const statusEl = document.getElementById('detailEventStatus');
    if (isOngoing) {
        statusEl.textContent = "Đang diễn ra";
        statusEl.className = 'detail-status-pill badge-ongoing';
    } else if (isUpcoming) {
        statusEl.textContent = "Sắp diễn ra";
        statusEl.className = 'detail-status-pill badge-upcoming';
    } else {
        statusEl.textContent = "Đã kết thúc";
        statusEl.className = 'detail-status-pill badge-ended';
    }

    // Setup register button
    const btnReg = document.getElementById('detailRegisterBtn');
    if (isEnded) {
        btnReg.style.background = '#94a3b8';
        btnReg.innerHTML = '<i class="fas fa-check"></i> Đã kết thúc';
        btnReg.disabled = true;
    } else {
        btnReg.style.background = '#c53030';
        btnReg.innerHTML = '<i class="fas fa-user-plus"></i> Tham gia sự kiện';
        btnReg.disabled = false;
        
        // Cập nhật trạng thái nếu đã đăng ký
        if (ev.is_registered) {
            btnReg.style.background = '#94a3b8';
            btnReg.innerHTML = '<i class="fas fa-times-circle"></i> Hủy tham gia';
        }
    }

    document.getElementById('eventDetailModal').classList.add('active');
}

async function toggleRegisterFromDetail() {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    if (!currentDetailEventId) return;

    try {
        const ev = allFeedItems.find(i => i.id === currentDetailEventId);
        const method = ev && ev.is_registered ? 'DELETE' : 'POST';
        
        const response = await fetch('/api/events/register', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: currentDetailEventId, user_id: currentUser.id })
        });
        const result = await response.json();
        alert(result.message);
        
        if(response.ok) {
            const btnReg = document.getElementById('detailRegisterBtn');
            const cardBtn = document.getElementById(`join-btn-${currentDetailEventId}`);
            
            // Cập nhật trạng thái
            if (ev) {
                ev.is_registered = !ev.is_registered;
                // Cập nhật UI nút trong modal
                if (ev.is_registered) {
                    btnReg.style.background = '#94a3b8';
                    btnReg.innerHTML = '<i class="fas fa-times-circle"></i> Hủy tham gia';
                    
                    // Cập nhật nút ngoài card
                    if (cardBtn) {
                        cardBtn.innerHTML = `<i class="fas fa-check-circle"></i> Đã đăng ký`;
                    }
                    
                    ev.participant_count = (ev.participant_count || 0) + 1;
                } else {
                    btnReg.style.background = '#c53030';
                    btnReg.innerHTML = '<i class="fas fa-user-plus"></i> Tham gia sự kiện';
                    
                    // Cập nhật nút ngoài card
                    if (cardBtn) {
                        cardBtn.innerHTML = `<i class="fas fa-user-plus"></i> Tham gia ngay`;
                    }
                    
                    ev.participant_count = Math.max(0, (ev.participant_count || 0) - 1);
                }
                // Cập nhật số người tham gia trong modal
                document.getElementById('detailRegistered').textContent = ev.participant_count;
            }
        }
    } catch (err) { alert("Lỗi hệ thống khi thay đổi trạng thái đăng ký!"); }
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

    const clubId = document.getElementById('postClub')?.value;
    
    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                club_id: clubId ? Number(clubId) : null,
                user_id: (currentUser.user_id || currentUser.id),
                title: 'Trạng thái',
                content: content,
                type: clubId ? 'Thông báo CLB' : 'Cộng đồng',
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

async function loadClubsForForms() {
    if (!currentUser) return;
    try {
        const uid = currentUser.user_id || currentUser.id;
        const response = await fetch(`/api/user/clubs/${uid}`);
        const clubs = await response.json();
        
        const eventSelect = document.getElementById('eventClub');
        const postSelect = document.getElementById('postClub');
        
        const optionsHtml = '<option value="">🌎 Công khai</option>' + clubs.map(c => `<option value="${c.id}">♣️ ${c.name}</option>`).join('');
        
        if (eventSelect) {
            eventSelect.innerHTML = '<option value="">Chọn CLB tổ chức</option>' + clubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        if (postSelect) {
            postSelect.innerHTML = optionsHtml;
        }
    } catch(e) { console.error("Lỗi load clubs cho forms:", e); }
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
