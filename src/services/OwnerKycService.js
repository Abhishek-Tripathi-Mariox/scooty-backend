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
        adharFile: owner.adharFile || "", // Aadhaar front
        adharBackFile: owner.adharBackFile || "",
        panFile: owner.panFile || "",
      },
    };
  };

  const submitOwnerKyc = async ({ ownerId, files = null }) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" });
    if (!owner) return null;

    // Owner KYC: Aadhaar front + back, PAN and profile photo are mandatory.
    // No driving licence for owners. `adharFrontFile` is an alias of `adharFile`.
    const uploads = [
      ["profilePhotoUrl", files?.profilePhoto],
      ["adharFile", files?.adharFile || files?.adharFrontFile],
      ["adharBackFile", files?.adharBackFile],
      ["panFile", files?.panFile],
    ];
    for (const [field, file] of uploads) {
      if (!file) continue;
      const uploadRes = await fileUploadService.uploadFileToAws(file);
      owner[field] = uploadRes.images?.[0] || owner[field];
    }

    const missing = [
      ["adharFile", "Aadhaar card (front)"],
      ["adharBackFile", "Aadhaar card (back)"],
      ["panFile", "PAN card"],
      ["profilePhotoUrl", "Profile photo"],
    ]
      .filter(([field]) => !owner[field])
      .map(([, label]) => label);
    if (missing.length) {
      const err = new Error(`Please upload: ${missing.join(", ")}`);
      err.code = "KYC_DOCS_REQUIRED";
      throw err;
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

