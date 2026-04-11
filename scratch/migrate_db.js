const sql = require('mssql');
require('dotenv').config({ path: './backend/.env' });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function migrate() {
    try {
        let pool = await sql.connect(config);
        console.log("Connected to DB...");
        
        await pool.request().query("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('join_requests') AND name = 'reason') ALTER TABLE join_requests ADD reason NVARCHAR(MAX)");
        
        console.log("Migration successful: Column 'reason' added to 'join_requests'");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
