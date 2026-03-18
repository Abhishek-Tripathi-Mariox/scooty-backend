const jwt = require("jsonwebtoken");
const ResponseMiddleware = require("./ResponseMiddleware");
const JWTSECRET = process.env.JWTSECRET;
const UserService = require("../services/UserService");

module.exports = () => {
  const verifyUserToken = async (req, res, next) => {
    let usertoken = req.headers.authorization;
    try {
      if (usertoken) {
        let tokens = usertoken.split(" ");

        let token = tokens[1];
        let payload = jwt.verify(token, JWTSECRET);

        let user = await UserService().fetchByQuery({
          _id: payload.user_id,
        });
        console.log("Authenticated user:", {
          userId: payload.user_id,
          role: payload.role,
        }); 
        //checking user must exist in our DB else throwing error
        if (user && user.role === "USER") {
          console.log(`User ${user._id} authenticated`);
          // req.body.userId = user._id;
          req.body = {
            ...(req.body || {}),
            userId: user._id,
          };
          next();
        } else {
          throw new Error("invalid_token");
        }
      } else {
        throw new Error("invalid_token");
      }
    } catch (ex) {
      // console.log("heres",ex)
      req.rCode = 3;
      req.msg = "invalid_token";
      if (ex.message == "ac_deactivated") req.msg = ex.message;

      ResponseMiddleware(req, res, next);
    }
  };
  return {
    verifyUserToken,
  };
};
