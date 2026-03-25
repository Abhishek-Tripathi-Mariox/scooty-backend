const { models } = require("../models");
const AuditLogService = require("./AuditLogService");

const defaultSettings = () => ({
  notifications: {
    rideUpdates: true,
    0: true,
    payout: true,
    promotions: true,
    maintenance: true,
  },
});

module.exports = () => {
  const fetch = async (ownerId) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" }).lean();
    if (!owner) return null;
    return owner.settings || defaultSettings();
  };

  const update = async (ownerId, payload = {}) => {
    const owner = await models.User.findOne({ _id: ownerId, role: "OWNER" });
    if (!owner) return null;
    const before = owner.toObject();

    const incoming = payload.settings || payload;
    owner.settings = { ...(owner.settings || defaultSettings()), ...(incoming || {}) };

    // allow updating language from settings payload too
    if (typeof payload.language === "string" && payload.language.trim()) {
      owner.language = payload.language.trim();
    }

    await owner.save();
    await AuditLogService().create({
      actorId: ownerId,
      actorRole: "OWNER",
      action: "OWNER_SETTINGS_UPDATED",
      entityType: "User",
      entityId: owner._id,
      before,
      after: owner.toObject(),
    });
    return owner.settings;
  };

  return { fetch, update };
};
