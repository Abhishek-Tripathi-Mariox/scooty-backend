const mongoose = require("mongoose");

const RidePlanSchema = new mongoose.Schema(
  {
    stationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["HOURLY", "DAY_PASS", "WEEKLY", "MONTHLY"],
      default: "HOURLY",
      index: true,
    },
    durationHours: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    securityDeposit: { type: Number, default: 0, min: 0 },
    description: { type: String, default: "" },
    perks: { type: [String], default: [] },
    badge: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true },
);

RidePlanSchema.index({ stationId: 1, status: 1, createdAt: -1 });
RidePlanSchema.index({ code: 1, stationId: 1 }, { unique: true });

module.exports = mongoose.model("RidePlan", RidePlanSchema);
