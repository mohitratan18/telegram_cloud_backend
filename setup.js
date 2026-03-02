const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n🔐 Authentication Setup Wizard\n");
console.log("This will help you configure your authentication system.\n");

rl.question("Enter admin username (default: admin): ", (username) => {
    const adminUsername = username || "admin";
    
    rl.question("Enter admin password (min 8 characters): ", (password) => {
        if (password.length < 8) {
            console.error("\n❌ Password must be at least 8 characters!");
            rl.close();
            return;
        }

        console.log("\n⏳ Generating secure credentials...\n");

        // Generate JWT secret
        const jwtSecret = crypto.randomBytes(32).toString("hex");

        // Hash password
        bcrypt.hash(password, 12, (err, hash) => {
            if (err) {
                console.error("❌ Error hashing password:", err);
                rl.close();
                return;
            }

            console.log("✅ Setup complete! Add these to your .env file:\n");
            console.log("─".repeat(60));
            console.log(`ADMIN_USERNAME=${adminUsername}`);
            console.log(`ADMIN_PASSWORD=${hash}`);
            console.log(`JWT_SECRET=${jwtSecret}`);
            console.log("─".repeat(60));
            console.log("\n📝 Next steps:");
            console.log("1. Copy the above values to your .env file");
            console.log("2. Run the SQL in create_auth_table.sql in Supabase");
            console.log("3. Restart your server: node index.js");
            console.log("\n📖 See AUTH_SETUP.md for full documentation\n");

            rl.close();
        });
    });
});
