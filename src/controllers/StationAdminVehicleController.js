const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const VehicleService = require("../services/VehicleService");
const UserService = require("../services/UserService");

const statusActionMap = {
  MARK_MAINTENANCE: "MAINTENANCE",
  MARK_ACTIVE: "ACTIVE",
  ASSIGN_CHARGING: "CHARGING",
  MARK_INACTIVE: "INACTIVE",
};

const toInt = (value, fallback) => {
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveStationId = (stationAdmin, req) => {
  const requestStationId = String(req.query.stationId || req.body.stationId || "").trim();
  const assignedStationId = String(stationAdmin?.stationId || "").trim();

  if (assignedStationId) {
    if (requestStationId && requestStationId !== assignedStationId) {
      const err = new Error("station mismatch");
      err.code = "STATION_MISMATCH";
      throw err;
    }
    return assignedStationId;
  }

  if (requestStationId) return requestStationId;

  const err = new Error("station not assigned");
  err.code = "STATION_NOT_ASSIGNED";
  throw err;
};

const loadStationAdmin = async (stationAdminId) => {
  const stationAdmin = await UserService().fetchById(stationAdminId);
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
      stationId = resolveStationId(stationAdmin, req);
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
      stationId = resolveStationId(stationAdmin, req);
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

    const vehicle = await VehicleService().createDraft(
      stationAdmin._id,
      { ...(req.body || {}), stationId },
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
      stationId = resolveStationId(stationAdmin, req);
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
        stationId = resolveStationId(stationAdmin, req);
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
      if (ex.code === "VEHICLE_IN_RIDE") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Vehicle is currently in ride");
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Something went wrong");
    }
  },
};
