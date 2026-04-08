const sql = require('mssql');
const config = {
    user: "sa",
    password: "123",
    server: "localhost",
    database: "NentangCLB",
    port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
};

async function check() {
    try {
        let pool = await sql.connect(config);
        console.log("USERS COLUMNS:");
        let res = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users'");
        console.log(res.recordset.map(r => r.COLUMN_NAME));
        
        console.log("\nROLES TABLE EXISTS?");
        let roles = await pool.request().query("SELECT * FROM sys.tables WHERE name = 'roles'");
        console.log(roles.recordset.length > 0 ? "YES" : "NO");

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
