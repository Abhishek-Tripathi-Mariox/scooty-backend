const { models } = require("../models");
const fileUploadService = require("../util/s3");

module.exports = () => {
  const list = async (ownerId, { status } = {}) => {
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

    const vehicle = await models.Vehicle.findOne({ _id: vehicleId, ownerId }).lean();
    if (!vehicle) return null;

    let photoUrl = "";
    if (files && files.photo) {
      const uploadRes = await fileUploadService.uploadFileToAws(files.photo);
      photoUrl = uploadRes.images?.[0] || "";
    }

    return await models.MaintenanceRequest.create({
      userId: ownerId,
      vehicleId,
      issueType: issueType || "OTHER",
      description: String(description || ""),
      photoUrl,
      status: "OPEN",
    });
  };

  const fetchById = async (ownerId, requestId) => {
    return await models.MaintenanceRequest.findOne({ _id: requestId, userId: ownerId }).lean();
  };

  return { list, create, fetchById };
};
