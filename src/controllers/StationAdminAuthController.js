const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const UserService = require("../services/UserService");
const { generateToken } = require("../util/tokenUtils");
const { comparePassword, hashPassword } = require("../util/password");
const {
  generateOtp,
  storeOtp,
  verifyOtp,
  createOtpTransaction,
  getOtpTransaction,
  refreshOtpTransaction,
} = require("../util/otpUtil");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

module.exports = {
  login: async (req, res, next) => {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!email || !password) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "email and password are required");
    }

    const stationAdmin = await UserService().findByEmailDoc(email, ["STATION_ADMIN"]);
    if (!stationAdmin) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid credentials");
    }

    const ok = await comparePassword(password, stationAdmin.passwordHash);
    if (!ok) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid credentials");
    }

    const token = generateToken({
      user_id: stationAdmin._id.toString(),
      role: "STATION_ADMIN",
    });
    req.rData = { token, stationAdmin };
    req.msg = "admin_login_success";
    return ResponseMiddleware(req, res, next);
  },

  sendOtp: async (req, res, next) => {
    const email = normalizeEmail(req.body.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Valid email is required");
    }

    const stationAdmin = await UserService().findByEmailDoc(email, ["STATION_ADMIN"]);
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    const identifier = `stationadmin:${email}`;
    const { transactionId, expiresInSec } = await createOtpTransaction(identifier);
    const otp = generateOtp();
    await storeOtp(identifier, otp);

    // Integrate real email provider here (SES/SMTP/etc.). For now, log only.
    console.log("StationAdmin OTP generated", { email });

    req.rData = {
      email,
      transactionId,
      expiresInSec,
      otp: process.env.RETURN_OTP === "true" ? otp : undefined,
    };
    req.msg = "otp_sent";
    return ResponseMiddleware(req, res, next);
  },

  resendOtp: async (req, res, next) => {
    const transactionId = String(req.body.transactionId || "").trim();
    if (!transactionId) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "transactionId is required");
    }

    const txn = await getOtpTransaction(transactionId);
    if (!txn?.identifier || !String(txn.identifier).startsWith("stationadmin:")) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid or expired transactionId");
    }

    // NOTE: No DB query here (as requested)
    // const otp = generateOtp();
    const otp = process.env.MASTER_OTP_LOGIN || "123456"; // For development/testing, use a fixed OTP or environment variable 

    await storeOtp(txn.identifier, otp);
    await refreshOtpTransaction(transactionId);

    const email = String(txn.identifier).replace(/^stationadmin:/, "");
    req.rData = {
      email,
      transactionId,
      otp: process.env.RETURN_OTP === "true" ? otp : undefined,
    };
    req.msg = "otp_sent";
    return ResponseMiddleware(req, res, next);
  },

  verifyOtp: async (req, res, next) => {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();
    if (!email || !otp) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "email and otp are required");
    }

    const stationAdmin = await UserService().findByEmailDoc(email, ["STATION_ADMIN"]);
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    const ok = await verifyOtp(`stationadmin:${email}`, otp);
    if (!ok) {
      req.rCode = 0;
      req.msg = "incorrect_otp";
      return ResponseMiddleware(req, res, next);
    }

    const token = generateToken({
      user_id: stationAdmin._id.toString(),
      role: "STATION_ADMIN",
    });
    req.rData = { token, stationAdmin };
    req.msg = "otp_verified";
    return ResponseMiddleware(req, res, next);
  },

  changePassword: async (req, res, next) => {
    const stationAdminId = req.body.stationAdminId;
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

    const stationAdmin = await UserService().fetchDocByQuery({
      _id: stationAdminId,
      role: "STATION_ADMIN",
    });
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    const ok = await comparePassword(currentPassword, stationAdmin.passwordHash);
    if (!ok) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Incorrect current password");
    }

    stationAdmin.passwordHash = await hashPassword(newPassword);
    await stationAdmin.save();

    req.rData = { ok: true };
    req.msg = "password_changed";
    return ResponseMiddleware(req, res, next);
  },

  // Forgot password flow (existing station admin only)
  forgotPasswordSendOtp: async (req, res, next) => {
    const email = normalizeEmail(req.body.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Valid email is required");
    }

    const stationAdmin = await UserService().findByEmailDoc(email, ["STATION_ADMIN"]);
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    const identifier = `stationadmin_forgot:${email}`;
    const { transactionId, expiresInSec } = await createOtpTransaction(identifier);
    // const otp = generateOtp();
    const otp=process.env.MASTER_OTP_LOGIN || "123456"; // For development/testing, use a fixed OTP or environment variable   
    await storeOtp(identifier, otp);

    console.log("StationAdmin forgot-password OTP generated", { email });

    req.rData = {
      email,
      transactionId,
      expiresInSec,
      otp: otp
    };
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
    if (!txn?.identifier || !String(txn.identifier).startsWith("stationadmin_forgot:")) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid or expired transactionId");
    }

    // NOTE: No DB query here (as requested)
    // const otp = generateOtp();
    const otp=process.env.MASTER_OTP_LOGIN
    await storeOtp(txn.identifier, otp);
    await refreshOtpTransaction(transactionId);

    const email = String(txn.identifier).replace(/^stationadmin_forgot:/, "");
    req.rData = {
      email,
      transactionId,
      otp
    };
    req.msg = "otp_sent";
    return ResponseMiddleware(req, res, next);
  },

  forgotPasswordReset: async (req, res, next) => {
    const transactionId = String(req.body.transactionId || "").trim();
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

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
    if (!txn?.identifier || !String(txn.identifier).startsWith("stationadmin_forgot:")) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid or expired transactionId");
    }

    const ok = await verifyOtp(txn.identifier, otp);
    if (!ok) {
      req.rCode = 0;
      req.msg = "incorrect_otp";
      return ResponseMiddleware(req, res, next);
    }

    const email = String(txn.identifier).replace(/^stationadmin_forgot:/, "");
    const stationAdmin = await UserService().findByEmailDoc(email, ["STATION_ADMIN"]);
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    stationAdmin.passwordHash = await hashPassword(newPassword);
    await stationAdmin.save();

    req.rData = { ok: true };
    req.msg = "password_changed";
    return ResponseMiddleware(req, res, next);
  },
};
