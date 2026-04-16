let allRankings = {};

async function loadRankings() {
    try {
        console.log("🚀 Loading rankings from API...");
        const response = await fetch('/api/rankings');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        allRankings = await response.json();
        console.log("📥 Received rankings data:", allRankings);
        
        // Mặc định hiển thị tab CLB Năng động
        renderRanking('mostActiveClubs');
    } catch (err) {
        console.error("Lỗi tải bảng xếp hạng:", err);
        const rankingList = document.getElementById('rankingList');
        if (rankingList) rankingList.innerHTML = `<div style="padding: 20px; color: #c53030;">Lỗi: ${err.message}</div>`;
    }
}

function renderRanking(type) {
    const podiumArea = document.getElementById('podiumArea');
    const rankingList = document.getElementById('rankingList');
    const scoreLabel = document.getElementById('scoreLabel');
    
    const data = allRankings[type] || [];
    
    // Cập nhật label dựa trên loại
    if (type === 'mostActiveClubs') scoreLabel.innerText = "Điểm hoạt động";
    else if (type === 'topMembers') scoreLabel.innerText = "Điểm rèn luyện";
    else if (type === 'biggestClubs') scoreLabel.innerText = "Số thành viên";
    else if (type === 'popularEvents') scoreLabel.innerText = "Lượt yêu thích";

    // 1. Hiển thị Podium (Top 3)
    const top3 = data.slice(0, 3);
    podiumArea.innerHTML = '';
    
    top3.forEach((item, index) => {
        const rank = index + 1;
        const name = item.club_name || item.full_name || item.event_name || 'N/A';
        const avatar = item.logo_url || item.avatar || item.image || '';
        const score = item.activity_score || item.contribution_score || item.member_count || item.likes || 0;
        const unit = getUnit(type);

        const avatarHtml = avatar ? `<img src="${avatar}" class="podium-avatar">` : 
            `<div class="podium-avatar" style="background:#f8fafc; display:flex; align-items:center; justify-content:center; color:#cbd5e1; font-size:40px;"><i class="fas fa-crown"></i></div>`;

        podiumArea.innerHTML += `
            <div class="podium-card rank-${rank}">
                <div class="rank-badge">${rank}</div>
                ${avatarHtml}
                <div class="podium-name">${name}</div>
                <div class="podium-score">${formatNumber(score)}</div>
                <div class="podium-label">${unit}</div>
            </div>
        `;
    });

    // 2. Hiển thị danh sách còn lại (Hạng 4-10)
    const rest = data.slice(3, 10);
    rankingList.innerHTML = '';

    if (rest.length === 0 && top3.length === 0) {
        rankingList.innerHTML = '<div style="padding: 40px; text-align: center; color: #a0aec0;">Chưa có dữ liệu xếp hạng</div>';
        return;
    }

    rest.forEach((item, index) => {
        const rank = index + 4;
        const name = item.club_name || item.full_name || item.event_name || 'N/A';
        const avatar = item.logo_url || item.avatar || item.image || '';
        const score = item.activity_score || item.contribution_score || item.member_count || item.likes || 0;
        
        const avatarHtml = avatar ? `<img src="${avatar}" class="item-avatar">` : 
            `<div class="item-avatar" style="background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:18px;"><i class="fas fa-image"></i></div>`;

        rankingList.innerHTML += `
            <div class="rank-item">
                <div class="item-rank-num">${rank}</div>
                <div class="item-info">
                    ${avatarHtml}
                    <div class="item-name">${name}</div>
                </div>
                <div class="item-score-val">${formatNumber(score)}</div>
            </div>
        `;
    });
}

function formatNumber(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num;
}

function getUnit(type) {
    switch(type) {
        case 'mostActiveClubs': return 'Điểm hoạt động';
        case 'topMembers': return 'Điểm rèn luyện';
        case 'biggestClubs': return 'Thành viên';
        case 'popularEvents': return 'Lượt thích';
        default: return 'Điểm';
    }
}

function switchRank(event, type) {
    // UI active tab
    document.querySelectorAll('.rank-tab').forEach(tab => tab.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Render data
    renderRanking(type);
}

// Khởi chạy
document.addEventListener('DOMContentLoaded', loadRankings);
