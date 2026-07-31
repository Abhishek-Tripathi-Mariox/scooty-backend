const { models, mongoose } = require("../models");
const UserService = require("./UserService");
const AuditLogService = require("./AuditLogService");
const { hashPassword, normalizePassword } = require("../util/password");
const FinanceService = require("./FinanceService");

const VEHICLE_STATUS_ACTIONS = {
  MARK_ACTIVE: "ACTIVE",
  MARK_MAINTENANCE: "MAINTENANCE",
  ASSIGN_CHARGING: "CHARGING",
  MARK_INACTIVE: "INACTIVE",
};

const VEHICLE_STATUSES = new Set(["ACTIVE", "MAINTENANCE", "CHARGING", "INACTIVE"]);
// Statuses an admin can filter the vehicle list by (includes owner-submission states).
const VEHICLE_FILTER_STATUSES = new Set([
  "DRAFT",
  "PENDING_APPROVAL",
  "ACTIVE",
  "IN_RIDE",
  "MAINTENANCE",
  "CHARGING",
  "INACTIVE",
  "REMOVAL_REQUESTED",
  "REMOVED",
]);
// Targets allowed when updating status: the 4 admin statuses + DRAFT (used to reject
// an owner submission back for edits).
const VEHICLE_STATUS_TARGETS = new Set([...VEHICLE_STATUSES, "DRAFT"]);
const VEHICLE_RIDE_STATUSES = ["CONFIRMED", "ACTIVE", "COMPLETED"];
const MAINTENANCE_STATUSES = new Set(["OPEN", "IN_PROGRESS", "COMPLETED", "REJECTED"]);
const ADMIN_NOTIFICATION_TYPES = new Set(["RIDE", "EARNING", "ALERT", "SYSTEM"]);

const DEFAULT_PRICING = {
  currency: "INR",
  baseFarePerHour: 0,
  baseFarePerDay: 0,
  securityDepositDefault: 0,
  penaltySlabs: 3,
  convenienceFeePercent: 3,
  minimumConvenienceFee: 9,
  taxPercent: 18,
};

const DEFAULT_COMMISSION = {
  platformCommissionPercent: 20,
  ownerSharePercent: 80,
  franchiseSharePercent: 0,
};

const toInt = (value, fallback) => {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
};

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatRelativeTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} days ago`;
};

const formatVehicleLastRide = (booking) => {
  if (!booking) return null;
  // For ongoing/upcoming rides use the start time (end time may be in the future)
  const at =
    booking.status === "COMPLETED"
      ? booking.rideEndedAt || booking.endAt || booking.startAt || booking.createdAt || null
      : booking.startAt || booking.createdAt || null;
  return {
    rideId: booking._id,
    status: booking.status || "",
    label: formatRelativeTime(at) || "N/A",
    at,
  };
};

const buildRange = (from, to) => {
  const start = toDate(from);
  const end = toDate(to);
  return {
    ...(start ? { $gte: start } : {}),
    ...(end ? { $lte: end } : {}),
  };
};

const sanitizeAdmin = (admin) => {
  if (!admin) return admin;
  const data = admin.toObject ? admin.toObject() : { ...admin };
  delete data.passwordHash;
  return data;
};

const sanitizeUser = (user) => {
  if (!user) return user;
  const data = user.toObject ? user.toObject() : { ...user };
  delete data.passwordHash;
  return data;
};

const sanitizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return permissions.map((item) => String(item || "").trim()).filter(Boolean);
};

const sanitizeVehicle = (vehicle) => {
  if (!vehicle) return vehicle;
  return vehicle.toObject ? vehicle.toObject() : { ...vehicle };
};

const formatVehicle = (vehicle) => {
  const raw = sanitizeVehicle(vehicle);
  const station = raw?.stationId && typeof raw.stationId === "object"
    ? raw.stationId
    : null;
  const owner = raw?.ownerId && typeof raw.ownerId === "object"
    ? raw.ownerId
    : null;

  return {
    ...raw,
    station: station
      ? {
          id: station._id || station.id,
          name: station.name || "",
          address: station.address || "",
        }
      : raw.station || null,
    owner: owner
      ? {
          id: owner._id || owner.id,
          name: owner.name || "",
          email: owner.email || "",
          role: owner.role || "",
        }
      : raw.owner || null,
    batteryPercent: raw.batteryPercent ?? null,
    locationLabel: raw.locationLabel || station?.name || "",
  };
};

const resolveStationByValue = async (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (mongoose.Types.ObjectId.isValid(raw)) {
    const byId = await models.Station.findById(raw).lean();
    if (byId) return byId;
  }

  return await models.Station.findOne({
    name: { $regex: `^${raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  }).lean();
};

const formatMaintenanceStatus = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "OPEN") return "Pending";
  if (normalized === "IN_PROGRESS") return "In Progress";
  if (normalized === "COMPLETED") return "Completed";
  if (normalized === "REJECTED") return "Rejected";
  return status || "Pending";
};

const normalizeMaintenanceIssueType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  const map = {
    BATTERY_REPLACEMENT: "BATTERY",
    BATTERY: "BATTERY",
    BRAKE_SERVICE: "BRAKE",
    BRAKE: "BRAKE",
    TIRE_CHANGE: "TIRE",
    TIRE: "TIRE",
    ELECTRICAL: "ELECTRICAL",
    BODY: "BODY",
    MOTOR: "MOTOR",
    GENERAL_SERVICE: "OTHER",
    DAMAGE_REPAIR: "BODY",
    OTHER: "OTHER",
  };
  return map[normalized] || "OTHER";
};

const formatMaintenanceLog = (request) => {
  const raw = request?.toObject ? request.toObject() : { ...request };
  const vehicle = raw?.vehicleId && typeof raw.vehicleId === "object" ? raw.vehicleId : null;
  return {
    ...raw,
    id: raw._id || raw.id,
    logId: raw._id || raw.id,
    vehicleId: vehicle
      ? vehicle.registrationNumber || vehicle.modelName || vehicle._id || ""
      : raw.vehicleId,
    vehicle: vehicle
      ? {
          id: vehicle._id || vehicle.id,
          modelName: vehicle.modelName || "",
          registrationNumber: vehicle.registrationNumber || "",
          status: vehicle.status || "",
        }
      : raw.vehicle || null,
    status: formatMaintenanceStatus(raw.status),
    cost: raw.estimatedCost ?? raw.cost ?? null,
    date: raw.createdAt,
  };
};

