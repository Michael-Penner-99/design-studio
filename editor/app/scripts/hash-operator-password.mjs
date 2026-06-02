import bcrypt from "bcryptjs";
const pw = process.argv[2];
if (!pw) { console.error("usage: node scripts/hash-operator-password.mjs <password>"); process.exit(1); }
console.log(await bcrypt.hash(pw, 10));
