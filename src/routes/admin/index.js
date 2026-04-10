const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const AdminAuthMiddleware = require("../../middleware/AdminAuthMiddleware");

const AdminAuthController = require("../../controllers/AdminAuthController");
const AdminSettingsController = require("../../controllers/AdminSettingsController");
const AdminUserController = require("../../controllers/AdminUserController");
const AdminStationController = require("../../controllers/AdminStationController");
const AdminContentController = require("../../controllers/AdminContentController");
const AdminPanelController = require("../../controllers/AdminPanelController");

// Authentication
router.post("/auth/login", ErrorHandle(AdminAuthController.login));
router.post("/auth/forgot-password/send-otp", ErrorHandle(AdminAuthController.forgotPasswordSendOtp));
router.post(
  "/auth/forgot-password/resend-otp",
  ErrorHandle(AdminAuthController.forgotPasswordResendOtp),
);
router.post("/auth/forgot-password/reset", ErrorHandle(AdminAuthController.forgotPasswordReset));

// Protected routes
router.use(AdminAuthMiddleware().verifyAdminToken);

// Profile and account settings
router.get("/me", ErrorHandle(AdminSettingsController.me));
router.patch("/me", ErrorHandle(AdminSettingsController.update));
router.post("/change-password", ErrorHandle(AdminAuthController.changePassword));

// Station admin management
router.get(
  "/station-admins",
  AdminAuthMiddleware().requireRole("ADMIN"),
  ErrorHandle(AdminUserController.listStationAdmins),
);
router.post(
  "/station-admins",
  AdminAuthMiddleware().requireRole("ADMIN"),
  ErrorHandle(AdminUserController.createStationAdmin),
);

// Station management
router.get(
  "/stations",
  AdminAuthMiddleware().requireRole("ADMIN"),
  ErrorHandle(AdminStationController.list),
);
router.post(
  "/stations",
  AdminAuthMiddleware().requireRole("ADMIN"),
  ErrorHandle(AdminStationController.create),
);

// Content moderation: ride plans
router.get(
  "/ride-plans",
  AdminAuthMiddleware().requireRole("ADMIN"),
  ErrorHandle(AdminContentController.listPlans),
);
router.patch(
  "/ride-plans/:planId/review",
  AdminAuthMiddleware().requireRole("ADMIN"),
  ErrorHandle(AdminContentController.reviewPlan),
);

// Content moderation: FAQs
router.get(
  "/faqs",
  AdminAuthMiddleware().requireRole("ADMIN"),
  ErrorHandle(AdminContentController.listFaqs),
);
router.patch(
  "/faqs/:faqId/review",
  AdminAuthMiddleware().requireRole("ADMIN"),
  ErrorHandle(AdminContentController.reviewFaq),
);

// Super admin panel
router.get(
  "/dashboard",
  AdminAuthMiddleware().requirePermission("dashboard"),
  ErrorHandle(AdminPanelController.dashboard),
);
router.get(
  "/users",
  AdminAuthMiddleware().requirePermission("users"),
  ErrorHandle(AdminPanelController.listUsers),
);
router.patch(
  "/users/:userId/status",
  AdminAuthMiddleware().requirePermission("users"),
  ErrorHandle(AdminPanelController.updateUserStatus),
);
router.patch(
  "/users/:userId/kyc-status",
  AdminAuthMiddleware().requirePermission("users"),
  ErrorHandle(AdminPanelController.updateUserKycStatus),
);
router.get(
  "/pricing",
  AdminAuthMiddleware().requirePermission("pricing"),
  ErrorHandle(AdminPanelController.getPricing),
);
router.patch(
  "/pricing",
  AdminAuthMiddleware().requirePermission("pricing"),
  ErrorHandle(AdminPanelController.updatePricing),
);
router.get(
  "/commission",
  AdminAuthMiddleware().requirePermission("commission"),
  ErrorHandle(AdminPanelController.getCommission),
);
router.patch(
  "/commission",
  AdminAuthMiddleware().requirePermission("commission"),
  ErrorHandle(AdminPanelController.updateCommission),
);
router.get(
  "/settlements",
  AdminAuthMiddleware().requirePermission("settlements"),
  ErrorHandle(AdminPanelController.listSettlements),
);
router.post(
  "/settlements",
  AdminAuthMiddleware().requirePermission("settlements"),
  ErrorHandle(AdminPanelController.createSettlement),
);
router.patch(
  "/settlements/:settlementId/status",
  AdminAuthMiddleware().requirePermission("settlements"),
  ErrorHandle(AdminPanelController.updateSettlementStatus),
);
router.get(
  "/reports",
  AdminAuthMiddleware().requirePermission("reports"),
  ErrorHandle(AdminPanelController.reports),
);
router.get(
  "/transactions",
  AdminAuthMiddleware().requirePermission("reports"),
  ErrorHandle(AdminPanelController.listTransactions),
);
router.get(
  "/bookings/:bookingId/invoice",
  // AdminAuthMiddleware().requirePermission("reports"),
  ErrorHandle(AdminPanelController.bookingInvoice),
);
router.get(
  "/bookings/:bookingId/invoice/pdf",
  AdminAuthMiddleware().requirePermission("reports"),
  ErrorHandle(AdminPanelController.bookingInvoicePdf),
);
router.patch(
  "/bookings/:bookingId/refund",
  AdminAuthMiddleware().requirePermission("settlements"),
  ErrorHandle(AdminPanelController.bookingRefund),
);
router.get(
  "/ledger",
  AdminAuthMiddleware().requirePermission("reports"),
  ErrorHandle(AdminPanelController.ledger),
);
router.get(
  "/access-control/admins",
  AdminAuthMiddleware().requirePermission("access-control"),
  ErrorHandle(AdminPanelController.listAdmins),
);
router.post(
  "/access-control/admins",
  AdminAuthMiddleware().requirePermission("access-control"),
  ErrorHandle(AdminPanelController.createAdmin),
);
router.patch(
  "/access-control/admins/:adminId",
  AdminAuthMiddleware().requirePermission("access-control"),
  ErrorHandle(AdminPanelController.updateAdmin),
);
router.get(
  "/audit-logs",
  AdminAuthMiddleware().requirePermission("audit-logs"),
  ErrorHandle(AdminPanelController.listAuditLogs),
);

module.exports = router;
