// 2.6 Tải dữ liệu Thống kê & Xếp hạng
async function loadClubStatistics(period = currentStatsPeriod) {
    if (!clubId) return;
    try {
        const response = await fetch(`/api/clubs/${clubId}/rankings?period=${period}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!data || !data.overview) return;

        document.getElementById('statTotalEvents').textContent = data.overview.totalEvents ?? 0;
        document.getElementById('statTotalPosts').textContent = data.overview.totalPosts ?? 0;
        document.getElementById('statTotalMembers').textContent = data.overview.totalMembers ?? 0;

        const newMembersBadge = document.getElementById('newMembersBadge');
        if (data.overview.newMembers > 0 && currentStatsPeriod !== 'all') {
            const periodText = currentStatsPeriod === 'month' ? 'tháng' : 'năm';
            newMembersBadge.textContent = `+${data.overview.newMembers} mới trong ${periodText}`;
            newMembersBadge.style.display = 'block';
        } else {
            newMembersBadge.style.display = 'none';
        }

        renderRankingList('eventRankingsList', data.eventRankings || [], 'sự kiện');
        renderRankingList('postRankingsList', data.postRankings || [], 'bài viết');
    } catch (err) { console.error("Lỗi load stats:", err); }
}

function changeStatsPeriod(period) {
    currentStatsPeriod = period;
    ['btnMonth', 'btnYear', 'btnAll'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) { btn.classList.remove('active'); btn.style.background = 'none'; btn.style.color = '#64748b'; }
    });
    let activeBtnId = (period === 'year') ? 'btnYear' : (period === 'all' ? 'btnAll' : 'btnMonth');
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) { activeBtn.classList.add('active'); activeBtn.style.background = 'white'; activeBtn.style.color = '#2563eb'; }
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
                        <span style="font-size: 12px; color: #64748b;">Thành viên tích cực</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 15px; font-weight: 800; color: #2563eb;">${item.count}</div>
                    <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${unit}</div>
                </div>
            </div>`;
    }).join('');
}
