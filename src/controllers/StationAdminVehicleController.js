const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const VehicleService = require("../services/VehicleService");
const UserService = require("../services/UserService");
const { resolveStationAccess } = require("../utils/stationAccess");

const statusActionMap = {
  MARK_MAINTENANCE: "MAINTENANCE",
  MARK_ACTIVE: "ACTIVE",
  ASSIGN_CHARGING: "CHARGING",
  MARK_INACTIVE: "INACTIVE",
  REMOVE_VEHICLE: "REMOVED",
};
const STATION_ADMIN_ROLES = ["STATION_ADMIN", "SUB_STATION_ADMIN"];

const toInt = (value, fallback) => {
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Station admins may act on any station they manage (User.stationId or
// Station.stationAdminId); see utils/stationAccess.
const resolveStationId = async (stationAdmin, req) => {
  const requestedStationId = String(req.query.stationId || req.body.stationId || "").trim();
  return resolveStationAccess({ stationAdmin, requestedStationId });
};

const loadStationAdmin = async (stationAdminId) => {
  const stationAdmin = await UserService().fetchDocByQuery({
    _id: stationAdminId,
    role: { $in: STATION_ADMIN_ROLES },
  });
  if (!stationAdmin) return null;
  return stationAdmin;
};

module.exports = {
  list: async (req, res, next) => {
    const stationAdmin = await loadStationAdmin(req.body.stationAdminId);
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    let stationId;
    try {
      stationId = await resolveStationId(stationAdmin, req);
    } catch (ex) {
      if (ex.code === "STATION_NOT_ASSIGNED") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Station not assigned to station admin");
      }
      if (ex.code === "STATION_MISMATCH") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "station mismatch");
      }
      throw ex;
    }

    const vehicles = await VehicleService().listByStation({
      stationId,
      status: req.query.status,
      q: req.query.q,
      page: toInt(req.query.page, 1),
      limit: toInt(req.query.limit, 20),
    });

    req.rData = vehicles;
    return ResponseMiddleware(req, res, next, "vehicles fetched");
  },

  create: async (req, res, next) => {
    const stationAdmin = await loadStationAdmin(req.body.stationAdminId);
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    let stationId;
    try {
      stationId = await resolveStationId(stationAdmin, req);
    } catch (ex) {
      if (ex.code === "STATION_NOT_ASSIGNED") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Station not assigned to station admin");
      }
      if (ex.code === "STATION_MISMATCH") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "station mismatch");
      }
      throw ex;
    }

    const ownerId = String(req.body.ownerId || stationAdmin._id).trim();
    if (req.body.ownerId && String(req.body.ownerId).trim() !== String(stationAdmin._id)) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "ownerId must match station admin id");
    }
    const vehicle = await VehicleService().createDraft(
      ownerId,
      { ...(req.body || {}), stationId, actorRole: "STATION_ADMIN" },
      req.files || null,
    );

    req.rData = { vehicle };
    return ResponseMiddleware(req, res, next, "vehicle created");
  },

  detail: async (req, res, next) => {
    const stationAdmin = await loadStationAdmin(req.body.stationAdminId);
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    let stationId;
    try {
      stationId = await resolveStationId(stationAdmin, req);
    } catch (ex) {
      if (ex.code === "STATION_NOT_ASSIGNED") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Station not assigned to station admin");
      }
      if (ex.code === "STATION_MISMATCH") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "station mismatch");
      }
      throw ex;
    }

    const detail = await VehicleService().stationVehicleDetail({
      stationId,
      vehicleId: req.params.vehicleId,
    });

    if (!detail) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Vehicle not found");
    }

    req.rData = detail;
    return ResponseMiddleware(req, res, next, "vehicle detail fetched");
  },

  updateStatus: async (req, res, next) => {
    try {
      const stationAdmin = await loadStationAdmin(req.body.stationAdminId);
      if (!stationAdmin) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Station admin not found");
      }

      let stationId;
      try {
        stationId = await resolveStationId(stationAdmin, req);
      } catch (ex) {
        if (ex.code === "STATION_NOT_ASSIGNED") {
          req.rCode = 0;
          return ResponseMiddleware(req, res, next, "Station not assigned to station admin");
        }
        if (ex.code === "STATION_MISMATCH") {
          req.rCode = 0;
          return ResponseMiddleware(req, res, next, "station mismatch");
        }
        throw ex;
      }

      const requestedStatus =
        String(req.body.status || "").trim().toUpperCase() ||
        statusActionMap[String(req.body.action || "").trim().toUpperCase()] ||
        "";

      const vehicle = await VehicleService().updateStationVehicleStatus({
        stationId,
        vehicleId: req.params.vehicleId,
        status: requestedStatus,
        note: req.body.note || req.body.reason || "",
      });

      if (!vehicle) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Vehicle not found");
      }

      req.rData = { vehicle };
      return ResponseMiddleware(req, res, next, "status changed successfully");
    } catch (ex) {
      if (ex.code === "INVALID_STATUS") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Invalid status");
      }
      if (ex.code === "VEHICLE_NOT_APPROVED") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, ex.message);
      }
      if (ex.code === "VEHICLE_IN_RIDE") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Vehicle is currently in ride");
      }
      if (ex.code === "VEHICLE_REMOVED") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, ex.message);
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Something went wrong");
    }
  },
};
