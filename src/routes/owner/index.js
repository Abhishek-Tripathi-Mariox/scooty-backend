const router = require("express").Router();
const ErrorHandle = require("../../middleware/ErrorHandleMiddleware");
const OwnerAuthMiddleware = require("../../middleware/OwnerAuthMiddleware");

const OwnerAuthController = require("../../controllers/OwnerAuthController");
const OwnerController = require("../../controllers/OwnerController");

router.post("/auth/send-otp", ErrorHandle(OwnerAuthController.sendOtp));
router.post("/auth/verify-otp", ErrorHandle(OwnerAuthController.verifyOtp));

router.use(OwnerAuthMiddleware().verifyOwnerToken);

router.get("/me", ErrorHandle(OwnerController.me));
router.patch("/me", ErrorHandle(OwnerController.update));

module.exports = router;
