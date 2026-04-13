const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectDB } = require("./config/database");

// ================= INITIALIZE APP =================
const app = express();

// ================= CONFIG EJS & STATIC FILES =================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../frontend")); 
app.use(express.static(path.join(__dirname, "../frontend")));

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ================= CONNECT DATABASE =================
connectDB();

// ================= MIDDLEWARE =================
const ensureDB = (req, res, next) => {
    const { getPool } = require("./config/database");
    if (!getPool()) {
        return res.status(500).json({ message: "Database not ready" });
    }
    next();
};
app.use(ensureDB);

// ================= VIEW ROUTES (Giao diện) =================
const viewRoutes = require("./routes/viewRoutes");
app.use("/", viewRoutes); 

// ================= API MODULES (PLATFORM CORE) =================
const authRoutes = require("./routes/authRoutes");
const clubRoutes = require("./routes/clubRoutes");
const eventRoutes = require("./routes/eventRoutes");
const postRoutes = require("./routes/postRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const supportRoutes = require("./routes/supportRoutes");
const rankingRoutes = require("./routes/rankingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const pointRoutes = require("./routes/pointRoutes");

app.use("/api", authRoutes);      // Đăng ký, Đăng nhập, Stats
app.use("/api/clubs", clubRoutes); // Quản lý CLB
app.use("/api/events", eventRoutes); // Quản lý Sự kiện
app.use("/api/posts", postRoutes);  // Diễn đàn, Bình luận
app.use("/api/user", userRoutes);   // Profile người dùng
app.use("/api/notifications", notificationRoutes); // Thông báo
app.use("/api/support", supportRoutes);
app.use("/api/rankings", rankingRoutes); // Bảng xếp hạng hệ thống
app.use("/api/admin", adminRoutes); // Quản trị hệ thống

// TRANG PROFILE (Để lại tương thích với logic cũ)
app.get("/profile", (req, res) => {
    res.render("Profile", { user: {} });
});

// ================= START SERVER =================
const http = require("http");
const { initSocket } = require("./services/socketService");

const server = http.createServer(app);
const PORT = 5000;

initSocket(server);

server.listen(PORT, () => {
    console.log(`🚀 Platform Core running: http://localhost:${PORT}`);
    console.log(`📂 Modular Architecture enabled (Real-time Socket.io active).`);
});