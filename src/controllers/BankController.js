const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const BankService = require("../services/BankService");
const OwnerService = require("../services/OwnerService");

module.exports = {
  get: async (req, res, next) => {
    const ownerId = req.body.ownerId;

    const owner = await OwnerService().fetchOwnerLeanById(ownerId);
    if (!owner) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Owner not found");
    }

    const bank = await BankService().getOrCreate(ownerId);
    req.rData = { bank };
    req.msg = "bank_details_fetched";
    return ResponseMiddleware(req, res, next);
  },

  update: async (req, res, next) => {
    try {
      const ownerId = req.body.ownerId;
      const owner = await OwnerService().fetchOwnerLeanById(ownerId);
      if (!owner) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Owner not found");
      }

      const { accountHolderName, accountNumber, bankName, ifsc, upiId ,} = req.body || {};
      const bank = await BankService().upsert({
        ownerId,
        payload: { accountHolderName, accountNumber, bankName, ifsc, upiId },
        files: req.files || null,
      });

      req.rData = { bank };
      req.msg = "bank_details_updated";
      return ResponseMiddleware(req, res, next);
    } catch (error) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, error.message || "Something went wrong");
    }
  },
};

