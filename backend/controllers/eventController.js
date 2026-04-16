const { getPool, sql } = require("../config/database");
const { createNotification } = require("../services/notificationService");

// 1. Lấy danh sách sự kiện
const getAllEvents = async (req, res) => {
    const clubId = req.query.club_id;
    const userId = req.query.user_id;
    const pool = getPool();
    try {
        const request = pool.request();
        let query = `
            SELECT e.id, e.event_name, e.description, e.location, e.start_time, e.end_time, e.image, 
                   e.likes, e.views, e.comments,
                   (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) as participant_count,
                   c.club_name, c.id as club_id,
                   (CASE WHEN EXISTS (
                       SELECT 1 FROM user_roles ur 
                       JOIN roles r ON ur.role_id = r.id 
                       WHERE ur.user_id = e.created_by AND r.role_name = 'admin'
                   ) THEN 1 ELSE 0 END) as is_admin_event
        `;
        if (userId) {
            query += `, (CASE WHEN EXISTS (SELECT 1 FROM event_registrations er WHERE er.event_id = e.id AND er.user_id = @uid) THEN 1 ELSE 0 END) as is_registered `;
            query += `, (CASE WHEN EXISTS (SELECT 1 FROM event_likes el WHERE el.event_id = e.id AND el.user_id = @uid) THEN 1 ELSE 0 END) as user_liked `;
            request.input("uid", sql.Int, userId);
        } else {
            query += `, 0 as is_registered, 0 as user_liked `;
        }
        
        query += ` FROM events e LEFT JOIN clubs c ON e.club_id = c.id `;
        
        if (clubId) {
            query += ` WHERE e.club_id = @cid`;
            request.input("cid", sql.Int, clubId);
        }
        query += ` ORDER BY is_admin_event DESC, e.created_at DESC`;
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
};

// 2. Tạo sự kiện mới
const createEvent = async (req, res) => {
    console.log("[POST /api/events] Body:", req.body);
    let { event_name, description, location, start_time, end_time, club_id, created_by, image } = req.body;
    
    // Fix FK Violation: Convert 0 or empty strings to null for School Events
    if (club_id === 0 || club_id === "0" || club_id === "" || club_id === undefined) {
        club_id = null;
    }

    console.log(`[POST /api/events] Received event: "${event_name}" for Club ID: ${club_id}`);
    
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("name", sql.NVarChar, event_name)
            .input("desc", sql.NVarChar, description)
            .input("loc", sql.NVarChar, location)
            .input("st", sql.DateTime, start_time)
            .input("et", sql.DateTime, end_time)
            .input("cid", sql.Int, club_id)
            .input("uid", sql.Int, created_by)
            .input("img", sql.NVarChar(sql.MAX), image)
            .query(`INSERT INTO events (event_name, description, location, start_time, end_time, club_id, created_by, created_at, image, status) 
                    OUTPUT INSERTED.id
                    VALUES (@name, @desc, @loc, @st, @et, @cid, @uid, GETDATE(), @img, 'active')`);
        
        const eventId = result.recordset[0].id;

        // Gửi thông báo (chỉ nếu có club_id)
        try {
            if (club_id) {
                const clubRes = await pool.request().input("cid", sql.Int, club_id).query("SELECT club_name, created_by FROM clubs WHERE id = @cid");
                const clubData = clubRes.recordset[0];
                const clubName = clubData?.club_name || "CLB";
                const creatorId = clubData?.created_by;
                
                const members = await pool.request().input("cid", sql.Int, club_id).query("SELECT user_id FROM club_members WHERE club_id = @cid AND status = 'active'");
                
                const recipientIds = new Set(members.recordset.map(m => m.user_id));
                if (creatorId && creatorId !== parseInt(created_by)) recipientIds.add(creatorId);

                for (const rid of recipientIds) {
                    if (rid !== parseInt(created_by)) {
                        await createNotification(rid, "Sự kiện mới!", `"${clubName}" vừa tạo sự kiện mới: ${event_name}`, "event", `/DienDan?id=${club_id}`);
                    }
                }
            } else {
                // Đây là sự kiện của Trường (không CLB) -> Thông báo toàn hệ thống (Chạy ngầm để không block phản hồi API)
                const allUsers = await pool.request().query("SELECT id FROM users WHERE status = 'active' OR status IS NULL");
                const userCount = allUsers.recordset.length;
                console.log(`📢 [BROADCAST] Found ${userCount} active users to notify about school event.`);

                // Chạy ngầm tiến trình gửi để không block res.json
                setImmediate(async () => {
                    for (const u of allUsers.recordset) {
                        try {
                            if (Number(u.id) !== Number(created_by)) {
                                await createNotification(u.id, "Thông báo Nhà trường", `Trường vừa tạo sự kiện mới: ${event_name}`, "event", `/TinTuc?eventId=${eventId}`);
                            }
                        } catch (e) { console.error(`Failed to notify user ${u.id}:`, e); }
                    }
                    console.log(`✅ [BROADCAST] Finished notifying all users.`);
                });
            }
        } catch (notifErr) { console.error("Lỗi gửi thông báo sự kiện:", notifErr); }

        res.json({ message: "Tạo sự kiện thành công!", eventId });
    } catch (err) { 
        console.error("Lỗi POST Event:", err);
        res.status(500).json({ message: "Lỗi tạo sự kiện" }); 
    }
};

