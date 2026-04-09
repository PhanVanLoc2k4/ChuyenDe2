        } catch (errN) { console.error(errN); }

        res.json({ message: "Bình luận thành công!" });
    } catch (err) { res.status(500).json({ message: "Lỗi bình luận sự kiện" }); }
});

app.get("/api/events/:id/comments", ensureDB, async (req, res) => {
    try {
        const result = await pool.request()
            .input("eid", sql.Int, req.params.id)
            .query(`
                SELECT c.id, c.content, c.created_at, u.full_name as author_name, u.avatar as author_avatar
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.event_id = @eid
                ORDER BY c.created_at DESC
            `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "Lỗi tải bình luận" }); }
});

// --- Utility: Create Notification ---
async function createNotification(userId, title, message, type, link = "") {
    try {
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
        console.log(`✅ Notification created successfully for User ${uId}`);
    } catch (err) { 
        console.error(`❌ Error creating notification for User ${userId}:`, err.message); 
    }
}

// 11. API Quản lý thông báo
app.get("/api/notifications/:userId", ensureDB, async (req, res) => {
    try {
        const result = await pool.request()
            .input("uid", sql.Int, req.params.userId)
            .query("SELECT * FROM notifications WHERE user_id = @uid ORDER BY created_at DESC");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "Lỗi lấy thông báo" }); }
});

app.put("/api/notifications/read/:id", ensureDB, async (req, res) => {
    try {
        await pool.request()
            .input("id", sql.Int, req.params.id)
            .query("UPDATE notifications SET is_read = 1 WHERE id = @id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Lỗi cập nhật thông báo" }); }
});

app.put("/api/notifications/read-all/:userId", ensureDB, async (req, res) => {
    try {
        await pool.request()
            .input("uid", sql.Int, req.params.userId)
            .query("UPDATE notifications SET is_read = 1 WHERE user_id = @uid");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Lỗi cập nhật tất cả thông báo" }); }
});

// --- Error Handling for Stability ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception thrown:', err);
});

// ================= START SERVER =================
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running V2: http://localhost:${PORT}`);
    console.log(`✅ Server stabilized - Diagnostics Active (v3.12 Hotfix)`);
});
