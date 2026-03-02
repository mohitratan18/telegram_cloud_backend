const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const verifyToken = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ 
                error: "Unauthorized", 
                message: "No token provided" 
            });
        }

        const token = authHeader.split(" ")[1];

        // Verify JWT signature and expiration
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ 
                    error: "Unauthorized", 
                    message: "Token expired" 
                });
            }
            return res.status(401).json({ 
                error: "Unauthorized", 
                message: "Invalid token" 
            });
        }

        // Check if token exists in database and is not revoked
        const { data: tokenData, error } = await supabase
            .from("auth_tokens")
            .select("*")
            .eq("token", token)
            .eq("revoked", false)
            .single();

        if (error || !tokenData) {
            return res.status(401).json({ 
                error: "Unauthorized", 
                message: "Token not found or revoked" 
            });
        }

        // Check if token is expired (double check with DB)
        if (new Date(tokenData.expires_at) < new Date()) {
            return res.status(401).json({ 
                error: "Unauthorized", 
                message: "Token expired" 
            });
        }

        // Attach user info to request
        req.user = {
            username: decoded.username,
            tokenId: tokenData.id
        };

        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(401).json({ 
            error: "Unauthorized", 
            message: "Authentication failed" 
        });
    }
};

module.exports = { verifyToken };
