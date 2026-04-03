const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const { generateToken } = require("../util/tokenUtils");
const { comparePassword, hashPassword, normalizePassword } = require("../util/password");
const {
  createOtpTransaction,
  getOtpTransaction,
  refreshOtpTransaction,
  storeOtp,
  verifyOtp,
} = require("../util/otpUtil");
const { adminOtpEmailTemplate } = require("../util/emailTemplates");
const mailService = require("../util/mail")();
const UserService = require("../services/UserService");
const AuditLogService = require("../services/AuditLogService");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const buildAdminOtp = () => process.env.MASTER_OTP_LOGIN || "123456";
const sanitizeAdmin = (admin) => {
  if (!admin) return admin;
  const data = admin.toObject ? admin.toObject() : { ...admin };
  delete data.passwordHash;
  return data;
};
const sendAdminOtpEmail = async ({
  email,
  otp,
  name = "Admin",
  purpose = "login",
  expiresInSec = 300,
}) => {
  const subject =
    purpose === "forgot-password"
      ? "Scooty Rental - Admin Password Reset OTP"
      : "Scooty Rental - Admin Login OTP";

  const html = adminOtpEmailTemplate({
    name,
    otp,
    expiresInSec,
    purpose,
  });

  const text = `Your OTP for ${purpose === "forgot-password" ? "password reset" : "login"} is ${otp}. It expires in ${Math.max(
    1,
    Math.ceil(Number(expiresInSec || 300) / 60),
  )} minute(s).`;

  await mailService.sendMail(email, subject, text, html);
};

const getAdminByEmail = async (email) => await UserService().findByEmailDoc(email, ["ADMIN"]);

module.exports = {
  login: async (req, res, next) => {
    const email = normalizeEmail(req.body.email);
    const password = normalizePassword(req.body.password);
    if (!email || !password) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "email and password are required");
    }

    const admin = await getAdminByEmail(email);
    if (!admin) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid credentials");
    }
    if (admin.isActive === false) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid credentials");
    }

    const ok = await comparePassword(password, admin.passwordHash);
    if (!ok) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid credentials");
    }

    const token = generateToken({ user_id: admin._id.toString(), role: admin.role });
    await AuditLogService().create({
      actorId: admin._id,
      actorRole: "ADMIN",
      action: "ADMIN_LOGIN_SUCCESS",
      entityType: "Auth",
      entityId: admin._id,
      meta: { email },
    });
    req.rData = { token, admin: sanitizeAdmin(admin) };
    req.msg = "admin_login_success";
    return ResponseMiddleware(req, res, next);
  },

  changePassword: async (req, res, next) => {
    const adminId = req.body.adminId;
    const currentPassword = normalizePassword(req.body.currentPassword);
    const newPassword = normalizePassword(req.body.newPassword);
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
    if (admin.isActive === false) {
      req.rCode = 4;
      return ResponseMiddleware(req, res, next, "forbidden");
    }

    const ok = await comparePassword(currentPassword, admin.passwordHash);
    if (!ok) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Incorrect current password");
    }

    admin.passwordHash = await hashPassword(newPassword);
    await admin.save();

    await AuditLogService().create({
      actorId: adminId,
      action: "ADMIN_PASSWORD_CHANGED",
      entityType: "User",
      entityId: admin._id,
      meta: { selfService: true },
    });

    req.rData = { ok: true };
    req.msg = "password_changed";
    return ResponseMiddleware(req, res, next);
  },

  forgotPasswordSendOtp: async (req, res, next) => {
    const email = normalizeEmail(req.body.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Valid email is required");
    }

    const admin = await getAdminByEmail(email);
    if (!admin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Admin not found");
    }

    const identifier = `admin_forgot:${email}`;
    const { transactionId, expiresInSec } = await createOtpTransaction(identifier);
    // const otp = buildAdminOtp();
    const otp=process.env.MASTER_OTP_LOGIN || "123456";
    await storeOtp(identifier, otp);
    await sendAdminOtpEmail({
      email,
      otp,
      name: admin.name || "Admin",
      purpose: "forgot-password",
      expiresInSec,
    });

    req.rData = {
      email,
      transactionId,
      expiresInSec,
      otp: process.env.RETURN_OTP === "true" ? otp : undefined,
    };
    await AuditLogService().create({
      actorRole: "ADMIN",
      action: "ADMIN_OTP_SENT",
      entityType: "Auth",
      meta: { email, purpose: "forgot-password" },
    });
    req.msg = "otp_sent";
    return ResponseMiddleware(req, res, next);
  },

  forgotPasswordResendOtp: async (req, res, next) => {
    const transactionId = String(req.body.transactionId || "").trim();
    if (!transactionId) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "transactionId is required");
    }

    const txn = await getOtpTransaction(transactionId);
    if (!txn?.identifier || !String(txn.identifier).startsWith("admin_forgot:")) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid or expired transactionId");
    }

    const otp = buildAdminOtp();
    await storeOtp(txn.identifier, otp);
    await refreshOtpTransaction(transactionId);

    const email = String(txn.identifier).replace(/^admin_forgot:/, "");
    const admin = await getAdminByEmail(email);
    if (admin) {
      await sendAdminOtpEmail({
        email,
        otp,
        name: admin.name || "Admin",
        purpose: "forgot-password",
        expiresInSec: 300,
      });
    }
    req.rData = {
      email,
      transactionId,
      otp: process.env.RETURN_OTP === "true" ? otp : undefined,
    };
    await AuditLogService().create({
      actorRole: "ADMIN",
      action: "ADMIN_OTP_RESENT",
      entityType: "Auth",
      meta: { email, purpose: "forgot-password" },
    });
    req.msg = "otp_sent";
    return ResponseMiddleware(req, res, next);
  },

  forgotPasswordReset: async (req, res, next) => {
    const transactionId = String(req.body.transactionId || "").trim();
    const otp = String(req.body.otp || "").trim();
    const newPassword = normalizePassword(req.body.newPassword);

    if (!transactionId || !otp || !newPassword) {
      req.rCode = 0;
      return ResponseMiddleware(
        req,
        res,
        next,
        "transactionId, otp and newPassword are required",
      );
    }

    const txn = await getOtpTransaction(transactionId);
    if (!txn?.identifier || !String(txn.identifier).startsWith("admin_forgot:")) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid or expired transactionId");
    }

    const ok = await verifyOtp(txn.identifier, otp);
    if (!ok) {
      req.rCode = 0;
      req.msg = "incorrect_otp";
      return ResponseMiddleware(req, res, next);
    }

    const email = String(txn.identifier).replace(/^admin_forgot:/, "");
    const admin = await getAdminByEmail(email);
    if (!admin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Admin not found");
    }

    admin.passwordHash = await hashPassword(newPassword);
    await admin.save();

    await AuditLogService().create({
      actorId: admin._id,
      actorRole: "ADMIN",
      action: "ADMIN_PASSWORD_RESET",
      entityType: "User",
      entityId: admin._id,
      meta: { email },
    });

    req.rData = { ok: true };
    req.msg = "password_changed";
    return ResponseMiddleware(req, res, next);
  },
};
