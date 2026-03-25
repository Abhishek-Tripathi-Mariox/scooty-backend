const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const AdminPanelService = require("../services/AdminPanelService");

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

const sanitizeAuthUser = (user) => {
  if (!user) return user;
  const data = user.toObject ? user.toObject() : { ...user };
  delete data.passwordHash;
  return data;
};

module.exports = {
  dashboard: async (req, res, next) => {
    const dashboard = await AdminPanelService().getDashboard({
      from: req.query.from,
      to: req.query.to,
    });
    req.rData = { dashboard };
    req.msg = "dashboard_stats_fetched";
    return ResponseMiddleware(req, res, next);
  },

  listUsers: async (req, res, next) => {
    const data = await AdminPanelService().listUsers({
      role: req.query.role,
      status: req.query.status,
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    req.msg = "users_list";
    return ResponseMiddleware(req, res, next);
  },

  updateUserStatus: async (req, res, next) => {
    const isActive = parseBoolean(req.body.isActive);
    if (isActive === null) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, "isActive must be boolean");
    }

    const user = await AdminPanelService().updateUserStatus({
      adminId: req.body.adminId,
      userId: req.params.userId,
      isActive,
      note: req.body.note,
    });
    if (!user) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { user: sanitizeAuthUser(user) };
    req.msg = "user_status_updated";
    return ResponseMiddleware(req, res, next);
  },

  getPricing: async (req, res, next) => {
    const pricing = await AdminPanelService().getPricing();
    req.rData = { pricing };
    return ResponseMiddleware(req, res, next, "pricing fetched successfully");
  },

  updatePricing: async (req, res, next) => {
    const pricing = await AdminPanelService().updatePricing({
      adminId: req.body.adminId,
      payload: req.body || {},
    });
    req.rData = { pricing };
    return ResponseMiddleware(req, res, next, "pricing updated successfully");
  },

  getCommission: async (req, res, next) => {
    const commission = await AdminPanelService().getCommission();
    req.rData = { commission };
    return ResponseMiddleware(req, res, next, "commission fetched successfully");
  },

  updateCommission: async (req, res, next) => {
    const commission = await AdminPanelService().updateCommission({
      adminId: req.body.adminId,
      payload: req.body || {},
    });
    req.rData = { commission };
    return ResponseMiddleware(req, res, next, "commission updated successfully");
  },

  listSettlements: async (req, res, next) => {
    const data = await AdminPanelService().listSettlements({
      status: req.query.status,
      userId: req.query.userId,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    return ResponseMiddleware(req, res, next, "settlements fetched successfully");
  },

  createSettlement: async (req, res, next) => {
    try {
      const settlement = await AdminPanelService().createSettlement({
        adminId: req.body.adminId,
        payload: req.body || {},
      });
      if (!settlement) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "User not found");
      }
      req.rData = { settlement };
      return ResponseMiddleware(req, res, next, "settlement created successfully");
    } catch (ex) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  updateSettlementStatus: async (req, res, next) => {
    try {
      const settlement = await AdminPanelService().updateSettlementStatus({
        adminId: req.body.adminId,
        settlementId: req.params.settlementId,
        status: req.body.status,
        note: req.body.note,
      });
      if (!settlement) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Settlement not found");
      }
      req.rData = { settlement };
      return ResponseMiddleware(req, res, next, "settlement updated successfully");
    } catch (ex) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  reports: async (req, res, next) => {
    const report = await AdminPanelService().getReports({
      from: req.query.from,
      to: req.query.to,
      stationId: req.query.stationId,
    });
    req.rData = { report };
    return ResponseMiddleware(req, res, next, "reports fetched successfully");
  },

  listAdmins: async (req, res, next) => {
    const data = await AdminPanelService().listAdmins({
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    return ResponseMiddleware(req, res, next, "admins fetched successfully");
  },

  createAdmin: async (req, res, next) => {
    try {
      const admin = await AdminPanelService().createAdmin({
        adminId: req.body.adminId,
        payload: req.body || {},
      });
      req.rData = { admin: sanitizeAuthUser(admin) };
      return ResponseMiddleware(req, res, next, "admin created successfully");
    } catch (ex) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  updateAdmin: async (req, res, next) => {
    try {
      const admin = await AdminPanelService().updateAdmin({
        adminId: req.body.adminId,
        targetAdminId: req.params.adminId,
        payload: req.body || {},
      });
      if (!admin) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Admin not found");
      }
      req.rData = { admin: sanitizeAuthUser(admin) };
      return ResponseMiddleware(req, res, next, "admin updated successfully");
    } catch (ex) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  listAuditLogs: async (req, res, next) => {
    const data = await AdminPanelService().listAuditLogs({
      action: req.query.action,
      entityType: req.query.entityType,
      adminId: req.query.adminId,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    return ResponseMiddleware(req, res, next, "audit logs fetched successfully");
  },

  listTransactions: async (req, res, next) => {
    const data = await AdminPanelService().listTransactions({
      type: req.query.type,
      from: req.query.from,
      to: req.query.to,
      stationId: req.query.stationId,
      userId: req.query.userId,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    return ResponseMiddleware(req, res, next, "transactions fetched successfully");
  },

  bookingInvoice: async (req, res, next) => {
    const invoice = await AdminPanelService().bookingInvoice({
      bookingId: req.params.bookingId,
    });
    if (!invoice) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Booking not found");
    }
    req.rData = { invoice };
    return ResponseMiddleware(req, res, next, "invoice fetched successfully");
  },

  bookingInvoicePdf: async (req, res, next) => {
    const invoice = await AdminPanelService().bookingInvoice({
      bookingId: req.params.bookingId,
    });
    if (!invoice) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Booking not found");
    }
    const pdf = require("../services/FinanceService")().generatePdfDocument({
      title: `Invoice ${invoice.invoiceNumber}`,
      invoice,
      footer: "Tax invoice generated by Movyra",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    return res.status(200).send(pdf);
  },

  bookingRefund: async (req, res, next) => {
    try {
      const booking = await AdminPanelService().updateBookingRefund({
        adminId: req.body.adminId,
        bookingId: req.params.bookingId,
        status: req.body.status,
        note: req.body.note,
        failureReason: req.body.failureReason,
        referenceId: req.body.referenceId,
        method: req.body.method,
      });
      if (!booking) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Booking not found");
      }
      req.rData = { booking };
      return ResponseMiddleware(req, res, next, "refund updated successfully");
    } catch (ex) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  ledger: async (req, res, next) => {
    const data = await AdminPanelService().listLedger({
      sourceType: req.query.sourceType,
      sourceId: req.query.sourceId,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    return ResponseMiddleware(req, res, next, "ledger fetched successfully");
  },
};
