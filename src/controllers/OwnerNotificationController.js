const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const OwnerNotificationService = require("../services/OwnerNotificationService");

module.exports = {
  list: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const type = req.query.type;
    const notifications = await OwnerNotificationService().list(ownerId, { type });
    req.rData = { notifications };
    req.msg = "notifications_list";
    return ResponseMiddleware(req, res, next);
  },

  markRead: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const notification = await OwnerNotificationService().markRead(ownerId, req.params.notificationId);
    if (!notification) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Notification not found");
    }
    req.rData = { notification };
    req.msg = "notification_read";
    return ResponseMiddleware(req, res, next);
  },
};

