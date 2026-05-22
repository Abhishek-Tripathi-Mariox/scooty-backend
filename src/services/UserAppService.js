const { models, mongoose } = require("../models");
const ContentService = require("./ContentService");
const AuditLogService = require("./AuditLogService");
const FinanceService = require("./FinanceService");

const BOOKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"];
const ACTIVE_BOOKING_STATUSES = ["CONFIRMED", "ACTIVE"];

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const haversineDistanceKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const normalizeDateInput = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim().slice(0, 10);
};

const mergeDateTime = (dateValue, timeValue) => {
  const datePart = normalizeDateInput(dateValue);
  const timePart = String(timeValue || "").trim();
  if (!datePart || !/^\d{2}:\d{2}$/.test(timePart)) return null;
  return new Date(`${datePart}T${timePart}:00`);
};

const formatTime = (date) =>
  new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

const formatDateLabel = (date) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

const pickVehicleImage = (vehicle) =>
  vehicle?.photos?.sideUrl || vehicle?.photos?.frontUrl || "";

const buildUnlockCode = (bookingId) => `MV-${String(bookingId).slice(-6).toUpperCase()}`;

const defaultNotificationsSettings = () => ({
  rideUpdates: true,
  earnings: true,
  payout: true,
  promotions: true,
  maintenance: true,
});

const defaultPermissionsSettings = () => ({
  location: false,
  camera: false,
  notifications: false,
});

const defaultLocationSettings = () => ({
  isEnabled: false,
  latitude: null,
  longitude: null,
  accuracy: null,
  source: "",
  city: "",
  state: "",
  pincode: "",
  updatedAt: null,
});

const normalizeSettingsPayload = (payload = {}) => {
  const input = payload.settings || payload || {};
  return {
    ...input,
    notifications: {
      ...defaultNotificationsSettings(),
      ...(input.notifications || {}),
    },
    permissions: {
      ...defaultPermissionsSettings(),
      ...(input.permissions || {}),
    },
    location: {
      ...defaultLocationSettings(),
      ...(input.location || {}),
    },
  };
};

