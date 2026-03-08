require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const busboy = require("busboy");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
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
// const loginLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 5, // 5 attempts per window
//     message: { error: "Too many login attempts, please try again later" },
//     standardHeaders: true,
//     legacyHeaders: false,
// });

const upload = multer({ dest: "uploads/" });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// ============================================
// INTERNAL HEALTH MONITORING
// ============================================

let healthCheckInterval = null;
let healthStats = {
    totalChecks: 0,
    totalFailures: 0,
    consecutiveFailures: 0,
    lastCheckTime: null,
    lastStatus: null,
    startTime: Date.now()
};

async function performInternalHealthCheck() {
    healthStats.totalChecks++;
    healthStats.lastCheckTime = new Date().toISOString();
    
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    let allHealthy = true;
    const checks = {};

    try {
        // Check database
        try {
            const { error } = await supabase
                .from("images")
                .select("id")
                .limit(1);
            checks.database = error ? "unhealthy" : "healthy";
            if (error) allHealthy = false;
        } catch (err) {
            checks.database = "unhealthy";
            allHealthy = false;
        }

        // Check Telegram API
        try {
            const telegramCheck = await axios.get(`${TELEGRAM_API}/getMe`, {
                timeout: 5000
            });
            checks.telegram = telegramCheck.data.ok ? "healthy" : "unhealthy";
            if (!telegramCheck.data.ok) allHealthy = false;
        } catch (err) {
            checks.telegram = "unhealthy";
            allHealthy = false;
        }

        // Check storage
        try {
            if (!fs.existsSync('uploads')) {
                fs.mkdirSync('uploads');
            }
            checks.storage = "healthy";
        } catch (err) {
            checks.storage = "unhealthy";
            allHealthy = false;
        }

        const status = allHealthy ? "OK" : "DEGRADED";
        healthStats.lastStatus = status;

        if (allHealthy) {
            healthStats.consecutiveFailures = 0;
            console.log(
                `\x1b[90m[${timestamp}]\x1b[0m \x1b[32m✓ HEALTH CHECK\x1b[0m - ` +
                `Status: \x1b[32m${status}\x1b[0m | ` +
                `DB: \x1b[32m${checks.database}\x1b[0m | ` +
                `Telegram: \x1b[32m${checks.telegram}\x1b[0m | ` +
                `Storage: \x1b[32m${checks.storage}\x1b[0m`
            );
        } else {
            healthStats.consecutiveFailures++;
            healthStats.totalFailures++;
            console.log(
                `\x1b[90m[${timestamp}]\x1b[0m \x1b[33m⚠ HEALTH CHECK\x1b[0m - ` +
                `Status: \x1b[33m${status}\x1b[0m | ` +
                `DB: ${checks.database === 'healthy' ? '\x1b[32m' : '\x1b[31m'}${checks.database}\x1b[0m | ` +
                `Telegram: ${checks.telegram === 'healthy' ? '\x1b[32m' : '\x1b[31m'}${checks.telegram}\x1b[0m | ` +
                `Storage: ${checks.storage === 'healthy' ? '\x1b[32m' : '\x1b[31m'}${checks.storage}\x1b[0m`
            );

            // Alert on consecutive failures
            if (healthStats.consecutiveFailures === 5) {
                console.log(`\x1b[31m⚠️  WARNING: 5 consecutive health check failures!\x1b[0m`);
            } else if (healthStats.consecutiveFailures === 10) {
                console.log(`\x1b[31m🚨 CRITICAL: 10 consecutive health check failures!\x1b[0m`);
            }
        }

    } catch (error) {
        healthStats.consecutiveFailures++;
        healthStats.totalFailures++;
        healthStats.lastStatus = "ERROR";
        console.log(
            `\x1b[90m[${timestamp}]\x1b[0m \x1b[31m✗ HEALTH CHECK ERROR\x1b[0m - ${error.message}`
        );
    }
}

function startHealthMonitoring() {
    const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 1000; // Default 1 second
    
    console.log(`\x1b[36m╔════════════════════════════════════════════════════════════╗\x1b[0m`);
    console.log(`\x1b[36m║          Internal Health Monitor Started                  ║\x1b[0m`);
    console.log(`\x1b[36m║  Interval: ${(interval / 1000).toString().padEnd(48)}s║\x1b[0m`);
    console.log(`\x1b[36m╚════════════════════════════════════════════════════════════╝\x1b[0m`);
    console.log('');

    // Perform initial check
    performInternalHealthCheck();

    // Start interval
    healthCheckInterval = setInterval(performInternalHealthCheck, interval);
}

