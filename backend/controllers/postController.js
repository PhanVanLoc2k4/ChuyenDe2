const { getPool, sql } = require("../config/database");
const { createNotification } = require("../services/notificationService");

// 1. Lấy danh sách bài viết
const getAllPosts = async (req, res) => {
    const club = req.query.club;
    const club_id = req.query.club_id;
    const search = req.query.search;
    const user_id = req.query.user_id;
    const pool = getPool();
    try {
        const request = pool.request();
        if (user_id) {
            request.input("current_uid", sql.Int, user_id);
        }

        let query = `
            SELECT p.id, p.title, p.content, p.image, p.likes, p.views, p.comments, p.type, p.created_at, p.user_id,
                   p.shared_post_id, p.shared_event_id,
                   c.id AS club_id, c.club_name, c.club_code,
                   u.full_name as author_name, u.avatar as author_avatar,
                   -- Thông tin bài viết gốc (nếu là share bài viết)
                   origP.content as orig_post_content, origP.image as orig_post_image,
                   origU.full_name as orig_post_author, origU.avatar as orig_post_author_avatar,
                   -- Thông tin sự kiện gốc (nếu là share sự kiện)
                   origE.event_name as orig_event_name, origE.description as orig_event_desc, origE.image as orig_event_image,
                   origEC.club_name as orig_event_club
                   ${user_id ? ", CASE WHEN EXISTS (SELECT 1 FROM likes l WHERE l.likeable_id = p.id AND l.likeable_type = 'post' AND l.user_id = @current_uid) THEN 1 ELSE 0 END as user_liked" : ""}
            FROM posts p 
            LEFT JOIN clubs c ON p.club_id = c.id
            LEFT JOIN users u ON p.user_id = u.id
            -- Join lấy bài viết gốc
            LEFT JOIN posts origP ON p.shared_post_id = origP.id
            LEFT JOIN users origU ON origP.user_id = origU.id
            -- Join lấy sự kiện gốc
            LEFT JOIN events origE ON p.shared_event_id = origE.id
            LEFT JOIN clubs origEC ON origE.club_id = origEC.id
        `;
        let conditions = [];
        if (club && club !== "all") {
            conditions.push(`c.club_code = @club`);
            request.input("club", sql.VarChar, club);
        }
        if (club_id) {
            conditions.push(`p.club_id = @cid`);
            request.input("cid", sql.Int, club_id);
        }
        if (search) {
            conditions.push(`(p.title LIKE @search OR p.content LIKE @search)`);
            request.input("search", sql.NVarChar, `%${search}%`);
        }
        
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        
        query += ` ORDER BY p.created_at DESC`;
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi load posts" });
    }
};

// 2. Đăng bài viết mới
const createPost = async (req, res) => {
    console.log("[POST /api/posts] Body:", req.body);
    const { title, content, type, club_id, user_id, image } = req.body;
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("t", sql.NVarChar, title)
            .input("c", sql.NVarChar, content)
            .input("ty", sql.NVarChar, type)
            .input("cid", sql.Int, club_id)
            .input("uid", sql.Int, user_id)
            .input("img", sql.NVarChar(sql.MAX), image)
            .query(`INSERT INTO posts (title, content, type, club_id, user_id, created_at, likes, views, comments, image) 
                    OUTPUT INSERTED.id
                    VALUES (@t, @c, @ty, @cid, @uid, GETDATE(), 0, 0, 0, @img)`);
        
        const postId = result.recordset[0].id;

        // Gửi thông báo
        if (club_id && !isNaN(parseInt(club_id))) {
            try {
                const clubRes = await pool.request().input("cid", sql.Int, parseInt(club_id)).query("SELECT club_name, created_by FROM clubs WHERE id = @cid");
                const clubData = clubRes.recordset[0];
                if (clubData) {
                    const clubName = clubData.club_name || "CLB";
                    const creatorId = clubData.created_by;
                    const members = await pool.request().input("cid", sql.Int, parseInt(club_id)).query("SELECT user_id FROM club_members WHERE club_id = @cid AND status = 'active'");
                    const recipientIds = new Set(members.recordset.map(m => m.user_id));
                    if (creatorId && parseInt(creatorId) !== parseInt(user_id)) recipientIds.add(parseInt(creatorId));

                    for (const rid of recipientIds) {
                        if (rid !== parseInt(user_id)) {
                            await createNotification(rid, "Bài viết mới!", `"${clubName}" vừa có bài viết mới: ${title}`, "post", `/DienDan?id=${club_id}&postId=${postId}`);
                        }
                    }
                }
            } catch (notifErr) { console.error("Lỗi gửi thông báo bài viết:", notifErr); }
        } else {
            // Bài đăng công khai (Nhà trường) -> Thông báo toàn hệ thống (Chạy ngầm)
            try {
                const allUsers = await pool.request().query("SELECT id FROM users WHERE status = 'active' OR status IS NULL");
                const userCount = allUsers.recordset.length;
                console.log(`📢 [BROADCAST] Found ${userCount} active users to notify about public post.`);

                setImmediate(async () => {
                    for (const u of allUsers.recordset) {
                        try {
                            if (Number(u.id) !== Number(user_id)) {
                                await createNotification(u.id, "Thông báo Nhà trường", `Nhà trường vừa đăng tin mới: ${title}`, "post", `/TinTuc?postId=${postId}`);
                            }
                        } catch (e) { console.error(`Failed to notify user ${u.id}:`, e); }
                    }
                    console.log(`✅ [BROADCAST] Finished notifying all users for post.`);
                });
            } catch (notifErr) { console.error("Lỗi chuẩn bị thông báo tin tức:", notifErr); }
        }

        res.json({ message: "Đăng bài thành công!", postId });
    } catch (err) { res.status(500).json({ message: "Lỗi đăng bài" }); }
};

