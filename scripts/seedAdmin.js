require("dotenv").config();

const db = require("../src/models");

const waitForDb = () =>
  new Promise((resolve, reject) => {
    if (db.readyState === 1) return resolve();
    db.once("open", resolve);
    db.once("error", reject);
  });

async function main() {
  await waitForDb();

  const { models, mongoose } = db;
  const { hashPassword } = require("../src/util/password");

  const email = String(process.env.SEED_ADMIN_EMAIL || "admin@station.com")
    .trim()
    .toLowerCase();
  const password = String(process.env.SEED_ADMIN_PASSWORD || "Admin@123");
  const name = String(process.env.SEED_ADMIN_NAME || "Admin User").trim();

  const exists = await models.User.findOne({ role: "ADMIN", email }).lean();
  if (exists) {
    console.log("Admin already exists:", { id: exists._id.toString(), email });
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await hashPassword(password);
  const admin = await models.User.create({
    role: "ADMIN",
    name,
    email,
    passwordHash,
    isActive: true,
  });

  console.log("Seeded admin:", { id: admin._id.toString(), email });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("seedAdmin failed:", err);
  process.exitCode = 1;
});

