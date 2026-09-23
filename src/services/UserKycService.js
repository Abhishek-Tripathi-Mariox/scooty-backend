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
        adharFile: user.adharFile || "", // Aadhaar front
        adharBackFile: user.adharBackFile || "",
        drivingLicenseFile: user.drivingLicenseFile || "",
        panFile: user.panFile || "", // optional
      },
    };
  };

  const submitUserKyc = async ({ userId, files = null }) => {
    const user = await models.User.findOne({ _id: userId, role: "USER" });
    if (!user) return null;

    // Rider KYC: Aadhaar front + back, driving licence and profile photo are
    // mandatory; PAN is optional. `adharFrontFile` is accepted as an alias of
    // `adharFile` (the front side).
    const uploads = [
      ["profilePhotoUrl", files?.profilePhoto],
      ["adharFile", files?.adharFile || files?.adharFrontFile],
      ["adharBackFile", files?.adharBackFile],
      ["drivingLicenseFile", files?.drivingLicenseFile],
      ["panFile", files?.panFile],
    ];
    for (const [field, file] of uploads) {
      if (!file) continue;
      const uploadRes = await fileUploadService.uploadFileToAws(file);
      user[field] = uploadRes.images?.[0] || user[field];
    }

    const missing = [
      ["adharFile", "Aadhaar card (front)"],
      ["adharBackFile", "Aadhaar card (back)"],
      ["drivingLicenseFile", "Driving license"],
      ["profilePhotoUrl", "Profile photo"],
    ]
      .filter(([field]) => !user[field])
      .map(([, label]) => label);
    if (missing.length) {
      const err = new Error(`Please upload: ${missing.join(", ")}`);
      err.code = "KYC_DOCS_REQUIRED";
      throw err;
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