function stopHealthMonitoring() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        
        const uptime = Math.floor((Date.now() - healthStats.startTime) / 1000);
        const successRate = healthStats.totalChecks > 0 
            ? ((healthStats.totalChecks - healthStats.totalFailures) / healthStats.totalChecks * 100).toFixed(2)
            : 0;

        console.log('\n');
        console.log(`\x1b[36m╔════════════════════════════════════════════════════════════╗\x1b[0m`);
        console.log(`\x1b[36m║          Health Monitoring Summary                         ║\x1b[0m`);
        console.log(`\x1b[36m╠════════════════════════════════════════════════════════════╣\x1b[0m`);
        console.log(`\x1b[36m║\x1b[0m  Total Checks: ${healthStats.totalChecks.toString().padEnd(44)} \x1b[36m║\x1b[0m`);
        console.log(`\x1b[36m║\x1b[0m  Total Failures: ${healthStats.totalFailures.toString().padEnd(42)} \x1b[36m║\x1b[0m`);
        console.log(`\x1b[36m║\x1b[0m  Success Rate: ${successRate}%`.padEnd(59) + ` \x1b[36m║\x1b[0m`);
        console.log(`\x1b[36m║\x1b[0m  Uptime: ${uptime}s`.padEnd(59) + ` \x1b[36m║\x1b[0m`);
        console.log(`\x1b[36m╚════════════════════════════════════════════════════════════╝\x1b[0m`);
        console.log('');
    }
}

// ============================================
// HEALTH CHECK ENDPOINT (Public)
// ============================================

// ============================================
// HEALTH CHECK ENDPOINT (Public)
// ============================================

