const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const UserService = require("../services/UserService");
const AuditLogService = require("../services/AuditLogService");
const { hashPassword, normalizePassword } = require("../util/password");
const { models, mongoose } = require("../models");

const STATION_ADMIN_ROLES = ["STATION_ADMIN", "SUB_STATION_ADMIN"];
const normalizeStationAdminRole = (role) => {
  const normalized = String(role || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "STATIONADMIN") return "STATION_ADMIN";
  if (normalized === "SUBSTATIONADMIN" || normalized === "SUB_STAION_ADMIN") return "SUB_STATION_ADMIN";
  return normalized;
};

const toInt = (v, fallback) => {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
};

const sanitizeAdmin = (admin) => {
  if (!admin) return admin;
  const data = admin.toObject ? admin.toObject() : { ...admin };
  delete data.passwordHash;
  return data;
};

module.exports = {
  listStationAdmins: async (req, res, next) => {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limitRaw = toInt(req.query.limit, 20);
    const limit = Math.min(100, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const query = { role: { $in: STATION_ADMIN_ROLES } };
    const [total, admins] = await Promise.all([
      models.User.countDocuments(query),
      models.User.find(query)
        .sort({ createdAt: -1 })
        .select("-passwordHash")
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
    const { name, email, mobile, password, stationId, role } = req.body || {};
    if (!role) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "role is required");
    }
    const normalizedRole = normalizeStationAdminRole(role);

    if (!name || !email || !password) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "name, email, password are required");
    }

    if (!["STATION_ADMIN", "SUB_STATION_ADMIN"].includes(normalizedRole)) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "role must be STATION_ADMIN or SUB_STATION_ADMIN");
    }

    if (normalizedRole === "SUB_STATION_ADMIN" && !stationId) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "stationId is required for SUB_STATION_ADMIN");
    }
    if (stationId && !mongoose.Types.ObjectId.isValid(String(stationId))) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid stationId");
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

    if (stationId) {
      const station = await models.Station.findById(stationId).lean();
      if (!station) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Station not found");
      }
    }

    const passwordHash = await hashPassword(normalizePassword(password));
    const admin = await userService.create({
      role: normalizedRole,
      name: String(name).trim(),
      email: normalizedEmail,
      mobile: normalizedMobile,
      passwordHash,
      stationId: stationId || undefined,
      isActive: true,
    });

    await AuditLogService().create({
      actorId: req.body.adminId,
      action: "STATION_ADMIN_CREATED",
      entityType: "User",
      entityId: admin._id,
      after: sanitizeAdmin(admin),
      meta: { stationId },
    });

    req.rData = { admin: sanitizeAdmin(admin) };
    req.msg = "success";
    return ResponseMiddleware(req, res, next);
  },
};
