const { models } = require("../models");
const fileUploadService = require("../util/s3");

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));

module.exports = () => {
  const fetchOwnerLeanById = async (ownerId) => {
    return await models.User.findOne({ _id: ownerId, role: "OWNER" }).select({ bank: 0 }).lean();
  };

  const fetchOwnerDocById = async (ownerId) => {
    return await models.User.findOne({ _id: ownerId, role: "OWNER" });
  };

  const emailInUse = async (email, excludeUserId) => {
    if (!email) return false;
    const query = { email: String(email).trim().toLowerCase() };
    if (excludeUserId) query._id = { $ne: excludeUserId };
    const exists = await models.User.exists(query);
    return exists ? true : false;
  };

  const updateOwnerProfile = async ({ ownerId, payload = {}, files = null }) => {
    const owner = await fetchOwnerDocById(ownerId);
    if (!owner) return null;

    const { name, email, city, companyName, adress, state, pincode } = payload || {};

    if (typeof city === "string") owner.city = city.trim();
    if (typeof adress === "string") owner.adress = adress.trim();
    if (typeof state === "string") owner.state = state.trim();
    if (typeof pincode === "string") owner.pincode = pincode.trim();

    if (typeof name === "string" && name.trim()) owner.name = name.trim();
    if (typeof companyName === "string" && companyName.trim()) owner.companyName = companyName.trim();

    if (typeof email === "string") {
      const normalized = email.trim().toLowerCase();
      if (normalized && !isValidEmail(normalized)) {
        const err = new Error("Invalid email");
        err.code = "INVALID_EMAIL";
        throw err;
      }
      if (normalized) {
        const inUse = await emailInUse(normalized, owner._id);
        if (inUse) {
          const err = new Error("Email already in use");
          err.code = "EMAIL_IN_USE";
          throw err;
        }
        owner.email = normalized;
      } else {
        owner.email = undefined;
      }
    }

    if (files) {
      if (files.profilePhoto) {
        const uploadRes = await fileUploadService.uploadFileToAws(files.profilePhoto);
        owner.profilePhotoUrl = uploadRes.images?.[0] || owner.profilePhotoUrl;
      }
      if (files.adharFile) {
        const uploadRes = await fileUploadService.uploadFileToAws(files.adharFile);
        owner.adharFile = uploadRes.images?.[0] || owner.adharFile;
      }
      if (files.panFile) {
        const uploadRes = await fileUploadService.uploadFileToAws(files.panFile);
        owner.panFile = uploadRes.images?.[0] || owner.panFile;
      }
    }

    await owner.save();
    return owner;
  };

  return {
    fetchOwnerLeanById,
    fetchOwnerDocById,
    updateOwnerProfile,
  };
};
