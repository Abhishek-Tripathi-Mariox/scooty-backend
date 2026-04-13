const { models } = require("../models");
const FinanceService = require("./FinanceService");

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const toDate = (value, boundary = "start") => {
  if (!value) return null;
  const isDateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  if (isDateOnly) {
    const time = boundary === "end" ? "23:59:59.999" : "00:00:00";
    const date = new Date(`${value}T${time}+05:30`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDayLabel = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

const formatDateKey = (value) =>
  new Date(value).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

const getVehicleLabel = (item, bookingMap) => {
  if (item.vehicleLabel) return item.vehicleLabel;
  if (item.meta && typeof item.meta === "object" && item.meta.vehicleLabel) return item.meta.vehicleLabel;
  const booking = item.bookingId ? bookingMap.get(String(item.bookingId)) : null;
  if (!booking) return "Unassigned";
  return booking.vehicleLabel || booking.modelName || booking.registrationNumber || "Unassigned";
};

const buildTrend = (items, from, to) => {
  const earningItems = items.filter((item) => item.type === "OWNER_EARNING" && item.direction === "CREDIT");
  if (!earningItems.length) return [];

  const parsedTo = toDate(to, "end") || new Date();
  const parsedFrom = toDate(from, "start");
  const sevenDaysAgo = new Date(parsedTo);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const windowStart = parsedFrom && parsedFrom > sevenDaysAgo ? parsedFrom : sevenDaysAgo;

  const totals = new Map();
  for (const item of earningItems) {
    const date = new Date(item.createdAt || Date.now());
    if (Number.isNaN(date.getTime())) continue;
    const key = formatDateKey(date);
    totals.set(key, (totals.get(key) || 0) + round2(item.amount || 0));
  }

  const points = [];
  const cursor = new Date(windowStart);
  while (cursor <= parsedTo && points.length < 7) {
    const key = formatDateKey(cursor);
    points.push({
      label: formatDayLabel(cursor),
      value: round2(totals.get(key) || 0),
      date: key,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
};

const buildVehicleWise = async (items, ownerId) => {
  const earningItems = items.filter((item) => item.type === "OWNER_EARNING" && item.direction === "CREDIT");
  if (!earningItems.length) return [];

  const bookingIds = Array.from(
    new Set(
      earningItems
        .map((item) => item.bookingId || item.meta?.bookingId)
        .filter(Boolean)
        .map((value) => String(value)),
    ),
  );

  const bookingMap = new Map();
  if (bookingIds.length) {
    const bookings = await models.Booking.find({ _id: { $in: bookingIds }, }).populate("vehicleId", "modelName registrationNumber ownerId").lean();
    for (const booking of bookings) {
      const vehicle = booking.vehicleId || {};
      const label =
        vehicle.modelName ||
        vehicle.registrationNumber ||
        booking.planName ||
        booking.planCode ||
        "Unassigned";
      bookingMap.set(String(booking._id), {
        vehicleLabel: label,
        modelName: vehicle.modelName || "",
        registrationNumber: vehicle.registrationNumber || "",
      });
    }
  }

  const totals = new Map();
  for (const item of earningItems) {
    const vehicleLabel = getVehicleLabel(item, bookingMap);
    const current = totals.get(vehicleLabel) || { label: vehicleLabel, value: 0, count: 0 };
    current.value += round2(item.amount || 0);
    current.count += 1;
    totals.set(vehicleLabel, current);
  }

  return Array.from(totals.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
};

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

    const trend = buildTrend(items, from, to);
    const vehicleWise = await buildVehicleWise(items, ownerId);

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
      trend,
      vehicleWise,
      payouts,
      recentTransactions: items.slice(0, 10),
      pagination: transactions.pagination,
    };
  };

  return { list };
};
