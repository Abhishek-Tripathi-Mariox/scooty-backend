const jwt = require("jsonwebtoken");
const ResponseMiddleware = require("./ResponseMiddleware");
const { models } = require("../models");

const JWTSECRET = process.env.JWTSECRET;

module.exports = () => {
  const verifyOwnerToken = async (req, res, next) => {
    const auth = req.headers.authorization;
    try {
      if (!auth) throw new Error("invalid_token");
      const token = auth.split(" ")[1];
      if (!token) throw new Error("invalid_token");

      const payload = jwt.verify(token, JWTSECRET);
      const userId = payload.user_id;
      if (!userId) throw new Error("invalid_token");

      const owner = await models.User.findById(userId).lean();
      if (!owner || owner.isActive === false) throw new Error("invalid_token");
      if (owner.role !== "OWNER") throw new Error("invalid_token");

      req.body = { ...(req.body || {}), ownerId: owner._id };
      return next();
    } catch (ex) {
      req.rCode = 3;
      req.msg = "invalid_token";
      return ResponseMiddleware(req, res, next);
    }
  };

  return { verifyOwnerToken };
};
