const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const OwnerDashboardService = require("../services/OwnerDashboardService");

module.exports = {
  dashboard: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const data = await OwnerDashboardService().getDashboard(ownerId);
    if (!data) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Owner not found");
    }

    req.rData = { dashboard: data };
    req.msg = "dashboard_stats_fetched";
    return ResponseMiddleware(req, res, next);
  },
};

