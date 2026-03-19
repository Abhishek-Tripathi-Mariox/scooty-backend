const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const OwnerSettingsService = require("../services/OwnerSettingsService");

module.exports = {
  get: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const settings = await OwnerSettingsService().fetch(ownerId);
    if (!settings) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Owner not found");
    }
    req.rData = { settings };
    return ResponseMiddleware(req, res, next, "settings fetched");
  },

  update: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const settings = await OwnerSettingsService().update(ownerId, req.body || {});
    if (!settings) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Owner not found");
    }
    req.rData = { settings };
    return ResponseMiddleware(req, res, next, "settings updated");
  },
};

