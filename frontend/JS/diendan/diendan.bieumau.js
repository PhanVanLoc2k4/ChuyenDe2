function setupFormListeners() {
    // 1. Form Đăng bài
    const postForm = document.getElementById('postForm');
    if (postForm) {
        postForm.onsubmit = async (e) => {
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
                user_id: Number(currentUser.id || currentUser.user_id)
            };
            try {
                const resp = await fetch('/api/posts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (resp.ok) {
                    alert("Đăng bài thành công!");
                    closeModal('createPostModal');
                    loadPosts();
                    if (typeof loadClubStatistics === 'function') loadClubStatistics();
                    e.target.reset();
                } else {
                    const res = await resp.json();
                    alert("Lỗi: " + res.message);
                }
            } catch (err) { alert("Lỗi đăng bài."); }
        };
    }

    // 2. Form Edit Bài
    const editPostForm = document.getElementById('editPostForm');
    if (editPostForm) {
        editPostForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('editPostId').value;
            const post = window.currentPostsData.find(p => p.id == id);
            if (!post) return;
            const imageFile = document.getElementById('editPostImage').files[0];
            const imageBase64 = imageFile ? await toBase64(imageFile) : post.image;
            const data = {
                title: document.getElementById('editPostTitle').value,
                content: document.getElementById('editPostContent').value,
                type: document.getElementById('editPostType').value,
                image: imageBase64,
                user_id: Number(currentUser.id || currentUser.user_id)
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
    }

    // 3. Form Tạo sự kiện
    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.onsubmit = async (e) => {
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
                created_by: Number(currentUser.id || currentUser.user_id),
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
                if (resp.ok) {
                    closeModal('createEventModal');
                    loadEvents();
                    if (typeof loadClubStatistics === 'function') loadClubStatistics();
                    e.target.reset();
                }
            } catch (err) { alert("Lỗi tạo sự kiện."); }
        };
    }

    // 4. Form Edit sự kiện
    const editEventForm = document.getElementById('editEventForm');
    if (editEventForm) {
        editEventForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('editEventId').value;
            const ev = window.currentEventsData.find(evt => evt.id == id);
            if (!ev) return;
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
}
