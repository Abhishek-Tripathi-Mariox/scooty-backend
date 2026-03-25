const { models } = require("../models");
const fileUploadService = require("../util/s3");
const AuditLogService = require("./AuditLogService");

module.exports = () => {
  const list = async (ownerId, { status } = {}) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
    if (!owner) return [];

    const query = { userId: ownerId };
    if (status) query.status = status;
    return await models.MaintenanceRequest.find(query).sort({ createdAt: -1 }).lean();
  };

  const create = async ({ ownerId, payload = {}, files = null }) => {
    const { vehicleId, issueType, description } = payload || {};
    if (!vehicleId) {
      const err = new Error("vehicleId is required");
      err.code = "REQUIRED_FIELDS_MISSING";
      throw err;
    }

    const vehicle = await models.Vehicle.findOne({
      _id: vehicleId,
      ownerId,
    }).lean();
    if (!vehicle) return null;
    if (!vehicle.stationId) {
      const err = new Error("Vehicle station is required");
      err.code = "STATION_REQUIRED";
      throw err;
    }

    let photoUrl = "";
    if (files && files.photo) {
      const uploadRes = await fileUploadService.uploadFileToAws(files.photo);
      photoUrl = uploadRes.images?.[0] || "";
    }

    const request = await models.MaintenanceRequest.create({
      userId: ownerId,
      vehicleId,
      stationId: vehicle.stationId,
      issueType: issueType || "OTHER",
      description: String(description || ""),
      photoUrl,
      status: "OPEN",
    });

    await AuditLogService().create({
      actorId: ownerId,
      actorRole: "OWNER",
      action: "OWNER_MAINTENANCE_CREATED",
      entityType: "MaintenanceRequest",
      entityId: request._id,
      after: request,
      meta: { vehicleId, issueType: issueType || "OTHER" },
    });

    return request;
  };

  const fetchById = async (ownerId, requestId) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
    if (!owner) return null;

    return await models.MaintenanceRequest.findOne({ _id: requestId, userId: ownerId }).lean();
  };

  return { list, create, fetchById };
};
