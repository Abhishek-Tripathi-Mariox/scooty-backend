const mongoose = require("mongoose");

const MaintenanceRequestSchema = new mongoose.Schema(
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
    stationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      index: true,
    },
    issueType: {
      type: String,
      enum: ["BATTERY", "BRAKE", "TIRE", "ELECTRICAL", "BODY", "MOTOR", "OTHER"],
      default: "OTHER",
      index: true,
    },
    description: { type: String, default: "" },
    estimatedCost: { type: Number, default: null },
    photoUrls: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "COMPLETED", "REJECTED"],
      default: "OPEN",
      index: true,
    },
    resolutionNote: { type: String, default: "" },
  },
  { timestamps: true },
);

MaintenanceRequestSchema.index({ userId: 1, createdAt: -1 });
MaintenanceRequestSchema.index({ stationId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("MaintenanceRequest", MaintenanceRequestSchema);
