const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const AdminPanelService = require("../services/AdminPanelService");

const toInt = (value, fallback) => {
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  list: async (req, res, next) => {
    const data = await AdminPanelService().listAdminNotifications({
      adminId: req.body.adminId,
      type: req.query.type,
      page: toInt(req.query.page, 1),
      limit: toInt(req.query.limit, 100),
    });
    req.rData = data;
    return ResponseMiddleware(req, res, next, "notifications fetched successfully");
  },

  markRead: async (req, res, next) => {
    const notification = await AdminPanelService().markAdminNotificationRead({
      adminId: req.body.adminId,
      notificationId: req.params.notificationId,
    });
    if (!notification) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Notification not found");
    }
    req.rData = { notification };
    return ResponseMiddleware(req, res, next, "notification marked as read");
  },

  markAllRead: async (req, res, next) => {
    const result = await AdminPanelService().markAllAdminNotificationsRead({
      adminId: req.body.adminId,
      type: req.query.type,
    });
    req.rData = { result };
    return ResponseMiddleware(req, res, next, "notifications marked as read");
  },
};
