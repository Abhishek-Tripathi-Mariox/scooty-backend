const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const UserService = require("../services/UserService");
const fileUploadService = require("../util/s3");
module.exports = {
  profile: async (req, res, next) => {
    const userId = req.body.userId;
    const user = await UserService().fetchById(userId);

    if (!user) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { user };
    req.msg = "profile_fetched";
    return ResponseMiddleware(req, res, next);
  },

  update: async (req, res, next) => {
    const userId = req.body.userId;
    const { name, language, email, profilePhotoUrl } = req.body || {};
    const userService = UserService();
    const user = await userService.fetchDocByQuery({ _id: userId });
    if (!user) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    if (typeof name === "string") user.name = name.trim() || user.name;
    if (typeof language === "string" && language.trim()) {
      user.language = language.trim();
    }

    if (typeof email === "string") {
      const normalized = email.trim().toLowerCase();
      if (normalized) {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
        if (!isValid) {
          req.rCode = 0;
          return ResponseMiddleware(req, res, next, "Invalid email");
        }
        const inUse = await userService.emailInUse(normalized, user._id);
        if (inUse) {
          req.rCode = 0;
          return ResponseMiddleware(req, res, next, "Email already in use");
        }
        user.email = normalized;
      } else {
        user.email = undefined;
      }
    }

    // Option 1: direct URL provided by client
    if (typeof profilePhotoUrl === "string") {
      const url = profilePhotoUrl.trim();
      user.profilePhotoUrl = url || undefined;
    }

    // Option 2: multipart upload `profilePhoto` (requires express-fileupload)
    if (req.files && req.files.profilePhoto) {
      const file = req.files.profilePhoto;
      const uploadRes = await fileUploadService.uploadFileToAws(file);
      user.profilePhotoUrl = uploadRes.images?.[0] || user.profilePhotoUrl;
    }

    await user.save();

    req.rData = { user };
    req.msg = "profile_updated";
    return ResponseMiddleware(req, res, next);
  },
};
