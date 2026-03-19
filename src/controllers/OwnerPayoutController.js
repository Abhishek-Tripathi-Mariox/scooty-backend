const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const OwnerPayoutService = require("../services/OwnerPayoutService");

module.exports = {
  list: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const payouts = await OwnerPayoutService().list(ownerId);
    req.rData = { payouts };
    return ResponseMiddleware(req, res, next, "payouts fetched");
  },

  request: async (req, res, next) => {
    try {
      const ownerId = req.body.ownerId;
      const payout = await OwnerPayoutService().request({
        ownerId,
        amount: req.body.amount,
      });
      if (!payout) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Owner not found");
      }
      req.rData = { payout };
      return ResponseMiddleware(req, res, next, "payout requested");
    } catch (ex) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },
};

