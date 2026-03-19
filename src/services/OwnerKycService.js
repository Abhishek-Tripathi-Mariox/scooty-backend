const { models } = require("../models");
const fileUploadService = require("../util/s3");

module.exports = () => {
  const fetchOwnerKyc = async (ownerId) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
    if (!owner) return null;

    return {
      status: owner.kycStatus,
      rejectionReason: owner.kycRejectionReason || "",
      submittedAt: owner.kycSubmittedAt || null,
      verifiedAt: owner.kycVerifiedAt || null,
      documents: {
        profilePhotoUrl: owner.profilePhotoUrl || "",
        adharFile: owner.adharFile || "",
        panFile: owner.panFile || "",
      },
    };
  };

  const submitOwnerKyc = async ({ ownerId, files = null }) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" });
    if (!owner) return null;

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

    owner.kycStatus = "PENDING";
    owner.kycRejectionReason = "";
    owner.kycSubmittedAt = new Date();
    owner.kycVerifiedAt = undefined;

    await owner.save();
    return await fetchOwnerKyc(ownerId);
  };

  return {
    fetchOwnerKyc,
    submitOwnerKyc,
  };
};

