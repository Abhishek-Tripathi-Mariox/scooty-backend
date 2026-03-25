const { models, mongoose } = require("../models");
const fileUploadService = require("../util/s3");
const AuditLogService = require("./AuditLogService");
const FinanceService = require("./FinanceService");

const BOOKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"];
const RIDE_STATUSES = ["CONFIRMED", "ACTIVE", "COMPLETED"];
const MAINTENANCE_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "REJECTED"];
const VEHICLE_STATUSES = ["ACTIVE", "MAINTENANCE", "CHARGING", "INACTIVE"];
const NOTIFICATION_TYPES = ["RIDE", "EARNING", "ALERT", "SYSTEM"];
const SUPPORT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const safeDate = (value, fallback = null) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const normalizePage = (value, fallback = 1) => {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const normalizeLimit = (value, fallback = 20) => {
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(100, n);
};

const formatDateLabel = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

const formatDateTimeLabel = (value) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const diffMinutes = (from, to) => {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(1, Math.round((end - start) / 60000));
};

const buildTextSearch = (value) => String(value || "").trim();

const buildDateSeries = (from, to) => {
  const series = [];
  let cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end) {
    series.push({
      key: cursor.toISOString().slice(0, 10),
      label: formatDateLabel(cursor),
      value: new Date(cursor),
    });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return series;
};

const resolveStationScope = async ({ stationAdminId, stationId: requestedStationId = "" }) => {
  const stationAdmin = await models.User.findOne({ _id: stationAdminId, role: "STATION_ADMIN" }).lean();
  if (!stationAdmin) return { stationAdmin: null, stationId: null };

  const assignedStationId = String(stationAdmin.stationId || "").trim();
  const requested = String(requestedStationId || "").trim();

  if (assignedStationId) {
    if (requested && requested !== assignedStationId) {
      const err = new Error("station mismatch");
      err.code = "STATION_MISMATCH";
      throw err;
    }
    return { stationAdmin, stationId: assignedStationId };
  }

  if (requested) {
    if (!mongoose.Types.ObjectId.isValid(requested)) {
      const err = new Error("stationId must be a valid id");
      err.code = "INVALID_STATION";
      throw err;
    }
    return { stationAdmin, stationId: requested };
  }

  const err = new Error("Station not assigned to station admin");
  err.code = "STATION_NOT_ASSIGNED";
  throw err;
};

const bookingPopulate = [
  { path: "vehicleId", select: "modelName registrationNumber chassisNumber batteryPercent locationLabel status photos stationId" },
  { path: "pickupStationId", select: "name address" },
  { path: "dropStationId", select: "name address" },
  { path: "userId", select: "name email mobile profilePhotoUrl" },
];

const formatBooking = (bookingDoc) => {
  const booking = bookingDoc.toObject ? bookingDoc.toObject() : bookingDoc;
  const startAt = booking.startAt || booking.createdAt;
  const endAt = booking.endAt || booking.rideEndedAt || booking.startAt || booking.createdAt;
  const vehicle = booking.vehicleId || {};
  const user = booking.userId || {};

  return {
    ...booking,
    user: {
      id: user._id || null,
      name: user.name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      profilePhotoUrl: user.profilePhotoUrl || "",
    },
    vehicle: {
      id: vehicle._id || null,
      modelName: vehicle.modelName || "",
      registrationNumber: vehicle.registrationNumber || "",
      chassisNumber: vehicle.chassisNumber || "",
      batteryPercent: vehicle.batteryPercent ?? null,
      locationLabel: vehicle.locationLabel || "",
      status: vehicle.status || "",
    },
    pickupStation: booking.pickupStationId
      ? {
        id: booking.pickupStationId._id,
        name: booking.pickupStationId.name,
        address: booking.pickupStationId.address || "",
      }
      : null,
    dropStation: booking.dropStationId
      ? {
        id: booking.dropStationId._id,
        name: booking.dropStationId.name,
        address: booking.dropStationId.address || "",
      }
      : null,
    schedule: {
      startAt,
      endAt,
      startLabel: formatDateTimeLabel(startAt),
      endLabel: formatDateTimeLabel(endAt),
      dateLabel: formatDateLabel(startAt),
    },
    totalPayable: booking.pricing?.totalPayable || 0,
  };
};

const formatMaintenance = (requestDoc) => {
  const request = requestDoc.toObject ? requestDoc.toObject() : requestDoc;
  return {
    ...request,
    dateLabel: formatDateTimeLabel(request.createdAt),
    updatedAtLabel: formatDateTimeLabel(request.updatedAt),
  };
};

const formatTicket = (ticketDoc) => {
  const ticket = ticketDoc.toObject ? ticketDoc.toObject() : ticketDoc;
  return {
    ...ticket,
    createdAtLabel: formatDateTimeLabel(ticket.createdAt),
    updatedAtLabel: formatDateTimeLabel(ticket.updatedAt),
  };
};

const formatNotification = (notificationDoc) => {
  const notification = notificationDoc.toObject ? notificationDoc.toObject() : notificationDoc;
  return {
    ...notification,
    createdAtLabel: formatDateTimeLabel(notification.createdAt),
  };
};

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
};

