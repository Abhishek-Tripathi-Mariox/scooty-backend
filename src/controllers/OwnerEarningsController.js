const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const OwnerEarningsService = require("../services/OwnerEarningsService");

module.exports = {
  list: async (req, res, next) => {
    const data = await OwnerEarningsService().list(req.body.ownerId, {
      from: req.query.from,
      to: req.query.to,
      type: req.query.type,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    req.msg = "earnings_list";
    return ResponseMiddleware(req, res, next);
  },
};
