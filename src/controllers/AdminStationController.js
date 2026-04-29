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

    req.rData = { stations };
    req.msg = "stations_list";
    return ResponseMiddleware(req, res, next);
  },

  create: async (req, res, next) => {
    const { name, address, city, state, parkingType, lat, lng, isActive, stationAdminId } = req.body || {};

    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "name is required");
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
