const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const { generateToken } = require("../util/tokenUtils");
const { comparePassword, hashPassword } = require("../util/password");
const UserService = require("../services/UserService");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const sanitizeAdmin = (admin) => {
  if (!admin) return admin;
  const data = admin.toObject ? admin.toObject() : { ...admin };
  delete data.passwordHash;
  return data;
};

module.exports = {
  login: async (req, res, next) => {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!email || !password) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "email and password are required");
    }

    const admin = await UserService().findByEmailDoc(email, ["ADMIN"]);
    if (!admin) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid credentials");
    }

    const ok = await comparePassword(password, admin.passwordHash);
    if (!ok) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid credentials");
    }

    const token = generateToken({ user_id: admin._id.toString(), role: admin.role });
    req.rData = { token, admin: sanitizeAdmin(admin) };
    req.msg = "admin_login_success";
    return ResponseMiddleware(req, res, next);
  },

  changePassword: async (req, res, next) => {
    const adminId = req.body.adminId;
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    if (!currentPassword || !newPassword) {
      req.rCode = 0;
      return ResponseMiddleware(
        req,
        res,
        next,
        "currentPassword and newPassword are required",
      );
    }

    const admin = await UserService().fetchDocByQuery({ _id: adminId, role: "ADMIN" });
    if (!admin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Admin not found");
    }

    const ok = await comparePassword(currentPassword, admin.passwordHash);
    if (!ok) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Incorrect current password");
    }

    admin.passwordHash = await hashPassword(newPassword);
    await admin.save();

    req.rData = { ok: true };
    req.msg = "password_changed";
    return ResponseMiddleware(req, res, next);
  },
};
