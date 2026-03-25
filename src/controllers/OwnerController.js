const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const OwnerService = require("../services/OwnerService");
const BankService = require("../services/BankService");
const FinanceService = require("../services/FinanceService");


module.exports = {
  me: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const owner = await OwnerService().fetchOwnerLeanById(ownerId);
    if (!owner) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Owner not found");
    }

    const bank = await BankService().getOrCreate(ownerId);
    req.rData = { owner, bank };
    req.msg = "profile_fetched";
    return ResponseMiddleware(req, res, next);
  },

  update: async (req, res, next) => {
    try {
      const ownerId = req.body.ownerId;
      const { name, email, city, companyName, adress, state, pincode } = req.body || {};

      const owner = await OwnerService().updateOwnerProfile({
        ownerId,
        payload: { name, email, city, companyName, adress, state, pincode },
        files: req.files || null,
      });

      if (!owner) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Owner not found");
      }

      // Backward compatible: if client still sends bank fields in /me update, update bank via service
      const { accountHolderName, accountNumber, bankName, ifsc, upiId } = req.body || {};
      const hasBankPayload =
        typeof accountHolderName === "string" ||
        typeof accountNumber === "string" ||
        typeof bankName === "string" ||
        typeof ifsc === "string" ||
        typeof upiId === "string" ||
        (req.files && (req.files.bankFile || req.files.bankfile || req.files.bank_file));

      let bank = await BankService().getOrCreate(ownerId);
      if (hasBankPayload) {
        bank = await BankService().upsert({
          ownerId,
          payload: { accountHolderName, accountNumber, bankName, ifsc, upiId },
          files: req.files || null,
        });
      }

      const ownerProfile = await OwnerService().fetchOwnerLeanById(ownerId);
      req.rData = { owner: ownerProfile, bank };
      req.msg = "profile_updated";
      return ResponseMiddleware(req, res, next);
    } catch (error) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, error.message || "Something went wrong");
    }
  },

  transactions: async (req, res, next) => {
    const data = await FinanceService().listTransactions({
      userId: req.body.ownerId,
      role: "OWNER",
      type: req.query.type,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    req.msg = "transactions_list";
    return ResponseMiddleware(req, res, next);
  },
};
