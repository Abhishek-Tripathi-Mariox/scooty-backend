const { models } = require("../models");
const FinanceService = require("./FinanceService");

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

module.exports = () => {
  const list = async (ownerId, { from, to, type, page = 1, limit = 20 } = {}) => {
    const [transactions, payouts] = await Promise.all([
      FinanceService().listTransactions({
        userId: ownerId,
        role: "OWNER",
        type,
        from,
        to,
        page,
        limit,
      }),
      models.PayoutRequest.find({ userId: ownerId }).sort({ createdAt: -1 }).lean(),
    ]);

    const items = transactions.transactions || [];
    const summary = items.reduce(
      (acc, item) => {
        const amount = round2(item.amount || 0);
        if (item.direction === "CREDIT") acc.credit += amount;
        if (item.direction === "DEBIT") acc.debit += amount;
        if (item.type === "OWNER_EARNING") acc.earnings += amount;
        if (item.type === "PAYOUT_REQUEST") acc.payouts += amount;
        if (item.type === "GST_COLLECTION") acc.gst += amount;
        if (item.type === "PLATFORM_COMMISSION") acc.platformCommission += amount;
        return acc;
      },
      { credit: 0, debit: 0, earnings: 0, payouts: 0, gst: 0, platformCommission: 0 },
    );

    return {
      summary: {
        today: summary.earnings,
        week: summary.earnings,
        month: summary.earnings,
        totalCredit: summary.credit,
        totalDebit: summary.debit,
        gstCollected: summary.gst,
        platformCommission: summary.platformCommission,
      },
      trend: [],
      vehicleWise: [],
      payouts,
      recentTransactions: items.slice(0, 10),
      pagination: transactions.pagination,
    };
  };

  return { list };
};
