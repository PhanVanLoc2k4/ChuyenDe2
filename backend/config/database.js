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
    console.log("🔍 Checking Database Schema...");
    
    const runQuery = async (query, description) => {
        try {
            await pool.request().query(query);
        } catch (err) {
            console.warn(`⚠️ [Schema] ${description} skipped:`, err.message);
        }
    };

    // 1. Cập nhật các cột hiện có (Dùng try-catch riêng cho từng lệnh)
    await runQuery("ALTER TABLE posts ALTER COLUMN image NVARCHAR(MAX)", "Update posts.image");
    await runQuery("ALTER TABLE clubs ALTER COLUMN logo_url NVARCHAR(MAX)", "Update clubs.logo_url");
    await runQuery("ALTER TABLE clubs ALTER COLUMN cover_url NVARCHAR(MAX)", "Update clubs.cover_url");
    await runQuery("ALTER TABLE events ALTER COLUMN club_id INT NULL", "Update events.club_id");
    
    // 1.1 Tạo bảng Roles và đồng bộ hóa cột role của Users
    await runQuery(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'roles')
        BEGIN
            CREATE TABLE roles (
                id INT IDENTITY(1,1) PRIMARY KEY,
                role NVARCHAR(50) NOT NULL UNIQUE
            );
            INSERT INTO roles (role) VALUES ('university'), ('leader'), ('student');
        END
    `, "Create/Update roles table");

    // 2. Thêm các cột mới (Dùng IF NOT EXISTS để an toàn)
    await runQuery(`
        IF EXISTS (SELECT * FROM sys.tables WHERE name = 'posts')
        AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'user_id')
            ALTER TABLE posts ADD user_id INT FOREIGN KEY REFERENCES users(id);
    `, "Add posts.user_id");

    await runQuery(`
        IF EXISTS (SELECT * FROM sys.tables WHERE name = 'join_requests')
        AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('join_requests') AND name = 'reason')
            ALTER TABLE join_requests ADD reason NVARCHAR(MAX);
    `, "Add join_requests.reason");

    await runQuery(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'status')
            ALTER TABLE users ADD status NVARCHAR(50) DEFAULT 'active';
    `, "Add users.status");

    await runQuery(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'training_points')
            ALTER TABLE users ADD training_points INT DEFAULT 0;
    `, "Add users.training_points");

    await runQuery(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'created_at')
            ALTER TABLE users ADD created_at DATETIME DEFAULT GETDATE();
    `, "Add users.created_at");

    await runQuery("UPDATE users SET created_at = GETDATE() WHERE created_at IS NULL", "Update users.created_at data");

    await runQuery(`
        IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Users_Roles')
        AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'role')
        AND EXISTS (SELECT * FROM sys.tables WHERE name = 'roles')
        BEGIN
            -- Đảm bảo dữ liệu trong users.role hợp lệ trước khi tạo constraint
            UPDATE users SET role = 'student' WHERE role NOT IN (SELECT role FROM roles);
            ALTER TABLE users ADD CONSTRAINT FK_Users_Roles FOREIGN KEY (role) REFERENCES roles(role);
        END
    `, "Add FK_Users_Roles constraint");

    await runQuery(`
        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'event_registrations' AND COLUMN_NAME = 'attendance' AND DATA_TYPE = 'bit')
        BEGIN
            DECLARE @ConstraintName nvarchar(200)
            SELECT @ConstraintName = Name FROM sys.default_constraints
            WHERE parent_object_id = OBJECT_ID('event_registrations')
            AND parent_column_id = (SELECT column_id FROM sys.columns WHERE name = 'attendance' AND object_id = OBJECT_ID('event_registrations'))
            
            IF @ConstraintName IS NOT NULL
                EXEC('ALTER TABLE event_registrations DROP CONSTRAINT ' + @ConstraintName)
                
            ALTER TABLE event_registrations DROP COLUMN attendance
            ALTER TABLE event_registrations ADD attendance NVARCHAR(50) DEFAULT 'registered'
        END
        ELSE IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_registrations') AND name = 'attendance')
        BEGIN
            ALTER TABLE event_registrations ADD attendance NVARCHAR(50) DEFAULT 'registered'
        END
    `, "Fix/Add event_registrations.attendance");

    // 3. Tạo các bảng mới nếu chưa có
    await runQuery(`
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('support_requests') AND type in (N'U'))
        BEGIN
            CREATE TABLE support_requests (
                id INT PRIMARY KEY IDENTITY(1,1),
                user_id INT FOREIGN KEY REFERENCES users(id),
                category NVARCHAR(100),
                subject NVARCHAR(255),
                message NVARCHAR(MAX),
                status NVARCHAR(50) DEFAULT 'pending',
                reply_message NVARCHAR(MAX),
                replied_by INT FOREIGN KEY REFERENCES users(id),
                replied_at DATETIME,
                created_at DATETIME DEFAULT GETDATE()
            );
        END
    `, "Create support_requests");

    await runQuery(`
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('training_point_history') AND type in (N'U'))
        BEGIN
            CREATE TABLE training_point_history (
                id INT PRIMARY KEY IDENTITY(1,1),
                user_id INT FOREIGN KEY REFERENCES users(id),
                points INT,
                reason NVARCHAR(MAX),
                created_at DATETIME DEFAULT GETDATE(),
                created_by INT
            );
        END
    `, "Create training_point_history");

    await runQuery(`
        IF EXISTS (SELECT * FROM sys.tables WHERE name = 'event_comments')
        AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('event_comments') AND name = 'parent_id')
            ALTER TABLE event_comments ADD parent_id INT FOREIGN KEY REFERENCES event_comments(id);
    `, "Add event_comments.parent_id");

    console.log("✅ Schema check completed.");
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
