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
        <div class="mgmt-container">
            <button onclick="togglePostDropdown(event, 'post-${post.id}')" class="mgmt-btn">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div id="dropdown-post-${post.id}" class="mgmt-dropdown">
                <button onclick="openEditPost(${post.id})" class="mgmt-item"><i class="fas fa-edit"></i> Chỉnh sửa</button>
                <button onclick="deletePost(${post.id})" class="mgmt-item danger"><i class="fas fa-trash"></i> Xóa bài viết</button>
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
            <div class="club-avatar">${ev.club_name ? ev.club_name.charAt(0) : '🏢'}</div>
            <div class="post-author-info">
                <div class="post-author">
                    ${ev.club_name || '🏢 NHÀ TRƯỜNG'}
                    <span class="event-badge">Sự kiện</span>
                </div>
                <div class="post-time">
                    <i class="far fa-clock"></i> 
                    ${new Date(ev.created_at || ev.start_time).toLocaleDateString('vi-VN')}
                </div>
            </div>
            <div class="event-status-mini ${statusClass}">${statusText}</div>
            
            <!-- Dropdown quản lý sự kiện -->
            ${(currentUser && (currentUser.role === 'admin' || currentUser.role_name === 'admin' || Number(ev.created_by) === Number(currentUser.user_id || currentUser.id))) ? `
            <div class="mgmt-container">
                <button class="mgmt-btn" onclick="togglePostDropdown(event, 'event-${ev.id}')">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div id="dropdown-event-${ev.id}" class="mgmt-dropdown">
                    <button onclick="openEditEvent(${ev.id})" class="mgmt-item"><i class="fas fa-edit"></i> Chỉnh sửa</button>
                    <button onclick="deleteEvent(${ev.id})" class="mgmt-item danger"><i class="fas fa-trash"></i> Xóa sự kiện</button>
                </div>
            </div>
            ` : ''}
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
        const allComments = await res.json();
        
        if (allComments.length === 0) {
            container.innerHTML = '<div style="padding: 15px; color: #a0aec0; text-align: center; font-size: 13px;">Chưa có câu hỏi hay bình luận nào.</div>';
            return;
        }

        const parents = allComments.filter(c => !c.parent_id);
        const children = allComments.filter(c => c.parent_id);

        container.innerHTML = parents.map(p => {
            const replies = children.filter(c => c.parent_id === p.id);
            const repliesHtml = replies.map(r => `
                <div class="comment-item reply-item" style="display: flex; gap: 10px; margin-top: 10px; margin-left: 42px; padding: 4px 0;">
                    <div class="comment-user-avatar" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 11px;">
                        ${r.author_avatar ? `<img src="${r.author_avatar}" style="width: 100%; height: 100%; object-fit: cover; display: block;">` : (r.author_name ? r.author_name[0] : '?')}
                    </div>
                    <div class="comment-content-wrapper" style="background:#f1f5f9; padding:8px 12px; border-radius:10px; flex:1">
                        <div class="comment-user-name" style="font-weight:700; font-size:12px; color:#1e293b">${r.author_name}</div>
                        <div class="comment-text" style="font-size:13px; color:#475569; margin:2px 0; line-height: 1.4;">${r.content}</div>
                        <div class="comment-time" style="font-size:10px; color:#94a3b8">${new Date(r.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                </div>
            `).join('');

            return `
            <div class="comment-group" style="margin-bottom: 20px;">
                <div class="comment-item" style="display: flex; gap: 12px; padding: 8px 0;">
                    <div class="comment-user-avatar" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: #e2e8f0; display: flex; align-items: center; justify-content: center;">
                        ${p.author_avatar ? `<img src="${p.author_avatar}" style="width: 100%; height: 100%; object-fit: cover; display: block;">` : (p.author_name ? p.author_name[0] : '?')}
                    </div>
                    <div class="comment-content-wrapper" style="flex:1">
                        <div style="background:#f8fafc; padding:10px 14px; border-radius:12px;">
                            <div class="comment-user-name" style="font-weight:700; font-size:13px; color:#1e293b">${p.author_name}</div>
                            <div class="comment-text" style="font-size:14px; color:#475569; margin:3px 0; line-height: 1.4;">${p.content}</div>
                            <div class="comment-time" style="font-size:11px; color:#94a3b8">${new Date(p.created_at).toLocaleString('vi-VN')}</div>
                        </div>
                        <div style="display: flex; gap: 15px; margin-top: 4px; margin-left: 10px;">
                             <button onclick="toggleReplyInput(${p.id}, ${eventId}, 'event')" style="background:none; border:none; color:#64748b; font-size:12px; font-weight:600; cursor:pointer; padding:0; transition:0.2s;" onmouseover="this.style.color='#3b82f6'" onmouseout="this.style.color='#64748b'">Trả lời</button>
                        </div>
                        <div id="reply-input-container-event-${p.id}" style="display: none; margin-top: 10px; margin-left: 10px;">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="text" id="reply-input-event-${p.id}" placeholder="Trả lời sự kiện..." 
                                       style="flex:1; padding: 8px 12px; border-radius: 20px; border: 1px solid #e2e8f0; font-size: 13px; outline: none;"
                                       onkeyup="if(event.key === 'Enter') submitEventComment(${eventId}, ${p.id})">
                                <button onclick="submitEventComment(${eventId}, ${p.id})" style="background:#3b82f6; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                    <i class="fas fa-paper-plane" style="font-size: 12px;"></i>
                                </button>
                            </div>
                        </div>
                        <div class="replies-list" id="event-replies-list-${p.id}">
                            ${repliesHtml}
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    } catch (e) { container.innerHTML = 'Lỗi tải bình luận.'; }
}

async function submitEventComment(eventId, parentId = null) {
    if (isSubmitting) return;
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const inputId = parentId ? `reply-input-event-${parentId}` : `event-comment-input-${eventId}`;
    const input = document.getElementById(inputId);
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    isSubmitting = true;
    try {
        const res = await fetch(`/api/events/${eventId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: (currentUser.user_id || currentUser.id),
                content: content,
                parent_id: parentId
            })
        });
        if (res.ok) {
            input.value = '';
            if (parentId) {
                document.getElementById(`reply-input-container-event-${parentId}`).style.display = 'none';
            }
            await loadEventComments(eventId);
        }
    } catch (e) { 
        alert("Lỗi gửi bình luận."); 
    } finally {
        isSubmitting = false;
    }
}