const pickMaintenancePhotos = (files) => {
  if (!files) return null;
  const grouped = [
    ...toArray(files.photos),
    ...toArray(files["photos[]"]),
    ...toArray(files.photo),
    ...toArray(files.maintenancePhotos),
    ...toArray(files["maintenancePhotos[]"]),
    ...toArray(files.maintenancePhoto),
    ...toArray(files.maintenance_photo),
  ];
  return grouped.length ? grouped : null;
};

module.exports = () => {
  const getDashboard = async ({ stationAdminId, stationId: requestedStationId = "" }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    const station = stationId ? await models.Station.findById(stationId).lean() : null;

    const [vehicleStatusRows, totalVehicles, activeBookings, upcomingBookings, openMaintenance, unreadNotifications, openSupportTickets, revenueRows, rideRows] =
      await Promise.all([
        models.Vehicle.aggregate([
          { $match: { ...(stationId ? { stationId: new mongoose.Types.ObjectId(stationId) } : {}) } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        models.Vehicle.countDocuments(stationId ? { stationId } : {}),
        models.Booking.countDocuments({
          ...(stationId ? { pickupStationId: stationId } : {}),
          status: { $in: ["CONFIRMED", "ACTIVE"] },
        }),
        models.Booking.countDocuments({
          ...(stationId ? { pickupStationId: stationId } : {}),
          status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] },
          startAt: { $gte: new Date() },
        }),
        models.MaintenanceRequest.countDocuments({
          ...(stationId
            ? {
              vehicleId: {
                $in: await models.Vehicle.find({ stationId }).distinct("_id"),
              },
            }
            : {}),
          status: { $in: ["OPEN", "IN_PROGRESS"] },
        }),
        models.Notification.countDocuments({ userId: stationAdminId, isRead: false }),
        models.SupportTicket.countDocuments({ status: { $in: ["OPEN", "IN_PROGRESS"] } }),
        models.Booking.aggregate([
          {
            $match: {
              ...(stationId ? { pickupStationId: new mongoose.Types.ObjectId(stationId) } : {}),
              status: "COMPLETED",
            },
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: { $ifNull: ["$pricing.totalPayable", 0] } },
              completed: { $sum: 1 },
              avgDuration: { $avg: "$actualDurationMinutes" },
            },
          },
        ]),
        models.Booking.aggregate([
          {
            $match: {
              ...(stationId ? { pickupStationId: new mongoose.Types.ObjectId(stationId) } : {}),
              status: { $in: RIDE_STATUSES },
            },
          },
          {
            $sort: { createdAt: -1 },
          },
          { $limit: 5 },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          {
            $lookup: {
              from: "vehicles",
              localField: "vehicleId",
              foreignField: "_id",
              as: "vehicle",
            },
          },
        ]),
      ]);

    const vehicleCounts = Object.fromEntries(vehicleStatusRows.map((row) => [row._id, row.count]));
    const revenueSummary = revenueRows?.[0] || {};

    return {
      station: station
        ? {
          id: station._id,
          name: station.name,
          address: station.address || "",
          isActive: station.isActive,
        }
        : null,
      stats: {
        totalVehicles,
        vehiclesByStatus: vehicleCounts,
        activeBookings,
        upcomingBookings,
        openMaintenance,
        unreadNotifications,
        openSupportTickets,
        totalRevenue: round2(revenueSummary.revenue || 0),
        completedRides: revenueSummary.completed || 0,
        averageRideMinutes: round2(revenueSummary.avgDuration || 0),
      },
      liveActivity: (rideRows || []).map((ride) => ({
        id: ride._id,
        status: ride.status,
        userName: ride.user?.[0]?.name || "",
        vehicleName: ride.vehicle?.[0]?.modelName || "",
        createdAt: ride.createdAt,
      })),
    };
  };

  const listBookings = async ({
    stationAdminId,
    stationId: requestedStationId = "",
    status,
    q,
    page = 1,
    limit = 20,
  }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const skip = (safePage - 1) * safeLimit;
    const query = {
      ...(stationId ? { pickupStationId: stationId } : {}),
    };

    if (Array.isArray(status) && status.length) {
      const allowed = status
        .map((item) => String(item || "").trim().toUpperCase())
        .filter((item) => BOOKING_STATUSES.includes(item));
      if (allowed.length) {
        query.status = { $in: allowed };
      }
    } else {
      const normalizedStatus = String(status || "").trim().toUpperCase();
      if (normalizedStatus && BOOKING_STATUSES.includes(normalizedStatus)) {
        query.status = normalizedStatus;
      }
    }

    const search = buildTextSearch(q);
    if (search) {
      const or = [
        { planCode: { $regex: search, $options: "i" } },
        { planName: { $regex: search, $options: "i" } },
        { "payment.referenceId": { $regex: search, $options: "i" } },
      ];
      if (mongoose.Types.ObjectId.isValid(search)) {
        or.push({ _id: search });
      }

      const [matchedUsers, matchedVehicles] = await Promise.all([
        models.User.find({
          role: "USER",
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { mobile: { $regex: search, $options: "i" } },
          ],
        })
          .select("_id")
          .lean(),
        models.Vehicle.find({
          $or: [
            { modelName: { $regex: search, $options: "i" } },
            { registrationNumber: { $regex: search, $options: "i" } },
            { chassisNumber: { $regex: search, $options: "i" } },
          ],
        })
          .select("_id")
          .lean(),
      ]);

      if (matchedUsers.length) {
        or.push({ userId: { $in: matchedUsers.map((row) => row._id) } });
      }
      if (matchedVehicles.length) {
        or.push({ vehicleId: { $in: matchedVehicles.map((row) => row._id) } });
      }

      query.$or = or;
    }

    const [total, rows] = await Promise.all([
      models.Booking.countDocuments(query),
      models.Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate(bookingPopulate)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      bookings: rows.map(formatBooking),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  };

  const getBooking = async ({ stationAdminId, stationId: requestedStationId = "", bookingId }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    const booking = await models.Booking.findOne({
      _id: bookingId,
      ...(stationId ? { pickupStationId: stationId } : {}),
    })
      .populate(bookingPopulate)
      .lean();

    return booking ? formatBooking(booking) : null;
  };

  const approveBooking = async ({ stationAdminId, stationId: requestedStationId = "", bookingId, note = "" }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    const booking = await models.Booking.findOne({
      _id: bookingId,
      ...(stationId ? { pickupStationId: stationId } : {}),
    });
    if (!booking) return null;

    if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
      const err = new Error("Booking cannot be approved");
      err.code = "INVALID_BOOKING_STATUS";
      throw err;
    }

    const before = booking.toObject();
    booking.status = "CONFIRMED";
    booking.payment = {
      ...booking.payment,
      status: "PAID",
      method: booking.payment?.method || "STATION_ADMIN",
      referenceId: booking.payment?.referenceId || `SA-${Date.now()}`,
      paidAmount: booking.pricing?.totalPayable || 0,
      paidAt: booking.payment?.paidAt || new Date(),
    };
    booking.meta = {
      ...(booking.meta || {}),
      stationAdminReviewed: true,
      stationAdminNote: note,
      stationAdminReviewedAt: new Date(),
      stationAdminId,
    };
    await booking.save();

    await AuditLogService().create({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "BOOKING_APPROVED",
      entityType: "Booking",
      entityId: booking._id,
      before,
      after: booking.toObject(),
      meta: { stationId, note },
    });

    return await models.Booking.findById(booking._id).populate(bookingPopulate).lean();
  };

  const cancelBooking = async ({ stationAdminId, stationId: requestedStationId = "", bookingId, reason = "" }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    const booking = await models.Booking.findOne({
      _id: bookingId,
      ...(stationId ? { pickupStationId: stationId } : {}),
    });
    if (!booking) return null;

    const before = booking.toObject();
    booking.status = "CANCELLED";
    booking.meta = {
      ...(booking.meta || {}),
      cancelledByStationAdmin: true,
      cancelledAt: new Date(),
      cancelledReason: reason,
      stationAdminId,
    };
    await booking.save();

    await AuditLogService().create({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "BOOKING_CANCELLED",
      entityType: "Booking",
      entityId: booking._id,
      before,
      after: booking.toObject(),
      meta: { stationId, reason },
    });

    return await models.Booking.findById(booking._id).populate(bookingPopulate).lean();
  };

  const listRides = async ({
    stationAdminId,
    stationId: requestedStationId = "",
    status,
    q,
    page = 1,
    limit = 20,
  }) => {
    const normalizedStatus = String(status || "").trim().toUpperCase();
    return await listBookings({
      stationAdminId,
      stationId: requestedStationId,
      status:
        normalizedStatus && BOOKING_STATUSES.includes(normalizedStatus)
          ? normalizedStatus
          : ["CONFIRMED", "ACTIVE"],
      q,
      page,
      limit,
    });
  };

  const forceEndRide = async ({ stationAdminId, stationId: requestedStationId = "", bookingId, note = "" }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    const booking = await models.Booking.findOne({
      _id: bookingId,
      ...(stationId ? { pickupStationId: stationId } : {}),
    });
    if (!booking) return null;

    if (booking.status !== "ACTIVE") {
      const err = new Error("Only active rides can be force ended");
      err.code = "INVALID_BOOKING_STATUS";
      throw err;
    }

    const endedAt = new Date();
    const startedAt = booking.rideStartedAt || booking.startAt || booking.createdAt;
    const before = booking.toObject();
    const penalty = await FinanceService().calculatePenalty({
      booking,
      actualDurationMinutes: diffMinutes(startedAt, endedAt),
    });
    booking.status = "COMPLETED";
    booking.rideEndedAt = endedAt;
    booking.actualDurationMinutes = diffMinutes(startedAt, endedAt);
    booking.meta = {
      ...(booking.meta || {}),
      forceEndedByStationAdmin: true,
      forceEndedAt: endedAt,
      forceEndNote: note,
      stationAdminId,
      penalty,
    };
    await booking.save();

    const vehicleStationId = booking.dropStationId || booking.pickupStationId;
    await models.Vehicle.updateOne(
      { _id: booking.vehicleId, ...(vehicleStationId ? { stationId: vehicleStationId } : {}) },
      {
        $set: {
          status: "ACTIVE",
          ...(vehicleStationId ? { stationId: vehicleStationId } : {}),
        },
      },
    );

    await AuditLogService().create({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "RIDE_FORCE_ENDED",
      entityType: "Booking",
      entityId: booking._id,
      before,
      after: booking.toObject(),
      meta: { stationId, note },
    });

    return await models.Booking.findById(booking._id).populate(bookingPopulate).lean();
  };

  const lockVehicle = async ({ stationAdminId, stationId: requestedStationId = "", bookingId, note = "" }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    const booking = await models.Booking.findOne({
      _id: bookingId,
      ...(stationId ? { pickupStationId: stationId } : {}),
    }).lean();
    if (!booking) return null;

    const vehicle = await models.Vehicle.findOne({
      _id: booking.vehicleId,
      ...(stationId ? { stationId } : {}),
    });
    if (!vehicle) return null;
    const before = vehicle.toObject();

    vehicle.status = "INACTIVE";
    vehicle.approvalNote = note || "Locked by station admin";
    await vehicle.save();

    await models.Booking.updateOne(
      { _id: bookingId },
      {
        $set: {
          "meta.stationAdminLocked": true,
          "meta.stationAdminLockedAt": new Date(),
          "meta.stationAdminId": stationAdminId,
          "meta.stationAdminLockNote": note,
        },
      },
    );

    await AuditLogService().create({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "VEHICLE_LOCKED",
      entityType: "Vehicle",
      entityId: vehicle._id,
      before,
      after: vehicle.toObject(),
      meta: { stationId, note },
    });

    return await models.Vehicle.findById(vehicle._id).lean();
  };

  const listMaintenance = async ({
    stationAdminId,
    status,
    q,
    page = 1,
    limit = 20,
  }) => {
    const { stationAdmin, stationId } = await resolveStationScope({ stationAdminId });
    if (!stationAdmin) return null;

    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const skip = (safePage - 1) * safeLimit;
    const normalizedStatus = String(status || "").trim().toUpperCase();

    const query = { stationId };
    if (normalizedStatus && MAINTENANCE_STATUSES.includes(normalizedStatus)) {
      query.status = normalizedStatus;
    }

    const search = buildTextSearch(q);
    if (search) {
      const or = [
        { issueType: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { resolutionNote: { $regex: search, $options: "i" } },
      ];
      if (mongoose.Types.ObjectId.isValid(search)) {
        or.push({ _id: search });
      }
      query.$or = or;
    }

    const [total, rows] = await Promise.all([
      models.MaintenanceRequest.countDocuments(query),
      models.MaintenanceRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("vehicleId", "modelName registrationNumber status stationId")
        .populate("userId", "name email mobile")
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      requests: rows.map(formatMaintenance),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  };

  const createMaintenance = async ({
    stationAdminId,
    payload,
    files = null,
  }) => {
    const { stationAdmin, stationId } = await resolveStationScope({ stationAdminId });
    if (!stationAdmin) return null;

    const vehicleId = String(payload.vehicleId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
      const err = new Error("vehicleId is required");
      err.code = "INVALID_VEHICLE";
      throw err;
    }
    const vehicle = await models.Vehicle.findOne({
      _id: new mongoose.Types.ObjectId(vehicleId),
      ...(stationId ? { stationId } : {}),
    });
    if (!vehicle) {
      const err = new Error("Vehicle not found");
      err.code = "VEHICLE_NOT_FOUND";
      throw err;
    }

    const issueType = String(payload.issueType || "OTHER").trim().toUpperCase();
    const description = String(payload.description || "").trim();
    if (!description) {
      const err = new Error("description is required");
      err.code = "INVALID_MAINTENANCE_INPUT";
      throw err;
    }

    const estimatedCostRaw = payload.estimatedCost;
    const estimatedCost =
      estimatedCostRaw === undefined || estimatedCostRaw === null || String(estimatedCostRaw).trim() === ""
        ? null
        : Number(estimatedCostRaw);
    if (estimatedCost !== null && Number.isNaN(estimatedCost)) {
      const err = new Error("estimatedCost must be a number");
      err.code = "INVALID_MAINTENANCE_INPUT";
      throw err;
    }

    let photoUrls = [];
    const maintenancePhotos = pickMaintenancePhotos(files);
    if (maintenancePhotos && maintenancePhotos.length) {
      const uploadRes = await fileUploadService.uploadFileToAws(maintenancePhotos);
      photoUrls = (uploadRes.images || []).filter(Boolean);
    }

    const request = await models.MaintenanceRequest.create({
      userId: stationAdminId,
      vehicleId: vehicle._id,
      stationId,
      issueType: [
        "BATTERY",
        "BRAKE",
        "TIRE",
        "ELECTRICAL",
        "BODY",
        "MOTOR",
        "OTHER",
      ].includes(issueType)
        ? issueType
        : "OTHER",
      description,
      estimatedCost,
      photoUrls,
      status: "OPEN",
    });

    await AuditLogService().create({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "MAINTENANCE_CREATED",
      entityType: "MaintenanceRequest",
      entityId: request._id,
      after: request,
      meta: { stationId, vehicleId: vehicle._id, issueType: request.issueType },
    });

    vehicle.status = "MAINTENANCE";
    vehicle.approvalNote = String(payload.note || "").trim();
    await vehicle.save();

    return await models.MaintenanceRequest.findById(request._id)
      .populate("vehicleId", "modelName registrationNumber status stationId")
      .populate("userId", "name email mobile")
      .lean();
  };

  const maintenanceDetail = async ({ stationAdminId, requestId }) => {
    const { stationAdmin, stationId } = await resolveStationScope({ stationAdminId });
    if (!stationAdmin) return null;

    const request = await models.MaintenanceRequest.findOne({ _id: requestId, stationId })
      .populate("vehicleId", "modelName registrationNumber status stationId")
      .populate("userId", "name email mobile")
      .lean();

    return request ? formatMaintenance(request) : null;
  };

  const updateMaintenanceStatus = async ({
    stationAdminId,
    requestId,
    status,
    resolutionNote = "",
  }) => {
    const { stationAdmin, stationId } = await resolveStationScope({ stationAdminId });
    if (!stationAdmin) return null;

    const normalizedStatus = String(status || "").trim().toUpperCase();
    if (!MAINTENANCE_STATUSES.includes(normalizedStatus)) {
      const err = new Error("Invalid maintenance status");
      err.code = "INVALID_MAINTENANCE_STATUS";
      throw err;
    }

    const request = await models.MaintenanceRequest.findOne({ _id: requestId, stationId });
    if (!request) {
      const err = new Error("Maintenance request not found");
      err.code = "MAINTENANCE_REQUEST_NOT_FOUND";
      throw err;
    }
    const before = request.toObject();

    request.status = normalizedStatus;
    request.resolutionNote = String(resolutionNote || "").trim();
    await request.save();

    const vehicleStatus = normalizedStatus === "COMPLETED" || normalizedStatus === "REJECTED" ? "ACTIVE" : "MAINTENANCE";
    await models.Vehicle.updateOne(
      { _id: request.vehicleId, ...(stationId ? { stationId } : {}) },
      { $set: { status: vehicleStatus } },
    );

    await AuditLogService().create({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "MAINTENANCE_STATUS_UPDATED",
      entityType: "MaintenanceRequest",
      entityId: request._id,
      before,
      after: request.toObject(),
      meta: { status: normalizedStatus, vehicleStatus },
    });

    return await models.MaintenanceRequest.findById(request._id)
      .populate("vehicleId", "modelName registrationNumber status stationId")
      .populate("userId", "name email mobile")
      .lean();
  };

  const listNotifications = async ({ stationAdminId, type }) => {
    const query = { userId: stationAdminId };
    const normalizedType = String(type || "").trim().toUpperCase();
    if (normalizedType && NOTIFICATION_TYPES.includes(normalizedType)) {
      query.type = normalizedType;
    }
    return await models.Notification.find(query).sort({ createdAt: -1 }).limit(100).lean();
  };

  const markNotificationRead = async ({ stationAdminId, notificationId }) => {
    const notification = await models.Notification.findOne({
      _id: notificationId,
      userId: stationAdminId,
    });
    if (!notification) return null;
    notification.isRead = true;
    await notification.save();
    return notification.toObject();
  };

  const markAllNotificationsRead = async ({ stationAdminId, type = null } = {}) => {
    const query = { userId: stationAdminId, isRead: false };
    const normalizedType = String(type || "").trim().toUpperCase();
    if (normalizedType && NOTIFICATION_TYPES.includes(normalizedType)) {
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

  const listSupportTickets = async ({
    status,
    q,
    page = 1,
    limit = 20,
  }) => {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const skip = (safePage - 1) * safeLimit;
    const query = {};

    const normalizedStatus = String(status || "").trim().toUpperCase();
    if (normalizedStatus && SUPPORT_STATUSES.includes(normalizedStatus)) {
      query.status = normalizedStatus;
    }

    const search = buildTextSearch(q);
    if (search) {
      const userIds = await models.User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { mobile: { $regex: search, $options: "i" } },
        ],
      })
        .select("_id")
        .lean();

      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
        ...(userIds.length ? [{ userId: { $in: userIds.map((row) => row._id) } }] : []),
      ];
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or.push({ _id: search });
      }
    }

    const [total, rows] = await Promise.all([
      models.SupportTicket.countDocuments(query),
      models.SupportTicket.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("userId", "name email mobile profilePhotoUrl")
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    return {
      tickets: rows.map(formatTicket),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  };

  const supportTicketDetail = async ({ ticketId }) => {
    const ticket = await models.SupportTicket.findById(ticketId)
      .populate("userId", "name email mobile profilePhotoUrl")
      .lean();
    return ticket ? formatTicket(ticket) : null;
  };

  const updateSupportTicket = async ({ stationAdminId, ticketId, status }) => {
    const normalizedStatus = String(status || "").trim().toUpperCase();
    if (!SUPPORT_STATUSES.includes(normalizedStatus)) {
      const err = new Error("Invalid support ticket status");
      err.code = "INVALID_SUPPORT_STATUS";
      throw err;
    }

    const ticket = await models.SupportTicket.findById(ticketId);
    if (!ticket) return null;
    const before = ticket.toObject();

    ticket.status = normalizedStatus;
    await ticket.save();
    await AuditLogService().create({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "SUPPORT_TICKET_STATUS_UPDATED",
      entityType: "SupportTicket",
      entityId: ticket._id,
      before,
      after: ticket.toObject(),
      meta: { status: normalizedStatus },
    });
    return ticket.toObject();
  };

  const escalateSupportTicket = async ({ stationAdminId, ticketId, note = "" }) => {
    const ticket = await models.SupportTicket.findById(ticketId);
    if (!ticket) return null;

    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      const err = new Error("Resolved tickets cannot be escalated");
      err.code = "INVALID_SUPPORT_STATUS";
      throw err;
    }

    const before = ticket.toObject();
    ticket.status = "IN_PROGRESS";
    ticket.escalatedToSuperAdmin = true;
    ticket.escalatedAt = new Date();
    ticket.escalationNote = String(note || "").trim();
    await ticket.save();
    await AuditLogService().create({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "SUPPORT_TICKET_ESCALATED",
      entityType: "SupportTicket",
      entityId: ticket._id,
      before,
      after: ticket.toObject(),
      meta: { note: ticket.escalationNote },
    });
    return ticket.toObject();
  };

  const reports = async ({
    stationAdminId,
    stationId: requestedStationId = "",
    from,
    to,
    q,
  }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    const end = safeDate(to, endOfDay(new Date()));
    const start = safeDate(from, startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)));
    const fromDate = startOfDay(start);
    const toDate = endOfDay(end);
    const series = buildDateSeries(fromDate, toDate);
    const search = buildTextSearch(q);
    let matchedVehicleIds = null;

    if (search) {
      const vehicleQuery = {
        ...(stationId ? { stationId } : {}),
        $or: [
          { modelName: { $regex: search, $options: "i" } },
          { registrationNumber: { $regex: search, $options: "i" } },
          { chassisNumber: { $regex: search, $options: "i" } },
        ],
      };
      if (mongoose.Types.ObjectId.isValid(search)) {
        vehicleQuery.$or.push({ _id: search });
      }

      matchedVehicleIds = await models.Vehicle.find(vehicleQuery).distinct("_id");
    }

    const bookingMatch = {
      createdAt: { $gte: fromDate, $lte: toDate },
      ...(stationId ? { pickupStationId: new mongoose.Types.ObjectId(stationId) } : {}),
    };
    if (Array.isArray(matchedVehicleIds)) {
      bookingMatch.vehicleId = { $in: matchedVehicleIds };
    }

    const maintenanceMatch = {
      createdAt: { $gte: fromDate, $lte: toDate },
      ...(Array.isArray(matchedVehicleIds) ? { vehicleId: { $in: matchedVehicleIds } } : {}),
    };

    const [summaryRows, bookings, vehicleRows, maintenanceRows] = await Promise.all([
      models.Booking.aggregate([
        { $match: bookingMatch },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            confirmedBookings: {
              $sum: { $cond: [{ $eq: ["$status", "CONFIRMED"] }, 1, 0] },
            },
            activeRides: {
              $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
            },
            completedRides: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
            },
            cancelledBookings: {
              $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
            },
            revenue: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "COMPLETED"] },
                  { $ifNull: ["$pricing.totalPayable", 0] },
                  0,
                ],
              },
            },
            avgDuration: {
              $avg: {
                $cond: [{ $eq: ["$status", "COMPLETED"] }, "$actualDurationMinutes", null],
              },
            },
          },
        },
      ]),
      models.Booking.find(bookingMatch)
        .select("status pricing.totalPayable actualDurationMinutes createdAt rideEndedAt vehicleId pickupStationId")
        .lean(),
      models.Vehicle.aggregate([
        {
          $match: {
            ...(stationId ? { stationId: new mongoose.Types.ObjectId(stationId) } : {}),
            ...(Array.isArray(matchedVehicleIds) ? { _id: { $in: matchedVehicleIds } } : {}),
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      models.MaintenanceRequest.aggregate([
        {
          $lookup: {
            from: "vehicles",
            localField: "vehicleId",
            foreignField: "_id",
            as: "vehicle",
          },
        },
        { $unwind: "$vehicle" },
        {
          $match: {
            ...(stationId ? { "vehicle.stationId": new mongoose.Types.ObjectId(stationId) } : {}),
            ...maintenanceMatch,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summary = summaryRows[0] || {};
    const dailyMap = new Map(series.map((row) => [row.key, { date: row.key, label: row.label, revenue: 0, rides: 0 }]));
    for (const booking of bookings) {
      const date = new Date(booking.rideEndedAt || booking.createdAt).toISOString().slice(0, 10);
      const slot = dailyMap.get(date);
      if (!slot) continue;
      slot.rides += 1;
      if (booking.status === "COMPLETED") {
        slot.revenue = round2(slot.revenue + Number(booking.pricing?.totalPayable || 0));
      }
    }

    return {
      summary: {
        totalBookings: summary.totalBookings || 0,
        confirmedBookings: summary.confirmedBookings || 0,
        activeRides: summary.activeRides || 0,
        completedRides: summary.completedRides || 0,
        cancelledBookings: summary.cancelledBookings || 0,
        revenue: round2(summary.revenue || 0),
        averageRideMinutes: round2(summary.avgDuration || 0),
      },
      daily: Array.from(dailyMap.values()),
      vehiclesByStatus: Object.fromEntries(vehicleRows.map((row) => [row._id, row.count])),
      maintenanceByStatus: Object.fromEntries(maintenanceRows.map((row) => [row._id, row.count])),
    };
  };

  const listTransactions = async ({
    stationAdminId,
    stationId: requestedStationId = "",
    type,
    from,
    to,
    page = 1,
    limit = 20,
  }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    return await FinanceService().listTransactions({
      role: "ADMIN",
      type,
      from,
      to,
      stationId,
      page,
      limit,
    });
  };

  const bookingInvoice = async ({ stationAdminId, stationId: requestedStationId = "", bookingId }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    const booking = await models.Booking.findOne({
      _id: bookingId,
      ...(stationId ? { pickupStationId: stationId } : {}),
    })
      .populate("vehicleId", "modelName registrationNumber photos ownerId")
      .populate("pickupStationId", "name address")
      .populate("dropStationId", "name address")
      .populate("userId", "name email mobile")
      .lean();
    if (!booking) return null;

    return await FinanceService().buildBookingInvoice({
      bookingDoc: booking,
      customer: {
        id: booking.userId?._id || booking.userId || null,
        name: booking.userId?.name || "",
        mobile: booking.userId?.mobile || "",
        email: booking.userId?.email || "",
      },
    });
  };

  const updateBookingRefund = async ({
    stationAdminId,
    stationId: requestedStationId = "",
    bookingId,
    status,
    note,
    failureReason,
    referenceId,
    method,
  }) => {
    const { stationAdmin, stationId } = await resolveStationScope({
      stationAdminId,
      stationId: requestedStationId,
    });
    if (!stationAdmin) return null;

    const booking = await models.Booking.findOne({
      _id: bookingId,
      ...(stationId ? { pickupStationId: stationId } : {}),
    });
    if (!booking) return null;

    const result = await FinanceService().markRefundState({
      bookingId,
      status,
      note,
      failureReason,
      referenceId,
      method,
      processedByRole: "STATION_ADMIN",
      processedByUserId: stationAdminId,
    });
    return result ? result.booking : null;
  };

  return {
    getDashboard,
    listBookings,
    getBooking,
    approveBooking,
    cancelBooking,
    listRides,
    forceEndRide,
    lockVehicle,
    listMaintenance,
    createMaintenance,
    maintenanceDetail,
    updateMaintenanceStatus,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    listSupportTickets,
    supportTicketDetail,
    updateSupportTicket,
    escalateSupportTicket,
    reports,
    listTransactions,
    bookingInvoice,
    updateBookingRefund,
  };
};