// 2.1 Chia sẻ bài viết/sự kiện (Tạo bài đăng mới trỏ tới bài gốc)
const createShare = async (req, res) => {
    const { content, user_id, shared_post_id, shared_event_id, club_id } = req.body;
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("c", sql.NVarChar, content)
            .input("uid", sql.Int, user_id)
            .input("spid", sql.Int, shared_post_id || null)
            .input("seid", sql.Int, shared_event_id || null)
            .input("cid", sql.Int, club_id || null)
            .query(`INSERT INTO posts (title, content, type, user_id, shared_post_id, shared_event_id, club_id, created_at, likes, views, comments) 
                    OUTPUT INSERTED.id
                    VALUES (N'Đã chia sẻ', @c, N'Chia sẻ', @uid, @spid, @seid, @cid, GETDATE(), 0, 0, 0)`);
        
        const postId = result.recordset[0].id;
        res.json({ message: "Chia sẻ thành công!", postId });
    } catch (err) {
        console.error("Lỗi chia sẻ:", err);
        res.status(500).json({ message: "Lỗi khi thực hiện chia sẻ" });
    }
};

// 3. Like bài viết
const likePost = async (req, res) => {
    const { user_id } = req.body;
    const post_id = req.params.id;
    const pool = getPool();
    
    if (!user_id) return res.status(401).json({ message: "Vui lòng đăng nhập" });

    try {
        const check = await pool.request()
            .input("pid", sql.Int, post_id)
            .input("uid", sql.Int, user_id)
            .query("SELECT id FROM likes WHERE likeable_id = @pid AND likeable_type = 'post' AND user_id = @uid");

        if (check.recordset.length > 0) {
            await pool.request()
                .input("pid", sql.Int, post_id)
                .input("uid", sql.Int, user_id)
                .query("DELETE FROM likes WHERE likeable_id = @pid AND likeable_type = 'post' AND user_id = @uid");
            await pool.request().input("id", sql.Int, post_id).query(`UPDATE posts SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END WHERE id = @id`);
            return res.json({ success: true, liked: false });
        } else {
            await pool.request()
                .input("pid", sql.Int, post_id)
                .input("uid", sql.Int, user_id)
                .query("INSERT INTO likes (likeable_id, likeable_type, user_id) VALUES (@pid, 'post', @uid)");
            await pool.request().input("id", sql.Int, post_id).query(`UPDATE posts SET likes = likes + 1 WHERE id = @id`);
            return res.json({ success: true, liked: true });
        }
    } catch (err) { 
        res.status(500).json({ message: "Like error" }); 
    }
};

