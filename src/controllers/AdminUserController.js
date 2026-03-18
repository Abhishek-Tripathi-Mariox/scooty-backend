const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const UserService = require("../services/UserService");
const { hashPassword } = require("../util/password");
const { models } = require("../models");

const toInt = (v, fallback) => {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = {
  listStationAdmins: async (req, res, next) => {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limitRaw = toInt(req.query.limit, 20);
    const limit = Math.min(100, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const query = { role: "STATION_ADMIN" };
    const [total, admins] = await Promise.all([
      models.User.countDocuments(query),
      models.User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    req.rData = {
      admins,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
    req.msg = "users_list";
    return ResponseMiddleware(req, res, next);
  },

  createStationAdmin: async (req, res, next) => {
    const { name, email, mobile, password, stationId } = req.body || {};

    if (!name || !email || !password) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "name, email, password are required");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid email");
    }

    const userService = UserService();
    const emailInUse = await userService.emailInUse(normalizedEmail);
    if (emailInUse) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Email already in use");
    }

    const normalizedMobile = mobile ? String(mobile).replace(/\D/g, "") : undefined;
    if (normalizedMobile) {
      if (normalizedMobile.length < 10) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Invalid mobile");
      }
      const mobileInUse = await userService.mobileInUse(normalizedMobile);
      if (mobileInUse) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Mobile already in use");
      }
    }

    const passwordHash = await hashPassword(password);
    const admin = await userService.create({
      role: "STATION_ADMIN",
      name: String(name).trim(),
      email: normalizedEmail,
      mobile: normalizedMobile,
      passwordHash,
      stationId: stationId || undefined,
      isActive: true,
    });

    req.rData = { admin };
    req.msg = "success";
    return ResponseMiddleware(req, res, next);
  },
};
