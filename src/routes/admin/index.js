const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const AdminAuthMiddleware = require("../../middleware/AdminAuthMiddleware");

const AdminAuthController = require("../../controllers/AdminAuthController");
const AdminSettingsController = require("../../controllers/AdminSettingsController");
const AdminUserController = require("../../controllers/AdminUserController");
const AdminStationController = require("../../controllers/AdminStationController");
const AdminContentController = require("../../controllers/AdminContentController");

// Authentication
router.post("/auth/login", ErrorHandle(AdminAuthController.login));

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

module.exports = router;
