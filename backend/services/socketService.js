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
