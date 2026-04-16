const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const AdminPanelService = require("../services/AdminPanelService");

const toInt = (value, fallback) => {
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  list: async (req, res, next) => {
    const data = await AdminPanelService().listMaintenanceLogs({
      status: req.query.status,
      q: req.query.q,
      page: toInt(req.query.page, 1),
      limit: toInt(req.query.limit, 20),
    });
    req.rData = data;
    return ResponseMiddleware(req, res, next, "maintenance logs fetched successfully");
  },

  detail: async (req, res, next) => {
    const request = await AdminPanelService().getMaintenanceLogById(req.params.requestId);
    if (!request) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Maintenance request not found");
    }
    req.rData = { request };
    return ResponseMiddleware(req, res, next, "maintenance detail fetched successfully");
  },

  create: async (req, res, next) => {
    try {
      const request = await AdminPanelService().createMaintenanceLog({
        adminId: req.body.adminId,
        payload: req.body || {},
      });
      req.rData = { request };
      return ResponseMiddleware(req, res, next, "maintenance request created successfully");
    } catch (ex) {
      if (ex.code === "INVALID_VEHICLE") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "vehicleId is required");
      }
      if (ex.code === "VEHICLE_NOT_FOUND") {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, ex.message);
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const request = await AdminPanelService().updateMaintenanceStatus({
        adminId: req.body.adminId,
        requestId: req.params.requestId,
        status: req.body.status,
        resolutionNote: req.body.resolutionNote || req.body.note || "",
      });
      if (!request) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Maintenance request not found");
      }
      req.rData = { request };
      return ResponseMiddleware(req, res, next, "maintenance status updated successfully");
    } catch (ex) {
      if (ex.code === "INVALID_MAINTENANCE_STATUS") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Invalid maintenance status");
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },
};
