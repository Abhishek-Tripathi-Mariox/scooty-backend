const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const UserService = require("../services/UserService");
const UserAppService = require("../services/UserAppService");
const fileUploadService = require("../util/s3");
module.exports = {
  dashboard: async (req, res, next) => {
    const dashboard = await UserAppService().getDashboard({
      userId: req.body.userId,
    });
    if (!dashboard) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { dashboard };
    req.msg = "dashboard_fetched";
    return ResponseMiddleware(req, res, next);
  },

  profile: async (req, res, next) => {
    const userId = req.body.userId;
    const [user, dashboard] = await Promise.all([
      UserService().fetchById(userId),
      UserAppService().getDashboard({ userId }),
    ]);

    if (!user) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { user, dashboard };
    req.msg = "profile_fetched";
    return ResponseMiddleware(req, res, next);
  },

  update: async (req, res, next) => {
    const userId = req.body.userId;
    const { name, address, adress, city, language, email, profilePhotoUrl } = req.body || {};
    const userService = UserService();
    const user = await userService.fetchDocByQuery({ _id: userId });
    if (!user) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    if (typeof name === "string") user.name = name.trim() || user.name;
    if (typeof address === "string") user.adress = address.trim() || user.adress;
    if (typeof adress === "string") user.adress = adress.trim() || user.adress;
    if (typeof city === "string") user.city = city.trim() || user.city;
    if (typeof language === "string" && language.trim()) {
      const normalizedLanguage = language.trim();
      user.settings = user.settings || {};
      user.settings.language = normalizedLanguage;
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

    const dashboard = await UserAppService().getDashboard({ userId });
    req.rData = { user: user.toObject(), dashboard };
    req.msg = "profile_updated";
    return ResponseMiddleware(req, res, next);
  },

  plans: async (req, res, next) => {
    const plans = await UserAppService().listPlans({ stationId: req.query.stationId });
    req.rData = { plans };
    req.msg = "plans_list";
    return ResponseMiddleware(req, res, next);
  },

  stations: async (req, res, next) => {
    const stations = await UserAppService().listStations({
      lat: req.query.lat ?? req.query.latitude,
      lng: req.query.lng ?? req.query.longitude,
      search: req.query.search,
      city: req.query.city,
      state: req.query.state,
      radiusKm: req.query.radiusKm,
    });
    req.rData = { stations };
    req.msg = "stations_list";
    return ResponseMiddleware(req, res, next);
  },

  stationDetail: async (req, res, next) => {
    const data = await UserAppService().stationDetail(req.params.stationId);
    if (!data) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Station not found");
    }

    req.rData = data;
    req.msg = "station_detail";
    return ResponseMiddleware(req, res, next);
  },

  rideDetail: async (req, res, next) => {
    const ride = await UserAppService().rideDetail({
      userId: req.body.userId,
      rideId: req.params.rideId,
    });
    if (!ride) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Ride not found");
    }

    req.rData = { ride };
    req.msg = "ride_detail";
    return ResponseMiddleware(req, res, next);
  },

  timeSlots: async (req, res, next) => {
    const timeSlots = await UserAppService().listTimeSlots({
      date: req.query.date,
      planCode: req.query.planCode,
      stationId: req.query.stationId,
    });
    req.rData = timeSlots;
    req.msg = "time_slots_list";
    return ResponseMiddleware(req, res, next);
  },

  bookingQuote: async (req, res, next) => {
    const quote = await UserAppService().generateQuote({
      userId: req.body.userId,
      payload: req.body || {},
    });
    req.rData = { quote };
    req.msg = "booking_quote";
    return ResponseMiddleware(req, res, next);
  },

  createBooking: async (req, res, next) => {
    const booking = await UserAppService().createBooking({
      userId: req.body.userId,
      payload: req.body || {},
    });
    req.rData = { booking };
    req.msg = "booking_created";
    return ResponseMiddleware(req, res, next);
  },

  bookings: async (req, res, next) => {
    const bookings = await UserAppService().listBookings({
      userId: req.body.userId,
      status: req.query.status,
    });
    req.rData = { bookings };
    req.msg = "booking_list";
    return ResponseMiddleware(req, res, next);
  },

  bookingDetail: async (req, res, next) => {
    const booking = await UserAppService().fetchBooking({
      userId: req.body.userId,
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

  confirmPayment: async (req, res, next) => {
    const booking = await UserAppService().confirmPayment({
      userId: req.body.userId,
      bookingId: req.params.bookingId,
      paymentMethod: req.body.paymentMethod,
      paymentReferenceId: req.body.paymentReferenceId,
    });
    if (!booking) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Booking not found");
    }

    req.rData = { booking };
    req.msg = "payment_confirmed";
    return ResponseMiddleware(req, res, next);
  },

  startRide: async (req, res, next) => {
    const booking = await UserAppService().startRide({
      userId: req.body.userId,
      bookingId: req.params.bookingId,
      unlockCode: req.body.unlockCode || req.body.code,
    });
    if (!booking) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Booking not found");
    }

    req.rData = { booking };
    req.msg = "ride_started";
    return ResponseMiddleware(req, res, next);
  },

  completeRide: async (req, res, next) => {
    // Parking proof photo may arrive as a multipart file upload. The upload
    // is best-effort: if it fails (e.g. storage misconfigured), the ride
    // still completes — just without the proof photo.
    let parkingPhotoUrl = req.body.parkingPhotoUrl;
    if (req.files && req.files.parkingPhoto) {
      try {
        const uploadRes = await fileUploadService.uploadFileToAws(req.files.parkingPhoto);
        parkingPhotoUrl = uploadRes.images?.[0] || parkingPhotoUrl;
      } catch (uploadError) {
        console.error("Parking photo upload failed:", uploadError.message);
      }
    }

    const booking = await UserAppService().completeRide({
      userId: req.body.userId,
      bookingId: req.params.bookingId,
      dropStationId: req.body.dropStationId,
      parkingPhotoUrl,
      rating: req.body.rating,
      review: req.body.review,
    });
    if (!booking) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Booking not found");
    }

    req.rData = { booking };
    req.msg = "ride_completed";
    return ResponseMiddleware(req, res, next);
  },

  cancelBooking: async (req, res, next) => {
    try {
      const booking = await UserAppService().cancelBooking({
        userId: req.body.userId,
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
    } catch (error) {
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, error.message || "Unable to cancel booking");
    }
  },

  rideHistory: async (req, res, next) => {
    const rides = await UserAppService().rideHistory({
      userId: req.body.userId,
    });
    req.rData = { rides };
    req.msg = "ride_history";
    return ResponseMiddleware(req, res, next);
  },

  transactions: async (req, res, next) => {
    const data = await UserAppService().transactionHistory({
      userId: req.body.userId,
      type: req.query.type,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.rData = data;
    req.msg = "transactions_list";
    return ResponseMiddleware(req, res, next);
  },

  bookingInvoice: async (req, res, next) => {
    const invoice = await UserAppService().bookingInvoice({
      userId: req.body.userId,
      bookingId: req.params.bookingId,
    });
    if (!invoice) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Booking not found");
    }

    req.rData = { invoice };
    req.msg = "invoice_fetched";
    return ResponseMiddleware(req, res, next);
  },

  bookingRefund: async (req, res, next) => {
    const refund = await UserAppService().bookingRefund({
      userId: req.body.userId,
      bookingId: req.params.bookingId,
    });
    if (!refund) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Booking not found");
    }

    req.rData = { refund };
    req.msg = "refund_fetched";
    return ResponseMiddleware(req, res, next);
  },

  settings: async (req, res, next) => {
    const settings = await UserAppService().getSettings({
      userId: req.body.userId,
    });
    if (!settings) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { settings };
    req.msg = "settings_fetched";
    return ResponseMiddleware(req, res, next);
  },

  updateSettings: async (req, res, next) => {
    const user = await UserAppService().updateSettings({
      userId: req.body.userId,
      payload: req.body || {},
    });
    if (!user) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { user };
    req.msg = "settings_updated";
    return ResponseMiddleware(req, res, next);
  },

  location: async (req, res, next) => {
    const settings = await UserAppService().getSettings({
      userId: req.body.userId,
    });
    if (!settings) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { location: settings.location };
    req.msg = "location_fetched";
    return ResponseMiddleware(req, res, next);
  },

  updateLocation: async (req, res, next) => {
    const user = await UserAppService().updateLocation({
      userId: req.body.userId,
      payload: req.body || {},
    });
    if (!user) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { user };
    req.msg = "location_updated";
    return ResponseMiddleware(req, res, next);
  },

  bookingInvoicePdf: async (req, res, next) => {
    const invoice = await UserAppService().bookingInvoice({
      userId: req.body.userId,
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

  bookingReceiptPdf: async (req, res, next) => {
    const invoice = await UserAppService().bookingInvoice({
      userId: req.body.userId,
      bookingId: req.params.bookingId,
    });
    if (!invoice) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Booking not found");
    }

    const pdf = require("../services/FinanceService")().generatePdfDocument({
      title: `Receipt ${invoice.receiptNumber}`,
      invoice,
      footer: "Payment receipt generated by Movyra",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.receiptNumber}.pdf"`);
    return res.status(200).send(pdf);
  },

  referralSummary: async (req, res, next) => {
    const referral = await UserAppService().referralSummary({
      userId: req.body.userId,
    });
    if (!referral) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { referral };
    req.msg = "referral_fetched";
    return ResponseMiddleware(req, res, next);
  },

  applyReferralCode: async (req, res, next) => {
    const referral = await UserAppService().applyReferralCode({
      userId: req.body.userId,
      referralCode: req.body.referralCode,
    });
    if (!referral) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { referral };
    req.msg = "referral_applied";
    return ResponseMiddleware(req, res, next);
  },

  notifications: async (req, res, next) => {
    const notifications = await UserAppService().listNotifications({
      userId: req.body.userId,
      type: req.query.type,
    });
    req.rData = { notifications };
    req.msg = "notifications_list";
    return ResponseMiddleware(req, res, next);
  },

  markAllNotificationsRead: async (req, res, next) => {
    const result = await UserAppService().markAllNotificationsRead({
      userId: req.body.userId,
      type: req.query.type,
    });

    req.rData = { result };
    req.msg = "notification_read";
    return ResponseMiddleware(req, res, next);
  },

  markNotificationRead: async (req, res, next) => {
    const notification = await UserAppService().markNotificationRead({
      userId: req.body.userId,
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

  faqs: async (req, res, next) => {
    const faqs = await UserAppService().listFaqs({
      stationId: req.query.stationId,
    });
    req.rData = { faqs };
    req.msg = "faqs_list";
    return ResponseMiddleware(req, res, next);
  },

  tickets: async (req, res, next) => {
    const tickets = await UserAppService().listTickets({
      userId: req.body.userId,
    });
    req.rData = { tickets };
    req.msg = "tickets_list";
    return ResponseMiddleware(req, res, next);
  },

  createTicket: async (req, res, next) => {
    const ticket = await UserAppService().createTicket({
      userId: req.body.userId,
      subject: req.body.subject,
      message: req.body.message,
    });
    req.rData = { ticket };
    req.msg = "ticket_created";
    return ResponseMiddleware(req, res, next);
  },

  ticketDetail: async (req, res, next) => {
    const ticket = await UserAppService().fetchTicket({
      userId: req.body.userId,
      ticketId: req.params.ticketId,
    });
    if (!ticket) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Ticket not found");
    }

    req.rData = { ticket };
    req.msg = "ticket_detail";
    return ResponseMiddleware(req, res, next);
  },

  walletSummary: async (req, res, next) => {
    const wallet = await UserAppService().walletSummary({
      userId: req.body.userId,
    });
    if (!wallet) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "User not found");
    }

    req.rData = { wallet };
    return ResponseMiddleware(req, res, next, "wallet summary fetched successfully");
  },
};
