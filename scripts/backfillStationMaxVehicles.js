require("dotenv").config();

const db = require("../src/models");

const DEFAULT_MAX_VEHICLES = Number(process.env.STATION_DEFAULT_MAX_VEHICLES || 20);

const waitForDb = () =>
  new Promise((resolve, reject) => {
    if (db.readyState === 1) return resolve();
    db.once("open", resolve);
    db.once("error", reject);
  });

async function main() {
  await waitForDb();

  const { models, mongoose } = db;

  if (!Number.isInteger(DEFAULT_MAX_VEHICLES) || DEFAULT_MAX_VEHICLES < 1) {
    throw new Error(
      `STATION_DEFAULT_MAX_VEHICLES must be a positive integer (got ${DEFAULT_MAX_VEHICLES}).`,
    );
  }

  console.log(`Backfilling stations missing maxVehicles with default = ${DEFAULT_MAX_VEHICLES} ...`);

  const stations = await models.Station.find(
    {
      $or: [
        { maxVehicles: { $exists: false } },
        { maxVehicles: null },
        { maxVehicles: { $lte: 0 } },
      ],
    },
    { _id: 1, name: 1, maxVehicles: 1 },
  ).lean();

  console.log(`Found ${stations.length} stations to update.`);

  if (stations.length === 0) {
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  let needsBumping = 0;
  for (const station of stations) {
    const currentCount = await models.Vehicle.countDocuments({
      stationId: station._id,
      status: { $nin: ["REMOVED"] },
    });
    const target = Math.max(DEFAULT_MAX_VEHICLES, currentCount);
    if (target > DEFAULT_MAX_VEHICLES) needsBumping += 1;
    await models.Station.updateOne(
      { _id: station._id },
      { $set: { maxVehicles: target } },
    );
    updated += 1;
    console.log(
      `  ✓ ${station.name || station._id} → maxVehicles = ${target}` +
        (target > DEFAULT_MAX_VEHICLES
          ? ` (bumped to fit ${currentCount} existing vehicles)`
          : ""),
    );
  }

  console.log(
    `\nDone. Updated ${updated} stations` +
      (needsBumping > 0
        ? ` (${needsBumping} were bumped above the default to accommodate existing vehicles).`
        : "."),
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Backfill failed:", err);
  try {
    await db.mongoose.disconnect();
  } catch {}
  process.exit(1);
});
