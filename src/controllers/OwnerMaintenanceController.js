const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const OwnerMaintenanceService = require("../services/OwnerMaintenanceService");

module.exports = {
  list: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const status = req.query.status;
    const requests = await OwnerMaintenanceService().list(ownerId, { status });
    req.rData = { requests };
    return ResponseMiddleware(req, res, next, "maintenance requests fetched");
  },

  create: async (req, res, next) => {
    try {
      const ownerId = req.body.ownerId;
      const request = await OwnerMaintenanceService().create({
        ownerId,
        payload: req.body || {},
        files: req.files || null,
      });
      if (!request) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Vehicle not found");
      }
      req.rData = { request };
      return ResponseMiddleware(req, res, next, "maintenance request created");
    } catch (ex) {
      if (ex.code === "REQUIRED_FIELDS_MISSING") {
        req.rCode = 0;
        req.msg = "required_fields_missing";
        return ResponseMiddleware(req, res, next);
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  detail: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const request = await OwnerMaintenanceService().fetchById(ownerId, req.params.requestId);
    if (!request) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Request not found");
    }
    req.rData = { request };
    return ResponseMiddleware(req, res, next, "maintenance request detail");
  },
};

