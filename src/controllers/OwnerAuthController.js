const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const { generateToken } = require("../util/tokenUtils");
const { generateOtp, storeOtp, verifyOtp } = require("../util/otpUtil");
const UserService = require("../services/UserService");
const AuditLogService = require("../services/AuditLogService");

const normalizeMobile = (mobile) => String(mobile || "").replace(/\D/g, "");
const normalizeText = (value) => String(value || "").trim();
const getRoleConflictMessage = (role) => {
  const normalizedRole = String(role || "").trim().toUpperCase();
  if (normalizedRole === "USER") {
    return "This mobile number is already registered as a USER account. Please use the user app.";
  }
  if (normalizedRole === "OWNER") {
    return "This mobile number is already registered as an OWNER account. Please use the owner app.";
  }
  return `This mobile number is already registered as a ${normalizedRole || "different"} account.`;
};
const serializeOwner = (owner) => {
  if (!owner) return owner;
  const data = owner.toObject ? owner.toObject() : { ...owner };
  data.address = data.address || data.adress || "";
  return data;
};

const ensureOwnerRoleAvailability = async (mobile) => {
  const service = UserService();
  const existing = await service.fetchDocByQuery({ mobile });

  if (existing && existing.role !== "OWNER") {
    const err = new Error(getRoleConflictMessage(existing.role));
    err.code = "ROLE_CONFLICT";
    throw err;
  }

  return existing;
};

const ensureOwnerProfile = async ({ mobile, name, address, city, companyName }) => {
  const service = UserService();
  const existing = await ensureOwnerRoleAvailability(mobile);

  if (!existing) {
    return await service.create({
      role: "OWNER",
      mobile,
      name,
      adress: address,
      city,
      ...(companyName ? { companyName } : {}),
    });
  }

  if (!existing.name) existing.name = name;
  if (!existing.adress) existing.adress = address;
  if (!existing.city) existing.city = city;
  if (companyName && !existing.companyName) existing.companyName = companyName;
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
      await ensureOwnerRoleAvailability(mobile);
    } catch (error) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, error.message || "Unable to send OTP");
    }

    const otp = generateOtp();
    await storeOtp(`owner:${mobile}`, otp);
    await AuditLogService().create({
      actorRole: "OWNER",
      action: "OWNER_OTP_SENT",
      entityType: "Auth",
      meta: { mobile },
    });
    req.rData = { mobile, otp };
    req.msg = "otp_sent";
    return ResponseMiddleware(req, res, next);
  },

  signup: async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    const name = normalizeText(req.body.fullName || req.body.name);
    const address = normalizeText(req.body.address || req.body.adress);
    const city = normalizeText(req.body.city);
    const companyName = normalizeText(req.body.companyName);

    if (!name || !address || !mobile || !city) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "name, address, mobile and city are required");
    }

    if (mobile.length < 10) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid mobile number");
    }

    let owner;
    try {
      owner = await ensureOwnerProfile({ mobile, name, address, city, companyName });
    } catch (error) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, error.message || "Unable to create owner");
    }

    await AuditLogService().create({
      actorRole: "OWNER",
      action: "OWNER_SIGNUP_SUCCESS",
      entityType: "Auth",
      entityId: owner._id,
      meta: { mobile },
    });

    const token = generateToken({ user_id: owner._id.toString(), role: "OWNER" });
    req.rData = { token, owner: serializeOwner(owner) };
    req.msg = "signup_success";
    return ResponseMiddleware(req, res, next);
  },

  verifyOtp: async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    const otp = String(req.body.otp || "").trim();
    const name = normalizeText(req.body.fullName || req.body.name);
    const address = normalizeText(req.body.address || req.body.adress);
    const city = normalizeText(req.body.city);
    const companyName = normalizeText(req.body.companyName);

    if (!mobile || !otp) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "mobile and otp are required");
    }

    const ok = await verifyOtp(`owner:${mobile}`, otp);
    if (!ok) {
      req.rCode = 0;
      req.msg = "incorrect_otp";
      return ResponseMiddleware(req, res, next);
    }

    const service = UserService();
    try {
      await ensureOwnerRoleAvailability(mobile);
    } catch (error) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, error.message || "Unable to verify OTP");
    }

    let owner = await service.findByMobileDoc(mobile, ["OWNER"]);
    if (!owner) {
      owner = await service.create({
        role: "OWNER",
        mobile,
        name: name || undefined,
        adress: address || undefined,
        city: city || undefined,
        companyName: companyName || undefined,
      });
    } else {
      if (name && !owner.name) owner.name = name;
      if (address && !owner.adress) owner.adress = address;
      if (city && !owner.city) owner.city = city;
      if (companyName && !owner.companyName) owner.companyName = companyName;
      await owner.save();
    }
    await AuditLogService().create({
      actorId: owner._id,
      actorRole: "OWNER",
      action: "OWNER_OTP_VERIFIED",
      entityType: "Auth",
      entityId: owner._id,
      meta: { mobile },
    });

    const token = generateToken({ user_id: owner._id.toString(), role: "OWNER" });
    req.rData = { token, owner: serializeOwner(owner) };
    req.msg = "otp_verified";
    return ResponseMiddleware(req, res, next);
  },
};