// 3. Lấy chi tiết sự kiện
const getEventDetail = async (req, res) => {
    const userId = req.query.user_id;
    const pool = getPool();
    try {
        const request = pool.request();
        request.input("id", sql.Int, req.params.id);
        
        let query = `
            SELECT e.*, c.club_name, u.full_name as creator_name,
                   (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) as participant_count
        `;
        
        if (userId) {
            query += `, (CASE WHEN EXISTS (SELECT 1 FROM event_registrations er WHERE er.event_id = e.id AND er.user_id = @uid) THEN 1 ELSE 0 END) as is_registered `;
            query += `, (CASE WHEN EXISTS (SELECT 1 FROM event_likes el WHERE el.event_id = e.id AND el.user_id = @uid) THEN 1 ELSE 0 END) as user_liked `;
            request.input("uid", sql.Int, userId);
        } else {
            query += `, 0 as is_registered, 0 as user_liked `;
        }

        query += `
            FROM events e
            LEFT JOIN clubs c ON e.club_id = c.id
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.id = @id
        `;
        
        const result = await request.query(query);
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ message: "Không tìm thấy sự kiện" });
        }
    } catch (err) { res.status(500).json({ message: "Lỗi lấy chi tiết sự kiện" }); }
};

// 4. Đăng ký tham gia sự kiện
const registerEvent = async (req, res) => {
    const { event_id, user_id } = req.body;
    const pool = getPool();
    try {
        const check = await pool.request()
            .input("e", sql.Int, event_id)
            .input("u", sql.Int, user_id)
            .query("SELECT id FROM event_registrations WHERE event_id = @e AND user_id = @u");
        
        if (check.recordset.length > 0) return res.status(400).json({ message: "Bạn đã đăng ký sự kiện này rồi!" });
        
        await pool.request()
            .input("e", sql.Int, event_id)
            .input("u", sql.Int, user_id)
            .query("INSERT INTO event_registrations (event_id, user_id, status, registered_at) VALUES (@e, @u, 'pending', GETDATE())");
        res.json({ message: "Đăng ký sự kiện thành công! Vui lòng chờ duyệt." });
    } catch (err) { res.status(500).json({ message: "Lỗi đăng ký sự kiện" }); }
};

// 5. Hủy đăng ký sự kiện
const unregisterEvent = async (req, res) => {
    const { event_id, user_id } = req.body;
    const pool = getPool();
    try {
        await pool.request()
            .input("e", sql.Int, event_id)
            .input("u", sql.Int, user_id)
            .query("DELETE FROM event_registrations WHERE event_id = @e AND user_id = @u");
        res.json({ message: "Đã hủy đăng ký tham gia sự kiện." });
    } catch (err) { res.status(500).json({ message: "Lỗi hủy đăng ký" }); }
};

