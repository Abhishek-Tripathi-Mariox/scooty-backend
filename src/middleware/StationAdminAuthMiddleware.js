const jwt = require("jsonwebtoken");
const ResponseMiddleware = require("./ResponseMiddleware");
const UserService = require("../services/UserService");

const JWTSECRET = process.env.JWTSECRET;

module.exports = () => {
  const verifyStationAdminToken = async (req, res, next) => {
    const auth = req.headers.authorization;
    try {
      if (!auth) throw new Error("invalid_token");
      const token = auth.split(" ")[1];
      if (!token) throw new Error("invalid_token");

      const payload = jwt.verify(token, JWTSECRET);
      const userId = payload.user_id;
      if (!userId) throw new Error("invalid_token");

      const stationAdmin = await UserService().fetchByQuery({ _id: userId });
      if (!stationAdmin || stationAdmin.role !== "STATION_ADMIN") {
        throw new Error("invalid_token");
      }

      req.body = {
        ...(req.body || {}),
        stationAdminId: stationAdmin._id,
      };
      return next();
    } catch (ex) {
      req.rCode = 3;
      req.msg = "invalid_token";
      return ResponseMiddleware(req, res, next);
    }
  };

  return { verifyStationAdminToken };
};
