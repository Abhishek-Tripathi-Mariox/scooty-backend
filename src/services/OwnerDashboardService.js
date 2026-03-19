const { models } = require("../models");
const VehicleService = require("./VehicleService");

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

module.exports = () => {
  const fetchOwnerLean = async (ownerId) => {
    return await models.User.findOne({ _id: ownerId, role: "OWNER" }).select({ bank: 0 }).lean();
  };

  const getDashboard = async (ownerId) => {
    const owner = await fetchOwnerLean(ownerId);
    if (!owner) return null;

    const [vehicleCounts, unreadNotifications, openMaintenance] = await Promise.all([
      VehicleService().counts(ownerId),
      models.Notification.countDocuments({ userId: ownerId, isRead: false }),
      models.MaintenanceRequest.countDocuments({
        userId: ownerId,
        status: { $in: ["OPEN", "IN_PROGRESS"] },
      }),
    ]);

    const totalVehicles = Object.values(vehicleCounts).reduce((a, b) => a + b, 0);

    // Earnings are placeholders unless ride/ledger is implemented.
    const today = startOfDay(new Date());
    const todayEarnings = 0;
    const monthEarnings = 0;

    return {
      walletBalance: owner.walletBalance || 0,
      earnings: { today: todayEarnings, month: monthEarnings, asOf: today },
      vehicles: {
        total: totalVehicles,
        byStatus: vehicleCounts,
      },
      maintenanceOpenCount: openMaintenance,
      unreadNotifications,
      liveActivity: [],
    };
  };

  return { getDashboard };
};
