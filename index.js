require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");

// Initialize DB connection + models
const db = require("./src/models");
const seedAdminIfNeeded = require("./src/startup/seedAdmin");

const waitForDb = () =>
  new Promise((resolve, reject) => {
    if (db.readyState === 1) return resolve();
    db.once("open", resolve);
    db.once("error", reject);
  });

const routes = require("./src/routes");
const ResponseMiddleware = require("./src/middleware/ResponseMiddleware");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    abortOnLimit: true,
    createParentPath: false,
  }),
);

app.get("/health", (req, res) => res.send({ ok: true }));

app.use("/v1/api", routes);

// Auto-seed ADMIN on startup (idempotent)
waitForDb()
  .then(async () => {
    const result = await seedAdminIfNeeded(db.models);
    if (result.created) {
      console.log("Auto-seeded admin:", { id: result.admin._id.toString(), email: result.email });
    } else {
      console.log("Admin already present:", { id: result.admin._id.toString(), email: result.email });
    }
  })
  .catch((err) => {
    console.error("Auto-seed admin failed:", err.message);
  });

// 404 handler
app.use((req, res, next) => {
  req.rCode = 5;
  req.msg = "not_found";
  ResponseMiddleware(req, res, next, "Route not found");
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
