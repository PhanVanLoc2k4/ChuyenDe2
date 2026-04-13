// 4. Xử lý Tab SỰ KIỆN (Events)
async function loadEvents() {
    const list = document.getElementById('eventsList');
    if (!list) return;
    list.innerHTML = '<div class="loading-placeholder">Đang tải sự kiện...</div>';

    try {
        let fetchUrl = `/api/events?club_id=${clubId}`;
        if (currentUser) {
            fetchUrl += `&user_id=${currentUser.user_id || currentUser.id}`;
        }
        const response = await fetch(fetchUrl);
        const events = await response.json();
        window.currentEventsData = events; // Cache for edit

        if (events.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding: 40px; color: #64748b;">Chưa có sự kiện nào được tạo.</p>';
            return;
        }

        const isLeader = currentUser && clubData && Number(currentUser.id) === Number(clubData.created_by);
        const isAdmin = currentUser && currentUser.role === 'admin';
        const canManageEvent = isLeader || isAdmin;

        list.innerHTML = events.map(ev => {
            const mgmtHtml = canManageEvent ? `
                <div class="mgmt-container" style="position: absolute; top: 15px; right: 15px;">
                    <button onclick="togglePostDropdown(event, 'event-${ev.id}')" class="mgmt-btn">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div id="dropdown-event-${ev.id}" class="mgmt-dropdown">
                        <button onclick="event.stopPropagation(); openEditEvent(${ev.id})" class="mgmt-item">
                            <i class="fas fa-edit"></i> Chỉnh sửa
                        </button>
                        <button onclick="event.stopPropagation(); deleteEvent(${ev.id})" class="mgmt-item danger">
                            <i class="fas fa-trash"></i> Xóa sự kiện
                        </button>
                    </div>
                </div>
            ` : "";

            const isLiked = ev.user_liked === 1;
            const heartClass = isLiked ? 'fas fa-heart' : 'far fa-heart';
            const heartColor = isLiked ? 'color: #ef4444;' : '';

            return `
            <div class="post-card event-card" style="position: relative; overflow: visible; padding: 0; display: flex; flex-direction: column; min-height: 220px;">
                <div style="display: flex; flex-direction: row; flex: 1;">
                    <div style="flex: 1; padding: 25px; position: relative;" ${canManageEvent ? `onclick="openEventRegistrations(${ev.id})" style="cursor:pointer;" title="Nhấn để xem danh sách đăng ký"` : ''}>
                        ${mgmtHtml}
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                            <div class="event-date-box" style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 12px; text-align: center; min-width: 70px;">
                                <span style="display: block; font-size: 12px; color: #c53030; font-weight: 700; text-transform: uppercase;">Tháng ${new Date(ev.start_time).getMonth() + 1}</span>
                                <span style="display: block; font-size: 24px; font-weight: 800; color: #1a2639;">${new Date(ev.start_time).getDate()}</span>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                ${!canManageEvent ?
                    (ev.is_registered
                        ? `<button onclick="cancelEventRegistration(${ev.id}, event)" class="btn-registered">
                                                <i class="fas fa-check-circle icon-default"></i><i class="fas fa-times icon-hover"></i>
                                                <span class="text-default">Đã đăng ký</span><span class="text-hover">Hủy tham gia</span>
                                           </button>`
                        : `<button class="btn-action btn-approve" onclick="registerForEvent(${ev.id}, event)">Đăng ký tham gia</button>`)
                    : `<span style="font-size: 12px; color: #c53030; font-weight: bold; background: #fef2f2; padding: 5px 10px; border-radius: 8px; margin-right: 25px;"><i class="fas fa-users"></i> DS Đăng ký</span>`}
                            </div>
                        </div>
                        ${ev.is_admin_event ? `
                        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 8px;">
                            <span style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 5px;">
                                <i class="fas fa-certificate" style="color: #fbbf24;"></i> NHÀ TRƯỜNG
                            </span>
                            <span style="background: rgba(16, 185, 129, 0.1); color: #059669; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">ƯU TIÊN</span>
                        </div>
                        ` : ""}
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
                        <div style="position: absolute; top:0; left:0; width: 50px; height: 100%; background: linear-gradient(to right, white, transparent);"></div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="post-footer" style="padding: 12px 25px; border-top: 1px solid #f1f5f9; background: #fafafa; border-radius: 0 0 20px 20px;">
                    <div class="post-stats" style="display: flex; flex-direction: row; gap: 20px; align-items: center;">
                        <div class="stat-item" onclick="likeEvent(${ev.id}, event)" id="event-like-btn-${ev.id}" 
                             style="display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; color: #64748b;">
                            <i class="${heartClass}" id="event-heart-icon-${ev.id}" style="${heartColor}; font-size: 18px;"></i>
                            <span id="event-like-count-${ev.id}" style="font-weight: 600; font-size: 14px;">${ev.likes || 0}</span>
                        </div>
                        <div class="stat-item" onclick="toggleEventComments(${ev.id}, event)" 
                             style="display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; color: #64748b;">
                            <i class="far fa-comment" style="font-size: 18px;"></i>
                            <span style="font-weight: 600; font-size: 14px;">${ev.comments || 0}</span>
                        </div>
                    </div>

                    <div id="event-comments-section-${ev.id}" class="premium-comments-section" style="display: none; width: 100%; margin-top: 15px;">
                        <div class="comments-divider" style="margin: 12px 0; border-top: 1px solid #e2e8f0;"></div>
                        <div id="event-comments-list-${ev.id}" class="comments-list">
                            <div class="loading-comments" style="text-align: center; padding: 10px; font-size: 13px; color: #94a3b8;">Đang tải bình luận...</div>
                        </div>
                        <div class="comment-input-wrapper" style="display: flex; gap: 10px; margin-top: 12px;">
                            <input type="text" id="event-comment-input-${ev.id}" placeholder="Hỏi điều gì đó về sự kiện này..." 
                                   style="flex: 1; padding: 10px 16px; border-radius: 25px; border: 1px solid #e2e8f0; font-size: 14px; outline: none; transition: 0.2s;"
                                   onkeyup="if(event.key === 'Enter') submitEventComment(${ev.id})">
                            <button class="send-comment-btn" onclick="submitEventComment(${ev.id})">
                                <i class="fas fa-paper-plane" style="font-size: 14px;"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    } catch (err) {
        if (list) list.innerHTML = 'Lỗi tải sự kiện.';
    }
}

async function registerForEvent(eventId, eventObj) {
    if (eventObj) eventObj.stopPropagation();
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    try {
        const response = await fetch('/api/events/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: eventId, user_id: (currentUser.user_id || currentUser.id) })
        });
        const result = await response.json();
        alert(result.message);
        if (response.ok) loadEvents();
    } catch (err) { alert("Lỗi đăng ký sự kiện."); }
}

async function cancelEventRegistration(eventId, eventObj) {
    if (eventObj) eventObj.stopPropagation();
    if (!confirm("Bạn có chắc muốn hủy tham gia sự kiện này?")) return;
    try {
        const response = await fetch('/api/events/register', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: eventId, user_id: (currentUser.user_id || currentUser.id) })
        });
        const result = await response.json();
        alert(result.message);
        if (response.ok) loadEvents();
    } catch (err) { alert("Lỗi hủy đăng ký sự kiện."); }
}

async function submitCreateEvent(event) {
    if (event) event.preventDefault();
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    
    const name = document.getElementById('eventName').value;
    const desc = document.getElementById('eventDesc').value;
    const loc = document.getElementById('eventLoc').value;
    const stTime = document.getElementById('eventStart').value;
    const edTime = document.getElementById('eventEnd').value;
    const imageFile = document.getElementById('eventImage').files[0];
    
    let imageBase64 = null;
    if (imageFile) imageBase64 = await toBase64(imageFile);
    
    try {
        const response = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_name: name,
                description: desc,
                location: loc,
                start_time: stTime,
                end_time: edTime,
                club_id: (clubId && clubId !== 0) ? Number(clubId) : null,
                created_by: (currentUser.user_id || currentUser.id),
                image: imageBase64 || ""
            })
        });
        
        const res = await response.json();
        alert(res.message);
        
        if (response.ok) {
            closeModal('createEventModal');
            document.getElementById('eventForm').reset();
            loadEvents();
            if (typeof loadClubStatistics === 'function') loadClubStatistics();
        }
    } catch (err) { console.error(err); alert("Lỗi tạo sự kiện."); }
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
            if (!heartIcon || !countSpan) return;
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

function openEditEvent(id) {
    if (!window.currentEventsData) return;
    const ev = window.currentEventsData.find(e => e.id === id);
    if (!ev) return;
    document.getElementById('editEventId').value = ev.id;
    document.getElementById('editEventName').value = ev.event_name;
    document.getElementById('editEventDesc').value = ev.description;
    document.getElementById('editEventLoc').value = ev.location;

    const st = new Date(ev.start_time);
    st.setMinutes(st.getMinutes() - st.getTimezoneOffset());
    document.getElementById('editEventStart').value = st.toISOString().slice(0, 16);

    const et = new Date(ev.end_time);
    et.setMinutes(et.getMinutes() - et.getTimezoneOffset());
    document.getElementById('editEventEnd').value = et.toISOString().slice(0, 16);

    openModal('editEventModal');
}

async function deleteEvent(id) {
    if (!confirm("Xóa sự kiện này sẽ tự động xóa tất cả đăng ký tham gia. Tiếp tục?")) return;
    try {
        const userId = currentUser.id || currentUser.user_id;
        const response = await fetch(`/api/events/${id}?user_id=${userId}`, { method: 'DELETE' });
        if (response.ok) {
            alert("Xóa thành công.");
            loadEvents();
        } else alert("Lỗi khi xóa sự kiện.");
    } catch (err) { console.error(err); }
}

async function openEventRegistrations(id) {
    const container = document.getElementById('registrationsContainer');
    const headerCount = document.getElementById('registrationsCount');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: #94a3b8;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 15px; font-size: 14px;">Đang tải danh sách...</p></div>';
    headerCount.innerText = "Đang kiểm tra...";
    openModal('eventRegistrationsModal');

    try {
        const response = await fetch(`/api/events/${id}/registrations`);
        const users = await response.json();
        if (users.length === 0) {
            headerCount.innerText = "Chưa có lượt đăng ký nào";
            container.innerHTML = `<div style="text-align:center; padding: 50px 20px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;"><div style="width: 60px; height: 60px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto;"><i class="fas fa-user-xmark" style="font-size: 24px; color: #94a3b8;"></i></div><h3 style="color: #475569; font-size: 16px; margin: 0 0 5px 0;">Danh sách trống</h3><p style="color: #64748b; font-size: 13px; margin: 0;">Sự kiện này hiện chưa có thành viên nào ghi danh tham gia.</p></div>`;
            return;
        }
        headerCount.innerText = `Tổng cộng: ${users.length} học sinh đăng ký`;
        container.innerHTML = '<div style="display: flex; flex-direction: column; gap: 12px;">' + users.map(u => {
            const isAttended = u.attendance === 'attended';
            return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px; border-radius: 12px; border: 1px solid ${isAttended ? '#86efac' : '#e2e8f0'}; background: ${isAttended ? '#f0fdf4' : 'white'}; transition: 0.2s;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, ${isAttended ? '#22c55e' : '#2563eb'} 0%, ${isAttended ? '#16a34a' : '#dbeafe'} 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        ${u.full_name.charAt(0)}
                    </div>
                    <div>
                        <div style="font-weight: 700; color: #1e293b; font-size: 15px;">${u.full_name}</div>
                        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
                            ${isAttended ? '<span style="color: #16a34a; font-weight: 600;"><i class="fas fa-check"></i> Đã có mặt (+5đ)</span>' : '<span style="color: #94a3b8;"><i class="fas fa-clock"></i> Chưa điểm danh</span>'}
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    ${!isAttended ? `
                        <button onclick="submitAttendance(${u.registration_id}, 'attended', ${id})" style="background: #16a34a; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s;">
                            <i class="fas fa-check-double"></i> Điểm danh
                        </button>
                    ` : ''}
                    <div style="text-align: right; background: ${isAttended ? '#dcfce7' : '#f8fafc'}; padding: 10px 15px; border-radius: 8px;">
                        <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Ngày ĐK</div>
                        <div style="font-size: 13px; font-weight: 700; color: #334155; margin-top: 2px;">${new Date(u.registered_at).toLocaleDateString('vi-VN')}</div>
                    </div>
                </div>
            </div>`;
        }).join('') + '</div>';
    } catch (err) {
        headerCount.innerText = "Lỗi kết nối";
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: #ef4444;"><i class="fas fa-exclamation-circle fa-2x"></i><p style="margin-top: 15px;">Lỗi tải dữ liệu.</p></div>';
    }
}

