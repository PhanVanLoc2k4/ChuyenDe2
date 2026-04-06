const sql = require('mssql');
const config = {
    user: "sa", password: "123", server: "localhost", database: "NentangCLB", port: 1433,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};
(async () => {
    try {
        const pool = await sql.connect(config);
        console.log("Connected. Altering events table column 'image' to NVARCHAR(MAX)...");
        await pool.request().query("ALTER TABLE events ALTER COLUMN image NVARCHAR(MAX)");
        console.log("Success!");
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
