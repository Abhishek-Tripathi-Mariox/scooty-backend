const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const { generateOtp, storeOtp, verifyOtp } = require("../util/otpUtil");
const { generateToken } = require("../util/tokenUtils");
const UserService = require("../services/UserService");
const AuditLogService = require("../services/AuditLogService");

const normalizeMobile = (mobile) => String(mobile || "").replace(/\D/g, "");
const normalizeText = (value) => String(value || "").trim();
const getRoleConflictMessage = (role) => {
  const normalizedRole = String(role || "").trim().toUpperCase();
  if (normalizedRole === "OWNER") {
    return "This mobile number is already registered as an OWNER account. Please use the owner app.";
  }
  if (normalizedRole === "USER") {
    return "This mobile number is already registered as a USER account. Please use the user app.";
  }
  return `This mobile number is already registered as a ${normalizedRole || "different"} account.`;
};
const serializeUser = (user) => {
  if (!user) return user;
  const data = user.toObject ? user.toObject() : { ...user };
  data.address = data.address || data.adress || "";
  return data;
};

const ensureUserRoleAvailability = async (mobile) => {
  const userService = UserService();
  const existing = await userService.fetchDocByQuery({ mobile });

  if (existing && existing.role !== "USER") {
    const err = new Error(getRoleConflictMessage(existing.role));
    err.code = "ROLE_CONFLICT";
    throw err;
  }

  return existing;
};

const ensureUserProfile = async ({ mobile, name, address, city }) => {
  const userService = UserService();
  const existing = await ensureUserRoleAvailability(mobile);

  if (!existing) {
    return await userService.create({
      mobile,
      role: "USER",
      name,
      adress: address,
      city,
    });
  }

  if (!existing.name) existing.name = name;
  if (!existing.adress) existing.adress = address;
  if (!existing.city) existing.city = city;
  await existing.save();
  return existing;
};

module.exports = {
  sendOtp: async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    if (!mobile || mobile.length < 10) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid mobile number");
    }

    try {
      await ensureUserRoleAvailability(mobile);
    } catch (error) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, error.message || "Unable to send OTP");
    }

    // const otp = generateOtp();
    const otp = "1155";
    await storeOtp(mobile, otp);
    await AuditLogService().create({
      actorRole: "USER",
      action: "USER_OTP_SENT",
      entityType: "Auth",
      meta: { mobile },
    });
    req.rData = {
      mobile,
      otp,
    };
    req.msg = "otp_sent";
    return ResponseMiddleware(req, res, next);
  },
  signup: async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    const name = normalizeText(req.body.name);
    const address = normalizeText(req.body.address || req.body.adress);
    const city = normalizeText(req.body.city);

    if (!name || !address || !mobile || !city) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "name, address, mobile and city are required");
    }

    if (mobile.length < 10) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid mobile number");
    }

    let user;
    try {
      user = await ensureUserProfile({ mobile, name, address, city });
    } catch (error) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, error.message || "Unable to create user");
    }

    await AuditLogService().create({
      actorRole: "USER",
      action: "USER_SIGNUP_SUCCESS",
      entityType: "Auth",
      entityId: user._id,
      meta: { mobile },
    });

    const token = generateToken({ user_id: user._id.toString(), role: "USER" });
    req.rData = {
      token,
      user: serializeUser(user),
    };
    req.msg = "signup_success";
    return ResponseMiddleware(req, res, next);
  },

  verifyOtp: async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    const otp = String(req.body.otp || "").trim();
    const name = normalizeText(req.body.name);
    const address = normalizeText(req.body.address || req.body.adress);
    const city = normalizeText(req.body.city);

    if (!mobile || mobile.length < 10 || !otp) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Mobile and OTP are required");
    }

    const ok = await verifyOtp(mobile, otp);
    if (!ok) {
      req.rCode = 0;
      req.msg = "incorrect_otp";
      return ResponseMiddleware(req, res, next);
    }

    const userService = UserService();
    try {
      await ensureUserRoleAvailability(mobile);
    } catch (error) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, error.message || "Unable to verify OTP");
    }

    let user = await userService.fetchDocByQuery({ mobile });
    if (!user) {
      user = await userService.create({
        mobile,
        role: "USER",
        name: name || undefined,
        adress: address || undefined,
        city: city || undefined,
      });
    } else {
      if (name && !user.name) user.name = name;
      if (address && !user.adress) user.adress = address;
      if (city && !user.city) user.city = city;
    }
    await user.save();
    await AuditLogService().create({
      actorId: user._id,
      actorRole: "USER",
      action: "USER_OTP_VERIFIED",
      entityType: "Auth",
      entityId: user._id,
      meta: { mobile },
    });

    const token = generateToken({ user_id: user._id.toString(), role: "USER" });

    req.rData = {
      token,
      user: serializeUser(user),
    };
    req.msg = "otp_verified";
    return ResponseMiddleware(req, res, next);
  },
};
