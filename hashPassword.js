const bcrypt = require("bcryptjs");

// Usage: node hashPassword.js your_password_here
const password = process.argv[2];

if (!password) {
    console.error("Usage: node hashPassword.js <password>");
    process.exit(1);
}

bcrypt.hash(password, 12, (err, hash) => {
    if (err) {
        console.error("Error hashing password:", err);
        process.exit(1);
    }
    console.log("\nHashed password:");
    console.log(hash);
    console.log("\nAdd this to your .env file as ADMIN_PASSWORD");
});
