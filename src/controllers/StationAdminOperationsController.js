const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const StationAdminService = require("../services/StationAdminService");

module.exports = {
  dashboard: async (req, res, next) => {
    const data = await StationAdminService().getDashboard({
      stationAdminId: req.body.stationAdminId,
      stationId: req.query.stationId,
    });
    if (!data) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station admin not found");
    }

    req.rData = { dashboard: data };
    req.msg = "dashboard_fetched";
    return ResponseMiddleware(req, res, next);
  },

  listBookings: async (req, res, next) => {
    const data = await StationAdminService().listBookings({
      stationAdminId: req.body.stationAdminId,
      stationId: req.query.stationId,
      status: req.query.status,
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    req.msg = "bookings_list";
    return ResponseMiddleware(req, res, next);
  },

  bookingDetail: async (req, res, next) => {
    const booking = await StationAdminService().getBooking({
      stationAdminId: req.body.stationAdminId,
      stationId: req.query.stationId,
      bookingId: req.params.bookingId,
    });
    if (!booking) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Booking not found");
    }

    req.rData = { booking };
    req.msg = "booking_detail";
    return ResponseMiddleware(req, res, next);
  },

  approveBooking: async (req, res, next) => {
    try {
      const booking = await StationAdminService().approveBooking({
        stationAdminId: req.body.stationAdminId,
        stationId: req.body.stationId || req.query.stationId,
        bookingId: req.params.bookingId,
        note: req.body.note,
      });
      if (!booking) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Booking not found");
      }

      req.rData = { booking };
      req.msg = "booking_approved";
      return ResponseMiddleware(req, res, next);
    } catch (ex) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  cancelBooking: async (req, res, next) => {
    const booking = await StationAdminService().cancelBooking({
      stationAdminId: req.body.stationAdminId,
      stationId: req.body.stationId || req.query.stationId,
      bookingId: req.params.bookingId,
      reason: req.body.reason,
    });
    if (!booking) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Booking not found");
    }

    req.rData = { booking };
    req.msg = "booking_cancelled";
    return ResponseMiddleware(req, res, next);
  },

  listRides: async (req, res, next) => {
    const data = await StationAdminService().listRides({
      stationAdminId: req.body.stationAdminId,
      stationId: req.query.stationId,
      status: req.query.status,
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    req.msg = "rides_list";
    return ResponseMiddleware(req, res, next);
  },

  rideDetail: async (req, res, next) => {
    const ride = await StationAdminService().getBooking({
      stationAdminId: req.body.stationAdminId,
      stationId: req.query.stationId,
      bookingId: req.params.rideId,
    });
    if (!ride) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Ride not found");
    }

    req.rData = { ride };
    req.msg = "ride_detail";
    return ResponseMiddleware(req, res, next);
  },

  forceEndRide: async (req, res, next) => {
    try {
      const ride = await StationAdminService().forceEndRide({
        stationAdminId: req.body.stationAdminId,
        stationId: req.body.stationId || req.query.stationId,
        bookingId: req.params.rideId,
        note: req.body.note,
      });
      if (!ride) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Ride not found");
      }

      req.rData = { ride };
      req.msg = "ride_force_ended";
      return ResponseMiddleware(req, res, next);
    } catch (ex) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  lockVehicle: async (req, res, next) => {
    const vehicle = await StationAdminService().lockVehicle({
      stationAdminId: req.body.stationAdminId,
      stationId: req.body.stationId || req.query.stationId,
      bookingId: req.params.rideId,
      note: req.body.note,
    });
    if (!vehicle) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Vehicle not found");
    }

    req.rData = { vehicle };
    req.msg = "vehicle_locked";
    return ResponseMiddleware(req, res, next);
  },

  listMaintenance: async (req, res, next) => {
    const data = await StationAdminService().listMaintenance({
      stationAdminId: req.body.stationAdminId,
      status: req.query.status,
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    req.msg = "maintenance_list";
    return ResponseMiddleware(req, res, next);
  },

  createMaintenance: async (req, res, next) => {
    try {
      const request = await StationAdminService().createMaintenance({
        stationAdminId: req.body.stationAdminId,
        payload: req.body || {},
        files: req.files || null,
      });
      if (!request) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Vehicle not found");
      }

      req.rData = { request };
      req.msg = "maintenance_created";
      return ResponseMiddleware(req, res, next);
    } catch (ex) {
      if (ex.code === "INVALID_VEHICLE") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "vehicleId is required");
      }
      if (ex.code === "VEHICLE_NOT_FOUND") {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, ex.message);
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  maintenanceDetail: async (req, res, next) => {
    const request = await StationAdminService().maintenanceDetail({
      stationAdminId: req.body.stationAdminId,
      requestId: req.params.requestId,
    });
    if (!request) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Maintenance request not found");
    }

    req.rData = { request };
    req.msg = "maintenance_detail";
    return ResponseMiddleware(req, res, next);
  },

  updateMaintenanceStatus: async (req, res, next) => {
    try {
      const request = await StationAdminService().updateMaintenanceStatus({
        stationAdminId: req.body.stationAdminId,
        requestId: req.params.requestId,
        status: req.body.status,
        resolutionNote: req.body.resolutionNote || req.body.note,
      });
      if (!request) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Maintenance request not found");
      }

      req.rData = { request };
      req.msg = "maintenance_updated";
      return ResponseMiddleware(req, res, next);
    } catch (ex) {
      if (ex.code === "INVALID_MAINTENANCE_STATUS") {
        req.rCode = 0;
        return ResponseMiddleware(req, res, next, "Invalid maintenance status");
      }
      if (ex.code === "MAINTENANCE_REQUEST_NOT_FOUND") {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, ex.message);
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  listNotifications: async (req, res, next) => {
    const notifications = await StationAdminService().listNotifications({
      stationAdminId: req.body.stationAdminId,
      type: req.query.type,
    });
    req.rData = { notifications };
    req.msg = "notifications_list";
    return ResponseMiddleware(req, res, next);
  },

  markNotificationRead: async (req, res, next) => {
    const notification = await StationAdminService().markNotificationRead({
      stationAdminId: req.body.stationAdminId,
      notificationId: req.params.notificationId,
    });
    if (!notification) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Notification not found");
    }

    req.rData = { notification };
    req.msg = "notification_read";
    return ResponseMiddleware(req, res, next);
  },

  markAllNotificationsRead: async (req, res, next) => {
    const result = await StationAdminService().markAllNotificationsRead({
      stationAdminId: req.body.stationAdminId,
      type: req.body.type || req.query.type,
    });
    req.rData = { result };
    req.msg = "notifications_marked_read";
    return ResponseMiddleware(req, res, next);
  },

  listSupportTickets: async (req, res, next) => {
    const data = await StationAdminService().listSupportTickets({
      status: req.query.status,
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    req.msg = "support_tickets_list";
    return ResponseMiddleware(req, res, next);
  },

  supportTicketDetail: async (req, res, next) => {
    const ticket = await StationAdminService().supportTicketDetail({
      ticketId: req.params.ticketId,
    });
    if (!ticket) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Ticket not found");
    }
    req.rData = { ticket };
    req.msg = "support_ticket_detail";
    return ResponseMiddleware(req, res, next);
  },

  updateSupportTicket: async (req, res, next) => {
    try {
      const ticket = await StationAdminService().updateSupportTicket({
        ticketId: req.params.ticketId,
        status: req.body.status,
      });
      if (!ticket) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Ticket not found");
      }
      req.rData = { ticket };
      req.msg = "support_ticket_updated";
      return ResponseMiddleware(req, res, next);
    } catch (ex) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  escalateSupportTicket: async (req, res, next) => {
    try {
      const ticket = await StationAdminService().escalateSupportTicket({
        ticketId: req.params.ticketId,
        note: req.body.note || req.body.reason,
      });
      if (!ticket) {
        req.rCode = 5;
        return ResponseMiddleware(req, res, next, "Ticket not found");
      }

      req.rData = { ticket };
      req.msg = "support_ticket_escalated";
      return ResponseMiddleware(req, res, next);
    } catch (ex) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  reports: async (req, res, next) => {
    const report = await StationAdminService().reports({
      stationAdminId: req.body.stationAdminId,
      stationId: req.query.stationId,
      from: req.query.from,
      to: req.query.to,
      q: req.query.q,
    });
    req.rData = { report };
    req.msg = "reports_fetched";
    return ResponseMiddleware(req, res, next);
  },
};
