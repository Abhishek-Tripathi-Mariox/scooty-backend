const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const { models, mongoose } = require("../models");
const AuditLogService = require("../services/AuditLogService");
const UserService = require("../services/UserService");

const STATION_ADMIN_ROLES = ["STATION_ADMIN", "SUB_STATION_ADMIN"];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidLatitude = (value) => {
  const n = toNumber(value);
  return n !== null && n >= -90 && n <= 90;
};

const isValidLongitude = (value) => {
  const n = toNumber(value);
  return n !== null && n >= -180 && n <= 180;
};

const loadStationAdmin = async (stationAdminId) => {
  const normalizedId = String(stationAdminId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(normalizedId)) return null;

  return await UserService().fetchDocByQuery({
    _id: normalizedId,
    role: { $in: STATION_ADMIN_ROLES },
  });
};

const buildStationAdminStationQuery = (stationAdmin) => {
  if (!stationAdmin) return {};

  const assignedStationId = String(stationAdmin.stationId || "").trim();
  return {
    $or: [
      { stationAdminId: stationAdmin._id },
      ...(assignedStationId && mongoose.Types.ObjectId.isValid(assignedStationId)
        ? [{ _id: assignedStationId }]
        : []),
    ],
  };
};

module.exports = {
  list: async (req, res, next) => {
    const stationAdminId = String(req.body.stationAdminId || req.query.stationAdminId || "").trim();
    let query = {};

    if (stationAdminId) {
      const stationAdmin = await loadStationAdmin(stationAdminId);
      if (!stationAdmin) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Station admin not found");
      }
      query = buildStationAdminStationQuery(stationAdmin);
    }

    const stations = await models.Station.find(query)
      .sort({ createdAt: -1 })
      .populate("stationAdminId", "name email mobile role stationId")
      .lean();

    const stationIds = stations.map((s) => s._id);
    const counts = stationIds.length
      ? await models.Vehicle.aggregate([
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
              availableVehicles: {
                $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
              },
            },
          },
        ])
      : [];
    const countMap = new Map(
      counts.map((c) => [
        String(c._id),
        { totalVehicles: c.totalVehicles || 0, availableVehicles: c.availableVehicles || 0 },
      ]),
    );

    const enriched = stations.map((s) => {
      const c = countMap.get(String(s._id)) || { totalVehicles: 0, availableVehicles: 0 };
      const max = Number(s.maxVehicles || 0);
      return {
        ...s,
        occupiedVehicles: c.totalVehicles,
        availableVehicles: c.availableVehicles,
        remainingCapacity: max > 0 ? Math.max(0, max - c.totalVehicles) : null,
        isFull: max > 0 ? c.totalVehicles >= max : false,
      };
    });

    req.rData = { stations: enriched };
    req.msg = "stations_list";
    return ResponseMiddleware(req, res, next);
  },

  create: async (req, res, next) => {
    const { name, address, city, state, parkingType, lat, lng, isActive, stationAdminId, maxVehicles } = req.body || {};

    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "name is required");
    }

    const parsedMaxVehicles = Number(maxVehicles);
    if (!Number.isFinite(parsedMaxVehicles) || !Number.isInteger(parsedMaxVehicles) || parsedMaxVehicles < 1) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "maxVehicles is required and must be a positive integer");
    }

    if (normalizedName.length < 3) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "name must be at least 3 characters");
    }

    const normalizedAddress = String(address || "").trim();
    if (!normalizedAddress) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "address is required");
    }

    const normalizedCity = String(city || "").trim();
    if (!normalizedCity) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "city is required");
    }

    const normalizedState = String(state || "").trim();
    if (!normalizedState) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "state is required");
    }

    if (!isValidLatitude(lat)) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "lat must be a valid latitude");
    }

    if (!isValidLongitude(lng)) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "lng must be a valid longitude");
    }

    const existingStation = await models.Station.findOne({
      name: { $regex: `^${escapeRegExp(normalizedName)}$`, $options: "i" },
      city: { $regex: `^${escapeRegExp(normalizedCity)}$`, $options: "i" },
      state: { $regex: `^${escapeRegExp(normalizedState)}$`, $options: "i" },
    }).lean();
    if (existingStation) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Station already exists for this city and state");
    }

    let resolvedStationAdminId = null;
    if (stationAdminId) {
      if (!mongoose.Types.ObjectId.isValid(String(stationAdminId))) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "stationAdminId must be a valid id");
      }

      const stationAdmin = await UserService().fetchDocByQuery({
        _id: stationAdminId,
        role: { $in: STATION_ADMIN_ROLES },
      });
      if (!stationAdmin) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Station admin not found");
      }
      resolvedStationAdminId = stationAdmin._id;
    }

    const station = await models.Station.create({
      name: normalizedName,
      address: normalizedAddress,
      city: normalizedCity,
      state: normalizedState,
      stationAdminId: resolvedStationAdminId || undefined,
      parkingType: ["COVERED", "OPEN"].includes(String(parkingType || "").trim().toUpperCase())
        ? String(parkingType || "").trim().toUpperCase()
        : "OPEN",
      maxVehicles: parsedMaxVehicles,
      location: {
        type: "Point",
        coordinates: [
          toNumber(lng),
          toNumber(lat),
        ],
      },
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    await AuditLogService().create({
      actorId: req.body.adminId,
      action: "STATION_CREATED",
      entityType: "Station",
      entityId: station._id,
      after: station,
      meta: { stationAdminId: resolvedStationAdminId || null },
    });

    req.rData = { station };
    req.msg = "success";
    return ResponseMiddleware(req, res, next);
  },

  update: async (req, res, next) => {
    const stationId = String(req.params.stationId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "stationId must be a valid id");
    }

    const station = await models.Station.findById(stationId);
    if (!station) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station not found");
    }

    const {
      name,
      address,
      city,
      state,
      parkingType,
      lat,
      lng,
      isActive,
      stationAdminId,
      maxVehicles,
    } = req.body || {};

    if (name !== undefined) {
      const normalizedName = String(name || "").trim();
      if (!normalizedName || normalizedName.length < 3) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "name must be at least 3 characters");
      }
      station.name = normalizedName;
    }

    if (address !== undefined) {
      const normalizedAddress = String(address || "").trim();
      if (!normalizedAddress) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "address is required");
      }
      station.address = normalizedAddress;
    }

    if (city !== undefined) {
      const normalizedCity = String(city || "").trim();
      if (!normalizedCity) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "city is required");
      }
      station.city = normalizedCity;
    }

    if (state !== undefined) {
      const normalizedState = String(state || "").trim();
      if (!normalizedState) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "state is required");
      }
      station.state = normalizedState;
    }

    if (parkingType !== undefined) {
      const normalizedType = String(parkingType || "").trim().toUpperCase();
      if (!["COVERED", "OPEN"].includes(normalizedType)) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "parkingType must be COVERED or OPEN");
      }
      station.parkingType = normalizedType;
    }

    if (maxVehicles !== undefined) {
      const parsedMax = Number(maxVehicles);
      if (!Number.isFinite(parsedMax) || !Number.isInteger(parsedMax) || parsedMax < 1) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "maxVehicles must be a positive integer");
      }
      const currentCount = await models.Vehicle.countDocuments({
        stationId: station._id,
        status: { $nin: ["REMOVED"] },
      });
      if (parsedMax < currentCount) {
        req.rCode = 0;
        return ResponseMiddleware(
          req,
          res,
          next,
          `Cannot set capacity below current occupancy (${currentCount} vehicles already here).`,
        );
      }
      station.maxVehicles = parsedMax;
    }

    if (lat !== undefined && lng !== undefined) {
      if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "lat/lng must be valid coordinates");
      }
      station.location = {
        type: "Point",
        coordinates: [toNumber(lng), toNumber(lat)],
      };
    }

    if (typeof isActive === "boolean") {
      station.isActive = isActive;
    }

    if (stationAdminId !== undefined) {
      const trimmed = String(stationAdminId || "").trim();
      if (trimmed === "" || trimmed === "null") {
        station.stationAdminId = undefined;
      } else {
        if (!mongoose.Types.ObjectId.isValid(trimmed)) {
          req.rCode = 0;
          return ResponseMiddleware(req, res, next, "stationAdminId must be a valid id");
        }
        const stationAdmin = await UserService().fetchDocByQuery({
          _id: trimmed,
          role: { $in: STATION_ADMIN_ROLES },
        });
        if (!stationAdmin) {
          req.rCode = 5;
          return ResponseMiddleware(req, res, next, "Station admin not found");
        }
        station.stationAdminId = stationAdmin._id;
      }
    }

    await station.save();

    await AuditLogService().create({
      actorId: req.body.adminId,
      action: "STATION_UPDATED",
      entityType: "Station",
      entityId: station._id,
      after: station,
    });

    req.rData = { station };
    req.msg = "success";
    return ResponseMiddleware(req, res, next);
  },

  detail: async (req, res, next) => {
    const stationId = String(req.params.stationId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "stationId must be a valid id");
    }

    const stationAdminId = String(req.body.stationAdminId || req.query.stationAdminId || "").trim();
    if (!stationAdminId) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "stationAdminId is required");
    }

    const stationAdmin = await loadStationAdmin(stationAdminId);
    if (!stationAdmin) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    const station = await models.Station.findOne({
      _id: stationId,
      ...buildStationAdminStationQuery(stationAdmin),
    })
      .populate("stationAdminId", "name email mobile role stationId")
      .lean();

    if (!station) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station not found");
    }

    req.rData = { station };
    req.msg = "station_detail";
    return ResponseMiddleware(req, res, next);
  },
};
