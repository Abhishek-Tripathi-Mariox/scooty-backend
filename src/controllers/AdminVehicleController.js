const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const AdminPanelService = require("../services/AdminPanelService");

const toInt = (value, fallback) => {
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  create: async (req, res, next) => {
    try {
      const vehicle = await AdminPanelService().createVehicle({
        adminId: req.body.adminId,
        payload: req.body,
      });

      req.rData = { vehicle };
      return ResponseMiddleware(req, res, next, "vehicle created successfully");
    } catch (ex) {
      if (ex.code === "STATION_NOT_FOUND") {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Station not found");
      }
      if (ex.code === "INVALID_VEHICLE_INPUT") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, ex.message || "Invalid vehicle input");
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  list: async (req, res, next) => {
    const data = await AdminPanelService().listVehicles({
      stationId: req.query.stationId,
      status: req.query.status,
      q: req.query.q,
      page: toInt(req.query.page, 1),
      limit: toInt(req.query.limit, 20),
    });
    req.rData = data;
    return ResponseMiddleware(req, res, next, "vehicles fetched successfully");
  },

  detail: async (req, res, next) => {
    const vehicle = await AdminPanelService().getVehicleById(req.params.vehicleId);
    if (!vehicle) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Vehicle not found");
    }
    req.rData = { vehicle };
    return ResponseMiddleware(req, res, next, "vehicle detail fetched successfully");
  },

  updateStatus: async (req, res, next) => {
    try {
      const vehicle = await AdminPanelService().updateVehicleStatus({
        adminId: req.body.adminId,
        vehicleId: req.params.vehicleId,
        status: req.body.status || req.body.action,
        note: req.body.note || req.body.reason || "",
      });

      if (!vehicle) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Vehicle not found");
      }

      req.rData = { vehicle };
      return ResponseMiddleware(req, res, next, "vehicle status updated successfully");
    } catch (ex) {
      if (ex.code === "INVALID_STATUS") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Invalid status");
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },
};
