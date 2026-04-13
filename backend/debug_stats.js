const sql = require('mssql');

const config = {
    user: 'sa',
    password: '123',
    server: 'localhost',
    database: 'NentangCLB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function testStats() {
    try {
        const pool = await sql.connect(config);
        console.log("Connected to DB");
        
        let month = null;
        let year = null;
        
        let dateFilter = "";
        let request = pool.request();

        if (month && year) {
            dateFilter = " WHERE MONTH(created_at) = @m AND YEAR(created_at) = @y ";
            request.input("m", sql.Int, month).input("y", sql.Int, year);
        } else if (year) {
            dateFilter = " WHERE YEAR(created_at) = @y ";
            request.input("y", sql.Int, year);
        }

        const query = `
            SELECT 
                (SELECT COUNT(*) FROM users ${dateFilter}) as totalUsers,
                (SELECT COUNT(*) FROM clubs WHERE status = 'active' ${dateFilter ? dateFilter.replace('WHERE', 'AND') : ''}) as totalClubs,
                (SELECT COUNT(*) FROM events WHERE status = 'active' ${dateFilter ? dateFilter.replace('WHERE', 'AND') : ''}) as totalEvents
        `;
        console.log("Query:", query);
        const stats = await request.query(query);
        console.log("Stats Result:", stats.recordset[0]);

        const topClubsQuery = `
            SELECT TOP 5 
                c.id, c.club_name, c.logo_url,
                (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count,
                (SELECT COUNT(*) FROM events WHERE club_id = c.id) as event_count,
                (SELECT COUNT(*) FROM posts WHERE club_id = c.id) as post_count
            FROM clubs c
            ORDER BY (
                (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) + 
                (SELECT COUNT(*) FROM events WHERE club_id = c.id) + 
                (SELECT COUNT(*) FROM posts WHERE club_id = c.id)
            ) DESC
        `;
        console.log("Top Clubs Query Executing...");
        const topClubs = await pool.request().query(topClubsQuery);
        console.log("Top Clubs Result:", topClubs.recordset);
        
        process.exit(0);
    } catch (err) {
        console.error("DEBUG ERROR:", err);
        process.exit(1);
    }
}

testStats();
