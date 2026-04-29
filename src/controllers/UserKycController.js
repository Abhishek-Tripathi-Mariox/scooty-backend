const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const UserKycService = require("../services/UserKycService");

module.exports = {
  get: async (req, res, next) => {
    const userId = req.body.userId;
    const kyc = await UserKycService().fetchUserKyc(userId);
    if (!kyc) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { kyc };
    req.msg = "kyc_fetched";
    return ResponseMiddleware(req, res, next);
  },

  submit: async (req, res, next) => {
    const userId = req.body.userId;
    const kyc = await UserKycService().submitUserKyc({
      userId,
      files: req.files || null,
    });

    if (!kyc) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { kyc };
    req.msg = "kyc_updated";
    return ResponseMiddleware(req, res, next);
  },
};
