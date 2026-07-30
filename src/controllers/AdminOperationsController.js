const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const StationAdminService = require("../services/StationAdminService");

module.exports = {
  listBookings: async (req, res, next) => {
    const data = await StationAdminService().listBookings({
      stationAdminId: req.body.adminId,
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
      stationAdminId: req.body.adminId,
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
        stationAdminId: req.body.adminId,
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
      stationAdminId: req.body.adminId,
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
      stationAdminId: req.body.adminId,
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
      stationAdminId: req.body.adminId,
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
        stationAdminId: req.body.adminId,
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
      stationAdminId: req.body.adminId,
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
        stationAdminId: req.body.adminId,
        ticketId: req.params.ticketId,
        status: req.body.status,
        actorRole: "ADMIN",
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
        stationAdminId: req.body.adminId,
        ticketId: req.params.ticketId,
        note: req.body.note || req.body.reason,
        actorRole: "ADMIN",
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
};