async function submitAttendance(registrationId, status, eventId) {
    if (!currentUser) return;
    try {
        const adminId = currentUser.id || currentUser.user_id;
        const response = await fetch('/api/points/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registration_id: registrationId, status, admin_id: adminId })
        });
        const result = await response.json();
        if (response.ok) {
            alert("Điểm danh thành công! Sinh viên đã được cộng +5 điểm rèn luyện.");
            openEventRegistrations(eventId); // Reload list
            if (typeof loadPosts === 'function') loadPosts(); // Optional: update stats
        } else alert("Lỗi: " + result.message);
    } catch (err) { alert("Lỗi hệ thống khi điểm danh."); }
}

async function submitEditEvent(event) {
    if (event) event.preventDefault();
    const id = document.getElementById('editEventId').value;
    const name = document.getElementById('editEventName').value;
    const desc = document.getElementById('editEventDesc').value;
    const loc = document.getElementById('editEventLoc').value;
    const stTime = document.getElementById('editEventStart').value;
    const edTime = document.getElementById('editEventEnd').value;
    const imageFile = document.getElementById('editEventImage').files[0];

    let imageBase64 = null;
    if (imageFile) {
        imageBase64 = await toBase64(imageFile);
    } else {
        const ev = window.currentEventsData.find(e => e.id == id);
        imageBase64 = ev ? ev.image : null;
    }

    try {
        const response = await fetch(`/api/events/${id}`, {
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

        if (response.ok) {
            alert("Cập nhật sự kiện thành công!");
            closeModal('editEventModal');
            loadEvents();
        } else {
            const data = await response.json();
            alert("Lỗi: " + (data.message || "Không thể cập nhật sự kiện."));
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi hệ thống khi cập nhật.");
    }
}
