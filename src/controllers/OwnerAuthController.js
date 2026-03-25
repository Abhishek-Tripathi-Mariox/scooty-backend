const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const { generateToken } = require("../util/tokenUtils");
const { generateOtp, storeOtp, verifyOtp } = require("../util/otpUtil");
const UserService = require("../services/UserService");
const AuditLogService = require("../services/AuditLogService");

const normalizeMobile = (mobile) => String(mobile || "").replace(/\D/g, "");

module.exports = {
  sendOtp: async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    if (!mobile || mobile.length < 10) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid mobile number");
    }

    // const otp = generateOtp();
    const otp = process.env.MASTER_OTP_LOGIN || "123456"; // For development/testing, use a fixed OTP or environment variable

    await storeOtp(`owner:${mobile}`, otp);
    await AuditLogService().create({
      actorRole: "OWNER",
      action: "OWNER_OTP_SENT",
      entityType: "Auth",
      meta: { mobile },
    });

    req.rData = { mobile, otp: otp };
    req.msg = "otp_sent";
    return ResponseMiddleware(req, res, next);
  },

  verifyOtp: async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    const otp = String(req.body.otp || "").trim();
    const name = (req.body.name || "").trim();
    const companyName = (req.body.companyName || "").trim();

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
    let owner = await service.findByMobileDoc(mobile, ["OWNER"]);
    if (!owner) {
      owner = await service.create({
        role: "OWNER",
        mobile,
        name: name || undefined,
        companyName: companyName || undefined,
      });
    } else {
      if (name && !owner.name) owner.name = name;
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
    req.rData = { token, owner };
    req.msg = "otp_verified";
    return ResponseMiddleware(req, res, next);
  },
};
