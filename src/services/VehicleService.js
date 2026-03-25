const { models, mongoose } = require("../models");
const fileUploadService = require("../util/s3");
const AuditLogService = require("./AuditLogService");

const normalizeStr = (v) => (typeof v === "string" ? v.trim() : "");
const stationVehicleStatuses = new Set(["ACTIVE", "MAINTENANCE", "CHARGING", "INACTIVE"]);
const rideStatuses = new Set(["CONFIRMED", "ACTIVE", "COMPLETED"]);
const maintenanceOpenStatuses = new Set(["OPEN", "IN_PROGRESS"]);

const validateStationId = async (stationId, { required = true } = {}) => {
  const requested = String(stationId || "").trim();
  if (!requested) {
    if (!required) return null;
    const err = new Error("stationId is required");
    err.code = "STATION_REQUIRED";
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(requested)) {
    const err = new Error("stationId must be a valid id");
    err.code = "INVALID_STATION";
    throw err;
  }

  const station = await models.Station.findOne({ _id: requested, isActive: true }).lean();
  if (!station) {
    const err = new Error("Station not found");
    err.code = "STATION_NOT_FOUND";
    throw err;
  }

  return station;
};

const resolveVehicleOwner = async (ownerId) => {
  const owner = await models.User.findOne({
    _id: ownerId,
    role: { $in: ["OWNER", "STATION_ADMIN"] },
    isActive: true,
  }).lean();
  if (!owner) {
    const err = new Error("Owner not found");
    err.code = "OWNER_NOT_FOUND";
    throw err;
  }
  return owner;
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

const formatDateLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

const formatDateTimeLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const buildStationSearchQuery = (stationId, { status, q } = {}) => {
  const query = { stationId };
  if (status) query.status = status;

  const search = normalizeStr(q);
  if (search) {
    const clauses = [
      { modelName: { $regex: search, $options: "i" } },
      { registrationNumber: { $regex: search, $options: "i" } },
      { chassisNumber: { $regex: search, $options: "i" } },
    ];
    if (/^[a-f\d]{24}$/i.test(search)) {
      clauses.push({ _id: search });
    }
    query.$or = clauses;
  }

  return query;
};

const formatListVehicle = ({ vehicle, station, lastRide, openMaintenanceCount = 0 }) => {
  const lastRideAt = lastRide?.rideEndedAt || lastRide?.endAt || lastRide?.startAt || lastRide?.createdAt || null;
  const lastRideStatus = lastRide?.status || "";

  return {
    ...vehicle,
    station: station
      ? {
          id: station._id,
          name: station.name,
          address: station.address || "",
        }
      : null,
    batteryPercent: vehicle.batteryPercent ?? null,
    locationLabel: vehicle.locationLabel || station?.name || "",
    openMaintenanceCount,
    lastRide: lastRide
      ? {
          rideId: lastRide._id,
          status: lastRideStatus,
          label:
            lastRideStatus === "ACTIVE"
              ? "Active"
              : lastRideStatus === "CONFIRMED"
                ? "Confirmed"
                : lastRideStatus === "COMPLETED"
                  ? formatRelativeTime(lastRideAt)
                  : formatRelativeTime(lastRideAt),
          at: lastRideAt,
          atLabel: formatDateTimeLabel(lastRideAt),
          riderName: lastRide.userId?.name || "",
        }
      : null,
  };
};

const formatRideHistoryItem = (booking) => {
  const startAt = booking.startAt || booking.createdAt;
  const endAt = booking.endAt || booking.rideEndedAt || booking.startAt || booking.createdAt;
  return {
    rideId: booking._id,
    riderName: booking.userId?.name || "",
    riderId: booking.userId?._id || null,
    date: startAt,
    dateLabel: formatDateLabel(startAt),
    durationMinutes:
      booking.actualDurationMinutes ||
      Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000)),
    distanceKm: booking.meta?.distanceKm ?? booking.meta?.distance ?? null,
    fare: booking.pricing?.totalPayable ?? 0,
    status: booking.status,
  };
};

const formatMaintenanceItem = (request) => ({
  requestId: request._id,
  issueType: request.issueType,
  status: request.status,
  description: request.description || "",
  resolutionNote: request.resolutionNote || "",
  photoUrl: request.photoUrl || "",
  createdAt: request.createdAt,
  createdAtLabel: formatDateTimeLabel(request.createdAt),
  updatedAt: request.updatedAt,
  updatedAtLabel: formatDateTimeLabel(request.updatedAt),
});

