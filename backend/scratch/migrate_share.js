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

async function migrate() {
    try {
        const pool = await sql.connect(config);
        console.log("Connected to DB");
        
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'shared_post_id')
            BEGIN
                ALTER TABLE posts ADD shared_post_id INT NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'shared_event_id')
            BEGIN
                ALTER TABLE posts ADD shared_event_id INT NULL;
            END
        `);
        
        console.log("Migration successful: Added shared_post_id and shared_event_id to posts table.");
        process.exit(0);
    } catch (err) {
        console.error("Migration Error:", err);
        process.exit(1);
    }
}

migrate();
