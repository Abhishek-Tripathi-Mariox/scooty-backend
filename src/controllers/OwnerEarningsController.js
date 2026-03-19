const ResponseMiddleware = require("../middleware/ResponseMiddleware");

module.exports = {
  list: async (req, res, next) => {
    // Placeholder until ride/ledger models are integrated.
    req.rData = {
      summary: {
        today: 0,
        week: 0,
        month: 0,
      },
      trend: [],
      vehicleWise: [],
      recentTransactions: [],
    };
    req.msg = "earnings_list";
    return ResponseMiddleware(req, res, next);
  },
};

