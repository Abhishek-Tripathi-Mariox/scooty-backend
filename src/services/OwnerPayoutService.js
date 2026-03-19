const { models } = require("../models");

const last4 = (s) => {
  const v = String(s || "").replace(/\s+/g, "");
  return v.length >= 4 ? v.slice(-4) : v;
};

module.exports = () => {
  const list = async (ownerId) => {
    return await models.PayoutRequest.find({ userId: ownerId }).sort({ createdAt: -1 }).lean();
  };

  const request = async ({ ownerId, amount }) => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      const err = new Error("Invalid amount");
      err.code = "INVALID_AMOUNT";
      throw err;
    }

    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
    if (!owner) return null;

    const bank = await models.Bank.findOne({ ownerId }).lean();
    if (!bank || (!bank.accountNumber && !bank.upiId)) {
      const err = new Error("Bank details not found");
      err.code = "BANK_NOT_FOUND";
      throw err;
    }

    // Optional wallet check (keep permissive if wallet system differs)
    const wallet = Number(owner.walletBalance || 0);
    if (wallet > 0 && n > wallet) {
      const err = new Error("Insufficient wallet balance");
      err.code = "INSUFFICIENT_BALANCE";
      throw err;
    }

    const payout = await models.PayoutRequest.create({
      userId: ownerId,
      amount: n,
      status: "PENDING",
      bankSnapshot: {
        accountHolderName: bank.accountHolderName || "",
        bankName: bank.bankName || "",
        accountNumberLast4: last4(bank.accountNumber),
        ifsc: bank.ifsc || "",
        upiId: bank.upiId || "",
        fileUrl: bank.fileUrl || "",
      },
    });

    return payout;
  };

  return { list, request };
};
