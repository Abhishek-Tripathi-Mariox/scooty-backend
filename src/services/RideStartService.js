const { models } = require("../models");
const AuditLogService = require("./AuditLogService");
const FinanceService = require("./FinanceService");

/**
 * Shared "ride goes ACTIVE" step used by the station-admin / admin OTP flow.
 * Expects a Booking document (not lean) that is already validated as CONFIRMED.
 */
module.exports = () => {
  const activateRide = async ({ booking, actorId, actorRole = "STATION_ADMIN", meta = {} }) => {
    const before = booking.toObject();

    // Cash is collected at the station when the scooty is picked up — mark
    // the payment PAID now and record it in finance.
    const collectPaymentNow = booking.payment?.status !== "PAID";
    if (collectPaymentNow) {
      booking.payment = {
        ...booking.payment,
        status: "PAID",
        method: booking.payment?.method || "CASH",
        referenceId: booking.payment?.referenceId || `CASH-${Date.now()}`,
        paidAmount: booking.pricing?.totalPayable || 0,
        paidAt: new Date(),
      };
    }

    booking.status = "ACTIVE";
    booking.rideStartedAt = new Date();
    booking.meta = {
      ...(booking.meta || {}),
      rideStartedBy: actorRole,
      rideStartedById: actorId,
      ...meta,
    };
    await booking.save();

    if (collectPaymentNow) {
      const finance = FinanceService();
      await finance.recordTransaction({
        userId: booking.userId,
        role: "USER",
        type: "BOOKING_PAYMENT",
        direction: "DEBIT",
        status: "SUCCESS",
        amount: booking.pricing?.totalPayable || 0,
        taxAmount: booking.pricing?.tax || 0,
        sourceType: "Booking",
        sourceId: booking._id,
        bookingId: booking._id,
        referenceId: booking.payment?.referenceId || "",
        description: `Payment for ${booking.planName || booking.planCode || "ride"} booking`,
        meta: { bookingId: booking._id },
        stationId: booking.pickupStationId,
        createdAt: booking.payment?.paidAt || new Date(),
      });
      await finance.postBookingPaymentJournal({
        booking,
        walletUsed: booking.pricing?.walletUsed || 0,
        paidAmount: booking.pricing?.totalPayable || 0,
      });
    }

    await models.Vehicle.updateOne({ _id: booking.vehicleId }, { $set: { status: "IN_RIDE" } });

    await models.Notification.create({
      userId: booking.userId,
      type: "RIDE",
      title: "Ride started",
      message: "Your scooty ride has started. Ride safe.",
      meta: { bookingId: booking._id },
    });

    await AuditLogService().create({
      actorId,
      actorRole,
      action: "RIDE_STARTED",
      entityType: "Booking",
      entityId: booking._id,
      before,
      after: booking.toObject(),
      meta,
    });

    return booking;
  };

  return { activateRide };
};
