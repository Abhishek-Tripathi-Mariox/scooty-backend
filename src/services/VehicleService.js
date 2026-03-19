const { models } = require("../models");
const fileUploadService = require("../util/s3");

const normalizeStr = (v) => (typeof v === "string" ? v.trim() : "");

module.exports = () => {
  const list = async (ownerId, { status } = {}) => {
    const query = { ownerId };
    if (status) query.status = status;
    return await models.Vehicle.find(query).sort({ createdAt: -1 }).lean();
  };

  const fetchByIdLean = async (ownerId, vehicleId) => {
    return await models.Vehicle.findOne({ _id: vehicleId, ownerId }).lean();
  };

  const fetchByIdDoc = async (ownerId, vehicleId) => {
    return await models.Vehicle.findOne({ _id: vehicleId, ownerId });
  };

  const createDraft = async (ownerId, payload = {}, files = {}) => {
    try {
      console.log("payload:", payload);

      // Ensure objects exist
      payload.photos = payload.photos || {};
      payload.documents = payload.documents || {};

      // Helper function for upload
      const uploadFile = async (file) => {
        if (!file) return "";
        const res = await fileUploadService.uploadFileToAws(file);
        return res.images?.[0] || "";
      };

      // Upload all files in parallel 🚀
      const [
        frontUrl,
        sideUrl,
        rcUrl,
        insuranceUrl
      ] = await Promise.all([
        uploadFile(files.frontUrl),
        uploadFile(files.sideUrl),
        uploadFile(files.rcDocument),
        uploadFile(files.insuranceDocument),
      ]);

      // Assign uploaded URLs
      if (frontUrl) payload.photos.frontUrl = frontUrl;
      if (sideUrl) payload.photos.sideUrl = sideUrl;
      if (rcUrl) payload.documents.rcUrl = rcUrl;
      if (insuranceUrl) payload.documents.insuranceUrl = insuranceUrl;

      // Create vehicle with photos & documents
      const vehicle = await models.Vehicle.create({
        ownerId,
        modelName: normalizeStr(payload.modelName),
        registrationNumber: normalizeStr(payload.registrationNumber),
        chassisNumber: normalizeStr(payload.chassisNumber),
        stationId: payload.stationId || undefined,
        status: "DRAFT",

        // ✅ IMPORTANT: saving here
        photos: payload.photos,
        documents: payload.documents,
      });

      return vehicle;

    } catch (error) {
      console.error("Error in createDraft:", error);
      throw error;
    }
  };

  const update = async ({ ownerId, vehicleId, payload = {}, files = null }) => {
    try {
      const vehicle = await fetchByIdDoc(ownerId, vehicleId);
      if (!vehicle) return null;

      const {
        modelName,
        registrationNumber,
        chassisNumber,
        stationId,
        submit
      } = payload || {};

      // ✅ Basic updates
      if (typeof modelName === "string") vehicle.modelName = modelName.trim();
      if (typeof registrationNumber === "string") vehicle.registrationNumber = registrationNumber.trim();
      if (typeof chassisNumber === "string") vehicle.chassisNumber = chassisNumber.trim();
      if (stationId) vehicle.stationId = stationId;

      // ✅ Ensure objects exist (IMPORTANT)
      vehicle.photos = vehicle.photos || {};
      vehicle.documents = vehicle.documents || {};

      // ✅ Helper for upload
      const uploadFile = async (file) => {
        if (!file) return "";
        const res = await fileUploadService.uploadFileToAws(file);
        return res.images?.[0] || "";
      };

      // ✅ Upload in parallel 🚀
      if (files) {
        const [
          frontUrl,
          sideUrl,
          rcUrl,
          insuranceUrl
        ] = await Promise.all([
          uploadFile(files.frontPhoto),
          uploadFile(files.sidePhoto),
          uploadFile(files.rcDocument),
          uploadFile(files.insuranceDocument),
        ]);

        // ✅ Assign only if uploaded
        if (frontUrl) vehicle.photos.frontUrl = frontUrl;
        if (sideUrl) vehicle.photos.sideUrl = sideUrl;
        if (rcUrl) vehicle.documents.rcUrl = rcUrl;
        if (insuranceUrl) vehicle.documents.insuranceUrl = insuranceUrl;
      }

      // ✅ Submit logic
      const wantsSubmit =
        submit === true ||
        submit === "true" ||
        submit === 1 ||
        submit === "1";

      if (wantsSubmit) {
        const hasBasics =
          normalizeStr(vehicle.modelName) &&
          normalizeStr(vehicle.registrationNumber) &&
          normalizeStr(vehicle.chassisNumber);

        const hasDocs =
          normalizeStr(vehicle.documents?.rcUrl) &&
          normalizeStr(vehicle.documents?.insuranceUrl);

        const hasPhotos =
          normalizeStr(vehicle.photos?.frontUrl) &&
          normalizeStr(vehicle.photos?.sideUrl);

        const hasStation = !!vehicle.stationId;

        if (!hasBasics || !hasDocs || !hasPhotos || !hasStation) {
          const err = new Error("Required fields are missing");
          err.code = "REQUIRED_FIELDS_MISSING";
          throw err;
        }

        vehicle.status = "PENDING_APPROVAL";
        vehicle.approvalNote = "";
      }

      await vehicle.save();
      return vehicle;

    } catch (error) {
      console.error("Error in update vehicle:", error);
      throw error;
    }
  };
  
  const requestRemoval = async (ownerId, vehicleId) => {
    const vehicle = await fetchByIdDoc(ownerId, vehicleId);
    if (!vehicle) return null;
    vehicle.status = "REMOVAL_REQUESTED";
    await vehicle.save();
    return vehicle;
  };

  const counts = async (ownerId) => {
    const pipeline = [
      { $match: { ownerId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ];
    const rows = await models.Vehicle.aggregate(pipeline);
    const out = {};
    for (const r of rows) out[r._id] = r.count;
    return out;
  };

  return {
    list,
    fetchByIdLean,
    createDraft,
    update,
    requestRemoval,
    counts,
  };
};

