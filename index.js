require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const { verifyToken } = require("./authMiddleware");

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ 
    origin: "*",
    credentials: true
}));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    next();
});
app.use(express.json());

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { error: "Too many login attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});

const upload = multer({ dest: "uploads/" });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// Login Route
app.post("/login", loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ 
                error: "Bad Request", 
                message: "Username and password are required" 
            });
        }

        // Verify credentials against environment variables
        if (username !== process.env.ADMIN_USERNAME) {
            return res.status(401).json({ 
                error: "Unauthorized", 
                message: "Invalid credentials" 
            });
        }

        // Compare password with hashed version
        // For first time setup, you need to hash your password
        const isPasswordValid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD);
        
        if (!isPasswordValid) {
            return res.status(401).json({ 
                error: "Unauthorized", 
                message: "Invalid credentials" 
            });
        }

        // Generate JWT token (expires in 7 days)
        const token = jwt.sign(
            { username: username },
            process.env.JWT_SECRET,
            { 
                expiresIn: "7d",
                algorithm: "HS256"
            }
        );

        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Store token in database
        const { data, error } = await supabase
            .from("auth_tokens")
            .insert([
                {
                    token: token,
                    username: username,
                    expires_at: expiresAt.toISOString(),
                    revoked: false
                }
            ])
            .select()
            .single();

        if (error) {
            console.error("Token storage error:", error);
            return res.status(500).json({ 
                error: "Internal Server Error", 
                message: "Failed to create session" 
            });
        }

        res.json({ 
            success: true,
            token: token,
            expiresAt: expiresAt.toISOString()
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ 
            error: "Internal Server Error", 
            message: "Login failed" 
        });
    }
});

// Logout Route (revoke token)
app.post("/logout", verifyToken, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.split(" ")[1];

        // Revoke token in database
        const { error } = await supabase
            .from("auth_tokens")
            .update({ revoked: true })
            .eq("token", token);

        if (error) {
            console.error("Logout error:", error);
            return res.status(500).json({ 
                error: "Internal Server Error", 
                message: "Logout failed" 
            });
        }

        res.json({ success: true, message: "Logged out successfully" });
    } catch (err) {
        console.error("Logout error:", err);
        res.status(500).json({ 
            error: "Internal Server Error", 
            message: "Logout failed" 
        });
    }
});

// Verify Token Route (check if token is still valid)
app.get("/verify", verifyToken, (req, res) => {
    res.json({ 
        success: true, 
        username: req.user.username 
    });
});

// ============================================
// PROTECTED ROUTES (require authentication)
// ============================================

// Upload Route
app.post("/upload", verifyToken, upload.single("image"), async (req, res) => {
    try {
        const filePath = req.file.path;

        const form = new FormData();
        form.append("chat_id", process.env.TELEGRAM_CHAT_ID);
        form.append("photo", fs.createReadStream(filePath));

        const telegramRes = await axios.post(
            `${TELEGRAM_API}/sendPhoto`,
            form,
            { headers: form.getHeaders() }
        );

        const message = telegramRes.data.result;
        const file_id = message.photo.pop().file_id;
        const message_id = message.message_id;

        const { error } = await supabase.from("images").insert([
            {
                file_id,
                message_id,
                filename: req.file.originalname,
                file_size: req.file.size,
                file_type: req.file.mimetype,
            },
        ]);

        fs.unlinkSync(filePath);

        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        console.error(err.response?.data || err);
        res.status(500).json({ error: "Upload failed" });
    }
});

const getTelegramFileUrl = async (file_id) => {
    const response = await axios.get(
        `${TELEGRAM_API}/getFile?file_id=${file_id}`
    );

    const file_path = response.data.result.file_path;

    return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file_path}`;
};


// Get Images Route
app.get("/images", verifyToken, async (req, res) => {
    const {
        sortBy = "uploaded_at",
        order = "desc",
        page = 1,
        limit = 10,
    } = req.query;

    const allowedFields = ["uploaded_at", "file_size", "file_type"];

    if (!allowedFields.includes(sortBy)) {
        return res.status(400).json({ error: "Invalid sort field" });
    }

    const from = (page - 1) * limit;
    const to = from + parseInt(limit) - 1;

    const { data, error, count } = await supabase
        .from("images")
        .select("*", { count: "exact" })
        .order(sortBy, { ascending: order === "asc" })
        .range(from, to);

    if (error) return res.status(500).json({ error });



    const enrichedData = await Promise.all(
        data.map(async (item) => {
            const image_url = await getTelegramFileUrl(item.file_id);
            return { ...item, image_url };
        })
    );

    res.json({
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        data: enrichedData,
    });
});


app.delete("/image/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // 1️⃣ Get record from DB
        const { data, error } = await supabase
            .from("images")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: "Image not found" });
        }

        // 2️⃣ Delete from Telegram
        await axios.post(
            `${TELEGRAM_API}/deleteMessage`,
            {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                message_id: data.message_id,
            }
        );

        // 3️⃣ Delete from DB
        await supabase.from("images").delete().eq("id", id);

        res.json({ success: true });
    } catch (err) {
        console.error(err.response?.data || err);
        res.status(500).json({ error: "Delete failed" });
    }
});


app.listen(process.env.PORT, () =>
    console.log(`Server running on port ${process.env.PORT}`)
);