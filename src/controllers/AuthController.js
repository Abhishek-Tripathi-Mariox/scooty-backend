const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const { generateOtp, storeOtp, verifyOtp } = require("../util/otpUtil");
const { generateToken } = require("../util/tokenUtils");
const UserService = require("../services/UserService");

const normalizeMobile = (mobile) => String(mobile || "").replace(/\D/g, "");

module.exports = {
  sendOtp: async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    if (!mobile || mobile.length < 10) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Invalid mobile number");
    }

    // const otp = generateOtp();
    const otp= process.env.MASTER_OTP_LOGIN || "123456"; // For development/testing, use a fixed OTP or environment variable  
    await storeOtp(mobile, otp);
    console.log(`OTP for ${mobile}: ${otp}`); // Log OTP for development/testing  
    console.log(`OTP generated and stored for ${mobile}`);
    req.rData = {
      mobile,
      // For development/testing only
      otp: otp,
    };
    req.msg = "otp_sent";
    return ResponseMiddleware(req, res, next);
  },

  verifyOtp: async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    const otp = String(req.body.otp || "").trim();
    const name = (req.body.name || "").trim();

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
    let user = await userService.fetchDocByQuery({ mobile });
    if (!user) {
      user = await userService.create({
        mobile,
        role: "USER",
        name: name || undefined,
      });
    } else if (name && !user.name) {
      user.name = name;
    }
    await user.save();

    const token = generateToken({ user_id: user._id.toString(), role: "USER" });

    req.rData = {
      token,
      user,
    };
    req.msg = "otp_verified";
    return ResponseMiddleware(req, res, next);
  },
};