// 4. Lấy bình luận
const getPostComments = async (req, res) => {
    const pool = getPool();
    try {
        const result = await pool.request()
            .input("pid", sql.Int, req.params.postId)
            .query(`
                SELECT c.id, c.user_id, c.content, c.created_at, c.parent_id, u.full_name as author_name, u.avatar as author_avatar
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.commentable_id = @pid AND c.commentable_type = 'post'
                ORDER BY c.created_at ASC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi load comments" });
    }
};

// 5. Bình luận bài viết
const createComment = async (req, res) => {
    const { user_id, content, parent_id } = req.body;
    const post_id = req.params.postId;
    const pool = getPool();
    try {
        await pool.request()
            .input("pid", sql.Int, post_id)
            .input("uid", sql.Int, user_id)
            .input("content", sql.NVarChar, content)
            .input("parent", sql.Int, parent_id || null)
            .query(`INSERT INTO comments (commentable_id, commentable_type, user_id, content, created_at, parent_id) 
                    VALUES (@pid, 'post', @uid, @content, GETDATE(), @parent)`);
        
        await pool.request()
            .input("pid", sql.Int, post_id)
            .query("UPDATE posts SET comments = comments + 1 WHERE id = @pid");
            
        res.json({ message: "Bình luận thành công!" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi đăng bình luận" });
    }
};

// 6. Cập nhật bài viết
const updatePost = async (req, res) => {
    console.log("[PUT /api/posts] Body:", req.body);
    const { title, content, type, image, user_id } = req.body;
    const post_id = req.params.id;
    const pool = getPool();
    try {
        // Kiểm tra quyền (Tác giả bài viết hoặc Admin)
        const check = await pool.request().input("id", sql.Int, post_id).query("SELECT user_id, club_id FROM posts WHERE id = @id");
        if (check.recordset.length === 0) return res.status(404).json({ message: "Không tìm thấy bài viết" });
        
        const userQuery = await pool.request().input("uid", sql.Int, user_id).query("SELECT role FROM users WHERE id = @uid");
        const userRole = (userQuery.recordset[0]?.role || '').toLowerCase();
        const isUniversity = userRole === 'university';

        if (Number(check.recordset[0].user_id) !== Number(user_id) && !isUniversity) {
            return res.status(403).json({ message: "Bạn không có quyền sửa bài viết này" });
        }

        await pool.request()
            .input("id", sql.Int, post_id)
            .input("t", sql.NVarChar, title)
            .input("c", sql.NVarChar, content)
            .input("ty", sql.NVarChar, type)
            .input("img", sql.NVarChar(sql.MAX), image)
            .query("UPDATE posts SET title = @t, content = @c, type = @ty, image = @img WHERE id = @id");
        
        // Thông báo nếu là tin tức Nhà trường (club_id IS NULL)
        const postData = check.recordset[0];
        if (!postData.club_id) {
            const allUsers = await pool.request().query("SELECT id FROM users WHERE status = 'active' OR status IS NULL");
            setImmediate(async () => {
                for (const u of allUsers.recordset) {
                    if (Number(u.id) !== Number(user_id)) {
                         await createNotification(u.id, "Cập nhật Nhà trường", `Tin tức "${title}" vừa có nội dung mới.`, "post", `/TinTuc?postId=${post_id}`);
                    }
                }
            });
        }

        res.json({ message: "Cập nhật thành công!" });
    } catch (err) { res.status(500).json({ message: "Lỗi cập nhật bài viết" }); }
};

// 7. Xóa bài viết
const deletePost = async (req, res) => {
    const post_id = req.params.id;
    const user_id = req.query.user_id;
    const pool = getPool();
    try {
        const check = await pool.request().input("id", sql.Int, post_id).query("SELECT user_id, club_id FROM posts WHERE id = @id");
        if (check.recordset.length === 0) return res.status(404).json({ message: "Không tìm thấy bài viết" });

        const post = check.recordset[0];
        const club_id = post.club_id;

        // Lấy thông tin chủ CLB & Kiểm tra Quyền Nhà trường (University)
        const clubCheck = await pool.request().input("cid", sql.Int, club_id).query("SELECT created_by FROM clubs WHERE id = @cid");
        const userQuery = await pool.request().input("uid", sql.Int, user_id).query("SELECT role FROM users WHERE id = @uid");
        const userRole = (userQuery.recordset[0]?.role || '').toLowerCase();
            
        const isUniversity = userRole === 'university';
        const isLeader = clubCheck.recordset.length > 0 && Number(clubCheck.recordset[0].created_by) === Number(user_id);
        const isAuthor = Number(post.user_id) === Number(user_id);

        if (!isAuthor && !isLeader && !isUniversity) {
            return res.status(403).json({ message: "Bạn không có quyền xóa bài viết này" });
        }

        // Xóa bình luận và like trước
        await pool.request().input("pid", sql.Int, post_id).query("DELETE FROM comments WHERE commentable_id = @pid AND commentable_type = 'post'");
        await pool.request().input("pid", sql.Int, post_id).query("DELETE FROM likes WHERE likeable_id = @pid AND likeable_type = 'post'");
        
        // Cuối cùng xóa bài viết
        await pool.request().input("id", sql.Int, post_id).query("DELETE FROM posts WHERE id = @id");
        
        res.json({ message: "Xóa bài viết thành công" });
    } catch (err) { res.status(500).json({ message: "Lỗi xóa bài viết" }); }
};

const deleteComment = async (req, res) => {
    const { commentId } = req.params;
    const pool = getPool();
    try {
        await pool.request()
            .input("id", sql.Int, commentId)
            .query("DELETE FROM comments WHERE id = @id OR parent_id = @id");
        res.json({ success: true, message: "Đã xóa bình luận!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Lỗi xóa bình luận" });
    }
};

module.exports = {
    getAllPosts,
    createPost,
    likePost,
    getPostComments,
    createComment,
    deleteComment,
    updatePost,
    deletePost,
    createShare
};
