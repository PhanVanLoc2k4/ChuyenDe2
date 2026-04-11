// 3.5 Comments Logic (Posts)
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
    if (!list) return;
    try {
        const response = await fetch(`/api/posts/${postId}/comments`);
        const allComments = await response.json();
        if (allComments.length === 0) {
            list.innerHTML = '<div style="font-size:13px; color:#94a3b8; text-align:center; padding: 10px;">Chưa có bình luận nào. Hãy là người đầu tiên!</div>';
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
                </div>`).join('');

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
                             <button onclick="toggleReplyInput(${p.id}, ${postId}, 'post')" style="background:none; border:none; color:#64748b; font-size:12px; font-weight:600; cursor:pointer; padding:0; transition:0.2s;">Trả lời</button>
                        </div>
                        <div id="reply-input-container-post-${p.id}" style="display: none; margin-top: 10px; margin-left: 10px;">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="text" id="reply-input-post-${p.id}" placeholder="Viết phản hồi..." style="flex:1; padding: 8px 12px; border-radius: 20px; border: 1px solid #e2e8f0; font-size: 13px; outline: none;" onkeyup="if(event.key === 'Enter') submitComment(${postId}, ${p.id})">
                                <button onclick="submitComment(${postId}, ${p.id})" style="background:#2563eb; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer;"><i class="fas fa-paper-plane" style="font-size: 12px;"></i></button>
                            </div>
                        </div>
                        <div class="replies-list" id="replies-list-${p.id}">${repliesHtml}</div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (err) { console.error(err); }
}

async function submitComment(postId, parentId = null) {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const inputId = parentId ? `reply-input-post-${parentId}` : `comment-input-${postId}`;
    const input = document.getElementById(inputId);
    const content = input.value.trim();
    if (!content) return;
    try {
        const response = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id || currentUser.user_id, content: content, parent_id: parentId })
        });
        if (response.ok) {
            input.value = '';
            if (parentId) document.getElementById(`reply-input-container-post-${parentId}`).style.display = 'none';
            loadComments(postId);
            const countSpan = document.getElementById(`comment-count-${postId}`);
            if (countSpan) countSpan.textContent = parseInt(countSpan.textContent) + 1;
        } else alert('Lỗi đăng bình luận');
    } catch (err) { console.error(err); }
}

// Comments Logic (Events)
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
    if (!container) return;
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
                    <div class="comment-user-avatar" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 11px;">
                        ${r.author_avatar ? `<img src="${r.author_avatar}" style="width:100%;height:100%;object-fit:cover;">` : (r.author_name ? r.author_name[0] : '?')}
                    </div>
                    <div class="comment-content-wrapper" style="background:#f1f5f9; padding:8px 12px; border-radius:10px; flex:1">
                        <div class="comment-user-name" style="font-weight:700; font-size:12px; color:#1e293b">${r.author_name}</div>
                        <div class="comment-text" style="font-size:13px; color:#475569; margin:2px 0; line-height: 1.4;">${r.content}</div>
                        <div class="comment-time" style="font-size:10px; color:#94a3b8">${new Date(r.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                </div>`).join('');
            return `
            <div class="comment-group" style="margin-bottom: 20px;">
                <div class="comment-item" style="display: flex; gap: 12px; padding: 8px 0;">
                    <div class="comment-user-avatar" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center;">
                        ${p.author_avatar ? `<img src="${p.author_avatar}" style="width:100%;height:100%;object-fit:cover;">` : (p.author_name ? p.author_name[0] : '?')}
                    </div>
                    <div class="comment-content-wrapper" style="flex:1">
                        <div style="background:#f8fafc; padding:10px 14px; border-radius:12px;">
                            <div class="comment-user-name" style="font-weight:700; font-size:13px; color:#1e293b">${p.author_name}</div>
                            <div class="comment-text" style="font-size:14px; color:#475569; margin:3px 0; line-height: 1.4;">${p.content}</div>
                            <div class="comment-time" style="font-size:11px; color:#94a3b8">${new Date(p.created_at).toLocaleString('vi-VN')}</div>
                        </div>
                        <div style="display: flex; gap: 15px; margin-top: 4px; margin-left: 10px;">
                             <button onclick="toggleReplyInput(${p.id}, ${eventId}, 'event')" style="background:none; border:none; color:#64748b; font-size:12px; font-weight:600; cursor:pointer; padding:0; transition:0.2s;">Trả lời</button>
                        </div>
                        <div id="reply-input-container-event-${p.id}" style="display: none; margin-top: 10px; margin-left: 10px;">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="text" id="reply-input-event-${p.id}" placeholder="Trả lời câu hỏi..." style="flex:1; padding: 8px 12px; border-radius: 20px; border: 1px solid #e2e8f0; font-size: 13px; outline: none;" onkeyup="if(event.key === 'Enter') submitEventComment(${eventId}, ${p.id})">
                                <button onclick="submitEventComment(${eventId}, ${p.id})" style="background:#3b82f6; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer;"><i class="fas fa-paper-plane" style="font-size: 12px;"></i></button>
                            </div>
                        </div>
                        <div class="replies-list" id="event-replies-list-${p.id}">${repliesHtml}</div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (e) { container.innerHTML = 'Lỗi tải bình luận.'; }
}

async function submitEventComment(eventId, parentId = null) {
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const inputId = parentId ? `reply-input-event-${parentId}` : `event-comment-input-${eventId}`;
    const input = document.getElementById(inputId);
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;
    try {
        const res = await fetch(`/api/events/${eventId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: (currentUser.user_id || currentUser.id), content: content, parent_id: parentId })
        });
        if (res.ok) {
            input.value = '';
            if (parentId) document.getElementById(`reply-input-container-event-${parentId}`).style.display = 'none';
            await loadEventComments(eventId);
        }
    } catch (e) { alert("Lỗi gửi bình luận."); }
}

// Shared UI Logic for Comments
function toggleReplyInput(commentId, postId, type) {
    const container = document.getElementById(`reply-input-container-${type}-${commentId}`);
    if (container.style.display === 'none') {
        container.style.display = 'block';
        document.getElementById(`reply-input-${type}-${commentId}`).focus();
    } else {
        container.style.display = 'none';
    }
}