function toggleReplyInput(commentId, targetId, type) {
    const container = document.getElementById(`reply-input-container-${type}-${commentId}`);
    if (container.style.display === 'none') {
        container.style.display = 'block';
        document.getElementById(`reply-input-${type}-${commentId}`).focus();
    } else {
        container.style.display = 'none';
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
        const allComments = await response.json();
        
        if (allComments.length === 0) { 
            list.innerHTML = '<div style="font-size:13px; color:#94a3b8; text-align:center; padding: 10px;">Chưa có bình luận.</div>'; 
            return; 
        }

        const parents = allComments.filter(c => !c.parent_id);
        const children = allComments.filter(c => c.parent_id);

        list.innerHTML = parents.map(p => {
            const replies = children.filter(c => c.parent_id === p.id);
            const repliesHtml = replies.map(r => `
                <div style="display: flex; gap: 10px; margin-top: 10px; margin-left: 42px;">
                    <div class="comment-user-avatar" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 11px;">
                        ${r.author_avatar ? `<img src="${r.author_avatar}" style="width:100%;height:100%;object-fit:cover;">` : (r.author_name || 'U').charAt(0)}
                    </div>
                    <div style="background: #f1f5f9; padding: 8px 12px; border-radius: 12px; border-top-left-radius: 4px; flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                            <span style="font-weight: 600; font-size: 12px; color: #1e293b;">${r.author_name}</span>
                            <span style="font-size: 10px; color: #94a3b8;">${new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div style="font-size: 13px; color: #334155; line-height: 1.4;">${r.content}</div>
                    </div>
                </div>
            `).join('');

            return `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; gap: 10px;">
                    <div class="comment-user-avatar" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center;">
                        ${p.author_avatar ? `<img src="${p.author_avatar}" style="width:100%;height:100%;object-fit:cover;">` : (p.author_name || 'U').charAt(0)}
                    </div>
                    <div style="flex: 1;">
                        <div style="background: #f8fafc; padding: 10px 14px; border-radius: 16px; border-top-left-radius: 4px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span style="font-weight: 600; font-size: 13px; color: #1e293b;">${p.author_name}</span>
                                <span style="font-size: 11px; color: #94a3b8;">${new Date(p.created_at).toLocaleDateString('vi-VN')}</span>
                            </div>
                            <div style="font-size: 14px; color: #334155; line-height: 1.4;">${p.content}</div>
                        </div>
                        <div style="display: flex; gap: 15px; margin-top: 4px; margin-left: 10px;">
                             <button onclick="toggleReplyInput(${p.id}, ${postId}, 'post')" style="background:none; border:none; color:#64748b; font-size:12px; font-weight:600; cursor:pointer; padding:0; transition:0.2s;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#64748b'">Trả lời</button>
                        </div>
                        <div id="reply-input-container-post-${p.id}" style="display: none; margin-top: 10px; margin-left: 10px;">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="text" id="reply-input-post-${p.id}" placeholder="Viết phản hồi..." 
                                       style="flex:1; padding: 8px 12px; border-radius: 20px; border: 1px solid #e2e8f0; font-size: 13px; outline: none;"
                                       onkeyup="if(event.key === 'Enter') submitComment(${postId}, ${p.id})">
                                <button onclick="submitComment(${postId}, ${p.id})" style="background:#2563eb; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                    <i class="fas fa-paper-plane" style="font-size: 12px;"></i>
                                </button>
                            </div>
                        </div>
                        <div class="replies-list" id="replies-list-${p.id}">
                            ${repliesHtml}
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    } catch (err) { list.innerHTML = 'Lỗi tải bình luận'; }
}

async function submitComment(postId, parentId = null) {
    if (isSubmitting) return;
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const inputId = parentId ? `reply-input-post-${parentId}` : `comment-input-${postId}`;
    const input = document.getElementById(inputId);
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;
    
    isSubmitting = true;
    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: (currentUser.user_id || currentUser.id), 
                content,
                parent_id: parentId
            })
        });
        if (res.ok) {
            input.value = '';
            if (parentId) {
                document.getElementById(`reply-input-container-post-${parentId}`).style.display = 'none';
            }
            loadComments(postId);
            // Cập nhật số lượng comment (nếu có span)
            const countSpan = document.getElementById(`comment-count-${postId}`);
            if(countSpan) countSpan.textContent = parseInt(countSpan.textContent) + 1;
        }
    } catch (err) { 
        console.error(err); 
    } finally {
        isSubmitting = false;
    }
}

// --- MANAGEMENT FUNCTIONS (Unified) ---
function togglePostDropdown(event, typeId) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${typeId}`);
    
    // Close other dropdowns
    document.querySelectorAll('.mgmt-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('show');
    });
    
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Click anywhere to close dropdowns
document.addEventListener('click', () => {
    document.querySelectorAll('.mgmt-dropdown').forEach(d => d.classList.remove('show'));
});

// --- POST MANAGEMENT ---
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

async function deletePost(postId) {
    if (!confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) return;
    const uid = currentUser ? (currentUser.user_id || currentUser.id) : null;
    
    try {
        const res = await fetch(`/api/posts/${postId}?user_id=${uid}`, { method: 'DELETE' });
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
        const post = allFeedItems.find(p => p.id == id);
        imageBase64 = post ? post.image : null;
    }
    
    try {
        const res = await fetch(`/api/posts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title, 
                content, 
                type, 
                image: imageBase64,
                user_id: (currentUser.user_id || currentUser.id)
            })
        });
        
        if (res.ok) {
            alert("Cập nhật bài viết thành công!");
            closeModal('editPostModal');
            loadFeed();
        } else {
            const errData = await res.json();
            alert("Lỗi: " + (errData.message || "Không xác định"));
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi hệ thống.");
    }
}

// --- EVENT ACTIONS & MODALS ---

let currentDetailEventId = null;

function showEventDetail(eventId) {
    const ev = allFeedItems.find(i => i.id === eventId && i.feedType === 'event');
    if (!ev) return;
    currentDetailEventId = ev.id;

    // Increment view count
    fetch(`/api/events/view/${eventId}`, { method: 'POST' }).catch(err => console.error("Error incrementing event view:", err));
    
    document.getElementById('detailEventTitle').textContent = "Chi tiết sự kiện";
    document.getElementById('detailEventName').textContent = ev.event_name;
    document.getElementById('detailEventClub').textContent = ev.club_name || "🏢 NHÀ TRƯỜNG";
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
        const isAdmin = currentUser.role === 'admin' || currentUser.role_name === 'admin';
        const uid = currentUser.user_id || currentUser.id;
        
        // Admin được phép chọn bất kỳ CLB nào, member chỉ chọn CLB đã tham gia
        const endpoint = isAdmin ? '/api/clubs' : `/api/user/clubs/${uid}`;
        const response = await fetch(endpoint);
        let clubs = await response.json();
        
        // Sắp xếp: Ưu tiên Nhà trường hoặc Ban giám hiệu lên đầu nếu là Admin
        if (isAdmin) {
            clubs.sort((a, b) => {
                const keywords = ['nhà trường', 'ban giám hiệu', 'hệ thống', 'thông báo'];
                const aName = (a.name || a.club_name || "").toLowerCase();
                const bName = (b.name || b.club_name || "").toLowerCase();
                
                const aIsOfficial = keywords.some(k => aName.includes(k));
                const bIsOfficial = keywords.some(k => bName.includes(k));
                
                if (aIsOfficial && !bIsOfficial) return -1;
                if (!aIsOfficial && bIsOfficial) return 1;
                return aName.localeCompare(bName);
            });
        }
        
        const eventSelect = document.getElementById('eventClub');
        const postSelect = document.getElementById('postClub');
        
        const optionsHtml = '<option value="">🌎 Công khai</option>' + clubs.map(c => `<option value="${c.id}">♣️ ${c.name || c.club_name}</option>`).join('');
        
        if (eventSelect) {
            let eventOptions = '<option value="">Chọn đơn vị tổ chức</option>';
            if (isAdmin) {
                eventOptions += '<option value="">🏢 Sự kiện của Trường (Công khai)</option>';
            }
            eventOptions += clubs.map(c => `<option value="${c.id}">${c.name || c.club_name}</option>`).join('');
            eventSelect.innerHTML = eventOptions;
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
    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role_name === 'admin');
    if (!clubId && !isAdmin) return alert("Vui lòng chọn CLB tổ chức!");

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
                club_id: clubId ? Number(clubId) : null,
                created_by: (currentUser.user_id || currentUser.id),
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

/* End of Management Block 1... and redundant block 2 removed */

// MANAGEMENT FOR EVENTS
function openEditEvent(eventId) {
    const ev = allFeedItems.find(i => i.id === eventId && i.feedType === 'event');
    if (!ev) return;

    document.getElementById('editEventId').value = ev.id;
    document.getElementById('editEventName').value = ev.event_name;
    document.getElementById('editEventLocation').value = ev.location;
    document.getElementById('editEventDescription').value = ev.description;
    
    // Parse start_time/end_time
    const st = new Date(ev.start_time);
    const et = new Date(ev.end_time);
    
    document.getElementById('editEventStartDate').value = st.toISOString().split('T')[0];
    document.getElementById('editEventStartTime').value = st.toTimeString().split(' ')[0].substring(0, 5);
    document.getElementById('editEventEndDate').value = et.toISOString().split('T')[0];
    document.getElementById('editEventEndTime').value = et.toTimeString().split(' ')[0].substring(0, 5);
    
    document.getElementById('editEventImageName').textContent = ev.image ? "Đã có ảnh (Click để thay đổi)" : "Chọn ảnh mới";
    openModal('editEventModal');
}

async function submitEditEvent() {
    const id = document.getElementById('editEventId').value;
    const name = document.getElementById('editEventName').value;
    const loc = document.getElementById('editEventLocation').value;
    const desc = document.getElementById('editEventDescription').value;
    const stTime = document.getElementById('editEventStartDate').value + 'T' + document.getElementById('editEventStartTime').value;
    const edTime = document.getElementById('editEventEndDate').value + 'T' + document.getElementById('editEventEndTime').value;
    const imageFile = document.getElementById('editEventImage').files[0];

    let imageBase64 = null;
    if (imageFile) {
        imageBase64 = await toBase64(imageFile);
    } else {
        const ev = allFeedItems.find(i => i.id == id && i.feedType === 'event');
        imageBase64 = ev ? ev.image : null;
    }

    try {
        const res = await fetch(`/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_name: name,
                description: desc,
                location: loc,
                start_time: stTime,
                end_time: edTime,
                image: imageBase64,
                user_id: (currentUser.user_id || currentUser.id)
            })
        });

        if (res.ok) {
            alert("Cập nhật sự kiện thành công!");
            closeModal('editEventModal');
            loadFeed();
        } else {
            const data = await res.json();
            alert("Lỗi: " + (data.message || "Không thể cập nhật"));
        }
    } catch (err) { console.error(err); }
}

async function deleteEvent(eventId) {
    if (!confirm("Bạn có chắc chắn muốn xóa sự kiện này?")) return;
    const uid = currentUser ? (currentUser.user_id || currentUser.id) : null;

    try {
        const res = await fetch(`/api/events/${eventId}?user_id=${uid}`, { method: 'DELETE' });
        if (res.ok) {
            alert("Đã xóa sự kiện!");
            loadFeed();
        } else alert("Lỗi khi xóa sự kiện.");
    } catch (err) { console.error(err); }
}
