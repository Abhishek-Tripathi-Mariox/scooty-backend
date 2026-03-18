require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");

// Initialize DB connection + models
require("./src/models");

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
