const sql = require("mssql");

const dbConfig = {
    user: "sa",
    password: "123",
    server: "localhost", 
    database: "NentangCLB",
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

const JWT_SECRET = "CLB_CONNECT_SECRET_KEY_2026"; 

let pool;

async function checkSchema(pool) {
    try {
        console.log("🔍 Checking Database Schema...");
        // Các lệnh kiểm tra và cập nhật Schema (Tự động nâng cấp hệ thống)
        await pool.request().query("ALTER TABLE posts ALTER COLUMN image NVARCHAR(MAX)");
        await pool.request().query("ALTER TABLE clubs ALTER COLUMN logo_url NVARCHAR(MAX)");
        await pool.request().query("ALTER TABLE clubs ALTER COLUMN cover_url NVARCHAR(MAX)");
        
        // Thêm cột user_id vào posts nếu chưa có
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'user_id')
                ALTER TABLE posts ADD user_id INT FOREIGN KEY REFERENCES users(id);
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('join_requests') AND name = 'reason')
                ALTER TABLE join_requests ADD reason NVARCHAR(MAX);
        `);
        
        console.log("✅ Schema check completed.");
    } catch (err) {
        console.warn("⚠️ Schema check warning:", err.message);
    }
}

async function connectDB() {
    try {
        pool = await sql.connect(dbConfig);
        console.log("✅ Connected SQL Server (Centralized)");
        await checkSchema(pool);
        return pool;
    } catch (err) {
        console.error("❌ DB Connection Error: ", err.message);
        throw err;
    }
}

const getPool = () => pool;

module.exports = {
    dbConfig,
    JWT_SECRET,
    connectDB,
    getPool,
    sql
};
