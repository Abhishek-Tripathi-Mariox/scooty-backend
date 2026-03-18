const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const StationAdminAuthMiddleware = require("../../middleware/StationAdminAuthMiddleware");

const StationAdminAuthController = require("../../controllers/StationAdminAuthController");
const StationAdminSettingsController = require("../../controllers/StationAdminSettingsController");

// Login (existing station admins only)
router.post("/auth/login", ErrorHandle(StationAdminAuthController.login));
router.post("/auth/send-otp", ErrorHandle(StationAdminAuthController.sendOtp));
router.post("/auth/resend-otp", ErrorHandle(StationAdminAuthController.resendOtp));
router.post("/auth/verify-otp", ErrorHandle(StationAdminAuthController.verifyOtp));

// Forgot password (existing station admins only)
router.post(
  "/auth/forgot-password/send-otp",
  ErrorHandle(StationAdminAuthController.forgotPasswordSendOtp),
);
router.post(
  "/auth/forgot-password/resend-otp",
  ErrorHandle(StationAdminAuthController.forgotPasswordResendOtp),
);
router.post(
  "/auth/forgot-password/reset",
  ErrorHandle(StationAdminAuthController.forgotPasswordReset),
);

// Protected
router.use(StationAdminAuthMiddleware().verifyStationAdminToken);

router.get("/me", ErrorHandle(StationAdminSettingsController.me));
router.patch("/me", ErrorHandle(StationAdminSettingsController.update));
router.post("/change-password", ErrorHandle(StationAdminAuthController.changePassword));

module.exports = router;
