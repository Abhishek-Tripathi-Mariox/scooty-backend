const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["ADMIN", "STATION_ADMIN", "USER", "OWNER"],
      default: "USER",
      index: true,
    },
    type: {
      type: String,
      enum: [
        "BOOKING_PAYMENT",
        "WALLET_DEBIT",
        "WALLET_CREDIT",
        "REFERRAL_BONUS",
        "OWNER_EARNING",
        "PLATFORM_COMMISSION",
        "GST_COLLECTION",
        "PAYOUT_REQUEST",
        "SETTLEMENT_REQUEST",
        "REFUND",
      ],
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      default: "DEBIT",
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "PROCESSING", "REVERSED"],
      default: "SUCCESS",
      index: true,
    },
    amount: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    ownerAmount: { type: Number, default: 0 },
    platformAmount: { type: Number, default: 0 },
    sourceType: { type: String, default: "", index: true },
    stationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      default: null,
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: true,
    },
    referenceId: { type: String, default: "" },
    description: { type: String, default: "" },
    currency: { type: String, default: "INR" },
    balanceBefore: { type: Number, default: null },
    balanceAfter: { type: Number, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ role: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
