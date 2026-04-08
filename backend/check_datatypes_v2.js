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
        let res = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users'");
        console.log("--- DATA TYPES ---");
        res.recordset.forEach(r => {
            console.log(`${r.COLUMN_NAME}: ${r.DATA_TYPE}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
