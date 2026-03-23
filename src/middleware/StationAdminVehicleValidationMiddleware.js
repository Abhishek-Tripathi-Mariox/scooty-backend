const ResponseMiddleware = require("./ResponseMiddleware");

const allowedStatuses = [
  "ACTIVE",
  "MAINTENANCE",
  "CHARGING",
  "INACTIVE",
  "DRAFT",
  "PENDING_APPROVAL",
  "IN_RIDE",
  "REMOVAL_REQUESTED",
  "REMOVED",
];

const allowedActions = [
  "MARK_MAINTENANCE",
  "MARK_ACTIVE",
  "ASSIGN_CHARGING",
  "MARK_INACTIVE",
];

const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || "").trim());
const isIntegerLike = (value) => {
  if (value === undefined || value === null || value === "") return false;
  const n = Number(value);
  return Number.isInteger(n);
};

const sendValidationError = (req, res, next, message) => {
  req.rCode = 0;
  return ResponseMiddleware(req, res, next, message);
};

module.exports = () => {
  const list = async (req, res, next) => {
    const status = String(req.query.status || "").trim().toUpperCase();
    if (status && !allowedStatuses.includes(status)) {
      return sendValidationError(req, res, next, "Invalid status");
    }

    const page = req.query.page;
    const limit = req.query.limit;
    if (page !== undefined && (!isIntegerLike(page) || Number(page) < 1)) {
      return sendValidationError(req, res, next, "page must be a positive integer");
    }
    if (limit !== undefined && (!isIntegerLike(limit) || Number(limit) < 1 || Number(limit) > 100)) {
      return sendValidationError(req, res, next, "limit must be between 1 and 100");
    }

    if (req.query.stationId && !isObjectId(req.query.stationId)) {
      return sendValidationError(req, res, next, "stationId must be a valid id");
    }

    return next();
  };

  const create = async (req, res, next) => {
    if (req.body.stationId && !isObjectId(req.body.stationId)) {
      return sendValidationError(req, res, next, "stationId must be a valid id");
    }

    const modelName = String(req.body.modelName || "").trim();
    const registrationNumber = String(req.body.registrationNumber || "").trim();
    const chassisNumber = String(req.body.chassisNumber || "").trim();
    const batteryPercent = req.body.batteryPercent;
    const locationLabel = req.body.locationLabel;

    if (!modelName) return sendValidationError(req, res, next, "modelName is required");
    if (!registrationNumber) return sendValidationError(req, res, next, "registrationNumber is required");
    if (!chassisNumber) return sendValidationError(req, res, next, "chassisNumber is required");
    if (typeof locationLabel === "string" && locationLabel.length > 120) {
      return sendValidationError(req, res, next, "locationLabel is too long");
    }
    if (batteryPercent !== undefined && batteryPercent !== null && batteryPercent !== "") {
      const n = Number(batteryPercent);
      if (!Number.isInteger(n) || n < 0 || n > 100) {
        return sendValidationError(req, res, next, "batteryPercent must be between 0 and 100");
      }
    }

    return next();
  };

  const vehicleId = async (req, res, next) => {
    if (!isObjectId(req.params.vehicleId)) {
      return sendValidationError(req, res, next, "vehicleId must be a valid id");
    }
    return next();
  };

  const updateStatus = async (req, res, next) => {
    const status = String(req.body.status || "").trim().toUpperCase();
    const action = String(req.body.action || "").trim().toUpperCase();

    if (!status && !action) {
      return sendValidationError(req, res, next, "status or action is required");
    }
    if (status && !allowedStatuses.includes(status)) {
      return sendValidationError(req, res, next, "Invalid status");
    }
    if (action && !allowedActions.includes(action)) {
      return sendValidationError(req, res, next, "Invalid action");
    }
    if (req.body.stationId && !isObjectId(req.body.stationId)) {
      return sendValidationError(req, res, next, "stationId must be a valid id");
    }
    if (req.body.note !== undefined && String(req.body.note || "").length > 500) {
      return sendValidationError(req, res, next, "note is too long");
    }
    if (req.body.reason !== undefined && String(req.body.reason || "").length > 500) {
      return sendValidationError(req, res, next, "reason is too long");
    }
    return next();
  };

  return {
    list,
    create,
    vehicleId,
    updateStatus,
  };
};
