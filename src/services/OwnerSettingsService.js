const { models } = require("../models");

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

    const incoming = payload.settings || payload;
    owner.settings = { ...(owner.settings || defaultSettings()), ...(incoming || {}) };

    // allow updating language from settings payload too
    if (typeof payload.language === "string" && payload.language.trim()) {
      owner.language = payload.language.trim();
    }

    await owner.save();
    return owner.settings;
  };

  return { fetch, update };
};