module.exports = () => {
  const getAdminPricing = async () => {
    const setting = await models.AdminSetting.findOne({ key: "pricing" }).lean();
    return setting?.value || {};
  };

  const getDashboard = async ({ userId }) => {
    const user = await models.User.findById(userId).lean();
    if (!user) return null;

    const [completedSummary, unreadNotifications] = await Promise.all([
      models.Booking.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(String(userId)),
            status: "COMPLETED",
          },
        },
        {
          $group: {
            _id: null,
            ridesCompleted: { $sum: 1 },
            totalSpent: { $sum: { $ifNull: ["$pricing.totalPayable", 0] } },
          },
        },
      ]),
      models.Notification.countDocuments({ userId, isRead: false }),
    ]);

    const summary = completedSummary?.[0] || {};
    return {
      walletBalance: round2(Number(user.walletBalance || 0)),
      totalSpent: round2(Number(summary.totalSpent || 0)),
      ridesCompleted: Number(summary.ridesCompleted || 0),
      unreadNotifications,
    };
  };

  const getSettings = async ({ userId }) => {
    const user = await models.User.findById(userId).lean();
    if (!user) return null;

    return {
      language: user.settings?.language || "en",
      notifications: {
        ...defaultNotificationsSettings(),
        ...(user.settings?.notifications || {}),
      },
      permissions: {
        ...defaultPermissionsSettings(),
        ...(user.settings?.permissions || {}),
      },
      location: {
        ...defaultLocationSettings(),
        ...(user.settings?.location || {}),
      },
    };
  };

  const updateSettings = async ({ userId, payload }) => {
    const user = await models.User.findById(userId);
    if (!user) return null;

    const settings = normalizeSettingsPayload(payload);
    const language = String(settings.language || payload.language || user.settings?.language || "en").trim() || "en";

    user.settings = {
      ...(user.settings || {}),
      language,
      notifications: {
        ...defaultNotificationsSettings(),
        ...(user.settings?.notifications || {}),
        ...(settings.notifications || {}),
      },
      permissions: {
        ...defaultPermissionsSettings(),
        ...(user.settings?.permissions || {}),
        ...(settings.permissions || {}),
      },
      location: {
        ...defaultLocationSettings(),
        ...(user.settings?.location || {}),
        ...(settings.location || {}),
        updatedAt: settings.location ? new Date() : user.settings?.location?.updatedAt || null,
      },
    };

    if (payload.city !== undefined) user.city = String(payload.city || "").trim();
    if (payload.state !== undefined) user.state = String(payload.state || "").trim();
    if (payload.pincode !== undefined) user.pincode = String(payload.pincode || "").trim();

    await user.save();
    return user.toObject();
  };

  const updateLocation = async ({ userId, payload }) => {
    return await updateSettings({
      userId,
      payload: {
        settings: {
          location: payload.location || payload,
        },
      },
    });
  };

  const createNotification = async ({ userId, type = "SYSTEM", title, message, meta = {} }) => {
    return await models.Notification.create({
      userId,
      type,
      title: String(title || "").trim(),
      message: String(message || "").trim(),
      meta,
    });
  };

  const hasBookingConflict = async ({ vehicleId, startAt, endAt, excludeBookingId = null }) => {
    const query = {
      vehicleId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    };
    if (excludeBookingId) query._id = { $ne: excludeBookingId };
    const existing = await models.Booking.exists(query);
    return !!existing;
  };

  const buildQuote = async ({
    userId,
    pickupStationId,
    dropStationId,
    vehicleId,
    planCode,
    date,
    startTime,
    referralCode,
    walletToUse,
  }) => {
    const plan = await ContentService().getApprovedPlanByCode({
      stationId: pickupStationId,
      code: planCode,
    });
    if (!plan) {
      const err = new Error("Invalid plan selected");
      err.code = "INVALID_PLAN";
      throw err;
    }

    if (!mongoose.Types.ObjectId.isValid(String(pickupStationId || ""))) {
      const err = new Error("Valid pickupStationId is required");
      err.code = "INVALID_PICKUP_STATION";
      throw err;
    }

    const pickupStation = await models.Station.findOne({
      _id: pickupStationId,
      isActive: true,
    }).lean();
    if (!pickupStation) {
      const err = new Error("Pickup station not found");
      err.code = "PICKUP_STATION_NOT_FOUND";
      throw err;
    }

    let dropStation = pickupStation;
    if (dropStationId) {
      dropStation = await models.Station.findOne({
        _id: dropStationId,
        isActive: true,
      }).lean();
      if (!dropStation) {
        const err = new Error("Drop station not found");
        err.code = "DROP_STATION_NOT_FOUND";
        throw err;
      }
    }

    const startAt = mergeDateTime(date, startTime);
    if (!startAt || Number.isNaN(startAt.getTime())) {
      const err = new Error("Valid date and startTime are required");
      err.code = "INVALID_START_TIME";
      throw err;
    }

    if (startAt.getTime() < Date.now() - 5 * 60 * 1000) {
      const err = new Error("Start time cannot be in the past");
      err.code = "PAST_TIME";
      throw err;
    }

    const endAt = new Date(startAt.getTime() + plan.durationHours * 60 * 60 * 1000);

    let vehicleQuery = {
      stationId: pickupStation._id,
      status: "ACTIVE",
    };
    if (vehicleId) {
      if (!mongoose.Types.ObjectId.isValid(String(vehicleId))) {
        const err = new Error("Invalid vehicleId");
        err.code = "INVALID_VEHICLE";
        throw err;
      }
      vehicleQuery._id = vehicleId;
    }

    const vehicles = await models.Vehicle.find(vehicleQuery).sort({ createdAt: 1 }).lean();
    if (!vehicles.length) {
      const err = new Error("No scooty available at this station");
      err.code = "NO_VEHICLE_AVAILABLE";
      throw err;
    }

    let selectedVehicle = null;
    for (const vehicle of vehicles) {
      const conflict = await hasBookingConflict({
        vehicleId: vehicle._id,
        startAt,
        endAt,
      });
      if (!conflict) {
        selectedVehicle = vehicle;
        break;
      }
    }

    if (!selectedVehicle) {
      const err = new Error("No scooty available for the selected time slot");
      err.code = "TIME_SLOT_UNAVAILABLE";
      throw err;
    }

    const user = await models.User.findById(userId).lean();
    if (!user) {
      const err = new Error("User not found");
      err.code = "USER_NOT_FOUND";
      throw err;
    }

    let referralDiscount = 0;
    let referralApplied = "";
    if (referralCode) {
      const normalizedReferral = String(referralCode).trim().toUpperCase();
      const referralOwner = await models.User.findOne({
        referralCode: normalizedReferral,
        role: "USER",
      }).lean();
      if (!referralOwner || String(referralOwner._id) === String(userId)) {
        const err = new Error("Invalid referral code");
        err.code = "INVALID_REFERRAL";
        throw err;
      }
      referralDiscount = 50;
      referralApplied = normalizedReferral;
    }

    const baseFare = round2(plan.price);
    const pricingConfig = await getAdminPricing();
    const convenienceFeePercent = Number(pricingConfig.convenienceFeePercent ?? 3);
    const minimumConvenienceFee = Number(pricingConfig.minimumConvenienceFee ?? 9);
    const taxPercent = Number(pricingConfig.taxPercent ?? 18);
    const securityDeposit = round2(plan.securityDeposit || pricingConfig.securityDepositDefault || 0);
    const convenienceFee = round2(
      Math.max(minimumConvenienceFee, Math.round(baseFare * (convenienceFeePercent / 100))),
    );
    const tax = round2((baseFare + convenienceFee) * (taxPercent / 100));
    const subtotal = round2(baseFare + securityDeposit + convenienceFee + tax);
    const requestedWalletUse = Math.max(0, Number(walletToUse || 0));
    const walletUsed = round2(Math.min(requestedWalletUse, Number(user.walletBalance || 0), subtotal - referralDiscount));
    const totalPayable = round2(Math.max(0, subtotal - referralDiscount - walletUsed));

    return {
      user,
      plan,
      pickupStation,
      dropStation,
      vehicle: selectedVehicle,
      startAt,
      endAt,
      date: normalizeDateInput(date),
      referralCodeApplied: referralApplied,
      pricing: {
        baseFare,
        securityDeposit,
        convenienceFee,
        tax,
        discount: referralDiscount,
        referralDiscount,
        walletUsed,
        totalPayable,
      },
    };
  };

  const formatBooking = (bookingDoc) => {
    const booking = bookingDoc.toObject ? bookingDoc.toObject() : bookingDoc;
    return {
      ...booking,
      schedule: {
        date: booking.date,
        startAt: booking.startAt,
        endAt: booking.endAt,
        startLabel: formatTime(booking.startAt),
        endLabel: formatTime(booking.endAt),
        dateLabel: formatDateLabel(booking.startAt),
      },
      scooter: booking.vehicleId && booking.vehicleId._id
        ? {
            id: booking.vehicleId._id,
            modelName: booking.vehicleId.modelName,
            registrationNumber: booking.vehicleId.registrationNumber,
            imageUrl: pickVehicleImage(booking.vehicleId),
          }
        : undefined,
      pickupStation: booking.pickupStationId && booking.pickupStationId._id
        ? {
            id: booking.pickupStationId._id,
            name: booking.pickupStationId.name,
            address: booking.pickupStationId.address,
          }
        : undefined,
      dropStation: booking.dropStationId && booking.dropStationId._id
        ? {
            id: booking.dropStationId._id,
            name: booking.dropStationId.name,
            address: booking.dropStationId.address,
          }
        : undefined,
    };
  };

  const listPlans = async ({ stationId } = {}) => {
    const plans = await ContentService().listApprovedPlansForUser({ stationId });
    if (!stationId || !mongoose.Types.ObjectId.isValid(String(stationId))) {
      return plans;
    }

    const availableScooters = await models.Vehicle.countDocuments({
      stationId,
      status: "ACTIVE",
    });

    return plans.map((plan) => ({
      ...plan,
      availableScooters,
    }));
  };

  const listStations = async ({ lat, lng, search, city, state } = {}) => {
    const query = { isActive: true };
    const andFilters = [];
    if (search) {
      const regex = new RegExp(String(search).trim(), "i");
      andFilters.push({ $or: [{ name: regex }, { address: regex }, { city: regex }, { state: regex }] });
    }

    const normalizedCity = String(city || "").trim();
    const normalizedState = String(state || "").trim();
    if (normalizedCity) {
      const cityRegex = new RegExp(normalizedCity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andFilters.push({ $or: [{ city: cityRegex }, { address: cityRegex }, { name: cityRegex }] });
    }
    if (normalizedState) {
      const stateRegex = new RegExp(normalizedState.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andFilters.push({ $or: [{ state: stateRegex }, { address: stateRegex }, { name: stateRegex }] });
    }

    if (andFilters.length > 0) {
      query.$and = andFilters;
    }

    const stations = await models.Station.find(query).sort({ createdAt: -1 }).lean();
    const stationIds = stations.map((station) => station._id);
    const vehicleCounts = await models.Vehicle.aggregate([
      {
        $match: {
          stationId: { $in: stationIds },
          status: { $nin: ["REMOVED"] },
        },
      },
      {
        $group: {
          _id: "$stationId",
          totalVehicles: { $sum: 1 },
          availableScooters: {
            $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
          },
          averageBatteryPercent: {
            $avg: {
              $cond: [{ $eq: ["$status", "ACTIVE"] }, "$batteryPercent", null],
            },
          },
        },
      },
    ]);

    const countsMap = new Map(
      vehicleCounts.map((item) => [
        String(item._id),
        {
          availableScooters: item.availableScooters,
          totalVehicles: item.totalVehicles,
          averageBatteryPercent:
            item.averageBatteryPercent != null ? Math.round(item.averageBatteryPercent) : null,
        },
      ]),
    );
    const hasCoordinates = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

    const data = stations.map((station) => {
      const stationLat = Number(station.location?.coordinates?.[1] || 0);
      const stationLng = Number(station.location?.coordinates?.[0] || 0);
      const hasStationCoords = Number.isFinite(stationLat) && Number.isFinite(stationLng) && (stationLat !== 0 || stationLng !== 0);
      const distanceKm = hasCoordinates && hasStationCoords
        ? round2(haversineDistanceKm(Number(lat), Number(lng), stationLat, stationLng))
        : null;
      const counts = countsMap.get(String(station._id)) || {};
      const maxVehicles = Number(station.maxVehicles || 0);
      const occupiedCount = counts.totalVehicles || 0;
      const remainingCapacity = maxVehicles > 0 ? Math.max(0, maxVehicles - occupiedCount) : null;

      return {
        ...station,
        coordinates: hasStationCoords
          ? { latitude: stationLat, longitude: stationLng }
          : null,
        availableScooters: counts.availableScooters || 0,
        averageBatteryPercent: counts.averageBatteryPercent ?? null,
        maxVehicles: maxVehicles || null,
        occupiedVehicles: occupiedCount,
        remainingCapacity,
        isFull: maxVehicles > 0 ? occupiedCount >= maxVehicles : false,
        distanceKm,
      };
    });

    data.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    return data;
  };

  const stationDetail = async (stationId) => {
    const station = await models.Station.findOne({ _id: stationId, isActive: true }).lean();
    if (!station) return null;

    const scooters = await models.Vehicle.find({
      stationId,
      status: "ACTIVE",
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return {
      station: {
        ...station,
        availableScooters: scooters.length,
      },
      scooters: scooters.map((vehicle) => ({
        _id: vehicle._id,
        modelName: vehicle.modelName,
        registrationNumber: vehicle.registrationNumber,
        imageUrl: pickVehicleImage(vehicle),
        status: vehicle.status,
      })),
    };
  };

  const listTimeSlots = async ({ date, planCode, stationId } = {}) => {
    const normalizedDate = normalizeDateInput(date) || normalizeDateInput(new Date());
    let plan = null;
    if (planCode) {
      const query = {
        code: String(planCode).trim().toUpperCase(),
        status: "APPROVED",
      };
      if (stationId && mongoose.Types.ObjectId.isValid(String(stationId))) {
        query.stationId = stationId;
      }
      plan = await models.RidePlan.findOne(query).lean();
    }
    if (!plan) {
      const query = { status: "APPROVED" };
      if (stationId && mongoose.Types.ObjectId.isValid(String(stationId))) {
        query.stationId = stationId;
      }
      plan = await models.RidePlan.findOne(query).sort({ price: 1, createdAt: -1 }).lean();
    }
    if (!plan) {
      const err = new Error("No approved ride plan available");
      err.code = "PLAN_NOT_AVAILABLE";
      throw err;
    }
    const slots = [];
    const now = Date.now();

    for (let hour = 6; hour <= 22; hour += 1) {
      for (const minute of [0, 30]) {
        const hh = String(hour).padStart(2, "0");
        const mm = String(minute).padStart(2, "0");
        const startAt = mergeDateTime(normalizedDate, `${hh}:${mm}`);
        const endAt = new Date(startAt.getTime() + plan.durationHours * 60 * 60 * 1000);
        slots.push({
          label: formatTime(startAt),
          value: `${hh}:${mm}`,
          disabled: startAt.getTime() < now,
          endLabel: formatTime(endAt),
        });
      }
    }

    return {
      date: normalizedDate,
      plan,
      slots,
    };
  };

  const generateQuote = async ({ userId, payload }) => {
    const quote = await buildQuote({
      userId,
      pickupStationId: payload.pickupStationId || payload.stationId,
      dropStationId: payload.dropStationId,
      vehicleId: payload.vehicleId,
      planCode: payload.planCode,
      date: payload.date,
      startTime: payload.startTime,
      referralCode: payload.referralCode,
      walletToUse: payload.walletToUse,
    });

    return {
      plan: quote.plan,
      scooter: {
        id: quote.vehicle._id,
        modelName: quote.vehicle.modelName,
        registrationNumber: quote.vehicle.registrationNumber,
        imageUrl: pickVehicleImage(quote.vehicle),
      },
      pickupStation: quote.pickupStation,
      dropStation: quote.dropStation,
      schedule: {
        date: quote.date,
        startAt: quote.startAt,
        endAt: quote.endAt,
        startLabel: formatTime(quote.startAt),
        endLabel: formatTime(quote.endAt),
      },
      pricing: quote.pricing,
      referralCodeApplied: quote.referralCodeApplied,
    };
  };

  const createBooking = async ({ userId, payload }) => {
    const quote = await buildQuote({
      userId,
      pickupStationId: payload.pickupStationId || payload.stationId,
      dropStationId: payload.dropStationId,
      vehicleId: payload.vehicleId,
      planCode: payload.planCode,
      date: payload.date,
      startTime: payload.startTime,
      referralCode: payload.referralCode,
      walletToUse: payload.walletToUse,
    });

    const user = await models.User.findById(userId);
    if (!user) return null;

    const paymentMethod = String(payload.paymentMethod || "").trim();
    const autoConfirm = paymentMethod && payload.autoConfirm !== false;
    const booking = await models.Booking.create({
      userId,
      vehicleId: quote.vehicle._id,
      pickupStationId: quote.pickupStation._id,
      dropStationId: quote.dropStation?._id,
      planCode: quote.plan.code,
      planName: quote.plan.name,
      planType: quote.plan.type,
      date: quote.date,
      startAt: quote.startAt,
      endAt: quote.endAt,
      durationHours: quote.plan.durationHours,
      status: autoConfirm ? "CONFIRMED" : "PENDING_PAYMENT",
      pricing: quote.pricing,
      payment: autoConfirm
        ? {
            status: "PAID",
            method: paymentMethod,
            referenceId: payload.paymentReferenceId || `PAY-${Date.now()}`,
            paidAmount: quote.pricing.totalPayable,
            paidAt: new Date(),
          }
        : {
            status: "PENDING",
            method: paymentMethod,
          },
      unlockCode: buildUnlockCode(new mongoose.Types.ObjectId().toString()),
      referralCodeApplied: quote.referralCodeApplied,
      meta: {
        bookingSource: "APP",
      },
    });

    booking.unlockCode = buildUnlockCode(booking._id.toString());
    await booking.save();

    if (quote.pricing.walletUsed > 0) {
      user.walletBalance = round2(Number(user.walletBalance || 0) - quote.pricing.walletUsed);
      await user.save();
    }

    const finance = FinanceService();
    if (quote.pricing.walletUsed > 0) {
      await finance.recordTransaction({
        userId,
        role: "USER",
        type: "WALLET_DEBIT",
        direction: "DEBIT",
        status: "SUCCESS",
        amount: quote.pricing.walletUsed,
        sourceType: "Booking",
        sourceId: booking._id,
        bookingId: booking._id,
        referenceId: booking.payment?.referenceId || "",
        description: "Wallet used for booking",
        meta: { bookingId: booking._id },
        stationId: quote.pickupStation._id,
        createdAt: booking.createdAt,
      });
    }

    if (booking.payment?.status === "PAID") {
      await finance.recordTransaction({
        userId,
        role: "USER",
        type: "BOOKING_PAYMENT",
        direction: "DEBIT",
        status: "SUCCESS",
        amount: quote.pricing.totalPayable,
        taxAmount: quote.pricing.tax,
        sourceType: "Booking",
        sourceId: booking._id,
        bookingId: booking._id,
        referenceId: booking.payment?.referenceId || "",
        description: `Payment for ${quote.plan.name} booking`,
        meta: { bookingId: booking._id },
        stationId: quote.pickupStation._id,
        createdAt: booking.payment?.paidAt || booking.createdAt,
      });
      await finance.postBookingPaymentJournal({
        booking,
        walletUsed: quote.pricing.walletUsed,
        paidAmount: quote.pricing.totalPayable,
      });
    }

    await createNotification({
      userId,
      type: "RIDE",
      title: "Booking created",
      message: `Your ${quote.plan.name} booking at ${quote.pickupStation.name} is ${autoConfirm ? "confirmed" : "awaiting payment"}.`,
      meta: { bookingId: booking._id, status: booking.status },
    });

    await AuditLogService().create({
      actorId: userId,
      actorRole: "USER",
      action: "BOOKING_CREATED",
      entityType: "Booking",
      entityId: booking._id,
      after: booking.toObject(),
      meta: { autoConfirm, paymentMethod: paymentMethod || null },
    });

    return await models.Booking.findById(booking._id)
      .populate("vehicleId", "modelName registrationNumber photos")
      .populate("pickupStationId", "name address")
      .populate("dropStationId", "name address")
      .lean();
  };

  const listBookings = async ({ userId, status }) => {
    const query = { userId };
    if (status && BOOKING_STATUSES.includes(String(status).trim().toUpperCase())) {
      query.status = String(status).trim().toUpperCase();
    }

    const bookings = await models.Booking.find(query)
      .sort({ createdAt: -1 })
      .populate("vehicleId", "modelName registrationNumber photos")
      .populate("pickupStationId", "name address")
      .populate("dropStationId", "name address")
      .lean();

    return bookings.map(formatBooking);
  };

  const fetchBooking = async ({ userId, bookingId }) => {
    if (!mongoose.Types.ObjectId.isValid(String(bookingId || ""))) return null;
    const booking = await models.Booking.findOne({ _id: bookingId, userId })
      .populate("vehicleId", "modelName registrationNumber photos")
      .populate("pickupStationId", "name address")
      .populate("dropStationId", "name address")
      .lean();

    return booking ? formatBooking(booking) : null;
  };

  const rideDetail = async ({ userId, rideId }) => {
    return await fetchBooking({ userId, bookingId: rideId });
  };

  const confirmPayment = async ({ userId, bookingId, paymentMethod, paymentReferenceId }) => {
    const booking = await models.Booking.findOne({ _id: bookingId, userId });
    if (!booking) return null;

    if (booking.status !== "PENDING_PAYMENT") {
      const err = new Error("Booking payment is already processed");
      err.code = "PAYMENT_ALREADY_DONE";
      throw err;
    }

    const before = booking.toObject();
    booking.status = "CONFIRMED";
    booking.payment = {
      status: "PAID",
      method: String(paymentMethod || "ONLINE").trim() || "ONLINE",
      referenceId: String(paymentReferenceId || `PAY-${Date.now()}`).trim(),
      paidAmount: booking.pricing?.totalPayable || 0,
      paidAt: new Date(),
    };
    await booking.save();

    await FinanceService().recordTransaction({
      userId,
      role: "USER",
      type: "BOOKING_PAYMENT",
      direction: "DEBIT",
      status: "SUCCESS",
      amount: booking.pricing?.totalPayable || 0,
      taxAmount: booking.pricing?.tax || 0,
      sourceType: "Booking",
      sourceId: booking._id,
      bookingId: booking._id,
      referenceId: booking.payment.referenceId,
      description: `Payment for ${booking.planName || booking.planCode || "booking"}`,
      meta: { bookingId: booking._id },
      stationId: booking.pickupStationId,
      createdAt: booking.payment.paidAt,
    });
    await FinanceService().postBookingPaymentJournal({
      booking,
      walletUsed: booking.pricing?.walletUsed || 0,
      paidAmount: booking.pricing?.totalPayable || 0,
    });

    await createNotification({
      userId,
      type: "RIDE",
      title: "Payment confirmed",
      message: "Your booking has been confirmed successfully.",
      meta: { bookingId: booking._id },
    });

    await AuditLogService().create({
      actorId: userId,
      actorRole: "USER",
      action: "BOOKING_PAYMENT_CONFIRMED",
      entityType: "Booking",
      entityId: booking._id,
      before,
      after: booking.toObject(),
    });

    return await fetchBooking({ userId, bookingId });
  };

  const startRide = async ({ userId, bookingId, unlockCode }) => {
    const booking = await models.Booking.findOne({ _id: bookingId, userId });
    if (!booking) return null;

    if (booking.status !== "CONFIRMED") {
      const err = new Error("Only confirmed bookings can be started");
      err.code = "INVALID_BOOKING_STATUS";
      throw err;
    }

    const expectedCode = String(booking.unlockCode || "").trim().toUpperCase();
    const providedCode = String(unlockCode || "").trim().toUpperCase();
    if (!expectedCode || !providedCode || expectedCode !== providedCode) {
      const err = new Error("Invalid unlock code");
      err.code = "INVALID_UNLOCK_CODE";
      throw err;
    }

    const before = booking.toObject();
    booking.status = "ACTIVE";
    booking.rideStartedAt = new Date();
    await booking.save();

    await models.Vehicle.updateOne({ _id: booking.vehicleId }, { $set: { status: "IN_RIDE" } });

    await createNotification({
      userId,
      type: "RIDE",
      title: "Ride started",
      message: "Your scooty ride has started. Ride safe.",
      meta: { bookingId: booking._id },
    });

    await AuditLogService().create({
      actorId: userId,
      actorRole: "USER",
      action: "RIDE_STARTED",
      entityType: "Booking",
      entityId: booking._id,
      before,
      after: booking.toObject(),
    });

    return await fetchBooking({ userId, bookingId });
  };

  const completeRide = async ({ userId, bookingId, dropStationId, parkingPhotoUrl, rating, review }) => {
    const booking = await models.Booking.findOne({ _id: bookingId, userId });
    if (!booking) return null;

    if (booking.status !== "ACTIVE") {
      const err = new Error("Only active rides can be completed");
      err.code = "INVALID_BOOKING_STATUS";
      throw err;
    }

    let finalDropStationId = booking.dropStationId;
    if (dropStationId) {
      const station = await models.Station.findOne({ _id: dropStationId, isActive: true }).lean();
      if (!station) {
        const err = new Error("Drop station not found");
        err.code = "DROP_STATION_NOT_FOUND";
        throw err;
      }
      finalDropStationId = station._id;
    }

    const endedAt = new Date();
    const startedAt = booking.rideStartedAt || booking.startAt;
    const durationMinutes = Math.max(1, Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 60000));

    const before = booking.toObject();
    booking.status = "COMPLETED";
    booking.dropStationId = finalDropStationId;
    booking.parkingPhotoUrl = String(parkingPhotoUrl || booking.parkingPhotoUrl || "").trim();
    booking.rating = rating ? Number(rating) : booking.rating;
    booking.review = String(review || booking.review || "").trim();
    booking.rideEndedAt = endedAt;
    booking.actualDurationMinutes = durationMinutes;
    await booking.save();

    await models.Vehicle.updateOne(
      { _id: booking.vehicleId },
      {
        $set: {
          status: "ACTIVE",
          stationId: finalDropStationId,
        },
      },
    );

    const finance = FinanceService();
    const vehicle = await models.Vehicle.findById(booking.vehicleId).lean();
    const ownerId = vehicle?.ownerId || null;
    const penalty = await finance.calculatePenalty({
      booking,
      actualDurationMinutes: durationMinutes,
    });
    booking.meta = {
      ...(booking.meta || {}),
      penalty,
    };
    await booking.save();

    if (ownerId) {
      const breakdown = await finance.getBreakdown(booking);
      const ownerCredit = round2(Number(breakdown.ownerAmount || 0));
      if (ownerCredit > 0) {
        await models.User.updateOne(
          { _id: ownerId, role: "OWNER" },
          { $inc: { walletBalance: ownerCredit } },
        );
      }
      await finance.recordTransaction({
        userId: ownerId,
        role: "OWNER",
        type: "OWNER_EARNING",
        direction: "CREDIT",
        status: "SUCCESS",
        amount: breakdown.ownerAmount,
        commissionAmount: breakdown.platformAmount,
        ownerAmount: breakdown.ownerAmount,
        platformAmount: breakdown.platformAmount,
        taxAmount: breakdown.taxAmount,
        sourceType: "Booking",
        sourceId: booking._id,
        bookingId: booking._id,
        referenceId: booking.payment?.referenceId || "",
        description: `Earning for ${booking.planName || booking.planCode || "ride"}`,
        meta: {
          bookingId: booking._id,
          ownerId,
          vehicleId: booking.vehicleId,
          vehicleLabel: vehicle?.modelName || vehicle?.registrationNumber || booking.planName || booking.planCode || "",
        },
        stationId: booking.pickupStationId,
        createdAt: endedAt,
      });

      await finance.recordTransaction({
        userId: userId,
        role: "ADMIN",
        type: "PLATFORM_COMMISSION",
        direction: "CREDIT",
        status: "SUCCESS",
        amount: breakdown.platformAmount,
        commissionAmount: breakdown.platformAmount,
        sourceType: "Booking",
        sourceId: booking._id,
        bookingId: booking._id,
        referenceId: booking.payment?.referenceId || "",
        description: `Platform commission for ${booking.planName || booking.planCode || "ride"}`,
        meta: { bookingId: booking._id, ownerId },
        stationId: booking.pickupStationId,
        createdAt: endedAt,
      });

      await finance.recordTransaction({
        userId: userId,
        role: "ADMIN",
        type: "GST_COLLECTION",
        direction: "CREDIT",
        status: "SUCCESS",
        amount: breakdown.taxAmount,
        taxAmount: breakdown.taxAmount,
        sourceType: "Booking",
        sourceId: booking._id,
        bookingId: booking._id,
        referenceId: booking.payment?.referenceId || "",
        description: `GST for ${booking.planName || booking.planCode || "ride"}`,
        meta: { bookingId: booking._id, ownerId },
        stationId: booking.pickupStationId,
        createdAt: endedAt,
      });
      await finance.postRideCompletionJournal({
        booking,
        breakdown,
      });
    }

    booking.refund = {
      ...(booking.refund || {}),
      status: booking.pricing?.securityDeposit > 0 ? "PENDING" : "NOT_APPLICABLE",
      amount: Number(booking.pricing?.securityDeposit || 0),
      method: "WALLET",
      requestedAt: booking.pricing?.securityDeposit > 0 ? endedAt : booking.refund?.requestedAt,
      note: booking.pricing?.securityDeposit > 0 ? "Security deposit pending refund review" : booking.refund?.note || "",
    };
    await booking.save();

    await createNotification({
      userId,
      type: "RIDE",
      title: "Ride completed",
      message: "Your ride has been completed successfully.",
      meta: { bookingId: booking._id },
    });

    await AuditLogService().create({
      actorId: userId,
      actorRole: "USER",
      action: "RIDE_COMPLETED",
      entityType: "Booking",
      entityId: booking._id,
      before,
      after: booking.toObject(),
      meta: { durationMinutes, dropStationId: finalDropStationId },
    });

    return await fetchBooking({ userId, bookingId });
  };

  const cancelBooking = async ({ userId, bookingId, reason }) => {
    const booking = await models.Booking.findOne({ _id: bookingId, userId });
    if (!booking) return null;

    const cancellable = ["PENDING_PAYMENT", "CONFIRMED"];
    if (!cancellable.includes(booking.status)) {
      const err = new Error(`Booking in status ${booking.status} cannot be cancelled`);
      err.code = "INVALID_BOOKING_STATUS";
      throw err;
    }

    const before = booking.toObject();
    const paid =
      booking.payment?.status === "PAID" &&
      Number(booking.payment?.paidAmount || 0) > 0;
    const refundAmount = paid ? round2(Number(booking.payment.paidAmount)) : 0;

    booking.status = "CANCELLED";
    booking.meta = {
      ...(booking.meta || {}),
      cancelledAt: new Date(),
      cancelReason: String(reason || "").trim() || "User cancelled",
    };

    if (refundAmount > 0) {
      booking.refund = {
        ...(booking.refund || {}),
        status: "PROCESSED",
        amount: refundAmount,
        method: "WALLET",
        referenceId: `REF-${Date.now()}`,
        note: "Auto-refunded on cancellation",
      };
      booking.payment = {
        ...(booking.payment || {}),
        status: "REFUNDED",
      };
    }
    await booking.save();

    if (booking.vehicleId) {
      await models.Vehicle.updateOne(
        { _id: booking.vehicleId, status: { $in: ["RESERVED", "IN_RIDE"] } },
        { $set: { status: "ACTIVE" } },
      );
    }

    if (refundAmount > 0) {
      const rider = await models.User.findById(userId);
      if (rider) {
        rider.walletBalance = round2(Number(rider.walletBalance || 0) + refundAmount);
        await rider.save();
      }
      await FinanceService().recordTransaction({
        userId,
        role: "USER",
        type: "REFUND",
        direction: "CREDIT",
        status: "SUCCESS",
        amount: refundAmount,
        sourceType: "Booking",
        sourceId: booking._id,
        bookingId: booking._id,
        referenceId: booking.refund?.referenceId || "",
        description: "Refund for cancelled booking",
        meta: { bookingId: booking._id },
        stationId: booking.pickupStationId,
        createdAt: new Date(),
      });
    }

    await createNotification({
      userId,
      type: "RIDE",
      title: "Booking cancelled",
      message:
        refundAmount > 0
          ? `Your booking is cancelled. ${refundAmount} refunded to your wallet.`
          : "Your booking has been cancelled.",
      meta: { bookingId: booking._id, status: booking.status },
    });

    await AuditLogService().create({
      actorId: userId,
      actorRole: "USER",
      action: "BOOKING_CANCELLED",
      entityType: "Booking",
      entityId: booking._id,
      before,
      after: booking.toObject(),
      meta: { refundAmount, reason: booking.meta.cancelReason },
    });

    return await fetchBooking({ userId, bookingId });
  };

  const rideHistory = async ({ userId }) => {
    return await listBookings({ userId, status: "COMPLETED" });
  };

  const referralSummary = async ({ userId }) => {
    const user = await models.User.findById(userId).lean();
    if (!user) return null;

    const referralCode = user.referralCode || `MV${String(user._id).slice(-6).toUpperCase()}`;
    if (!user.referralCode) {
      await models.User.updateOne({ _id: userId }, { $set: { referralCode } });
    }

    const invitees = await models.User.find({ referredBy: userId, role: "USER" })
      .sort({ createdAt: -1 })
      .select("name mobile createdAt")
      .lean();

    return {
      referralCode,
      referralEarnings: Number(user.referralEarnings || 0),
      totalReferrals: invitees.length,
      inviteReward: 100,
      appliedReferral: user.referredBy || null,
      invitees,
    };
  };

  const applyReferralCode = async ({ userId, referralCode }) => {
    const normalized = String(referralCode || "").trim().toUpperCase();
    if (!normalized) {
      const err = new Error("referralCode is required");
      err.code = "INVALID_REFERRAL";
      throw err;
    }

    const [user, referrer] = await Promise.all([
      models.User.findById(userId),
      models.User.findOne({ referralCode: normalized, role: "USER" }),
    ]);

    if (!user) return null;
    if (!referrer || String(referrer._id) === String(user._id)) {
      const err = new Error("Invalid referral code");
      err.code = "INVALID_REFERRAL";
      throw err;
    }
    if (user.referredBy) {
      const err = new Error("Referral code already applied");
      err.code = "REFERRAL_ALREADY_APPLIED";
      throw err;
    }

    user.referredBy = referrer._id;
    user.walletBalance = round2(Number(user.walletBalance || 0) + 100);
    referrer.referralEarnings = round2(Number(referrer.referralEarnings || 0) + 100);
    referrer.walletBalance = round2(Number(referrer.walletBalance || 0) + 100);

    await Promise.all([
      user.save(),
      referrer.save(),
      FinanceService().recordTransaction({
        userId,
        role: "USER",
        type: "REFERRAL_BONUS",
        direction: "CREDIT",
        status: "SUCCESS",
        amount: 100,
        sourceType: "Referral",
        referenceId: normalized,
        description: "Referral bonus credited",
        meta: { referralCode: normalized, referrerId: referrer._id },
      }),
      FinanceService().recordTransaction({
        userId: referrer._id,
        role: "USER",
        type: "REFERRAL_BONUS",
        direction: "CREDIT",
        status: "SUCCESS",
        amount: 100,
        sourceType: "Referral",
        referenceId: normalized,
        description: "Referral reward earned",
        meta: { referralCode: normalized, referredUserId: user._id },
      }),
      createNotification({
        userId,
        type: "SYSTEM",
        title: "Referral applied",
        message: "Referral bonus has been added to your wallet.",
        meta: { referralCode: normalized },
      }),
      createNotification({
        userId: referrer._id,
        type: "EARNING",
        title: "Referral reward earned",
        message: `${user.name || "A friend"} joined using your referral code.`,
        meta: { referredUserId: user._id },
      }),
    ]);

    await AuditLogService().create({
      actorId: userId,
      actorRole: "USER",
      action: "REFERRAL_CODE_APPLIED",
      entityType: "User",
      entityId: user._id,
      meta: { referralCode: normalized, referrerId: referrer._id },
    });

    return await referralSummary({ userId });
  };

  const listNotifications = async ({ userId, type }) => {
    const query = { userId };
    if (type) query.type = String(type).trim().toUpperCase();
    return await models.Notification.find(query).sort({ createdAt: -1 }).limit(100).lean();
  };

  const markNotificationRead = async ({ userId, notificationId }) => {
    const notification = await models.Notification.findOne({ _id: notificationId, userId });
    if (!notification) return null;
    notification.isRead = true;
    await notification.save();
    return notification.toObject();
  };

  const markAllNotificationsRead = async ({ userId, type = null } = {}) => {
    const query = { userId, isRead: false };
    if (type) query.type = String(type).trim().toUpperCase();

    const result = await models.Notification.updateMany(query, {
      $set: { isRead: true },
    });

    return {
      matchedCount: result.matchedCount ?? result.n ?? 0,
      modifiedCount: result.modifiedCount ?? result.nModified ?? 0,
    };
  };

  const listFaqs = async ({ stationId }) => {
    return await ContentService().listApprovedFaqsForUser({ stationId });
  };

  const listTickets = async ({ userId }) => {
    return await models.SupportTicket.find({ userId }).sort({ createdAt: -1 }).lean();
  };

  const createTicket = async ({ userId, subject, message }) => {
    const normalizedSubject = String(subject || "").trim();
    const normalizedMessage = String(message || "").trim();

    if (!normalizedSubject || !normalizedMessage) {
      const err = new Error("subject and message are required");
      err.code = "REQUIRED_FIELDS_MISSING";
      throw err;
    }

    const ticket = await models.SupportTicket.create({
      userId,
      subject: normalizedSubject,
      message: normalizedMessage,
      status: "OPEN",
    });

    await AuditLogService().create({
      actorId: userId,
      actorRole: "USER",
      action: "SUPPORT_TICKET_CREATED",
      entityType: "SupportTicket",
      entityId: ticket._id,
      after: ticket,
    });

    return ticket;
  };

  const fetchTicket = async ({ userId, ticketId }) => {
    return await models.SupportTicket.findOne({ _id: ticketId, userId }).lean();
  };

  const walletSummary = async ({ userId }) => {
    const [user, completedBookings, activeBookings] = await Promise.all([
      models.User.findById(userId).lean(),
      models.Booking.find({ userId, status: "COMPLETED" }).sort({ createdAt: -1 }).limit(10).lean(),
      models.Booking.find({ userId, status: { $in: ["CONFIRMED", "ACTIVE"] } }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    if (!user) return null;

    return {
      balance: round2(Number(user.walletBalance || 0)),
      referralEarnings: round2(Number(user.referralEarnings || 0)),
      recentCredits: completedBookings.map((booking) => ({
        id: booking._id,
        title: `${booking.planName} ride completed`,
        amount: 0,
        createdAt: booking.updatedAt,
      })),
      activeReservations: activeBookings.map((booking) => ({
        id: booking._id,
        title: booking.planName,
        amount: booking.pricing?.totalPayable || 0,
        createdAt: booking.createdAt,
      })),
    };
  };

  const transactionHistory = async ({ userId, type, from, to, page, limit }) => {
    return await FinanceService().listTransactions({
      userId,
      role: "USER",
      type,
      from,
      to,
      page,
      limit,
    });
  };

  const bookingInvoice = async ({ userId, bookingId }) => {
    const booking = await models.Booking.findOne({ _id: bookingId, userId })
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

  const bookingRefund = async ({ userId, bookingId }) => {
    const booking = await models.Booking.findOne({ _id: bookingId, userId })
      .populate("vehicleId", "modelName registrationNumber photos ownerId")
      .populate("pickupStationId", "name address")
      .populate("dropStationId", "name address")
      .lean();
    if (!booking) return null;

    return {
      bookingId: booking._id,
      refund: booking.refund || {
        status: "NOT_APPLICABLE",
        amount: 0,
      },
      payment: booking.payment || {},
      pricing: booking.pricing || {},
    };
  };

  return {
    getDashboard,
    getSettings,
    updateSettings,
    updateLocation,
    listPlans,
    listStations,
    stationDetail,
    listTimeSlots,
    generateQuote,
    createBooking,
    listBookings,
    fetchBooking,
    rideDetail,
    confirmPayment,
    startRide,
    completeRide,
    cancelBooking,
    rideHistory,
    referralSummary,
    applyReferralCode,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    listFaqs,
    listTickets,
    createTicket,
    fetchTicket,
    walletSummary,
    transactionHistory,
    bookingInvoice,
    bookingRefund,
  };
};
