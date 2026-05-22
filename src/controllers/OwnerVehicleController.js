const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const VehicleService = require("../services/VehicleService");

module.exports = {
  list: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const status = req.query.status;
    const vehicles = await VehicleService().list(ownerId, { status });
    req.rData = { vehicles };
    return ResponseMiddleware(req, res, next, "vehicles fetched");
  },

  create: async (req, res, next) => {
    try {
      const ownerId = req.body.ownerId;
      const vehicle = await VehicleService().createDraft(ownerId, req.body || {}, req.files || null);
      req.rData = { vehicle };
      return ResponseMiddleware(req, res, next, "vehicle created");
    } catch (ex) {
      if (ex.code === "STATION_CAPACITY_EXCEEDED") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, ex.message);
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Could not create vehicle");
    }
  },

  detail: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const vehicle = await VehicleService().detail(ownerId, req.params.vehicleId);
    if (!vehicle) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Vehicle not found");
    }
    req.rData = { vehicle };
    return ResponseMiddleware(req, res, next, "vehicle detail");
  },

  update: async (req, res, next) => {
    try {
      const ownerId = req.body.ownerId;
      const vehicle = await VehicleService().update({
        ownerId,
        vehicleId: req.params.vehicleId,
        payload: req.body || {},
        files: req.files || null,
      });
      if (!vehicle) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Vehicle not found");
      }
      req.rData = { vehicle };
      return ResponseMiddleware(req, res, next, "vehicle updated");
    } catch (ex) {
      if (ex.code === "REQUIRED_FIELDS_MISSING") {
        req.rCode = 0;
        req.msg = "required_fields_missing";
        return ResponseMiddleware(req, res, next);
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Something went wrong");
    }
  },

  requestRemoval: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const vehicle = await VehicleService().requestRemoval(ownerId, req.params.vehicleId);
    if (!vehicle) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Vehicle not found");
    }
    req.rData = { vehicle };
    return ResponseMiddleware(req, res, next, "removal requested");
  },
};
