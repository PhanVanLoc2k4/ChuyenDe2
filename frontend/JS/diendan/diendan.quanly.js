// 5. Xử lý Tab THÀNH VIÊN & DUYỆT (Management)
async function loadManagementData() {
    await loadJoinRequests();
    await loadMembers();
}

async function loadJoinRequests() {
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) return;
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
                <td style="max-width: 250px;">
                    <div style="font-size: 13px; color: #475569; font-style: italic; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                         "${req.reason || 'Không để lại lý do.'}"
                    </div>
                </td>
                <td>${new Date(req.requested_at).toLocaleDateString('vi-VN')}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="nut-bam-premium nut-chinh" style="padding: 6px 12px; font-size: 13px;" onclick="handleRequest(${req.request_id}, 'approve')">Duyệt</button>
                        <button class="nut-bam-premium nut-phu" style="padding: 6px 12px; font-size: 13px; color: var(--danger-color);" onclick="handleRequest(${req.request_id}, 'reject')">Từ chối</button>
                    </div>
                </td>
            </tr>`).join('');
    } catch (err) { tbody.innerHTML = 'Lỗi tải yêu cầu.'; }
}

async function loadMembers() {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Đang tải...</td></tr>';
    try {
        const response = await fetch(`/api/clubs/${clubId}/members`);
        const members = await response.json();
        tbody.innerHTML = members.map(m => {
            const isMe = currentUser && (Number(m.user_id) === Number(currentUser.id || currentUser.user_id));
            return `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="last-post-avatar" style="background:#f1f5f9; color:#475569;">${m.name.charAt(0)}</div>
                        <div>
                            <div style="font-weight: 600;">${m.name} ${isMe ? '<span style="color: #2563eb; font-size: 11px; background: #eff6ff; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">Bạn</span>' : ''}</div>
                            <div style="font-size: 12px; color: #64748b;">${m.email}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge" style="background: #e2e8f0; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">${m.role || 'Thành viên'}</span></td>
                <td>
                    ${isMe ? `<div style="color: #94a3b8; font-size: 12px; font-style: italic; text-align: center;">Hệ thống bảo vệ</div>` : `
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <select class="role-select" onchange="promoteMember(${m.member_record_id}, this.value)" style="flex: 1;">
                                <option value="">-- Cấp quyền --</option>
                                <option value="Phó CLB">Phó CLB</option>
                                <option value="Ban quản lý">Ban quản lý</option>
                                <option value="Thành viên">Thành viên (Gỡ quyền)</option>
                            </select>
                            <button class="btn-action btn-reject" onclick="kickMember(${m.member_record_id}, '${m.name}')" title="Loại khỏi CLB"><i class="fas fa-user-minus"></i></button>
                        </div>`}
                </td>
            </tr>`;
        }).join('');
    } catch (err) { tbody.innerHTML = 'Lỗi tải thành viên.'; }
}

async function handleRequest(requestId, action) {
    let reason = "";
    if (action === 'reject') {
        reason = prompt("Vui lòng nhập lý do từ chối (để thông báo cho sinh viên):");
        if (reason === null) return; // Nhấn Cancel
    }

    try {
        const response = await fetch('/api/clubs/requests/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_id: requestId, action, reason })
        });
        const result = await response.json();
        
        if (typeof showToast === 'function') {
            showToast(action === 'approve' ? "Thành công" : "Đã từ chối", result.message, action === 'approve' ? 'success' : 'warning');
        } else {
            alert(result.message);
        }
        
        loadManagementData();
    } catch (err) { 
        alert("Lỗi xử lý yêu cầu."); 
    }
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

async function kickMember(memberRecordId, memberName) {
    if (!confirm(`Bạn có chắc chắn muốn loại thành viên "${memberName}" không?`)) return;
    try {
        const response = await fetch(`/api/clubs/members/${memberRecordId}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            loadMembers();
        } else alert("Lỗi: " + result.message);
    } catch (err) { alert("Lỗi kết nối."); }
}

function loadSettingsData() {
    if (clubData) {
        const isOwner = currentUser && Number(currentUser.user_id || currentUser.id) === Number(clubData.created_by);
        
        // Form chỉnh sửa chỉ cho Leader
        const editForm = document.getElementById('settingClubForm');
        const dangerZone = document.getElementById('dangerZoneSection');
        const memberActions = document.getElementById('memberActionsSection');

        if (isOwner) {
            editForm.style.display = 'block';
            dangerZone.style.display = 'block';
            memberActions.style.display = 'none';
            
            document.getElementById('settingClubName').value = clubData.club_name || '';
            document.getElementById('settingClubCategory').value = clubData.category_name || '';
            document.getElementById('settingClubDesc').value = clubData.description || '';
        } else {
            editForm.style.display = 'none';
            dangerZone.style.display = 'none';
            memberActions.style.display = 'block';
        }
    }
}

async function handleLeaveClub() {
    if (!confirm("Bạn có chắc chắn muốn rời khỏi câu lạc bộ này không?")) return;
    
    try {
        const response = await fetch('/api/clubs/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                club_id: clubId, 
                user_id: currentUser.user_id || currentUser.id 
            })
        });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            window.location.href = '/DienDan'; // Về trang chủ diễn đàn
        } else {
            alert(result.message);
        }
    } catch (err) {
        alert("Lỗi kết nối.");
    }
}

async function handleDeleteClub() {
    const confirmName = prompt("HÀNH ĐỘNG NÀY KHÔNG THỂ HOÀN TÁC!\nVui lòng nhập lại tên Câu lạc bộ để xác nhận việc GIẢI TÁN:");
    if (confirmName !== clubData.club_name) {
        if (confirmName !== null) alert("Tên xác nhận không khớp.");
        return;
    }

    try {
        const response = await fetch(`/api/clubs/${clubId}?user_id=${currentUser.user_id || currentUser.id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            window.location.href = '/clb'; // Về danh sách CLB
        } else {
            alert(result.message);
        }
    } catch (err) {
        alert("Lỗi kết nối.");
    }
}

async function saveClubSettings(e) {
    e.preventDefault();
    if (!currentUser) return alert("Vui lòng đăng nhập!");
    const name = document.getElementById('settingClubName').value;
    const category = document.getElementById('settingClubCategory').value;
    const desc = document.getElementById('settingClubDesc').value;
    const logoFile = document.getElementById('settingClubLogo').files[0];
    const coverFile = document.getElementById('settingClubCover').files[0];

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
    submitBtn.disabled = true;

    try {
        const payload = { club_name: name, category_name: category, description: desc, logo_url: clubData.logo_url || '', cover_url: clubData.cover_url || '' };
        if (logoFile) payload.logo_url = await toBase64(logoFile);
        if (coverFile) payload.cover_url = await toBase64(coverFile);

        const response = await fetch(`/api/clubs/${clubId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok) { alert(result.message); location.reload(); }
        else { alert(result.message); submitBtn.innerHTML = originalText; submitBtn.disabled = false; }
    } catch (err) { alert("Lỗi cập nhật."); submitBtn.innerHTML = originalText; submitBtn.disabled = false; }
}
