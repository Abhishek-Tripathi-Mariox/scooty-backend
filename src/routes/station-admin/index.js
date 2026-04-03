const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const StationAdminAuthMiddleware = require("../../middleware/StationAdminAuthMiddleware");
const StationAdminVehicleValidationMiddleware = require("../../middleware/StationAdminVehicleValidationMiddleware");

const StationAdminAuthController = require("../../controllers/StationAdminAuthController");
const AdminStationController = require("../../controllers/AdminStationController");
const StationAdminSettingsController = require("../../controllers/StationAdminSettingsController");
const StationAdminContentController = require("../../controllers/StationAdminContentController");
const StationAdminVehicleController = require("../../controllers/StationAdminVehicleController");
const StationAdminOperationsController = require("../../controllers/StationAdminOperationsController");

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
router.get("/stations", ErrorHandle(AdminStationController.list));
router.get("/stations/:stationId", ErrorHandle(AdminStationController.detail));

// ---------------------------------------Dashboard
router.get("/dashboard", ErrorHandle(StationAdminOperationsController.dashboard));

// ---------------------------------------Ride plans
router.get("/ride-plans", ErrorHandle(StationAdminContentController.listPlans));
router.post("/ride-plans", ErrorHandle(StationAdminContentController.createPlan));
router.patch("/ride-plans/:planId", ErrorHandle(StationAdminContentController.updatePlan));

// ---------------------------------------FAQs
router.get("/faqs", ErrorHandle(StationAdminContentController.listFaqs));
router.post("/faqs", ErrorHandle(StationAdminContentController.createFaq));
router.patch("/faqs/:faqId", ErrorHandle(StationAdminContentController.updateFaq));

// ---------------------------------------Fleet vehicles
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

// ---------------------------------------Booking control
router.get("/bookings", ErrorHandle(StationAdminOperationsController.listBookings));
router.get("/bookings/:bookingId", ErrorHandle(StationAdminOperationsController.bookingDetail));
router.patch("/bookings/:bookingId/approve", ErrorHandle(StationAdminOperationsController.approveBooking));
router.patch("/bookings/:bookingId/cancel", ErrorHandle(StationAdminOperationsController.cancelBooking));

// ---------------------------------------Ride monitoring
router.get("/rides", ErrorHandle(StationAdminOperationsController.listRides));
router.get("/rides/:rideId", ErrorHandle(StationAdminOperationsController.rideDetail));
router.post("/rides/:rideId/force-end", ErrorHandle(StationAdminOperationsController.forceEndRide));
router.post("/rides/:rideId/lock-vehicle", ErrorHandle(StationAdminOperationsController.lockVehicle));

// ---------------------------------------Maintenance logs
router.get("/maintenance-logs", ErrorHandle(StationAdminOperationsController.listMaintenance));
router.post("/maintenance-logs", ErrorHandle(StationAdminOperationsController.createMaintenance));
router.get("/maintenance-logs/:requestId", ErrorHandle(StationAdminOperationsController.maintenanceDetail));
router.patch(
  "/maintenance-logs/:requestId/status",
  ErrorHandle(StationAdminOperationsController.updateMaintenanceStatus),
);

// ---------------------------------------Support
router.get("/support/tickets", ErrorHandle(StationAdminOperationsController.listSupportTickets));
router.get("/support/tickets/:ticketId", ErrorHandle(StationAdminOperationsController.supportTicketDetail));
router.patch("/support/tickets/:ticketId/status", ErrorHandle(StationAdminOperationsController.updateSupportTicket));
router.patch(
  "/support/tickets/:ticketId/escalate",
  ErrorHandle(StationAdminOperationsController.escalateSupportTicket),
);

// ---------------------------------------Notifications
router.get("/notifications", ErrorHandle(StationAdminOperationsController.listNotifications));
router.patch(
  "/notifications/:notificationId/read",
  ErrorHandle(StationAdminOperationsController.markNotificationRead),
);
router.patch(
  "/notifications/read-all",
  ErrorHandle(StationAdminOperationsController.markAllNotificationsRead),
);

// ---------------------------------------Reports-- 
router.get("/reports", ErrorHandle(StationAdminOperationsController.reports));
router.get("/transactions", ErrorHandle(StationAdminOperationsController.transactions));
router.get("/bookings/:bookingId/invoice", ErrorHandle(StationAdminOperationsController.bookingInvoice));
router.get("/bookings/:bookingId/invoice/pdf", ErrorHandle(StationAdminOperationsController.bookingInvoicePdf));
router.patch("/bookings/:bookingId/refund", ErrorHandle(StationAdminOperationsController.bookingRefund));

module.exports = router;