// 6. Like sự kiện
const likeEvent = async (req, res) => {
    const { user_id } = req.body;
    const event_id = req.params.id;
    const pool = getPool();
    
    if (!user_id) return res.status(401).json({ message: "Vui lòng đăng nhập" });

    try {
        const check = await pool.request()
            .input("eid", sql.Int, event_id)
            .input("uid", sql.Int, user_id)
            .query("SELECT id FROM event_likes WHERE event_id = @eid AND user_id = @uid");

        if (check.recordset.length > 0) {
            await pool.request()
                .input("eid", sql.Int, event_id)
                .input("uid", sql.Int, user_id)
                .query("DELETE FROM event_likes WHERE event_id = @eid AND user_id = @uid");
            await pool.request().input("id", sql.Int, event_id).query(`UPDATE events SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END WHERE id = @id`);
            return res.json({ success: true, liked: false });
        } else {
            await pool.request()
                .input("eid", sql.Int, event_id)
                .input("uid", sql.Int, user_id)
                .query("INSERT INTO event_likes (event_id, user_id) VALUES (@eid, @uid)");
            await pool.request().input("id", sql.Int, event_id).query(`UPDATE events SET likes = likes + 1 WHERE id = @id`);
            return res.json({ success: true, liked: true });
        }
    } catch (err) { 
        res.status(500).json({ message: "Like error" }); 
    }
};

// 7. Lấy danh sách đăng ký
const getEventRegistrations = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("eid", sql.Int, req.params.id)
            .query(`
                SELECT u.id, u.full_name, u.email, er.registered_at, er.status, er.attendance, er.id as registration_id
                FROM event_registrations er
                JOIN users u ON er.user_id = u.id
                WHERE er.event_id = @eid
                ORDER BY er.registered_at DESC
            `);
        res.json(result.recordset);
    } catch(err) {
        res.status(500).json({message: "Lỗi lấy danh sách đăng ký"});
    }
};

// 8. Cập nhật sự kiện
const updateEvent = async (req, res) => {
    console.log("[PUT /api/events] Body:", req.body);
    const { event_name, description, location, start_time, end_time, image, user_id } = req.body;
    const event_id = req.params.id;

    console.log(`[PUT /api/events/${event_id}] Update request from User: ${user_id}`);

    const pool = getPool();
    try {
        const check = await pool.request().input("id", sql.Int, event_id).query("SELECT created_by FROM events WHERE id = @id");
        if (check.recordset.length === 0) return res.status(404).json({ message: "Không tìm thấy sự kiện" });

        const roleCheck = await pool.request()
            .input("uid", sql.Int, user_id)
            .query("SELECT r.role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = @uid");
        const isAdmin = roleCheck.recordset.some(r => r.role_name === 'admin');

        if (Number(check.recordset[0].created_by) !== Number(user_id) && !isAdmin) {
            return res.status(403).json({ message: "Bạn không có quyền sửa sự kiện này" });
        }

        await pool.request()
            .input("id", sql.Int, event_id)
            .input("name", sql.NVarChar, event_name)
            .input("desc", sql.NVarChar, description)
            .input("loc", sql.NVarChar, location)
            .input("st", sql.DateTime, start_time)
            .input("et", sql.DateTime, end_time)
            .input("img", sql.NVarChar(sql.MAX), image)
            .query(`UPDATE events SET event_name = @name, description = @desc, location = @loc, 
                    start_time = @st, end_time = @et, image = @img WHERE id = @id`);
        
        // Thêm thông báo nếu là sự kiện Nhà trường (club_id IS NULL)
        const eventData = check.recordset[0];
        if (!eventData.club_id) {
            const allUsers = await pool.request().query("SELECT id FROM users WHERE status = 'active' OR status IS NULL");
            setImmediate(async () => {
                for (const u of allUsers.recordset) {
                    if (Number(u.id) !== Number(user_id)) {
                        await createNotification(u.id, "Cập nhật Nhà trường", `Sự kiện "${event_name}" vừa được cập nhật thông tin mới.`, "event", `/TinTuc?eventId=${event_id}`);
                    }
                }
            });
        }

        res.json({ message: "Cập nhật sự kiện thành công!" });
    } catch (err) { res.status(500).json({ message: "Lỗi cập nhật sự kiện" }); }
};

