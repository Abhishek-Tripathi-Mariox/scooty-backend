const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const UserService = require("../services/UserService");

module.exports = {
  me: async (req, res, next) => {
    const stationAdminId = req.body.stationAdminId;
    const stationAdmin = await UserService().fetchById(stationAdminId);
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }
    req.rData = { stationAdmin };
    req.msg = "profile_fetched";
    return ResponseMiddleware(req, res, next);
  },

  update: async (req, res, next) => {
    const stationAdminId = req.body.stationAdminId;
    const { name, email, mobile } = req.body || {};

    const userService = UserService();
    const stationAdmin = await userService.fetchDocByQuery({
      _id: stationAdminId,
      role: "STATION_ADMIN",
    });
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    if (typeof name === "string" && name.trim()) stationAdmin.name = name.trim();

    if (typeof email === "string") {
      const normalized = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Invalid email");
      }
      const inUse = await userService.emailInUse(normalized, stationAdmin._id);
      if (inUse) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Email already in use");
      }
      stationAdmin.email = normalized;
    }

    if (typeof mobile === "string") {
      const normalized = mobile.replace(/\D/g, "");
      if (normalized && normalized.length < 10) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Invalid mobile");
      }
      if (normalized) {
        const inUse = await userService.mobileInUse(normalized, stationAdmin._id);
        if (inUse) {
          req.rCode = 0;
          return ResponseMiddleware(req, res, next, "Mobile already in use");
        }
      }
      stationAdmin.mobile = normalized || stationAdmin.mobile;
    }

    await stationAdmin.save();

    req.rData = { stationAdmin };
    req.msg = "profile_updated";
    return ResponseMiddleware(req, res, next);
  },
};

