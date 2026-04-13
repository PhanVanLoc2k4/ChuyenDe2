const { getPool, sql } = require("../config/database");

async function createNotification(userId, title, message, type, link = "") {
    try {
        const pool = getPool();
        const uId = parseInt(userId);
        if (isNaN(uId)) {
            console.error(`❌ Invalid userId passed to createNotification: ${userId}`);
            return;
        }
        console.log(`📝 Creating notification for User ${uId}: ${title}`);
        await pool.request()
            .input("u", sql.Int, uId)
            .input("t", sql.NVarChar, title)
            .input("m", sql.NVarChar, message)
            .input("tp", sql.NVarChar, type)
            .input("l", sql.NVarChar, link)
            .query("INSERT INTO notifications (user_id, title, message, type, link) VALUES (@u, @t, @m, @tp, @l)");
        
        // --- REAL-TIME: Gửi qua Socket ---
        const { sendToUser } = require("./socketService");
        const emitted = sendToUser(uId, "new_notification", { title, message, type, link, created_at: new Date() });
        
        if (emitted) {
            console.log(`✅ Socket emission successful for User ${uId}`);
        } else {
            console.log(`⚠️ User ${uId} not online. Notification stored in DB.`);
        }
    } catch (err) { 
        console.error(`❌ Error creating notification for User ${userId}:`, err.message); 
    }
}

module.exports = {
    createNotification
};
