const router = require("express").Router();

router.use("/auth", require("./auth"));
router.use("/user", require("./user"));
router.use("/admin", require("./admin"));
router.use("/owner", require("./owner"));
router.use("/station-admin", require("./station-admin"));

module.exports = router;
