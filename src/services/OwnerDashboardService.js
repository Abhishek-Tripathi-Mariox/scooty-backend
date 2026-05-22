const { models } = require("../models");
const VehicleService = require("./VehicleService");
const FinanceService = require("./FinanceService");

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const formatActivityTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

const buildActivityItem = (item, fallbackType = "SYSTEM") => ({
  title: item.title || item.description || item.type || "Update",
  detail: item.message || item.description || "Latest activity from your account.",
  time: formatActivityTime(item.createdAt),
  type: item.type || fallbackType,
  createdAt: item.createdAt || null,
});

module.exports = () => {
  const fetchOwnerLean = async (ownerId) => {
    return await models.User.findOne({ _id: ownerId, role: "OWNER" }).select({ bank: 0 }).lean();
  };

  const getDashboard = async (ownerId) => {
    const owner = await fetchOwnerLean(ownerId);
    if (!owner) return null;

    const [vehicleCounts, unreadNotifications, openMaintenance, activityNotifications, vehicleIds] = await Promise.all([
      VehicleService().counts(ownerId),
      models.Notification.countDocuments({ userId: ownerId, isRead: false }),
      models.MaintenanceRequest.countDocuments({
        userId: ownerId,
        status: { $in: ["OPEN", "IN_PROGRESS"] },
      }),
      models.Notification.find({ userId: ownerId }).sort({ createdAt: -1 }).limit(4).lean(),
      models.Vehicle.distinct("_id", { ownerId }),
    ]);

    const totalVehicles = Object.values(vehicleCounts).reduce((a, b) => a + b, 0);
    const ratingRows =
      vehicleIds.length > 0
        ? await models.Booking.aggregate([
            {
              $match: {
                vehicleId: { $in: vehicleIds },
                rating: { $type: "number" },
              },
            },
            {
              $group: {
                _id: null,
                averageRating: { $avg: "$rating" },
              },
            },
          ])
        : [];

    const activity = activityNotifications.map((item) => buildActivityItem(item));
    if (!activity.length) {
      const transactionResult = await FinanceService().listTransactions({
        userId: ownerId,
        role: "OWNER",
        page: 1,
        limit: 4,
      });

      activity.push(
        ...((transactionResult.transactions || []).map((item) => buildActivityItem(item, item.type || "EARNING"))),
      );
    }

    const now = new Date();
    const today = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const earningsAggregation = await models.Transaction.aggregate([
      {
        $match: {
          userId: owner._id,
          role: "OWNER",
          type: "OWNER_EARNING",
          status: "SUCCESS",
          direction: "CREDIT",
          createdAt: { $gte: monthStart },
        },
      },
      {
        $group: {
          _id: null,
          monthTotal: { $sum: "$amount" },
          todayTotal: {
            $sum: {
              $cond: [{ $gte: ["$createdAt", today] }, "$amount", 0],
            },
          },
        },
      },
    ]);
    const earningsRow = earningsAggregation[0] || {};
    const todayEarnings = Math.round(Number(earningsRow.todayTotal || 0) * 100) / 100;
    const monthEarnings = Math.round(Number(earningsRow.monthTotal || 0) * 100) / 100;

    return {
      walletBalance: owner.walletBalance || 0,
      earnings: { today: todayEarnings, month: monthEarnings, asOf: today },
      vehicles: {
        total: totalVehicles,
        byStatus: vehicleCounts,
      },
      maintenanceOpenCount: openMaintenance,
      unreadNotifications,
      liveActivity: activity,
      averageRating:
        ratingRows?.[0]?.averageRating != null
          ? Math.round(Number(ratingRows[0].averageRating) * 10) / 10
          : null,
    };
  };

  return { getDashboard };
};
