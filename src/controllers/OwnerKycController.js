const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const OwnerKycService = require("../services/OwnerKycService");

module.exports = {
  get: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const kyc = await OwnerKycService().fetchOwnerKyc(ownerId);
    if (!kyc) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Owner not found");
    }

    req.rData = { kyc };
    req.msg = "kyc_fetched";
    return ResponseMiddleware(req, res, next);
  },

  submit: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    let kyc;
    try {
      kyc = await OwnerKycService().submitOwnerKyc({
        ownerId,
        files: req.files || null,
      });
    } catch (ex) {
      if (ex.code === "KYC_DOCS_REQUIRED") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, ex.message);
      }
      throw ex;
    }

    if (!kyc) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Owner not found");
    }

    req.rData = { kyc };
    req.msg = "kyc_updated";
    return ResponseMiddleware(req, res, next);
  },
};

