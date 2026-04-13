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
                   c.id AS club_id, c.club_name, c.club_code,
                   u.full_name as author_name, u.avatar as author_avatar
                   ${user_id ? ", CASE WHEN EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = @current_uid) THEN 1 ELSE 0 END as user_liked" : ""}
            FROM posts p 
            LEFT JOIN clubs c ON p.club_id = c.id
            LEFT JOIN users u ON p.user_id = u.id
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
        }

        res.json({ message: "Đăng bài thành công!", postId });
    } catch (err) { res.status(500).json({ message: "Lỗi đăng bài" }); }
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
            .query("SELECT id FROM post_likes WHERE post_id = @pid AND user_id = @uid");

        if (check.recordset.length > 0) {
            await pool.request()
                .input("pid", sql.Int, post_id)
                .input("uid", sql.Int, user_id)
                .query("DELETE FROM post_likes WHERE post_id = @pid AND user_id = @uid");
            await pool.request().input("id", sql.Int, post_id).query(`UPDATE posts SET likes = likes - 1 WHERE id = @id`);
            return res.json({ success: true, liked: false });
        } else {
            await pool.request()
                .input("pid", sql.Int, post_id)
                .input("uid", sql.Int, user_id)
                .query("INSERT INTO post_likes (post_id, user_id) VALUES (@pid, @uid)");
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
                SELECT c.id, c.content, c.created_at, c.parent_id, u.full_name as author_name, u.avatar as author_avatar
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.post_id = @pid
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
            .query(`INSERT INTO comments (post_id, user_id, content, created_at, parent_id) VALUES (@pid, @uid, @content, GETDATE(), @parent)`);
        
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
    const { title, content, type, image, user_id } = req.body;
    const post_id = req.params.id;
    const pool = getPool();
    try {
        // Kiểm tra quyền (Tác giả bài viết hoặc Admin)
        const check = await pool.request().input("id", sql.Int, post_id).query("SELECT user_id FROM posts WHERE id = @id");
        if (check.recordset.length === 0) return res.status(404).json({ message: "Không tìm thấy bài viết" });
        
        const roleCheck = await pool.request()
            .input("uid", sql.Int, user_id)
            .query("SELECT r.role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = @uid");
        const isAdmin = roleCheck.recordset.some(r => r.role_name === 'admin');

        if (Number(check.recordset[0].user_id) !== Number(user_id) && !isAdmin) {
            return res.status(403).json({ message: "Bạn không có quyền sửa bài viết này" });
        }

        await pool.request()
            .input("id", sql.Int, post_id)
            .input("t", sql.NVarChar, title)
            .input("c", sql.NVarChar, content)
            .input("ty", sql.NVarChar, type)
            .input("img", sql.NVarChar(sql.MAX), image)
            .query("UPDATE posts SET title = @t, content = @c, type = @ty, image = @img WHERE id = @id");
        
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

        // Lấy thông tin chủ CLB & Kiểm tra Admin
        const clubCheck = await pool.request().input("cid", sql.Int, club_id).query("SELECT created_by FROM clubs WHERE id = @cid");
        const roleCheck = await pool.request()
            .input("uid", sql.Int, user_id)
            .query("SELECT r.role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = @uid");
            
        const isAdmin = roleCheck.recordset.some(r => r.role_name === 'admin');
        const isLeader = clubCheck.recordset.length > 0 && Number(clubCheck.recordset[0].created_by) === Number(user_id);
        const isAuthor = Number(post.user_id) === Number(user_id);

        if (!isAuthor && !isLeader && !isAdmin) {
            return res.status(403).json({ message: "Bạn không có quyền xóa bài viết này" });
        }

        // Xóa bình luận và like trước
        await pool.request().input("pid", sql.Int, post_id).query("DELETE FROM comments WHERE post_id = @pid");
        await pool.request().input("pid", sql.Int, post_id).query("DELETE FROM post_likes WHERE post_id = @pid");
        
        // Cuối cùng xóa bài viết
        await pool.request().input("id", sql.Int, post_id).query("DELETE FROM posts WHERE id = @id");
        
        res.json({ message: "Xóa bài viết thành công" });
    } catch (err) { res.status(500).json({ message: "Lỗi xóa bài viết" }); }
};

module.exports = {
    getAllPosts,
    createPost,
    likePost,
    getPostComments,
    createComment,
    updatePost,
    deletePost
};
