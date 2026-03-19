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
  const seedAdminIfNeeded = require("../src/startup/seedAdmin");

  const result = await seedAdminIfNeeded(models);
  if (result.created) {
    console.log("Seeded admin:", { id: result.admin._id.toString(), email: result.email });
  } else {
    console.log("Admin already exists:", { id: result.admin._id.toString(), email: result.email });
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("seedAdmin failed:", err);
  process.exitCode = 1;
});
