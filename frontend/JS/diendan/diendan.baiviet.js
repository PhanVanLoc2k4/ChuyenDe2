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
    if (!list) return;
    list.innerHTML = '<div class="loading-placeholder">Đang tải bài viết...</div>';

    try {
        let url = `/api/posts?club_id=${clubId}`;
        if (currentSearchQuery) {
            url += `&search=${encodeURIComponent(currentSearchQuery)}`;
        }
        if (currentUser) {
            url += `&user_id=${currentUser.user_id || currentUser.id}`;
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
        }).join('');
    } catch (err) {
        if (list) list.innerHTML = 'Lỗi tải bài viết.';
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
                heartIcon.style.color = '#ef4444';
                countSpan.textContent = currentLikes + 1;
            } else {
                heartIcon.classList.remove('fas');
                heartIcon.classList.add('far');
                heartIcon.style.color = '';
                countSpan.textContent = Math.max(0, currentLikes - 1);
            }
        }
    } catch (e) { console.error(e); }
}

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
    if (!confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) return;
    try {
        const userId = currentUser.id || currentUser.user_id;
        const response = await fetch(`/api/posts/${id}?user_id=${userId}`, { method: 'DELETE' });
        if (response.ok) {
            alert("Xóa thành công.");
            loadPosts();
        } else {
            const res = await response.json();
            alert("Lỗi: " + (res.message || "Không thể xóa bài viết."));
        }
    } catch (err) { console.error(err); }
}
