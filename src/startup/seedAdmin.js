const { hashPassword, normalizePassword } = require("../util/password");

module.exports = async function seedAdminIfNeeded(models) {
  console.log("Seeding admin user if needed...");
  if (!models || !models.User) throw new Error("models.User is required");

  const email = String(process.env.SEED_ADMIN_EMAIL || "admin@station.com")
    .trim()
    .toLowerCase();
  const password = normalizePassword(process.env.SEED_ADMIN_PASSWORD || "Admin@123");
  const name = String(process.env.SEED_ADMIN_NAME || "Admin User").trim();

  const exists = await models.User.findOne({ role: "ADMIN", email }).lean();
  if (exists) {
    return { created: false, admin: exists, email };
  }

  const passwordHash = await hashPassword(password);
  const admin = await models.User.create({
    role: "ADMIN",
    name,
    email,
    passwordHash,
    isActive: true,
  });

  return { created: true, admin, email };
};
