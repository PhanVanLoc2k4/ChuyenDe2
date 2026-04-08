const API_BASE = 'http://localhost:5000/api';
let currentUser = null;

// ================= AUTH & INIT =================
function checkAuth() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            currentUser = JSON.parse(userStr);
        } catch (e) {
            currentUser = null;
        }
    }
    updateHeroSection();
}

function updateHeroSection() {
    const ctaContainer = document.getElementById('heroCtaContainer');
    if (currentUser) {
        document.getElementById('heroTitle').innerHTML = `Chào mừng trở lại,<br><span style="color:var(--primary)">${currentUser.full_name}</span> 👋`;
        document.getElementById('heroSubtitle').innerHTML = 'Sẵn sàng khám phá những Câu lạc bộ và Sự kiện mới nhất đang chờ bạn hôm nay.';
        
        // Update CTAs for logged in user
        ctaContainer.innerHTML = `
            <a href="/tintuc" class="btn-primary-large">Vào Bảng Tin</a>
            <a href="#discover-clubs" class="btn-secondary-large">Tham Gia Thêm CLB</a>
        `;
    }
}

// ================= LOAD PLATFORM STATS =================
async function loadPlatformStats() {
    try {
        // Here we would ideally fetch real stats from the API
        // const res = await fetch(`${API_BASE}/platform/stats`);
        // const data = await res.json();
        
        // Mock data loading with animation
        animateValue("statClubs", 0, 56, 1500, "+");
        animateValue("statMembers", 0, 12, 1500, "K+");
        animateValue("statEvents", 0, 340, 2000, "+");
    } catch (e) {
        console.error("Error loading stats", e);
    }
}

function animateValue(id, start, end, duration, affix = "") {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start) + affix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// ================= LOAD FEATURED CLUBS =================
async function loadFeaturedClubs() {
    const grid = document.getElementById('featuredClubsGrid');
    try {
        const res = await fetch(`${API_BASE}/clubs`);
        const data = await res.json();
        
        if (data.success && data.clubs && data.clubs.length > 0) {
            // Lấy ngẫu nhiên vài CLB làm nổi bật hoặc cắt lấy 6 CLB đầu
            const featuredClubs = data.clubs.slice(0, 6);
            
            grid.innerHTML = featuredClubs.map(club => `
                <div class="club-card" onclick="window.location.href='/clb'">
                    <div class="club-card-avatar" style="background: linear-gradient(135deg, var(--primary) 0%, rgb(153, 27, 27) 100%)">
                        ${club.club_name.substring(0, 2).toUpperCase()}
                    </div>
                    <h3>${club.club_name}</h3>
                    <p>${club.description}</p>
                    <div class="club-card-meta">
                        <span><i class="fas fa-users"></i> ${Math.floor(Math.random() * 500) + 50} thành viên</span>
                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8;">Chưa có câu lạc bộ nào trên nền tảng.</div>';
        }
    } catch (e) {
        console.error("Error loading clubs", e);
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Lỗi tải dữ liệu Câu lạc bộ.</div>';
    }
}

// ================= LOAD UPCOMING EVENTS =================
async function loadUpcomingEvents() {
    const grid = document.getElementById('upcomingEventsGrid');
    try {
        const res = await fetch(`${API_BASE}/events`);
        const data = await res.json();
        
        let events = [];
        if (data.success && data.events) {
            // Lọc ra các sự kiện sắp hoặc đang diễn ra
             events = data.events.filter(e => new Date(e.end_time) >= new Date());
             // Sắp xếp gần nhất
             events.sort((a,b) => new Date(a.start_time) - new Date(b.start_time));
        }

        if (events.length > 0) {
            const displayEvents = events.slice(0, 3);
            grid.innerHTML = displayEvents.map(ev => {
                const dateObj = new Date(ev.start_time);
                const day = dateObj.getDate();
                const monthStr = "Thg " + (dateObj.getMonth() + 1);
                
                return `
                <div class="event-landing-card" onclick="window.location.href='/tintuc'">
                    <div class="event-landing-img">
                        <img src="${ev.image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'}" alt="Event Image" onerror="this.src='https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'">
                        <div class="event-date-badge">
                            <span class="day">${day}</span>
                            <span class="month">${monthStr}</span>
                        </div>
                    </div>
                    <div class="event-landing-content">
                        ${ev.club_name ? `<span class="event-landing-club">${ev.club_name}</span>` : ''}
                        <h3 class="event-landing-title">${ev.event_name}</h3>
                        <div class="event-landing-meta">
                            <span><i class="far fa-clock"></i> ${dateObj.toLocaleTimeString('vi-VN')}</span>
                            <span><i class="fas fa-map-marker-alt"></i> ${ev.location}</span>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        } else {
            // Nếu không có API event hoặc trống, hiển thị Demo
            grid.innerHTML = `
                <div class="event-landing-card" onclick="window.location.href='/tintuc'">
                    <div class="event-landing-img">
                        <img src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800" alt="Event">
                        <div class="event-date-badge">
                            <span class="day">15</span>
                            <span class="month">Thg 5</span>
                        </div>
                    </div>
                    <div class="event-landing-content">
                        <span class="event-landing-club">CLB TIN HỌC</span>
                        <h3 class="event-landing-title">Workshop "AI Ứng Dụng Trong Học Tập"</h3>
                        <div class="event-landing-meta">
                            <span><i class="far fa-clock"></i> 08:30 - 11:30</span>
                            <span><i class="fas fa-map-marker-alt"></i> Hội trường B1</span>
                        </div>
                    </div>
                </div>
                <div class="event-landing-card" onclick="window.location.href='/tintuc'">
                    <div class="event-landing-img">
                        <img src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800" alt="Event">
                        <div class="event-date-badge">
                            <span class="day">20</span>
                            <span class="month">Thg 5</span>
                        </div>
                    </div>
                    <div class="event-landing-content">
                        <span class="event-landing-club">CLB ÂM NHẠC</span>
                        <h3 class="event-landing-title">Đêm nhạc Acoustic "Giai Điệu Mùa Hè"</h3>
                        <div class="event-landing-meta">
                            <span><i class="far fa-clock"></i> 19:00 - 22:00</span>
                            <span><i class="fas fa-map-marker-alt"></i> Sân vận động</span>
                        </div>
                    </div>
                </div>
                <div class="event-landing-card" onclick="window.location.href='/tintuc'">
                    <div class="event-landing-img">
                        <img src="https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800" alt="Event">
                        <div class="event-date-badge">
                            <span class="day">05</span>
                            <span class="month">Thg 6</span>
                        </div>
                    </div>
                    <div class="event-landing-content">
                        <span class="event-landing-club">CLB TÌNH NGUYỆN</span>
                        <h3 class="event-landing-title">Ra quân Chiến dịch Mùa Hè Xanh năm 2026</h3>
                        <div class="event-landing-meta">
                            <span><i class="far fa-clock"></i> 07:00 - 12:00</span>
                            <span><i class="fas fa-map-marker-alt"></i> Sân trường</span>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        console.error("Error loading upcoming events", e);
    }
}

// ================= SMOOTH SCROLL =================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// ================= INIT =================
function init() {
    checkAuth();
    loadPlatformStats();
    
    // Slight delay to simulate natural loading and let user see the cool spinner
    setTimeout(() => {
        loadFeaturedClubs();
        loadUpcomingEvents();
    }, 500);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