app.get("/health", async (req, res) => {
    const healthCheck = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        monitoring: {
            enabled: healthCheckInterval !== null,
            totalChecks: healthStats.totalChecks,
            totalFailures: healthStats.totalFailures,
            consecutiveFailures: healthStats.consecutiveFailures,
            lastCheckTime: healthStats.lastCheckTime,
            lastStatus: healthStats.lastStatus
        },
        checks: {}
    };

    try {
        // Check database connection
        const { data, error } = await supabase
            .from("images")
            .select("id")
            .limit(1);

        healthCheck.checks.database = error ? "unhealthy" : "healthy";
        
        if (error) {
            healthCheck.status = "degraded";
            healthCheck.checks.databaseError = error.message;
        }

        // Check Telegram API
        try {
            const telegramCheck = await axios.get(`${TELEGRAM_API}/getMe`, {
                timeout: 5000
            });
            healthCheck.checks.telegram = telegramCheck.data.ok ? "healthy" : "unhealthy";
        } catch (telegramError) {
            healthCheck.checks.telegram = "unhealthy";
            healthCheck.checks.telegramError = telegramError.message;
            healthCheck.status = "degraded";
        }

        // Check uploads directory
        try {
            if (!fs.existsSync('uploads')) {
                fs.mkdirSync('uploads');
            }
            healthCheck.checks.storage = "healthy";
        } catch (storageError) {
            healthCheck.checks.storage = "unhealthy";
            healthCheck.checks.storageError = storageError.message;
            healthCheck.status = "degraded";
        }

        // Determine overall status
        const allHealthy = Object.values(healthCheck.checks)
            .filter(v => typeof v === 'string')
            .every(v => v === "healthy");

        if (!allHealthy && healthCheck.status === "ok") {
            healthCheck.status = "degraded";
        }

        const statusCode = healthCheck.status === "ok" ? 200 : 503;
        res.status(statusCode).json(healthCheck);

    } catch (error) {
        res.status(503).json({
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            error: error.message,
            monitoring: {
                enabled: healthCheckInterval !== null,
                totalChecks: healthStats.totalChecks,
                totalFailures: healthStats.totalFailures
            }
        });
    }
});

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// Login Route
app.post("/login", async (req, res) => {
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

// Optimized Upload Route - Handles multiple large files with streaming
app.post("/upload", verifyToken, async (req, res) => {
    try {
        const bb = busboy({
            headers: req.headers,
            limits: {
                fileSize: 100 * 1024 * 1024, // 100MB per file limit
                files: 20, // Max 20 files per request
                fields: 10,
            },
        });

        const uploadResults = [];
        const uploadErrors = [];
        let filesProcessed = 0;
        let totalFiles = 0;

        // Track files being processed
        const filePromises = [];

        bb.on('file', (fieldname, file, info) => {
            totalFiles++;
            const { filename, mimeType } = info;

            // Validate file type (images only)
            if (!mimeType.startsWith('image/')) {
                file.resume(); // Drain the stream
                uploadErrors.push({
                    filename,
                    error: 'Only image files are allowed'
                });
                filesProcessed++;
                return;
            }

            // Create unique temporary file path
            const tempFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${filename}`;
            const tempFilePath = path.join('uploads', tempFileName);

            // Create write stream
            const writeStream = fs.createWriteStream(tempFilePath);

            let fileSize = 0;
            let fileTooLarge = false;

            // Track file size
            file.on('data', (chunk) => {
                fileSize += chunk.length;
            });

            // Handle file size limit
            file.on('limit', () => {
                fileTooLarge = true;
                writeStream.destroy();
                fs.unlink(tempFilePath, () => {});
                uploadErrors.push({
                    filename,
                    error: 'File too large (max 100MB)'
                });
                filesProcessed++;
            });

            // Pipe file to disk
            file.pipe(writeStream);

            // Create promise for this file upload
            const uploadPromise = new Promise((resolve, reject) => {
                writeStream.on('finish', async () => {
                    if (fileTooLarge) {
                        resolve();
                        return;
                    }

                    try {
                        // Upload to Telegram using streaming
                        const form = new FormData();
                        form.append("chat_id", process.env.TELEGRAM_CHAT_ID);
                        form.append("photo", fs.createReadStream(tempFilePath), {
                            filename: filename,
                            contentType: mimeType
                        });

                        const telegramRes = await axios.post(
                            `${TELEGRAM_API}/sendPhoto`,
                            form,
                            { 
                                headers: form.getHeaders(),
                                maxContentLength: Infinity,
                                maxBodyLength: Infinity
                            }
                        );

                        const message = telegramRes.data.result;
                        const file_id = message.photo[message.photo.length - 1].file_id;
                        const message_id = message.message_id;

                        // Save to database
                        const { error: dbError } = await supabase.from("images").insert([
                            {
                                file_id,
                                message_id,
                                filename: filename,
                                file_size: fileSize,
                                file_type: mimeType,
                            },
                        ]);

                        // Clean up temp file
                        fs.unlink(tempFilePath, () => {});

                        if (dbError) {
                            uploadErrors.push({
                                filename,
                                error: 'Database error: ' + dbError.message
                            });
                        } else {
                            uploadResults.push({
                                filename,
                                file_id,
                                message_id,
                                size: fileSize,
                                success: true
                            });
                        }

                        filesProcessed++;
                        resolve();
                    } catch (err) {
                        // Clean up temp file on error
                        fs.unlink(tempFilePath, () => {});
                        
                        uploadErrors.push({
                            filename,
                            error: err.response?.data?.description || err.message
                        });
                        filesProcessed++;
                        resolve();
                    }
                });

                writeStream.on('error', (err) => {
                    fs.unlink(tempFilePath, () => {});
                    uploadErrors.push({
                        filename,
                        error: 'Write error: ' + err.message
                    });
                    filesProcessed++;
                    resolve();
                });
            });

            filePromises.push(uploadPromise);
        });

        bb.on('finish', async () => {
            // Wait for all file uploads to complete
            await Promise.all(filePromises);

            // Send response
            const response = {
                success: uploadResults.length > 0,
                uploaded: uploadResults.length,
                failed: uploadErrors.length,
                total: totalFiles,
                results: uploadResults
            };

            if (uploadErrors.length > 0) {
                response.errors = uploadErrors;
            }

            if (uploadResults.length === 0 && uploadErrors.length > 0) {
                return res.status(400).json(response);
            }

            res.json(response);
        });

        bb.on('error', (err) => {
            console.error('Busboy error:', err);
            res.status(500).json({ 
                success: false,
                error: 'Upload processing failed: ' + err.message 
            });
        });

        // Pipe request to busboy
        req.pipe(bb);

    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ 
            success: false,
            error: "Upload failed: " + err.message 
        });
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


app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
    
    // Start internal health monitoring
    startHealthMonitoring();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    stopHealthMonitoring();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    stopHealthMonitoring();
    process.exit(0);
});

// Export for Vercel serverless
module.exports = app;