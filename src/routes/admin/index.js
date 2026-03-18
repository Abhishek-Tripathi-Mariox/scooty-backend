const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const AdminAuthMiddleware = require("../../middleware/AdminAuthMiddleware");

const AdminAuthController = require("../../controllers/AdminAuthController");
const AdminSettingsController = require("../../controllers/AdminSettingsController");
const AdminUserController = require("../../controllers/AdminUserController");

// Auth
router.post("/auth/login", ErrorHandle(AdminAuthController.login));

// Protected
router.use(AdminAuthMiddleware().verifyAdminToken);

router.get("/me", ErrorHandle(AdminSettingsController.me));
router.patch("/me", ErrorHandle(AdminSettingsController.update));
router.post("/change-password", ErrorHandle(AdminAuthController.changePassword));

// ADMIN can create station admins
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

module.exports = router;
