const jwt = require("jsonwebtoken");
const ResponseMiddleware = require("./ResponseMiddleware");
const UserService = require("../services/UserService");

const JWTSECRET = process.env.JWTSECRET;

module.exports = () => {
  const verifyAdminToken = async (req, res, next) => {
    const auth = req.headers.authorization;
    try {
      if (!auth) throw new Error("invalid_token");
      const parts = auth.split(" ");
      const token = parts[1];
      if (!token) throw new Error("invalid_token");

      const payload = jwt.verify(token, JWTSECRET);
      const userId = payload.user_id;
      if (!userId) throw new Error("invalid_token");

      const admin = await UserService().fetchByQuery({ _id: userId });
      if (!admin) throw new Error("invalid_token");
      if (!["ADMIN"].includes(admin.role)) {
        throw new Error("invalid_token");
      }
      if (admin.isActive === false) {
        throw new Error("invalid_token");
      }

      req.body = {
        ...(req.body || {}),
        adminId: admin._id,
        adminRole: admin.role,
        adminPermissions: Array.isArray(admin.adminPermissions) ? admin.adminPermissions : [],
        stationId: admin.stationId,
      };
      return next();
    } catch (ex) {
      req.rCode = 3;
      req.msg = "invalid_token";
      return ResponseMiddleware(req, res, next);
    }
  };

  const requireRole = (...roles) => {
    return (req, res, next) => {
      const role = req.body.adminRole;
      if (!role || (roles.length > 0 && !roles.includes(role))) {
        req.rCode = 4;
        req.msg = "forbidden";
        return ResponseMiddleware(req, res, next);
      }
      return next();
    };
  };

  const requirePermission = (...permissions) => {
    return (req, res, next) => {
      const granted = Array.isArray(req.body.adminPermissions) ? req.body.adminPermissions : [];
      if (granted.length === 0) return next();
      if (granted.includes("*")) return next();
      if (permissions.length === 0) return next();

      const ok = permissions.some((permission) => granted.includes(permission));
      if (!ok) {
        req.rCode = 4;
        req.msg = "forbidden";
        return ResponseMiddleware(req, res, next);
      }
      return next();
    };
  };

  return { verifyAdminToken, requireRole, requirePermission };
};
