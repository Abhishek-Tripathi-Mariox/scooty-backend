const mongoose = require("mongoose");
const { models } = require("../models");

const toId = (value) => String(value || "").trim();

/**
 * Stations a station admin may operate on:
 *  - the station on their user record (User.stationId), and
 *  - every station that lists them as its admin (Station.stationAdminId).
 * Platform ADMINs may operate on any station (or all, when none is requested).
 */
const listManagedStationIds = async (stationAdmin) => {
  if (!stationAdmin) return [];
  const ids = new Set();
  const assigned = toId(stationAdmin.stationId);
  if (assigned && mongoose.Types.ObjectId.isValid(assigned)) ids.add(assigned);
  const owned = await models.Station.find({ stationAdminId: stationAdmin._id }).distinct("_id");
  for (const id of owned) ids.add(String(id));
  return Array.from(ids);
};

/**
 * Resolve which station a request may act on.
 * Returns a station id string, or null for an ADMIN with no station requested (= all stations).
 * Throws INVALID_STATION / STATION_MISMATCH / STATION_NOT_ASSIGNED.
 */
const resolveStationAccess = async ({ stationAdmin, requestedStationId = "" }) => {
  const requested = toId(requestedStationId);

  if (requested && !mongoose.Types.ObjectId.isValid(requested)) {
    const err = new Error("stationId must be a valid id");
    err.code = "INVALID_STATION";
    throw err;
  }

  if (stationAdmin?.role === "ADMIN") {
    return requested || null;
  }

  const managed = await listManagedStationIds(stationAdmin);

  if (requested) {
    if (!managed.includes(requested)) {
      const err = new Error("station mismatch");
      err.code = "STATION_MISMATCH";
      throw err;
    }
    return requested;
  }

  if (managed.length > 0) return managed[0];

  const err = new Error("Station not assigned to station admin");
  err.code = "STATION_NOT_ASSIGNED";
  throw err;
};

module.exports = { listManagedStationIds, resolveStationAccess };
