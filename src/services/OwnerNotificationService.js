const { models } = require("../models");

module.exports = () => {
  const list = async (ownerId, { type } = {}) => {
    const query = { userId: ownerId };
    if (type) query.type = type;
    return await models.Notification.find(query).sort({ createdAt: -1 }).limit(100).lean();
  };

  const markRead = async (ownerId, notificationId) => {
    const doc = await models.Notification.findOne({ _id: notificationId, userId: ownerId });
    if (!doc) return null;
    doc.isRead = true;
    await doc.save();
    return doc;
  };

  return { list, markRead };
};
