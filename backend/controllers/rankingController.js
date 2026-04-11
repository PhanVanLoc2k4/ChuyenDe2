const { getPool, sql } = require("../config/database");

// 1. Bảng xếp hạng toàn hệ thống
const getGlobalRankings = async (req, res) => {
    const pool = getPool();
    try {
        // 1. CLB Năng động nhất
        const activeClubsQuery = `
            SELECT TOP 10 c.id, c.club_name, c.logo_url,
                   (ISNULL(pCount.total, 0) * 5 + ISNULL(eCount.total, 0) * 10) as activity_score
            FROM clubs c
            LEFT JOIN (
                SELECT club_id, COUNT(*) as total 
                FROM posts 
                GROUP BY club_id
            ) pCount ON c.id = pCount.club_id
            LEFT JOIN (
                SELECT club_id, COUNT(*) as total 
                FROM events 
                GROUP BY club_id
            ) eCount ON c.id = eCount.club_id
            WHERE (ISNULL(pCount.total, 0) > 0 OR ISNULL(eCount.total, 0) > 0)
            ORDER BY activity_score DESC
        `;
        const activeClubsResult = await pool.request().query(activeClubsQuery);
        const activeClubs = activeClubsResult.recordset;

        // 2. Thành viên ưu tú
        const topMembersQuery = `
            SELECT TOP 10 u.id, u.full_name, u.avatar, COUNT(p.id) as contribution_score
            FROM users u
            JOIN posts p ON u.id = p.user_id
            GROUP BY u.id, u.full_name, u.avatar
            ORDER BY contribution_score DESC
        `;
        const topMembersResult = await pool.request().query(topMembersQuery);
        const topMembers = topMembersResult.recordset;

        // 3. Quy mô CLB
        const biggestClubsQuery = `
            SELECT TOP 10 c.id, c.club_name, c.logo_url, COUNT(cm.id) as member_count
            FROM clubs c
            JOIN club_members cm ON c.id = cm.club_id
            WHERE cm.status = 'active'
            GROUP BY c.id, c.club_name, c.logo_url
            ORDER BY member_count DESC
        `;
        const biggestClubsResult = await pool.request().query(biggestClubsQuery);
        const biggestClubs = biggestClubsResult.recordset;

        // 4. Sự kiện Hot
        const popularEventsQuery = `
            SELECT TOP 10 e.id, e.event_name, e.image, e.likes
            FROM events e
            ORDER BY likes DESC
        `;
        const popularEventsResult = await pool.request().query(popularEventsQuery);
        const popularEvents = popularEventsResult.recordset;

        res.json({
            mostActiveClubs: activeClubs,
            topMembers: topMembers,
            biggestClubs: biggestClubs,
            popularEvents: popularEvents
        });
    } catch (err) {
        console.error("Lỗi API Global Rankings:", err);
        res.status(500).json({ message: "Lỗi tải bảng xếp hạng hệ thống" });
    }
};

module.exports = {
    getGlobalRankings
};