const formatAdminNotification = (notificationDoc) => {
  const notification = notificationDoc?.toObject ? notificationDoc.toObject() : { ...notificationDoc };
  return {
    ...notification,
    id: notification._id || notification.id,
    createdAtLabel: notification.createdAt
      ? new Date(notification.createdAt).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        })
      : "",
  };
};

const normalizeAdminNotificationType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return ADMIN_NOTIFICATION_TYPES.has(normalized) ? normalized : "SYSTEM";
};

const buildVehicleQuery = ({ stationId, status, q } = {}) => {
  const query = {};
  const searchStationId = String(stationId || "").trim();
  if (searchStationId && mongoose.Types.ObjectId.isValid(searchStationId)) {
    query.stationId = searchStationId;
  }

  const normalizedStatus = String(status || "").trim().toUpperCase();
  if (normalizedStatus && VEHICLE_FILTER_STATUSES.has(normalizedStatus)) {
    query.status = normalizedStatus;
  }

  const search = String(q || "").trim();
  if (search) {
    query.$or = [
      { modelName: { $regex: search, $options: "i" } },
      { registrationNumber: { $regex: search, $options: "i" } },
      { chassisNumber: { $regex: search, $options: "i" } },
      { locationLabel: { $regex: search, $options: "i" } },
    ];
    if (mongoose.Types.ObjectId.isValid(search)) {
      query.$or.push({ _id: search });
    }
  }

  return query;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeNumber = (value, fallback = 0, min = null) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (min !== null && n < min) return min;
  return n;
};

