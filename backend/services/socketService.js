let io;
const users = new Map(); // Map userId -> Set(socketIds)

const initSocket = (server) => {
    const { Server } = require("socket.io");
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    console.log("📡 Socket.io initialized");

    io.on("connection", (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        socket.on("register", (userId) => {
            if (userId) {
                const uId = String(userId);
                if (!users.has(uId)) {
                    users.set(uId, new Set());
                }
                users.get(uId).add(socket.id);
                console.log(`👤 User ${userId} registered with socket ${socket.id}. Total tabs: ${users.get(uId).size}`);
            }
        });

        socket.on("disconnect", () => {
            for (let [uid, sids] of users.entries()) {
                if (sids.has(socket.id)) {
                    sids.delete(socket.id);
                    console.log(`👋 Tab disconnected for user ${uid}. Remaining tabs: ${sids.size}`);
                    if (sids.size === 0) {
                        users.delete(uid);
                        console.log(`🚫 User ${uid} completely disconnected`);
                    }
                    break;
                }
            }
        });

        // --- Club Chat Logic ---
        socket.on("join_club", (clubId) => {
            const roomName = `club_${clubId}`;
            socket.join(roomName);
            console.log(`📢 Socket ${socket.id} joined room: ${roomName}`);
        });

        socket.on("send_club_message", async (data) => {
            const { clubId, userId, userName, userAvatar, message } = data;
            const roomName = `club_${clubId}`;
            
            try {
                const { getPool, sql } = require("../config/database");
                const pool = getPool();
                
                // Lưu vào Database
                await pool.request()
                    .input("clubId", sql.Int, clubId)
                    .input("userId", sql.Int, userId)
                    .input("content", sql.NVarChar(sql.MAX), message)
                    .query(`
                        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[club_messages]') AND type in (N'U'))
                        BEGIN
                            CREATE TABLE [dbo].[club_messages] (
                                [id] INT PRIMARY KEY IDENTITY(1,1),
                                [club_id] INT NOT NULL,
                                [user_id] INT NOT NULL,
                                [content] NVARCHAR(MAX) NOT NULL,
                                [created_at] DATETIME DEFAULT GETDATE()
                            )
                        END
                        
                        INSERT INTO club_messages (club_id, user_id, content, created_at) 
                        VALUES (@clubId, @userId, @content, GETDATE())
                    `);

                console.log(`💬 Saved & Broadcasting message in ${roomName} from ${userName}`);
                
                io.to(roomName).emit("receive_club_message", {
                    clubId,
                    userId,
                    userName,
                    userAvatar,
                    message,
                    timestamp: new Date()
                });
            } catch (err) {
                console.error("❌ Lỗi lưu tin nhắn CLB:", err);
            }
        });
    });

    return io;
};

const getIO = () => io;

const sendToUser = (userId, event, data) => {
    const uId = String(userId);
    const sids = users.get(uId);
    if (sids && sids.size > 0 && io) {
        sids.forEach(sid => {
            io.to(sid).emit(event, data);
        });
        console.log(`📤 Sent ${event} to user ${userId} (${sids.size} tabs)`);
        return true;
    }
    console.log(`⚠️ User ${userId} not connected or no active tabs`);
    return false;
};

module.exports = {
    initSocket,
    getIO,
    sendToUser
};
