const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const AuthMiddleware = require("../../middleware/AuthMiddleware");
const AuthController = require("../../controllers/AuthController");
const UserController = require("../../controllers/UserController");

// Public user auth routes
router.post("/auth/signup", ErrorHandle(AuthController.signup));
router.post("/auth/send-otp", ErrorHandle(AuthController.sendOtp));
router.post("/auth/verify-otp", ErrorHandle(AuthController.verifyOtp));

// Public discovery routes used by both rider and owner apps
router.get("/stations", ErrorHandle(UserController.stations));

// Protected user routes
router.use(AuthMiddleware().verifyUserToken);

router.get("/dashboard", ErrorHandle(UserController.dashboard));

// Discovery
router.get("/plans", ErrorHandle(UserController.plans));
router.get("/stations/:stationId", ErrorHandle(UserController.stationDetail));
router.get("/time-slots", ErrorHandle(UserController.timeSlots));

// Profile
router.get("/me", ErrorHandle(UserController.profile));
router.patch("/me", ErrorHandle(UserController.update));

// Bookings
router.post("/bookings/quote", ErrorHandle(UserController.bookingQuote));
router.post("/bookings", ErrorHandle(UserController.createBooking));
router.get("/bookings", ErrorHandle(UserController.bookings));
router.get("/bookings/:bookingId", ErrorHandle(UserController.bookingDetail));
router.get("/rides/history/:rideId", ErrorHandle(UserController.rideDetail));
router.post("/bookings/:bookingId/pay", ErrorHandle(UserController.confirmPayment));
router.post("/bookings/:bookingId/start", ErrorHandle(UserController.startRide));
router.post("/bookings/:bookingId/complete", ErrorHandle(UserController.completeRide));

// Ride history and wallet
router.get("/rides/history", ErrorHandle(UserController.rideHistory));
router.get("/wallet", ErrorHandle(UserController.walletSummary));
router.get("/transactions", ErrorHandle(UserController.transactions));
router.get("/bookings/:bookingId/invoice", ErrorHandle(UserController.bookingInvoice));
router.get("/bookings/:bookingId/refund", ErrorHandle(UserController.bookingRefund));
router.get("/bookings/:bookingId/invoice/pdf", ErrorHandle(UserController.bookingInvoicePdf));
router.get("/bookings/:bookingId/receipt/pdf", ErrorHandle(UserController.bookingReceiptPdf));

// Referral
router.get("/referral", ErrorHandle(UserController.referralSummary));
router.post("/referral/apply", ErrorHandle(UserController.applyReferralCode));

// Settings
router.get("/settings", ErrorHandle(UserController.settings));
router.patch("/settings", ErrorHandle(UserController.updateSettings));
router.get("/location", ErrorHandle(UserController.location));
router.patch("/location", ErrorHandle(UserController.updateLocation));

// Notifications
router.get("/notifications", ErrorHandle(UserController.notifications));
router.patch("/notifications/read-all", ErrorHandle(UserController.markAllNotificationsRead));
router.patch("/notifications/:notificationId/read", ErrorHandle(UserController.markNotificationRead));

// Support
router.get("/support/faqs", ErrorHandle(UserController.faqs));
router.get("/support/tickets", ErrorHandle(UserController.tickets));
router.post("/support/tickets", ErrorHandle(UserController.createTicket));
router.get("/support/tickets/:ticketId", ErrorHandle(UserController.ticketDetail));

module.exports = router;
