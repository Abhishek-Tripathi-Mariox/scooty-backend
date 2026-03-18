const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const { models } = require("../models");
const fileUploadService = require("../util/s3");


module.exports = {
  me: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
    req.rData = { owner };
    req.msg = "profile_fetched";
    return ResponseMiddleware(req, res, next);
  },

  update: async (req, res, next) => {
    try {
      console.log("testiingggggg")
      const ownerId = req.body.ownerId;
      const { name, email,city, companyName, upiId,adress, state, pincode, accountHolderName, accountNumber, bankName, ifsc } = req.body || {};

      const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" });
      if (!owner) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Owner not found");
      }

      // Basic fields
      if (city) owner.city=city; 
      if (adress) owner.adress=adress;
      if (pincode) owner.pincode=pincode;
      if (state) owner.state=state;    

      if (typeof name === "string" && name.trim()) owner.name = name.trim();
      if (typeof companyName === "string" && companyName.trim()) owner.companyName = companyName.trim();

      // Email validation
      if (typeof email === "string") {
        const normalized = email.trim().toLowerCase();
        if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
          req.rCode = 0;
          return ResponseMiddleware(req, res, next, "Invalid email");
        }
        if (normalized) owner.email = normalized;
      }

      // Ensure bank object exists
      if (!owner.bank) owner.bank = {};

      // Bank fields from root body
      if (typeof accountHolderName === "string") owner.bank.accountHolderName = accountHolderName.trim();
      if (typeof accountNumber === "string") owner.bank.accountNumber = accountNumber.trim();
      if (typeof bankName === "string") owner.bank.bankName = bankName.trim();
      if (typeof ifsc === "string") owner.bank.ifsc = ifsc.trim();
      if (typeof upiId === "string") owner.bank.upiId = upiId.trim();
      
      // File uploads
      if (req.files) {
        if (req.files.profilePhoto) {
          const file = req.files.profilePhoto;
          const uploadRes = await fileUploadService.uploadFileToAws(file);
          owner.profilePhotoUrl = uploadRes.images?.[0] || owner.profilePhotoUrl;
        }
        if (req.files.adharFile) {
          const file = req.files.adharFile;
          const uploadRes = await fileUploadService.uploadFileToAws(file);
          owner.adharFile = uploadRes.images?.[0] || owner.adharFile;
        }
        if (req.files.panFile) {
          const file = req.files.panFile;
          const uploadRes = await fileUploadService.uploadFileToAws(file);
          owner.panFile = uploadRes.images?.[0] || owner.panFile;
        }
        if (req.files.bankFile) {
          const file = req.files.bankFile;
          const uploadRes = await fileUploadService.uploadFileToAws(file);
          owner.bank.file = uploadRes.images?.[0] || owner.bank.file;
        }
      }

      await owner.save();

      req.rData = { owner };
      req.msg = "profile_updated";
      return ResponseMiddleware(req, res, next);

    } catch (error) {
      console.error(error);
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "Something went wrong");
    }
  },
};