module.exports = () => {
  const list = async (ownerId, { status } = {}) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
    if (!owner) return [];
    const query = { ownerId };
    if (status) query.status = status;
    return await models.Vehicle.find(query).sort({ createdAt: -1 }).lean();
  };

  const fetchByIdLean = async (ownerId, vehicleId) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
    if (!owner) return null;
    const query = { _id: vehicleId, ownerId };
    return await models.Vehicle.findOne(query).lean();
  };

  const fetchByIdDoc = async (ownerId, vehicleId) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
    if (!owner) return null;
    const query = { _id: vehicleId, ownerId };
    return await models.Vehicle.findOne(query);
  };

  const createDraft = async (ownerId, payload = {}, files = {}) => {
    try {
      files = files || {};
      await resolveVehicleOwner(ownerId);

      const station = await validateStationId(payload.stationId);
      const stationId = station._id;

      // Ensure nested objects always exist before we touch them
      const photos =
        payload.photos && typeof payload.photos === "object" && !Array.isArray(payload.photos)
          ? { ...payload.photos }
          : {};
      const documents =
        payload.documents && typeof payload.documents === "object" && !Array.isArray(payload.documents)
          ? { ...payload.documents }
          : {};

      // Helper function for upload
      const uploadFile = async (file) => {
        if (!file) return "";
        const res = await fileUploadService.uploadFileToAws(file);
        return res.images?.[0] || "";
      };

      // Upload all files in parallel 🚀
      const [
        frontUrl,
        sideUrl,
        rcUrl,
        insuranceUrl
      ] = await Promise.all([
        uploadFile(files.frontUrl),
        uploadFile(files.sideUrl),
        uploadFile(files.rcDocument),
        uploadFile(files.insuranceDocument),
      ]);

      // Assign uploaded URLs
      if (frontUrl) photos.frontUrl = frontUrl;
      if (sideUrl) photos.sideUrl = sideUrl;
      if (rcUrl) documents.rcUrl = rcUrl;
      if (insuranceUrl) documents.insuranceUrl = insuranceUrl;

      // Create vehicle with photos & documents
      const vehicle = await models.Vehicle.create({
        ownerId,
        modelName: normalizeStr(payload.modelName),
        registrationNumber: normalizeStr(payload.registrationNumber),
        chassisNumber: normalizeStr(payload.chassisNumber),
        stationId,
        batteryPercent:
          payload.batteryPercent === undefined || payload.batteryPercent === null || payload.batteryPercent === ""
            ? null
            : toNumber(payload.batteryPercent, null),
        locationLabel: normalizeStr(payload.locationLabel),
        status: "DRAFT",

        // ✅ IMPORTANT: saving here
        photos,
        documents,
      });

      await AuditLogService().create({
        actorId: ownerId,
        actorRole: payload.actorRole === "STATION_ADMIN" ? "STATION_ADMIN" : "OWNER",
        action: "VEHICLE_DRAFT_CREATED",
        entityType: "Vehicle",
        entityId: vehicle._id,
        after: vehicle,
        meta: { stationId },
      });

      return vehicle;

    } catch (error) {
      console.error("Error in createDraft:", error);
      throw error;
    }
  };

  const update = async ({ ownerId, vehicleId, payload = {}, files = null }) => {
    try {
      const vehicle = await fetchByIdDoc(ownerId, vehicleId);
      if (!vehicle) return null;
      const before = vehicle.toObject();

      const {
        modelName,
        registrationNumber,
        chassisNumber,
        stationId,
        submit
      } = payload || {};

      const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
      if (!owner) {
        const err = new Error("Owner not found");
        err.code = "OWNER_NOT_FOUND";
        throw err;
      }

      if (stationId) {
        const station = await validateStationId(stationId);
        vehicle.stationId = station._id;
      } else if (!vehicle.stationId) {
        const err = new Error("stationId is required");
        err.code = "STATION_REQUIRED";
        throw err;
      }

      // ✅ Basic updates
      if (typeof modelName === "string") vehicle.modelName = modelName.trim();
      if (typeof registrationNumber === "string") vehicle.registrationNumber = registrationNumber.trim();
      if (typeof chassisNumber === "string") vehicle.chassisNumber = chassisNumber.trim();
      if (payload.batteryPercent !== undefined) {
        vehicle.batteryPercent =
          payload.batteryPercent === "" || payload.batteryPercent === null
            ? null
            : toNumber(payload.batteryPercent, vehicle.batteryPercent);
      }
      if (typeof payload.locationLabel === "string") vehicle.locationLabel = payload.locationLabel.trim();

      // ✅ Ensure objects exist (IMPORTANT)
      vehicle.photos =
        vehicle.photos && typeof vehicle.photos === "object" && !Array.isArray(vehicle.photos)
          ? vehicle.photos
          : {};
      vehicle.documents =
        vehicle.documents && typeof vehicle.documents === "object" && !Array.isArray(vehicle.documents)
          ? vehicle.documents
          : {};

      // ✅ Helper for upload
      const uploadFile = async (file) => {
        if (!file) return "";
        const res = await fileUploadService.uploadFileToAws(file);
        return res.images?.[0] || "";
      };

      // ✅ Upload in parallel 🚀
      if (files) {
        const [
          frontUrl,
          sideUrl,
          rcUrl,
          insuranceUrl
        ] = await Promise.all([
          uploadFile(files?.frontPhoto),
          uploadFile(files?.sidePhoto),
          uploadFile(files?.rcDocument),
          uploadFile(files?.insuranceDocument),
        ]);

        // ✅ Assign only if uploaded
        if (frontUrl) vehicle.photos.frontUrl = frontUrl;
        if (sideUrl) vehicle.photos.sideUrl = sideUrl;
        if (rcUrl) vehicle.documents.rcUrl = rcUrl;
        if (insuranceUrl) vehicle.documents.insuranceUrl = insuranceUrl;
      }

      // ✅ Submit logic
      const wantsSubmit =
        submit === true ||
        submit === "true" ||
        submit === 1 ||
        submit === "1";

      if (wantsSubmit) {
        const hasBasics =
          normalizeStr(vehicle.modelName) &&
          normalizeStr(vehicle.registrationNumber) &&
          normalizeStr(vehicle.chassisNumber);

        const hasDocs =
          normalizeStr(vehicle.documents?.rcUrl) &&
          normalizeStr(vehicle.documents?.insuranceUrl);

        const hasPhotos =
          normalizeStr(vehicle.photos?.frontUrl) &&
          normalizeStr(vehicle.photos?.sideUrl);

        const hasStation = !!vehicle.stationId;

        if (!hasBasics || !hasDocs || !hasPhotos || !hasStation) {
          const err = new Error("Required fields are missing");
          err.code = "REQUIRED_FIELDS_MISSING";
          throw err;
        }

        vehicle.status = "PENDING_APPROVAL";
        vehicle.approvalNote = "";
      }

      await vehicle.save();
      await AuditLogService().create({
        actorId: ownerId,
        actorRole: "OWNER",
        action: "VEHICLE_UPDATED",
        entityType: "Vehicle",
        entityId: vehicle._id,
        before,
        after: vehicle.toObject(),
        meta: { submit: wantsSubmit },
      });
      return vehicle;

    } catch (error) {
      console.error("Error in update vehicle:", error);
      throw error;
    }
  };
  
  const requestRemoval = async (ownerId, vehicleId) => {
    const vehicle = await fetchByIdDoc(ownerId, vehicleId);
    if (!vehicle) return null;
    const before = vehicle.toObject();
    vehicle.status = "REMOVAL_REQUESTED";
    await vehicle.save();
    await AuditLogService().create({
      actorId: ownerId,
      actorRole: "OWNER",
      action: "VEHICLE_REMOVAL_REQUESTED",
      entityType: "Vehicle",
      entityId: vehicle._id,
      before,
      after: vehicle.toObject(),
    });
    return vehicle;
  };

  const counts = async (ownerId) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
    if (!owner) return {};

    const pipeline = [{ $match: { ownerId } }, { $group: { _id: "$status", count: { $sum: 1 } } }];
    const rows = await models.Vehicle.aggregate(pipeline);
    const out = {};
    for (const r of rows) out[r._id] = r.count;
    return out;
  };

  const listByStation = async ({ stationId, status, q, page = 1, limit = 20 } = {}) => {
    if (!stationId) {
      const safePage = Math.max(1, Number(page) || 1);
      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
      return {
        vehicles: [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const query = buildStationSearchQuery(stationId, { status, q });
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [total, vehicles, station] = await Promise.all([
      models.Vehicle.countDocuments(query),
      models.Vehicle.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      models.Station.findById(stationId).lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    if (!vehicles.length) {
      return {
        vehicles: [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
        },
      };
    }

    const vehicleIds = vehicles.map((vehicle) => vehicle._id);
    const [bookings, maintenanceRows] = await Promise.all([
      models.Booking.find({
        vehicleId: { $in: vehicleIds },
        status: { $in: Array.from(rideStatuses) },
      })
        .sort({ createdAt: -1 })
        .populate("userId", "name")
        .lean(),
      models.MaintenanceRequest.find({
        vehicleId: { $in: vehicleIds },
        status: { $in: Array.from(maintenanceOpenStatuses) },
      }).lean(),
    ]);

    const lastRideByVehicleId = new Map();
    for (const booking of bookings) {
      const key = String(booking.vehicleId);
      if (!lastRideByVehicleId.has(key)) lastRideByVehicleId.set(key, booking);
    }

    const openMaintenanceCountByVehicleId = new Map();
    for (const row of maintenanceRows) {
      const key = String(row.vehicleId);
      openMaintenanceCountByVehicleId.set(key, (openMaintenanceCountByVehicleId.get(key) || 0) + 1);
    }

    return {
      vehicles: vehicles.map((vehicle) =>
        formatListVehicle({
          vehicle,
          station,
          lastRide: lastRideByVehicleId.get(String(vehicle._id)) || null,
          openMaintenanceCount: openMaintenanceCountByVehicleId.get(String(vehicle._id)) || 0,
        }),
      ),
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

  const fetchByStationVehicleLean = async ({ stationId, vehicleId }) => {
    return await models.Vehicle.findOne({ _id: vehicleId, stationId }).lean();
  };

  const stationVehicleDetail = async ({ stationId, vehicleId }) => {
    const [vehicle, station] = await Promise.all([
      models.Vehicle.findOne({ _id: vehicleId, stationId }).lean(),
      models.Station.findById(stationId).lean(),
    ]);

    if (!vehicle) return null;

    const [recentBookings, maintenanceHistory, completedRideCount, activeRideCount, revenueRows, ratingRows] =
      await Promise.all([
        models.Booking.find({
          vehicleId,
          status: { $in: Array.from(rideStatuses) },
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate("userId", "name")
          .lean(),
        models.MaintenanceRequest.find({ vehicleId }).sort({ createdAt: -1 }).limit(10).lean(),
        models.Booking.countDocuments({ vehicleId, status: "COMPLETED" }),
        models.Booking.countDocuments({ vehicleId, status: "ACTIVE" }),
        models.Booking.aggregate([
          { $match: { vehicleId, status: "COMPLETED" } },
          { $group: { _id: null, revenue: { $sum: { $ifNull: ["$pricing.totalPayable", 0] } } } },
        ]),
        models.Booking.aggregate([
          { $match: { vehicleId, rating: { $type: "number" } } },
          { $group: { _id: null, averageRating: { $avg: "$rating" } } },
        ]),
      ]);

    const totalRides = completedRideCount;
    const revenue = revenueRows?.[0]?.revenue || 0;
    const averageRating = ratingRows?.[0]?.averageRating || 0;

    return {
      vehicle: {
        ...vehicle,
        station: station
          ? {
              id: station._id,
              name: station.name,
              address: station.address || "",
            }
          : null,
        batteryPercent: vehicle.batteryPercent ?? null,
        locationLabel: vehicle.locationLabel || station?.name || "",
      },
      performance: {
        totalRides,
        activeRides: activeRideCount,
        revenue,
        averageRating: Math.round(averageRating * 10) / 10,
      },
      recentRideHistory: recentBookings.map(formatRideHistoryItem),
      maintenanceHistory: maintenanceHistory.map(formatMaintenanceItem),
    };
  };

  const updateStationVehicleStatus = async ({ stationId, vehicleId, status, note = "" }) => {
    const normalizedStatus = String(status || "").trim().toUpperCase();
    if (!stationVehicleStatuses.has(normalizedStatus)) {
      const err = new Error("Invalid status");
      err.code = "INVALID_STATUS";
      throw err;
    }

    const vehicle = await models.Vehicle.findOne({ _id: vehicleId, stationId });
    if (!vehicle) return null;
    const before = vehicle.toObject();

    if (vehicle.status === "IN_RIDE" && normalizedStatus !== "INACTIVE") {
      const err = new Error("Vehicle is currently in ride");
      err.code = "VEHICLE_IN_RIDE";
      throw err;
    }

    vehicle.status = normalizedStatus;
    if (typeof note === "string") {
      vehicle.approvalNote = note.trim();
    }
    await vehicle.save();
    await AuditLogService().create({
      actorRole: "STATION_ADMIN",
      action: "VEHICLE_STATUS_UPDATED",
      entityType: "Vehicle",
      entityId: vehicle._id,
      before,
      after: vehicle.toObject(),
      meta: { stationId, status: normalizedStatus },
    });
    return vehicle.toObject();
  };

  return {
    list,
    fetchByIdLean,
    createDraft,
    update,
    requestRemoval,
    counts,
    listByStation,
    fetchByStationVehicleLean,
    stationVehicleDetail,
    updateStationVehicleStatus,
  };
};