// 9. Xóa sự kiện
const deleteEvent = async (req, res) => {
    const event_id = req.params.id;
    const user_id = req.query.user_id;
    const pool = getPool();
    try {
        const check = await pool.request().input("id", sql.Int, event_id).query("SELECT created_by, club_id FROM events WHERE id = @id");
        if (check.recordset.length === 0) return res.status(404).json({ message: "Không tìm thấy sự kiện" });

        const event = check.recordset[0];
        
        const clubCheck = await pool.request().input("cid", sql.Int, event.club_id).query("SELECT created_by FROM clubs WHERE id = @cid");
        const roleCheck = await pool.request()
            .input("uid", sql.Int, user_id)
            .query("SELECT r.role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = @uid");
            
        const isAdmin = roleCheck.recordset.some(r => r.role_name === 'admin');
        const isLeader = clubCheck.recordset.length > 0 && Number(clubCheck.recordset[0].created_by) === Number(user_id);
        const isAuthor = Number(event.created_by) === Number(user_id);

        if (!isAuthor && !isLeader && !isAdmin) {
            return res.status(403).json({ message: "Bạn không có quyền xóa sự kiện này" });
        }

        // Xóa các lượt đăng ký, like, comment trước
        await pool.request().input("eid", sql.Int, event_id).query("DELETE FROM event_registrations WHERE event_id = @eid");
        await pool.request().input("eid", sql.Int, event_id).query("DELETE FROM event_likes WHERE event_id = @eid");
        // (Nếu có bảng event_comments thì xóa ở đây)

        await pool.request().input("id", sql.Int, event_id).query("DELETE FROM events WHERE id = @id");
        res.json({ message: "Xóa sự kiện thành công" });
    } catch (err) { res.status(500).json({ message: "Lỗi xóa sự kiện" }); }
};

// 10. Lấy bình luận sự kiện
const getEventComments = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("eid", sql.Int, req.params.id)
            .query(`
                SELECT ec.id, ec.content, ec.created_at, ec.parent_id, u.full_name as author_name, u.avatar as author_avatar
                FROM event_comments ec
                LEFT JOIN users u ON ec.user_id = u.id
                WHERE ec.event_id = @eid
                ORDER BY ec.created_at ASC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Lỗi getEventComments:", err);
        res.status(500).json({ message: "Lỗi load bình luận sự kiện" });
    }
};

// 11. Đăng bình luận sự kiện
const createEventComment = async (req, res) => {
    const { user_id, content, parent_id } = req.body;
    const event_id = req.params.id;
    const pool = getPool();
    try {
        await pool.request()
            .input("eid", sql.Int, event_id)
            .input("uid", sql.Int, user_id)
            .input("content", sql.NVarChar, content)
            .input("parent", sql.Int, parent_id || null)
            .query(`INSERT INTO event_comments (event_id, user_id, content, created_at, parent_id) 
                    VALUES (@eid, @uid, @content, GETDATE(), @parent)`);
        
        await pool.request()
            .input("eid", sql.Int, event_id)
            .query("UPDATE events SET comments = comments + 1 WHERE id = @eid");
            
        res.json({ message: "Bình luận thành công!" });
    } catch (err) {
        console.error("Lỗi createEventComment:", err);
        res.status(500).json({ message: "Lỗi đăng bình luận sự kiện" });
    }
};

module.exports = {
    getAllEvents,
    createEvent,
    getEventDetail,
    registerEvent,
    unregisterEvent,
    likeEvent,
    getEventRegistrations,
    updateEvent,
    deleteEvent,
    getEventComments,
    createEventComment
};
