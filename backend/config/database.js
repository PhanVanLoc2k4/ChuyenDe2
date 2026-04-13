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
        await pool.request().query("ALTER TABLE events ALTER COLUMN club_id INT NULL");
        
        // Thêm cột user_id vào posts nếu chưa có
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'user_id')
                ALTER TABLE posts ADD user_id INT FOREIGN KEY REFERENCES users(id);
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('join_requests') AND name = 'reason')
                ALTER TABLE join_requests ADD reason NVARCHAR(MAX);

            -- --- HỆ THỐNG TRẠNG THÁI & ĐIỂM ---
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'status')
                ALTER TABLE users ADD status NVARCHAR(50) DEFAULT 'active';

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'training_points')
                ALTER TABLE users ADD training_points INT DEFAULT 0;

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_registrations') AND name = 'attendance')
                ALTER TABLE event_registrations ADD attendance NVARCHAR(50) DEFAULT 'registered';

            -- --- HỆ THỐNG KẾT NỐI NHÀ TRƯỜNG (SUPPORT REQUESTS) ---
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('support_requests') AND type in (N'U'))
            BEGIN
                CREATE TABLE support_requests (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    user_id INT FOREIGN KEY REFERENCES users(id),
                    category NVARCHAR(100),
                    subject NVARCHAR(255),
                    message NVARCHAR(MAX),
                    status NVARCHAR(50) DEFAULT 'pending', -- pending, processing, resolved, closed
                    reply_message NVARCHAR(MAX),
                    replied_by INT FOREIGN KEY REFERENCES users(id),
                    replied_at DATETIME,
                    created_at DATETIME DEFAULT GETDATE()
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('training_point_history') AND type in (N'U'))
            BEGIN
                CREATE TABLE training_point_history (
                    id INT PRIMARY KEY IDENTITY(1,1),
                    user_id INT FOREIGN KEY REFERENCES users(id),
                    points INT,
                    reason NVARCHAR(MAX),
                    created_at DATETIME DEFAULT GETDATE(),
                    created_by INT -- Admin hoặc Leader thực hiện
                );
            END
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
