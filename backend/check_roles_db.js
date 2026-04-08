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
        
        console.log("ROLES COLUMNS:");
        let rCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'roles'");
        console.log(rCols.recordset.map(r => r.COLUMN_NAME));
        
        console.log("\nUSER_ROLES COLUMNS:");
        let urCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_roles'");
        console.log(urCols.recordset.map(r => r.COLUMN_NAME));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
