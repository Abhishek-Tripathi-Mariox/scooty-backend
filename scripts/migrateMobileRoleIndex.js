// One-time migration: replace the old unique index on `mobile` with the
// unique (mobile, role) index, so a rider and an owner can share a number.
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
  const indexes = await models.User.collection.indexes();
  const oldIndex = indexes.find(
    (index) => index.unique && Object.keys(index.key).join(",") === "mobile",
  );
  if (oldIndex) {
    await models.User.collection.dropIndex(oldIndex.name);
    console.log("Dropped old unique index:", oldIndex.name);
  } else {
    console.log("Old unique mobile index not found, nothing to drop");
  }

  await models.User.createIndexes();
  console.log("User indexes now:", (await models.User.collection.indexes()).map((i) => i.name));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("migrateMobileRoleIndex failed:", err);
  process.exitCode = 1;
});
