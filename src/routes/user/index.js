const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const AuthMiddleware = require("../../middleware/AuthMiddleware");
const UserController = require("../../controllers/UserController");

// Protected user routes
router.use(AuthMiddleware().verifyUserToken);

// Discovery
router.get("/plans", ErrorHandle(UserController.plans));
router.get("/stations", ErrorHandle(UserController.stations));
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
router.post("/bookings/:bookingId/pay", ErrorHandle(UserController.confirmPayment));
router.post("/bookings/:bookingId/start", ErrorHandle(UserController.startRide));
router.post("/bookings/:bookingId/complete", ErrorHandle(UserController.completeRide));

// Ride history and wallet
router.get("/rides/history", ErrorHandle(UserController.rideHistory));
router.get("/wallet", ErrorHandle(UserController.walletSummary));

// Referral
router.get("/referral", ErrorHandle(UserController.referralSummary));
router.post("/referral/apply", ErrorHandle(UserController.applyReferralCode));

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
