-- =============================================
-- SQL Server Script để tạo CSDL NentangCLB
-- =============================================

-- 1. Tạo Database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'NentangCLB')
BEGIN
    CREATE DATABASE NentangCLB;
END
GO

USE NentangCLB;
GO

-- 2. Tạo bảng Roles (Vai trò hệ thống)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'roles')
BEGIN
    CREATE TABLE roles (
        id INT IDENTITY(1,1) PRIMARY KEY,
        role_name NVARCHAR(50) NOT NULL UNIQUE
    );
    -- Thêm dữ liệu mặc định cho roles
    INSERT INTO roles (role_name) VALUES ('admin'), ('user'), ('student'), ('teacher');
END

-- 3. Tạo bảng Categories (Chuyên mục CLB)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'categories')
BEGIN
    CREATE TABLE categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        category_name NVARCHAR(255) NOT NULL
    );
END

-- 4. Tạo bảng Users (Người dùng)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_code VARCHAR(50),
        full_name NVARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL CONSTRAINT UQ_Users_Email UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone NVARCHAR(20),
        dob DATE,
        gender NVARCHAR(10),
        bio NVARCHAR(MAX),
        hobbies NVARCHAR(MAX),
        avatar NVARCHAR(MAX),
        training_points INT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE()
    );
END

-- 5. Tạo bảng trung gian User_Roles (Phân quyền người dùng)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_roles')
BEGIN
    CREATE TABLE user_roles (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
        role_id INT NOT NULL FOREIGN KEY REFERENCES roles(id) ON DELETE CASCADE
    );
END

-- 6. Tạo bảng Clubs (Câu lạc bộ)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'clubs')
BEGIN
    CREATE TABLE clubs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        club_name NVARCHAR(255) NOT NULL,
        club_code VARCHAR(50) NOT NULL,
        description NVARCHAR(MAX),
        category_id INT FOREIGN KEY REFERENCES categories(id) ON DELETE SET NULL,
        created_by INT FOREIGN KEY REFERENCES users(id),
        logo_url NVARCHAR(MAX),
        cover_url NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'active',
        created_at DATETIME DEFAULT GETDATE()
    );
END

-- 7. Tạo bảng Club_Members (Thành viên CLB)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'club_members')
BEGIN
    CREATE TABLE club_members (
        id INT IDENTITY(1,1) PRIMARY KEY,
        club_id INT NOT NULL FOREIGN KEY REFERENCES clubs(id) ON DELETE CASCADE,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
        status NVARCHAR(50) DEFAULT 'active',
        role NVARCHAR(50) DEFAULT 'member', -- leader, sub-leader, member
        joined_at DATETIME DEFAULT GETDATE()
    );
END

-- 8. Tạo bảng Posts (Bài viết diễn đàn)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'posts')
BEGIN
    CREATE TABLE posts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(255),
        content NVARCHAR(MAX),
        type NVARCHAR(50), -- normal, announcement, event
        club_id INT FOREIGN KEY REFERENCES clubs(id) ON DELETE CASCADE,
        user_id INT FOREIGN KEY REFERENCES users(id),
        likes INT DEFAULT 0,
        views INT DEFAULT 0,
        comments INT DEFAULT 0,
        image NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE()
    );
END

-- 9. Tạo bảng Comments (Bình luận bài viết)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'comments')
BEGIN
    CREATE TABLE comments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        post_id INT NOT NULL FOREIGN KEY REFERENCES posts(id) ON DELETE CASCADE,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        content NVARCHAR(MAX) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END

-- 10. Tạo bảng Post_Likes (Lượt thích bài viết)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'post_likes')
BEGIN
    CREATE TABLE post_likes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        post_id INT NOT NULL FOREIGN KEY REFERENCES posts(id) ON DELETE CASCADE,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT uq_post_like UNIQUE (post_id, user_id)
    );
END

-- 11. Tạo bảng Events (Sự kiện)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'events')
BEGIN
    CREATE TABLE events (
        id INT IDENTITY(1,1) PRIMARY KEY,
        event_name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        location NVARCHAR(255),
        start_time DATETIME,
        end_time DATETIME,
        club_id INT NOT NULL FOREIGN KEY REFERENCES clubs(id) ON DELETE CASCADE,
        created_by INT FOREIGN KEY REFERENCES users(id),
        likes INT DEFAULT 0,
        views INT DEFAULT 0,
        comments INT DEFAULT 0,
        image NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'active',
        created_at DATETIME DEFAULT GETDATE()
    );
END

-- 12. Tạo bảng Event_Registrations (Đăng ký sự kiện)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_registrations')
BEGIN
    CREATE TABLE event_registrations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        event_id INT NOT NULL FOREIGN KEY REFERENCES events(id) ON DELETE CASCADE,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
        status NVARCHAR(50) DEFAULT 'registered', -- pending, approved, rejected
        registered_at DATETIME DEFAULT GETDATE()
    );
END

-- 12.1 Tạo bảng Event_Likes (Lượt thích sự kiện)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_likes')
BEGIN
    CREATE TABLE event_likes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        event_id INT NOT NULL FOREIGN KEY REFERENCES events(id) ON DELETE CASCADE,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT uq_event_like UNIQUE (event_id, user_id)
    );
END

-- 12.2 Tạo bảng Event_Comments (Bình luận sự kiện)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event_comments')
BEGIN
    CREATE TABLE event_comments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        event_id INT NOT NULL FOREIGN KEY REFERENCES events(id) ON DELETE CASCADE,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        content NVARCHAR(MAX) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END

-- 13. Tạo bảng Join_Requests (Yêu cầu tham gia CLB)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'join_requests')
BEGIN
    CREATE TABLE join_requests (
        id INT IDENTITY(1,1) PRIMARY KEY,
        club_id INT NOT NULL FOREIGN KEY REFERENCES clubs(id) ON DELETE CASCADE,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
        status NVARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
        reason NVARCHAR(MAX), -- Lý do gia nhập hoặc từ chối
        requested_at DATETIME DEFAULT GETDATE()
    );
END

-- 14. Tạo bảng Notifications (Thông báo)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
BEGIN
    CREATE TABLE notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
        title NVARCHAR(255),
        message NVARCHAR(MAX),
        type NVARCHAR(50), -- membership, post, event
        link NVARCHAR(MAX),
        is_read BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE()
    );
END

-- 15. Tạo bảng Saved_Posts (Bài viết đã lưu)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'saved_posts')
BEGIN
    CREATE TABLE saved_posts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
        post_id INT NOT NULL FOREIGN KEY REFERENCES posts(id) ON DELETE NO ACTION,
        saved_at DATETIME DEFAULT GETDATE()
    );
END

-- 16. Tạo bảng Club_Stats (Thống kê CLB)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'club_stats')
BEGIN
    CREATE TABLE club_stats (
        id INT IDENTITY(1,1) PRIMARY KEY,
        club_id INT NOT NULL UNIQUE FOREIGN KEY REFERENCES clubs(id) ON DELETE CASCADE,
        total_score INT DEFAULT 0,
        current_rank INT DEFAULT 0,
        trend NVARCHAR(50) DEFAULT 'stable'
    );
END

-- 17. Tạo bảng Training_Point_History (Lịch sử điểm rèn luyện)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'training_point_history')
BEGIN
    CREATE TABLE training_point_history (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
        points INT NOT NULL,
        reason NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        created_by INT -- Admin/Leader thực hiện cộng điểm
    );
END
