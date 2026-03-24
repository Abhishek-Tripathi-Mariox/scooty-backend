const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const UserService = require("../services/UserService");
const { models, mongoose } = require("../models");

const sanitizeAdmin = (admin) => {
  if (!admin) return admin;
  const data = admin.toObject ? admin.toObject() : { ...admin };
  delete data.passwordHash;
  return data;
};

module.exports = {
  me: async (req, res, next) => {
    const adminId = req.body.adminId;
    const admin = await UserService().fetchDocByQuery({ _id: adminId, role: "ADMIN" });
    if (!admin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Admin not found");
    }
    req.rData = { admin: sanitizeAdmin(admin) };
    req.msg = "profile_fetched";
    return ResponseMiddleware(req, res, next);
  },

  update: async (req, res, next) => {
    const adminId = req.body.adminId;
    const { name, email, mobile, stationId } = req.body || {};

    const service = UserService();
    const admin = await service.fetchDocByQuery({ _id: adminId, role: "ADMIN" });
    if (!admin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Admin not found");
    }

    if (typeof name === "string" && name.trim()) admin.name = name.trim();

    if (typeof email === "string") {
      const normalized = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Invalid email");
      }
      const inUse = await service.emailInUse(normalized, admin._id);
      if (inUse) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Email already in use");
      }
      admin.email = normalized;
    }

    if (typeof mobile === "string") {
      const normalized = mobile.replace(/\D/g, "");
      if (normalized && normalized.length < 10) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Invalid mobile");
      }
      if (normalized) {
        const inUse = await service.mobileInUse(normalized, admin._id);
        if (inUse) {
          req.rCode = 0;
          return ResponseMiddleware(req, res, next, "Mobile already in use");
        }
      }
      admin.mobile = normalized || admin.mobile;
    }

    if (stationId) {
      if (!mongoose.Types.ObjectId.isValid(String(stationId))) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Invalid stationId");
      }
      const station = await models.Station.findById(stationId).lean();
      if (!station) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Station not found");
      }
      admin.stationId = stationId;
    }

    await admin.save();
    req.rData = { admin: sanitizeAdmin(admin) };
    req.msg = "profile_updated";
    return ResponseMiddleware(req, res, next);
  },
};