module.exports = () => {
  const recordAuditLog = (payload) => AuditLogService().create(payload);

  const getSetting = async (key, fallback = {}) => {
    const setting = await models.AdminSetting.findOne({ key }).lean();
    return setting?.value ? setting.value : fallback;
  };

  const upsertSetting = async ({ key, value, updatedBy }) => {
    return await models.AdminSetting.findOneAndUpdate(
      { key },
      { $set: { value, updatedBy } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  };

  const getDashboard = async ({ from, to } = {}) => {
    const range = buildRange(from, to);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookingDateFilter = Object.keys(range).length > 0 ? { createdAt: range } : {};
    const todayFilter = { createdAt: { $gte: today } };

    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      totalStations,
      totalVehicles,
      totalBookings,
      todayBookings,
      revenueAgg,
      todayRevenueAgg,
      pendingPlans,
      pendingFaqs,
      pendingSettlements,
      openTickets,
      bookingByStatus,
      usersByRole,
    ] = await Promise.all([
      models.User.countDocuments({}),
      models.User.countDocuments({ isActive: true }),
      models.User.countDocuments({ isActive: false }),
      models.Station.countDocuments({}),
      models.Vehicle.countDocuments({}),
      models.Booking.countDocuments(bookingDateFilter),
      models.Booking.countDocuments(todayFilter),
      models.Booking.aggregate([
        ...(Object.keys(range).length > 0 ? [{ $match: { createdAt: range.createdAt } }] : []),
        { $group: { _id: null, revenue: { $sum: { $ifNull: ["$pricing.totalPayable", 0] } } } },
      ]),
      models.Booking.aggregate([
        { $match: todayFilter },
        { $group: { _id: null, revenue: { $sum: { $ifNull: ["$pricing.totalPayable", 0] } } } },
      ]),
      models.RidePlan.countDocuments({ status: "PENDING" }),
      models.Faq.countDocuments({ status: "PENDING" }),
      models.PayoutRequest.countDocuments({ status: "PENDING" }),
      models.SupportTicket.countDocuments({ status: { $in: ["OPEN", "IN_PROGRESS"] } }),
      models.Booking.aggregate([
        ...(Object.keys(range).length > 0 ? [{ $match: { createdAt: range.createdAt } }] : []),
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      models.User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    ]);

    const revenue = Number(revenueAgg?.[0]?.revenue || 0);
    const todayRevenue = Number(todayRevenueAgg?.[0]?.revenue || 0);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        blocked: blockedUsers,
        byRole: usersByRole.reduce((acc, item) => {
          acc[item._id || "UNKNOWN"] = item.count;
          return acc;
        }, {}),
      },
      stations: {
        total: totalStations,
      },
      vehicles: {
        total: totalVehicles,
      },
      bookings: {
        total: totalBookings,
        today: todayBookings,
        byStatus: bookingByStatus.reduce((acc, item) => {
          acc[item._id || "UNKNOWN"] = item.count;
          return acc;
        }, {}),
      },
      revenue: {
        total: revenue,
        today: todayRevenue,
        asOf: new Date(),
      },
      approvals: {
        ridePlans: pendingPlans,
        faqs: pendingFaqs,
      },
      settlements: {
        pending: pendingSettlements,
      },
      support: {
        openTickets,
      },
    };
  };

  const listUsers = async ({ role, status, q, page = 1, limit = 20 } = {}) => {
    const pageNumber = Math.max(1, toInt(page, 1));
    const pageSize = Math.min(100, Math.max(1, toInt(limit, 20)));
    const skip = (pageNumber - 1) * pageSize;

    const query = {};
    if (role) query.role = String(role).trim().toUpperCase();
    if (status === "ACTIVE") query.isActive = true;
    if (status === "BLOCKED") query.isActive = false;

    const search = String(q || "").trim();
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    const [total, users] = await Promise.all([
      models.User.countDocuments(query),
      models.User.find(query)
        .sort({ createdAt: -1 })
        .select("-passwordHash")
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      users,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    };
  };

  const getUserById = async (userId) => {
    if (!mongoose.Types.ObjectId.isValid(String(userId || ""))) return null;
    const user = await models.User.findById(userId).select("-passwordHash").lean();
    return user;
  };

  const updateUserStatus = async ({ adminId, userId, isActive, note }) => {
    if (!mongoose.Types.ObjectId.isValid(String(userId || ""))) return null;
    const user = await models.User.findById(userId);
    if (!user) return null;
    if (String(user._id) === String(adminId) && normalizeBoolean(isActive, true) === false) {
      const err = new Error("You cannot block your own account");
      err.code = "SELF_BLOCK";
      throw err;
    }

    const before = sanitizeUser(user);
    user.isActive = normalizeBoolean(isActive, true);
    await user.save();

    await recordAuditLog({
      actorId: adminId,
      action: "USER_STATUS_UPDATED",
      entityType: "User",
      entityId: user._id,
      before,
      after: sanitizeUser(user),
      meta: { note: String(note || "").trim() },
    });

    return user;
  };

  const updateUserKycStatus = async ({ adminId, userId, kycStatus, rejectionReason }) => {
    if (!mongoose.Types.ObjectId.isValid(String(userId || ""))) return null;
    const user = await models.User.findOne({
      _id: userId,
      role: { $in: ["OWNER", "USER"] },
    });
    if (!user) return null;

    const normalizedStatus = String(kycStatus || "").trim().toUpperCase();
    if (!["NOT_SUBMITTED", "PENDING", "APPROVED", "REJECTED"].includes(normalizedStatus)) {
      const err = new Error("Invalid kycStatus");
      err.code = "INVALID_KYC_STATUS";
      throw err;
    }

    const before = sanitizeUser(user);
    user.kycStatus = normalizedStatus;

    if (normalizedStatus === "APPROVED") {
      user.kycRejectionReason = "";
      user.kycVerifiedAt = new Date();
    } else if (normalizedStatus === "REJECTED") {
      user.kycRejectionReason = String(rejectionReason || "").trim();
      user.kycVerifiedAt = undefined;
    } else {
      user.kycRejectionReason = "";
      user.kycVerifiedAt = undefined;
    }

    await user.save();

    if (normalizedStatus === "APPROVED" || normalizedStatus === "REJECTED") {
      try {
        await models.Notification.create({
          userId: user._id,
          type: "SYSTEM",
          title: normalizedStatus === "APPROVED" ? "Account approved" : "KYC rejected",
          message:
            normalizedStatus === "APPROVED"
              ? "Your KYC has been approved. You can now book rides."
              : user.kycRejectionReason ||
                "Your KYC was rejected. Please update your documents and submit again.",
          meta: { kycStatus: normalizedStatus },
        });
      } catch {
        // notification is best-effort; approval itself already succeeded
      }
    }

    await recordAuditLog({
      actorId: adminId,
      action: `${user.role}_KYC_STATUS_UPDATED`,
      entityType: "User",
      entityId: user._id,
      before,
      after: sanitizeUser(user),
      meta: {
        kycStatus: normalizedStatus,
        rejectionReason: String(rejectionReason || "").trim(),
      },
    });

    return user;
  };

  const getPricing = async () => {
    const pricing = await getSetting("pricing", DEFAULT_PRICING);
    if (Array.isArray(pricing.penaltySlabs)) {
      const first = pricing.penaltySlabs[0];
      return {
        ...pricing,
        penaltySlabs: normalizeNumber(first?.amount ?? first, 3, 0),
      };
    }
    return pricing;
  };

  const updatePricing = async ({ adminId, payload }) => {
    const current = await getSetting("pricing", DEFAULT_PRICING);
    const value = {
      ...DEFAULT_PRICING,
      ...current,
    };

    if (Array.isArray(value.penaltySlabs)) {
      const first = value.penaltySlabs[0];
      value.penaltySlabs = normalizeNumber(first?.amount ?? first, 3, 0);
    } else {
      value.penaltySlabs = normalizeNumber(value.penaltySlabs, 3, 0);
    }

    if (payload.currency !== undefined) value.currency = String(payload.currency || "INR").trim() || "INR";
    if (payload.baseFarePerHour !== undefined) value.baseFarePerHour = normalizeNumber(payload.baseFarePerHour, 0, 0);
    if (payload.baseFarePerDay !== undefined) value.baseFarePerDay = normalizeNumber(payload.baseFarePerDay, 0, 0);
    if (payload.securityDepositDefault !== undefined) {
      value.securityDepositDefault = normalizeNumber(payload.securityDepositDefault, 0, 0);
    }
    if (payload.convenienceFeePercent !== undefined) {
      value.convenienceFeePercent = normalizeNumber(payload.convenienceFeePercent, 0, 0);
    }
    if (payload.minimumConvenienceFee !== undefined) {
      value.minimumConvenienceFee = normalizeNumber(payload.minimumConvenienceFee, 0, 0);
    }
    if (payload.taxPercent !== undefined) value.taxPercent = normalizeNumber(payload.taxPercent, 0, 0);
    if (payload.penaltySlabs !== undefined) {
      if (Array.isArray(payload.penaltySlabs)) {
        const first = payload.penaltySlabs[0];
        value.penaltySlabs = normalizeNumber(first?.amount ?? first, 3, 0);
      } else {
        value.penaltySlabs = normalizeNumber(payload.penaltySlabs, 3, 0);
      }
    }

    await upsertSetting({ key: "pricing", value, updatedBy: adminId });
    await recordAuditLog({
      actorId: adminId,
      action: "PRICING_UPDATED",
      entityType: "AdminSetting",
      meta: { key: "pricing" },
      after: value,
    });
    return value;
  };

  const getCommission = async () => {
    return await getSetting("commission", DEFAULT_COMMISSION);
  };

  const updateCommission = async ({ adminId, payload }) => {
    const current = await getSetting("commission", DEFAULT_COMMISSION);
    const value = {
      ...DEFAULT_COMMISSION,
      ...current,
    };

    if (payload.platformCommissionPercent !== undefined) {
      value.platformCommissionPercent = normalizeNumber(payload.platformCommissionPercent, 0, 0);
    }
    if (payload.ownerSharePercent !== undefined) {
      value.ownerSharePercent = normalizeNumber(payload.ownerSharePercent, 0, 0);
    }
    if (payload.franchiseSharePercent !== undefined) {
      value.franchiseSharePercent = normalizeNumber(payload.franchiseSharePercent, 0, 0);
    }

    await upsertSetting({ key: "commission", value, updatedBy: adminId });
    await recordAuditLog({
      actorId: adminId,
      action: "COMMISSION_UPDATED",
      entityType: "AdminSetting",
      meta: { key: "commission" },
      after: value,
    });
    return value;
  };

  const listSettlements = async ({ status, userId, page = 1, limit = 20 } = {}) => {
    const pageNumber = Math.max(1, toInt(page, 1));
    const pageSize = Math.min(100, Math.max(1, toInt(limit, 20)));
    const skip = (pageNumber - 1) * pageSize;

    const query = {};
    if (status) query.status = String(status).trim().toUpperCase();
    if (userId && mongoose.Types.ObjectId.isValid(String(userId))) query.userId = userId;

    const [total, settlements] = await Promise.all([
      models.PayoutRequest.countDocuments(query),
      models.PayoutRequest.find(query)
        .sort({ createdAt: -1 })
        .populate("userId", "name email mobile role stationId")
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      settlements,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    };
  };

  const createSettlement = async ({ adminId, payload }) => {
    const userId = payload.userId;
    if (!mongoose.Types.ObjectId.isValid(String(userId || ""))) {
      const err = new Error("userId is required");
      err.code = "INVALID_USER";
      throw err;
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      const err = new Error("amount is required");
      err.code = "INVALID_AMOUNT";
      throw err;
    }

    const owner = await models.User.findOne({ _id: userId, role: { $in: ["OWNER", "STATION_ADMIN", "ADMIN"] } }).lean();
    if (!owner) return null;

    const bank = await models.Bank.findOne({ ownerId: owner._id }).lean();
    const settlement = await models.PayoutRequest.create({
      userId: owner._id,
      amount,
      status: "PENDING",
      note: String(payload.note || "").trim(),
      bankSnapshot: {
        accountHolderName: bank?.accountHolderName || "",
        bankName: bank?.bankName || "",
        accountNumberLast4: bank?.accountNumber ? String(bank.accountNumber).replace(/\s+/g, "").slice(-4) : "",
        ifsc: bank?.ifsc || "",
        upiId: bank?.upiId || "",
        fileUrl: bank?.fileUrl || "",
      },
    });

    await FinanceService().recordTransaction({
      userId: owner._id,
      role: owner.role || "OWNER",
      type: "SETTLEMENT_REQUEST",
      direction: "DEBIT",
      status: "PENDING",
      amount,
      sourceType: "PayoutRequest",
      sourceId: settlement._id,
      referenceId: `ST-${String(settlement._id).slice(-8).toUpperCase()}`,
      description: "Settlement requested",
      meta: { settlementId: settlement._id },
    });

    await recordAuditLog({
      actorId: adminId,
      action: "SETTLEMENT_CREATED",
      entityType: "PayoutRequest",
      entityId: settlement._id,
      after: settlement,
      meta: { userId: owner._id, amount },
    });

    return settlement;
  };

  const updateSettlementStatus = async ({ adminId, settlementId, status, note }) => {
    const normalized = String(status || "").trim().toUpperCase();
    if (!["PENDING", "APPROVED", "REJECTED", "PROCESSING", "COMPLETED"].includes(normalized)) {
      const err = new Error("Invalid settlement status");
      err.code = "INVALID_STATUS";
      throw err;
    }

    const settlement = await models.PayoutRequest.findById(settlementId);
    if (!settlement) return null;
    const before = settlement.toObject();
    settlement.status = normalized;
    if (typeof note === "string") settlement.note = note.trim();
    await settlement.save();

    if (normalized === "COMPLETED") {
      await FinanceService().postPayoutJournal({
        payout: settlement.toObject(),
        amount: settlement.amount,
      });
      await FinanceService().recordTransaction({
        userId: settlement.userId,
        role: "OWNER",
        type: "SETTLEMENT_REQUEST",
        direction: "DEBIT",
        status: "SUCCESS",
        amount: settlement.amount,
        sourceType: "PayoutRequest",
        sourceId: settlement._id,
        referenceId: `PO-${String(settlement._id).slice(-8).toUpperCase()}`,
        description: "Payout completed",
        meta: { settlementId: settlement._id },
      });
    }

    await recordAuditLog({
      actorId: adminId,
      action: "SETTLEMENT_STATUS_UPDATED",
      entityType: "PayoutRequest",
      entityId: settlement._id,
      before,
      after: settlement.toObject(),
      meta: { status: normalized },
    });

    return settlement;
  };

  const getReports = async ({ from, to, stationId } = {}) => {
    const range = buildRange(from, to);
    const bookingMatch = {};
    if (Object.keys(range).length > 0) bookingMatch.createdAt = range;
    if (stationId && mongoose.Types.ObjectId.isValid(String(stationId))) {
      bookingMatch.pickupStationId = stationId;
    }

    const settlementMatch = {};
    if (Object.keys(range).length > 0) settlementMatch.createdAt = range;

    const [bookingSummary, dailyRevenue, dailyBookings, settlementSummary, topStations, topUsers, financeSummary] = await Promise.all([
      models.Booking.aggregate([
        Object.keys(bookingMatch).length > 0 ? { $match: bookingMatch } : { $match: {} },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: { $ifNull: ["$pricing.totalPayable", 0] } },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
            },
          },
        },
      ]),
      models.Booking.aggregate([
        Object.keys(bookingMatch).length > 0 ? { $match: bookingMatch } : { $match: {} },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            revenue: { $sum: { $ifNull: ["$pricing.totalPayable", 0] } },
            bookings: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      models.Booking.aggregate([
        Object.keys(bookingMatch).length > 0 ? { $match: bookingMatch } : { $match: {} },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      models.PayoutRequest.aggregate([
        Object.keys(settlementMatch).length > 0 ? { $match: settlementMatch } : { $match: {} },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ["$amount", 0] } },
          },
        },
      ]),
      models.Booking.aggregate([
        Object.keys(bookingMatch).length > 0 ? { $match: bookingMatch } : { $match: {} },
        {
          $group: {
            _id: "$pickupStationId",
            totalRevenue: { $sum: { $ifNull: ["$pricing.totalPayable", 0] } },
            totalBookings: { $sum: 1 },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 },
      ]),
      models.Booking.aggregate([
        Object.keys(bookingMatch).length > 0 ? { $match: bookingMatch } : { $match: {} },
        {
          $group: {
            _id: "$userId",
            totalRevenue: { $sum: { $ifNull: ["$pricing.totalPayable", 0] } },
            totalBookings: { $sum: 1 },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 },
      ]),
      FinanceService().getTransactionSummary({
        role: "ADMIN",
        from,
        to,
        stationId,
      }),
    ]);

    const summary = bookingSummary?.[0] || {};

    const stationIds = topStations.map((row) => row._id).filter(Boolean);
    const userIds = topUsers.map((row) => row._id).filter(Boolean);
    const [stations, users] = await Promise.all([
      stationIds.length
        ? models.Station.find({ _id: { $in: stationIds } }).select("name address").lean()
        : Promise.resolve([]),
      userIds.length
        ? models.User.find({ _id: { $in: userIds } }).select("name email role").lean()
        : Promise.resolve([]),
    ]);

    return {
      summary: {
        totalBookings: summary.totalBookings || 0,
        totalRevenue: summary.totalRevenue || 0,
        completed: summary.completed || 0,
        cancelled: summary.cancelled || 0,
      },
      dailyRevenue: dailyRevenue.map((item) => ({
        date: item._id,
        revenue: item.revenue,
        bookings: item.bookings,
      })),
      dailyBookings: dailyBookings.map((item) => ({
        date: item._id,
        total: item.total,
      })),
      settlements: settlementSummary.reduce((acc, item) => {
        acc[item._id || "UNKNOWN"] = {
          count: item.count,
          amount: item.amount,
        };
        return acc;
      }, {}),
      topStations: topStations.map((item) => {
        const station = stations.find((row) => String(row._id) === String(item._id));
        return {
          stationId: item._id,
          station: station || null,
          totalRevenue: item.totalRevenue,
          totalBookings: item.totalBookings,
        };
      }),
      topUsers: topUsers.map((item) => {
        const user = users.find((row) => String(row._id) === String(item._id));
        return {
          userId: item._id,
          user: user || null,
          totalRevenue: item.totalRevenue,
          totalBookings: item.totalBookings,
        };
      }),
      finance: {
        gstCollected: financeSummary.gst,
        platformCommission: financeSummary.platformCommission,
        ownerEarnings: financeSummary.ownerEarnings,
        payouts: financeSummary.payouts,
      },
    };
  };

  const listTransactions = async ({ type, from, to, stationId, userId, page = 1, limit = 20 } = {}) => {
    return await FinanceService().listTransactions({
      role: "ADMIN",
      type,
      from,
      to,
      stationId,
      userId,
      page,
      limit,
    });
  };

  const bookingInvoice = async ({ bookingId }) => {
    return await FinanceService().buildBookingInvoice({ bookingId });
  };

  const listLedger = async ({ sourceType, sourceId, from, to, page = 1, limit = 20 } = {}) => {
    return await FinanceService().listJournals({
      sourceType,
      sourceId,
      from,
      to,
      page,
      limit,
    });
  };

  const updateBookingRefund = async ({ adminId, bookingId, status, note, failureReason, referenceId, method }) => {
    return await FinanceService().markRefundState({
      bookingId,
      status,
      note,
      failureReason,
      referenceId,
      method,
      processedByRole: "ADMIN",
      processedByUserId: adminId,
    });
  };

  const listAdmins = async ({ q, page = 1, limit = 20 } = {}) => {
    const pageNumber = Math.max(1, toInt(page, 1));
    const pageSize = Math.min(100, Math.max(1, toInt(limit, 20)));
    const skip = (pageNumber - 1) * pageSize;

    const query = { role: "ADMIN" };
    const search = String(q || "").trim();
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    const [total, admins] = await Promise.all([
      models.User.countDocuments(query),
      models.User.find(query)
        .sort({ createdAt: -1 })
        .select("-passwordHash")
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      admins,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    };
  };

  const createAdmin = async ({ adminId, payload }) => {
    const name = String(payload.name || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const password = normalizePassword(payload.password);
    if (!name || !email || !password) {
      const err = new Error("name, email and password are required");
      err.code = "REQUIRED_FIELDS_MISSING";
      throw err;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = new Error("Invalid email");
      err.code = "INVALID_EMAIL";
      throw err;
    }

    const userService = UserService();
    if (await userService.emailInUse(email)) {
      const err = new Error("Email already in use");
      err.code = "EMAIL_EXISTS";
      throw err;
    }

    const mobile = String(payload.mobile || "").replace(/\D/g, "");
    if (mobile && mobile.length < 10) {
      const err = new Error("Invalid mobile");
      err.code = "INVALID_MOBILE";
      throw err;
    }
    if (mobile && (await userService.mobileInUse(mobile))) {
      const err = new Error("Mobile already in use");
      err.code = "MOBILE_EXISTS";
      throw err;
    }

    const passwordHash = await hashPassword(password);
    const admin = await models.User.create({
      role: "ADMIN",
      name,
      email,
      mobile,
      passwordHash,
      isActive: payload.isActive === undefined ? true : normalizeBoolean(payload.isActive, true),
      adminPermissions: sanitizePermissions(payload.permissions),
    });

    await recordAuditLog({
      actorId: adminId,
      action: "ADMIN_CREATED",
      entityType: "User",
      entityId: admin._id,
      after: sanitizeAdmin(admin),
      meta: { permissions: sanitizePermissions(payload.permissions) },
    });

    return admin;
  };

  const updateAdmin = async ({ adminId, targetAdminId, payload }) => {
    if (!mongoose.Types.ObjectId.isValid(String(targetAdminId || ""))) return null;
    const admin = await models.User.findOne({ _id: targetAdminId, role: "ADMIN" });
    if (!admin) return null;

    const before = sanitizeAdmin(admin);

    if (typeof payload.name === "string" && payload.name.trim()) admin.name = payload.name.trim();
    if (typeof payload.email === "string") {
      const email = payload.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const err = new Error("Invalid email");
        err.code = "INVALID_EMAIL";
        throw err;
      }
      const inUse = await UserService().emailInUse(email, admin._id);
      if (inUse) {
        const err = new Error("Email already in use");
        err.code = "EMAIL_EXISTS";
        throw err;
      }
      admin.email = email;
    }
    if (typeof payload.mobile === "string") {
      const mobile = payload.mobile.replace(/\D/g, "");
      if (mobile && mobile.length < 10) {
        const err = new Error("Invalid mobile");
        err.code = "INVALID_MOBILE";
        throw err;
      }
      if (mobile) {
        const inUse = await UserService().mobileInUse(mobile, admin._id);
        if (inUse) {
          const err = new Error("Mobile already in use");
          err.code = "MOBILE_EXISTS";
          throw err;
        }
        admin.mobile = mobile;
      }
    }
    if (payload.isActive !== undefined) admin.isActive = normalizeBoolean(payload.isActive, admin.isActive);
    if (Array.isArray(payload.permissions)) admin.adminPermissions = sanitizePermissions(payload.permissions);
    if (typeof payload.password === "string" && payload.password.trim()) {
      admin.passwordHash = await hashPassword(normalizePassword(payload.password));
    }

    await admin.save();
    await recordAuditLog({
      actorId: adminId,
      action: "ADMIN_UPDATED",
      entityType: "User",
      entityId: admin._id,
      before,
      after: sanitizeAdmin(admin),
      meta: { permissions: admin.adminPermissions || [] },
    });

    return admin;
  };

  const listAuditLogs = async ({ action, entityType, adminId, from, to, page = 1, limit = 20 } = {}) => {
    const pageNumber = Math.max(1, toInt(page, 1));
    const pageSize = Math.min(100, Math.max(1, toInt(limit, 20)));
    const skip = (pageNumber - 1) * pageSize;

    const query = {};
    if (action) query.action = String(action).trim().toUpperCase();
    if (entityType) query.entityType = String(entityType).trim();
    if (adminId && mongoose.Types.ObjectId.isValid(String(adminId))) query.actorId = adminId;
    const range = buildRange(from, to);
    if (Object.keys(range).length > 0) query.createdAt = range;

    const [total, logs] = await Promise.all([
      models.AuditLog.countDocuments(query),
      models.AuditLog.find(query)
        .sort({ createdAt: -1 })
        .populate("actorId", "name email role")
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      logs,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    };
  };

  const listVehicles = async ({ stationId, status, q, page = 1, limit = 20 } = {}) => {
    const pageNumber = Math.max(1, toInt(page, 1));
    const pageSize = Math.min(100, Math.max(1, toInt(limit, 20)));
    const skip = (pageNumber - 1) * pageSize;
    const query = buildVehicleQuery({ stationId, status, q });

    const [total, vehicles] = await Promise.all([
      models.Vehicle.countDocuments(query),
      models.Vehicle.find(query)
        .sort({ createdAt: -1 })
        .populate("stationId", "name address")
        .populate("ownerId", "name email role")
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const vehicleIds = vehicles.map((vehicle) => vehicle._id);
    const lastRideByVehicleId = new Map();
    if (vehicleIds.length) {
      const bookings = await models.Booking.find({
        vehicleId: { $in: vehicleIds },
        status: { $in: VEHICLE_RIDE_STATUSES },
      })
        .sort({ createdAt: -1 })
        .lean();
      for (const booking of bookings) {
        const key = String(booking.vehicleId);
        if (!lastRideByVehicleId.has(key)) lastRideByVehicleId.set(key, booking);
      }
    }

    return {
      vehicles: vehicles.map((vehicle) => ({
        ...formatVehicle(vehicle),
        lastRide: formatVehicleLastRide(lastRideByVehicleId.get(String(vehicle._id))),
      })),
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    };
  };

  const createVehicle = async ({ adminId, payload = {} }) => {
    const registrationNumber = String(payload.registrationNumber || payload.registrationNo || "").trim();
    if (!registrationNumber) {
      const err = new Error("registrationNumber is required");
      err.code = "INVALID_VEHICLE_INPUT";
      throw err;
    }

    const modelName = String(payload.modelName || payload.model || "").trim();
    const stationValue = payload.stationId || payload.station || "";
    const station = await resolveStationByValue(stationValue);
    if (!station) {
      const err = new Error("Station not found");
      err.code = "STATION_NOT_FOUND";
      throw err;
    }

    const vehicle = await models.Vehicle.create({
      ownerId: payload.ownerId && mongoose.Types.ObjectId.isValid(String(payload.ownerId))
        ? payload.ownerId
        : adminId,
      stationId: station._id,
      modelName,
      registrationNumber,
      chassisNumber: String(payload.chassisNumber || "").trim(),
      batteryPercent:
        payload.batteryPercent === undefined || payload.batteryPercent === null || payload.batteryPercent === ""
          ? null
          : Number(payload.batteryPercent),
      locationLabel: String(payload.locationLabel || station.name || "").trim(),
      status: VEHICLE_STATUSES.has(String(payload.status || "").trim().toUpperCase())
        ? String(payload.status || "").trim().toUpperCase()
        : "DRAFT",
    });

    await recordAuditLog({
      actorId: adminId,
      actorRole: "ADMIN",
      action: "ADMIN_VEHICLE_CREATED",
      entityType: "Vehicle",
      entityId: vehicle._id,
      after: sanitizeVehicle(vehicle),
      meta: { stationId: station._id, registrationNumber, modelName },
    });

    await createAdminNotification({
      adminId,
      type: "SYSTEM",
      title: "Vehicle added",
      message: `${registrationNumber} added to ${station.name || "station"}`,
      meta: { vehicleId: vehicle._id, stationId: station._id },
    });

    return formatVehicle(await models.Vehicle.findById(vehicle._id).populate("stationId", "name address").populate("ownerId", "name email role").lean());
  };

  const getVehicleById = async (vehicleId) => {
    if (!mongoose.Types.ObjectId.isValid(String(vehicleId || ""))) return null;
    const vehicle = await models.Vehicle.findById(vehicleId)
      .populate("stationId", "name address")
      .populate("ownerId", "name email role")
      .lean();
    return vehicle ? formatVehicle(vehicle) : null;
  };

  const createAdminNotification = async ({ adminId, type = "SYSTEM", title = "", message = "", meta = {} }) => {
    const recipientId = String(adminId || "").trim();
    if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) return null;

    const notification = await models.Notification.create({
      userId: recipientId,
      type: normalizeAdminNotificationType(type),
      title: String(title || "").trim(),
      message: String(message || "").trim(),
      isRead: false,
      meta: meta && typeof meta === "object" ? meta : {},
    });

    return formatAdminNotification(notification);
  };

  const listAdminNotifications = async ({ adminId, type, page = 1, limit = 100 } = {}) => {
    const recipientId = String(adminId || "").trim();
    if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
      return { notifications: [], unreadCount: 0, pagination: { page: 1, limit: 100, hasNextPage: false } };
    }

    const query = { userId: recipientId };
    const normalizedType = String(type || "").trim().toUpperCase();
    if (normalizedType && ADMIN_NOTIFICATION_TYPES.has(normalizedType)) {
      query.type = normalizedType;
    }

    const pageNumber = Math.max(1, toInt(page, 1));
    const pageSize = Math.min(200, Math.max(1, toInt(limit, 100)));
    const skip = (pageNumber - 1) * pageSize;

    const [notifications, unreadCount] = await Promise.all([
      models.Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      models.Notification.countDocuments({ userId: recipientId, isRead: false }),
    ]);

    return {
      notifications: notifications.map(formatAdminNotification),
      unreadCount,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        hasNextPage: notifications.length === pageSize,
      },
    };
  };

  const markAdminNotificationRead = async ({ adminId, notificationId }) => {
    const recipientId = String(adminId || "").trim();
    if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) return null;
    if (!mongoose.Types.ObjectId.isValid(String(notificationId || ""))) return null;

    const notification = await models.Notification.findOne({
      _id: notificationId,
      userId: recipientId,
    });
    if (!notification) return null;

    notification.isRead = true;
    await notification.save();
    return formatAdminNotification(notification);
  };

  const markAllAdminNotificationsRead = async ({ adminId, type = null } = {}) => {
    const recipientId = String(adminId || "").trim();
    if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    const query = { userId: recipientId, isRead: false };
    const normalizedType = String(type || "").trim().toUpperCase();
    if (normalizedType && ADMIN_NOTIFICATION_TYPES.has(normalizedType)) {
      query.type = normalizedType;
    }

    const result = await models.Notification.updateMany(query, {
      $set: { isRead: true },
    });

    return {
      matchedCount: result.matchedCount ?? result.n ?? 0,
      modifiedCount: result.modifiedCount ?? result.nModified ?? 0,
    };
  };

  const updateVehicleStatus = async ({ adminId, vehicleId, status, note = "" }) => {
    if (!mongoose.Types.ObjectId.isValid(String(vehicleId || ""))) return null;

    const normalizedStatus = String(status || "").trim().toUpperCase();
    if (!VEHICLE_STATUS_TARGETS.has(normalizedStatus)) {
      const err = new Error("Invalid status");
      err.code = "INVALID_STATUS";
      throw err;
    }

    const vehicle = await models.Vehicle.findById(vehicleId);
    if (!vehicle) return null;

    const before = sanitizeVehicle(vehicle);
    const previousStatus = vehicle.status;
    vehicle.status = normalizedStatus;
    if (typeof note === "string") vehicle.approvalNote = note.trim();
    await vehicle.save();

    // Approving a pending scooty — let the owner know it can now be used.
    const wasAwaitingApproval = previousStatus === "PENDING_APPROVAL" || previousStatus === "DRAFT";
    if (wasAwaitingApproval && ["ACTIVE", "CHARGING", "INACTIVE"].includes(normalizedStatus) && vehicle.ownerId) {
      try {
        await models.Notification.create({
          userId: vehicle.ownerId,
          type: "SYSTEM",
          title: "Scooty approved",
          message: `${vehicle.registrationNumber || "Your scooty"} has been approved by the admin${normalizedStatus === "ACTIVE" ? " and is now active" : ""}.`,
          meta: { vehicleId: vehicle._id, status: normalizedStatus },
        });
      } catch {
        // notification is best-effort
      }
    }

    // Rejecting a pending scooty back to DRAFT — tell the owner what to fix.
    if (previousStatus === "PENDING_APPROVAL" && normalizedStatus === "DRAFT" && vehicle.ownerId) {
      try {
        await models.Notification.create({
          userId: vehicle.ownerId,
          type: "SYSTEM",
          title: "Scooty submission rejected",
          message: `${vehicle.registrationNumber || "Your scooty"} was not approved.${note ? ` Reason: ${note.trim()}` : " Please review the details and submit again."}`,
          meta: { vehicleId: vehicle._id, status: normalizedStatus },
        });
      } catch {
        // notification is best-effort
      }
    }

    await recordAuditLog({
      actorId: adminId,
      actorRole: "ADMIN",
      action: "ADMIN_VEHICLE_STATUS_UPDATED",
      entityType: "Vehicle",
      entityId: vehicle._id,
      before,
      after: sanitizeVehicle(vehicle),
      meta: { status: normalizedStatus, note: note || "" },
    });

    await createAdminNotification({
      adminId,
      type: normalizedStatus === "MAINTENANCE" ? "ALERT" : "SYSTEM",
      title: "Vehicle status updated",
      message: `${vehicle.registrationNumber || "Vehicle"} marked as ${normalizedStatus.replace(/_/g, " ").toLowerCase()}`,
      meta: { vehicleId: vehicle._id, status: normalizedStatus },
    });

    return formatVehicle(await models.Vehicle.findById(vehicleId).populate("stationId", "name address").populate("ownerId", "name email role").lean());
  };

  const listMaintenanceLogs = async ({ status, q, page = 1, limit = 20 } = {}) => {
    const pageNumber = Math.max(1, toInt(page, 1));
    const pageSize = Math.min(100, Math.max(1, toInt(limit, 20)));
    const skip = (pageNumber - 1) * pageSize;
    const query = {};

    const normalizedStatus = String(status || "").trim().toUpperCase();
    if (normalizedStatus && MAINTENANCE_STATUSES.has(normalizedStatus)) {
      query.status = normalizedStatus;
    }

    const search = String(q || "").trim();
    if (search) {
      query.$or = [
        { issueType: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or.push({ _id: search });
      }
    }

    const [total, logs] = await Promise.all([
      models.MaintenanceRequest.countDocuments(query),
      models.MaintenanceRequest.find(query)
        .sort({ createdAt: -1 })
        .populate("vehicleId", "modelName registrationNumber status stationId")
        .populate("userId", "name email mobile")
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      logs: logs.map(formatMaintenanceLog),
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    };
  };

  const createMaintenanceLog = async ({ adminId, payload }) => {
    const vehicleId = String(payload.vehicleId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      const err = new Error("vehicleId is required");
      err.code = "INVALID_VEHICLE";
      throw err;
    }

    const vehicle = await models.Vehicle.findById(vehicleId);
    if (!vehicle) {
      const err = new Error("Vehicle not found");
      err.code = "VEHICLE_NOT_FOUND";
      throw err;
    }

    const description = String(payload.description || "").trim();
    if (!description) {
      const err = new Error("description is required");
      err.code = "INVALID_MAINTENANCE_INPUT";
      throw err;
    }

    const estimatedCostRaw = payload.estimatedCost ?? payload.cost;
    const estimatedCost =
      estimatedCostRaw === undefined || estimatedCostRaw === null || String(estimatedCostRaw).trim() === ""
        ? null
        : Number(estimatedCostRaw);
    if (estimatedCost !== null && Number.isNaN(estimatedCost)) {
      const err = new Error("estimatedCost must be a number");
      err.code = "INVALID_MAINTENANCE_INPUT";
      throw err;
    }

    const request = await models.MaintenanceRequest.create({
      userId: adminId,
      vehicleId: vehicle._id,
      stationId: vehicle.stationId || undefined,
      issueType: normalizeMaintenanceIssueType(payload.issueType),
      description,
      estimatedCost,
      photoUrls: [],
      status: "OPEN",
    });

    await recordAuditLog({
      actorId: adminId,
      actorRole: "ADMIN",
      action: "MAINTENANCE_CREATED",
      entityType: "MaintenanceRequest",
      entityId: request._id,
      after: request.toObject(),
      meta: { stationId: vehicle.stationId || null, vehicleId: vehicle._id, issueType: request.issueType },
    });

    await createAdminNotification({
      adminId,
      type: "ALERT",
      title: "Maintenance request created",
      message: `${vehicle.registrationNumber || "Vehicle"} moved to maintenance`,
      meta: { vehicleId: vehicle._id, requestId: request._id, issueType: request.issueType },
    });

    vehicle.status = "MAINTENANCE";
    await vehicle.save();

    const created = await models.MaintenanceRequest.findById(request._id)
      .populate("vehicleId", "modelName registrationNumber status stationId")
      .populate("userId", "name email mobile")
      .lean();
    return formatMaintenanceLog(created);
  };

  const getMaintenanceLogById = async (requestId) => {
    if (!mongoose.Types.ObjectId.isValid(String(requestId || ""))) return null;
    const request = await models.MaintenanceRequest.findById(requestId)
      .populate("vehicleId", "modelName registrationNumber status stationId")
      .populate("userId", "name email mobile")
      .lean();
    return request ? formatMaintenanceLog(request) : null;
  };

  const updateMaintenanceStatus = async ({ adminId, requestId, status, resolutionNote = "" }) => {
    if (!mongoose.Types.ObjectId.isValid(String(requestId || ""))) return null;

    const normalizedStatus = String(status || "").trim().toUpperCase();
    if (!MAINTENANCE_STATUSES.has(normalizedStatus)) {
      const err = new Error("Invalid maintenance status");
      err.code = "INVALID_MAINTENANCE_STATUS";
      throw err;
    }

    const request = await models.MaintenanceRequest.findById(requestId);
    if (!request) return null;
    const before = request.toObject();

    request.status = normalizedStatus;
    request.resolutionNote = String(resolutionNote || "").trim();
    await request.save();

    const vehicleStatus = normalizedStatus === "COMPLETED" || normalizedStatus === "REJECTED" ? "ACTIVE" : "MAINTENANCE";
    await models.Vehicle.updateOne(
      { _id: request.vehicleId },
      { $set: { status: vehicleStatus } },
    );

    await recordAuditLog({
      actorId: adminId,
      actorRole: "ADMIN",
      action: "MAINTENANCE_STATUS_UPDATED",
      entityType: "MaintenanceRequest",
      entityId: request._id,
      before,
      after: request.toObject(),
      meta: { status: normalizedStatus, vehicleStatus },
    });

    await createAdminNotification({
      adminId,
      type: normalizedStatus === "COMPLETED" ? "SYSTEM" : "ALERT",
      title: "Maintenance status updated",
      message: `Maintenance request ${request._id} is now ${normalizedStatus.replace(/_/g, " ").toLowerCase()}`,
      meta: { requestId: request._id, vehicleStatus, status: normalizedStatus },
    });

    const updated = await models.MaintenanceRequest.findById(requestId)
      .populate("vehicleId", "modelName registrationNumber status stationId")
      .populate("userId", "name email mobile")
      .lean();
    return formatMaintenanceLog(updated);
  };

  return {
    recordAuditLog,
    getDashboard,
    listUsers,
    getUserById,
    updateUserStatus,
    updateUserKycStatus,
    getPricing,
    updatePricing,
    getCommission,
    updateCommission,
    listSettlements,
    createSettlement,
    updateSettlementStatus,
    getReports,
    listTransactions,
    bookingInvoice,
    listLedger,
    updateBookingRefund,
    listAdmins,
    createAdmin,
    updateAdmin,
    listAuditLogs,
    listVehicles,
    createVehicle,
    getVehicleById,
    createAdminNotification,
    listAdminNotifications,
    markAdminNotificationRead,
    markAllAdminNotificationsRead,
    updateVehicleStatus,
    listMaintenanceLogs,
    createMaintenanceLog,
    getMaintenanceLogById,
    updateMaintenanceStatus,
  };
};
