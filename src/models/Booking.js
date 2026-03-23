const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    pickupStationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      required: true,
      index: true,
    },
    dropStationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      index: true,
    },
    planCode: { type: String, required: true, index: true },
    planName: { type: String, default: "" },
    planType: {
      type: String,
      enum: ["HOURLY", "DAY_PASS", "WEEKLY", "MONTHLY"],
      default: "HOURLY",
    },
    date: { type: String, default: "" },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"],
      default: "PENDING_PAYMENT",
      index: true,
    },
    pricing: {
      baseFare: { type: Number, default: 0 },
      securityDeposit: { type: Number, default: 0 },
      convenienceFee: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      referralDiscount: { type: Number, default: 0 },
      walletUsed: { type: Number, default: 0 },
      totalPayable: { type: Number, default: 0 },
    },
    payment: {
      status: {
        type: String,
        enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
        default: "PENDING",
      },
      method: { type: String, default: "" },
      referenceId: { type: String, default: "" },
      paidAmount: { type: Number, default: 0 },
      paidAt: { type: Date },
    },
    unlockCode: { type: String, default: "" },
    parkingPhotoUrl: { type: String, default: "" },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, default: "" },
    rideStartedAt: { type: Date },
    rideEndedAt: { type: Date },
    actualDurationMinutes: { type: Number, default: 0 },
    referralCodeApplied: { type: String, default: "" },
    offerCodeApplied: { type: String, default: "" },
    meta: { type: Object, default: {} },
  },
  { timestamps: true },
);

BookingSchema.index({ userId: 1, createdAt: -1 });
BookingSchema.index({ pickupStationId: 1, status: 1, startAt: 1 });
BookingSchema.index({ vehicleId: 1, status: 1, startAt: 1 });

module.exports = mongoose.model("Booking", BookingSchema);
