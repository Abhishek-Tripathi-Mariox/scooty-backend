const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const { models } = require("../models");

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

module.exports = {
  list: async (req, res, next) => {
    const stations = await models.Station.find({})
      .sort({ createdAt: -1 })
      .lean();

    req.rData = { stations };
    req.msg = "stations_list";
    return ResponseMiddleware(req, res, next);
  },

  create: async (req, res, next) => {
    const { name, address, parkingType, lat, lng, isActive } = req.body || {};

    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "name is required");
    }

    const station = await models.Station.create({
      name: normalizedName,
      address: String(address || "").trim(),
      parkingType: ["COVERED", "OPEN"].includes(String(parkingType || "").trim().toUpperCase())
        ? String(parkingType || "").trim().toUpperCase()
        : "OPEN",
      location: {
        type: "Point",
        coordinates: [
          toNumber(lng) ?? 0,
          toNumber(lat) ?? 0,
        ],
      },
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    req.rData = { station };
    req.msg = "success";
    return ResponseMiddleware(req, res, next);
  },
};
