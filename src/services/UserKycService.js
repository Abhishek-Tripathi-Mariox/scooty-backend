const { models } = require("../models");
const fileUploadService = require("../util/s3");

module.exports = () => {
  const fetchUserKyc = async (userId) => {
    const user = await models.User.findOne({ _id: userId, role: "USER" }).lean();
    if (!user) return null;

    return {
      status: user.kycStatus,
      rejectionReason: user.kycRejectionReason || "",
      submittedAt: user.kycSubmittedAt || null,
      verifiedAt: user.kycVerifiedAt || null,
      documents: {
        profilePhotoUrl: user.profilePhotoUrl || "",
        adharFile: user.adharFile || "",
        panFile: user.panFile || "",
      },
    };
  };

  const submitUserKyc = async ({ userId, files = null }) => {
    const user = await models.User.findOne({ _id: userId, role: "USER" });
    if (!user) return null;

    if (files) {
      if (files.profilePhoto) {
        const uploadRes = await fileUploadService.uploadFileToAws(files.profilePhoto);
        user.profilePhotoUrl = uploadRes.images?.[0] || user.profilePhotoUrl;
      }
      if (files.adharFile) {
        const uploadRes = await fileUploadService.uploadFileToAws(files.adharFile);
        user.adharFile = uploadRes.images?.[0] || user.adharFile;
      }
      if (files.panFile) {
        const uploadRes = await fileUploadService.uploadFileToAws(files.panFile);
        user.panFile = uploadRes.images?.[0] || user.panFile;
      }
    }

    user.kycStatus = "PENDING";
    user.kycRejectionReason = "";
    user.kycSubmittedAt = new Date();
    user.kycVerifiedAt = undefined;

    await user.save();
    return await fetchUserKyc(userId);
  };

  return {
    fetchUserKyc,
    submitUserKyc,
  };
};
