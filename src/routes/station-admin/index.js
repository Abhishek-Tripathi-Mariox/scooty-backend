const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const StationAdminAuthMiddleware = require("../../middleware/StationAdminAuthMiddleware");
const StationAdminVehicleValidationMiddleware = require("../../middleware/StationAdminVehicleValidationMiddleware");

const StationAdminAuthController = require("../../controllers/StationAdminAuthController");
const StationAdminSettingsController = require("../../controllers/StationAdminSettingsController");
const StationAdminContentController = require("../../controllers/StationAdminContentController");
const StationAdminVehicleController = require("../../controllers/StationAdminVehicleController");

// Public station admin auth
router.post("/auth/login", ErrorHandle(StationAdminAuthController.login));
router.post("/auth/send-otp", ErrorHandle(StationAdminAuthController.sendOtp));
router.post("/auth/resend-otp", ErrorHandle(StationAdminAuthController.resendOtp));
router.post("/auth/verify-otp", ErrorHandle(StationAdminAuthController.verifyOtp));

// Forgot password
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

// Protected station admin routes
router.use(StationAdminAuthMiddleware().verifyStationAdminToken);

// Profile and settings
router.get("/me", ErrorHandle(StationAdminSettingsController.me));
router.patch("/me", ErrorHandle(StationAdminSettingsController.update));
router.post("/change-password", ErrorHandle(StationAdminAuthController.changePassword));

// Ride plans
router.get("/ride-plans", ErrorHandle(StationAdminContentController.listPlans));
router.post("/ride-plans", ErrorHandle(StationAdminContentController.createPlan));
router.patch("/ride-plans/:planId", ErrorHandle(StationAdminContentController.updatePlan));

// FAQs
router.get("/faqs", ErrorHandle(StationAdminContentController.listFaqs));
router.post("/faqs", ErrorHandle(StationAdminContentController.createFaq));
router.patch("/faqs/:faqId", ErrorHandle(StationAdminContentController.updateFaq));

// Fleet vehicles
router.get(
  "/vehicles",
  StationAdminVehicleValidationMiddleware().list,
  ErrorHandle(StationAdminVehicleController.list),
);
router.post(
  "/vehicles",
  StationAdminVehicleValidationMiddleware().create,
  ErrorHandle(StationAdminVehicleController.create),
);
router.get(
  "/vehicles/:vehicleId",
  StationAdminVehicleValidationMiddleware().vehicleId,
  ErrorHandle(StationAdminVehicleController.detail),
);
router.patch(
  "/vehicles/:vehicleId/status",
  StationAdminVehicleValidationMiddleware().vehicleId,
  StationAdminVehicleValidationMiddleware().updateStatus,
  ErrorHandle(StationAdminVehicleController.updateStatus),
);

module.exports = router;
