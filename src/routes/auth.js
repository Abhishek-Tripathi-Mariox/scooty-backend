const router = require("express").Router();
const ErrorHandle = require("../middleware/ErrorHandleMiddleware");
const AuthController = require("../controllers/AuthController");

router.post("/send-otp", ErrorHandle(AuthController.sendOtp));
router.post("/verify-otp", ErrorHandle(AuthController.verifyOtp));

module.exports = router;
