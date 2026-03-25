const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const OwnerAuthMiddleware = require("../../middleware/OwnerAuthMiddleware");

const OwnerAuthController = require("../../controllers/OwnerAuthController");
const OwnerController = require("../../controllers/OwnerController");
const BankController = require("../../controllers/BankController");
const OwnerKycController = require("../../controllers/OwnerKycController");
const OwnerDashboardController = require("../../controllers/OwnerDashboardController");
const OwnerNotificationController = require("../../controllers/OwnerNotificationController");
const OwnerEarningsController = require("../../controllers/OwnerEarningsController");
const OwnerPayoutController = require("../../controllers/OwnerPayoutController");
const OwnerVehicleController = require("../../controllers/OwnerVehicleController");
const OwnerMaintenanceController = require("../../controllers/OwnerMaintenanceController");
const OwnerSupportController = require("../../controllers/OwnerSupportController");
const OwnerSettingsController = require("../../controllers/OwnerSettingsController");

// Public owner auth
router.post("/auth/send-otp", ErrorHandle(OwnerAuthController.sendOtp));
router.post("/auth/verify-otp", ErrorHandle(OwnerAuthController.verifyOtp));

// Protected owner routes
router.use(OwnerAuthMiddleware().verifyOwnerToken);

// Dashboard and earnings
router.get("/dashboard", ErrorHandle(OwnerDashboardController.dashboard));
router.get("/earnings", ErrorHandle(OwnerEarningsController.list));
router.get("/transactions", ErrorHandle(OwnerController.transactions));

// Notifications
router.get("/notifications", ErrorHandle(OwnerNotificationController.list));
router.patch("/notifications/:notificationId/read", ErrorHandle(OwnerNotificationController.markRead));

// Profile and account details
router.get("/me", ErrorHandle(OwnerController.me));
router.patch("/me", ErrorHandle(OwnerController.update));

// Bank details
router.get("/bank", ErrorHandle(BankController.get));
router.patch("/bank", ErrorHandle(BankController.update));

// KYC
router.get("/kyc", ErrorHandle(OwnerKycController.get));
router.patch("/kyc", ErrorHandle(OwnerKycController.submit));

// Payouts
router.get("/payouts", ErrorHandle(OwnerPayoutController.list));
router.post("/payouts/request", ErrorHandle(OwnerPayoutController.request));

// Vehicles
router.get("/vehicles", ErrorHandle(OwnerVehicleController.list));
router.post("/vehicles", ErrorHandle(OwnerVehicleController.create));
router.get("/vehicles/:vehicleId", ErrorHandle(OwnerVehicleController.detail));
router.patch("/vehicles/:vehicleId", ErrorHandle(OwnerVehicleController.update));
router.delete("/vehicles/:vehicleId", ErrorHandle(OwnerVehicleController.requestRemoval));

// Maintenance requests
router.get("/maintenance", ErrorHandle(OwnerMaintenanceController.list));
router.post("/maintenance", ErrorHandle(OwnerMaintenanceController.create));
router.get("/maintenance/:requestId", ErrorHandle(OwnerMaintenanceController.detail));

// Support
router.get("/support/faqs", ErrorHandle(OwnerSupportController.faqs));
router.get("/support/tickets", ErrorHandle(OwnerSupportController.listTickets));
router.post("/support/tickets", ErrorHandle(OwnerSupportController.createTicket));
router.get("/support/tickets/:ticketId", ErrorHandle(OwnerSupportController.ticketDetail));

// Settings
router.get("/settings", ErrorHandle(OwnerSettingsController.get));
router.patch("/settings", ErrorHandle(OwnerSettingsController.update));

module.exports = router;
