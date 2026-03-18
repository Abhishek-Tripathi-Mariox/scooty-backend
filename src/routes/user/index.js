const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const AuthMiddleware = require("../../middleware/AuthMiddleware");
const UserController = require("../../controllers/UserController");

router.get(
  "/me",
  AuthMiddleware().verifyUserToken,
  ErrorHandle(UserController.profile),
);
router.patch(
  "/me",
  AuthMiddleware().verifyUserToken,
  ErrorHandle(UserController.update),
);

module.exports = router;
