const mongoose = require("mongoose");

const VehicleSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station", index: true },

    modelName: { type: String, default: "" },
    registrationNumber: { type: String, default: "", index: true },
    chassisNumber: { type: String, default: "" },
    batteryPercent: { type: Number, default: null },
    locationLabel: { type: String, default: "" },

    photos: {
      frontUrl: { type: String, default: "" },
      sideUrl: { type: String, default: "" },
    },
    documents: {
      rcUrl: { type: String, default: "" },
      insuranceUrl: { type: String, default: "" },
    },

    status: {
      type: String,
      enum: [
        "DRAFT",
        "PENDING_APPROVAL",
        "ACTIVE",
        "IN_RIDE",
        "MAINTENANCE",
        "CHARGING",
        "INACTIVE",
        "REMOVAL_REQUESTED",
        "REMOVED",
      ],
      default: "DRAFT",
      index: true,
    },

    approvalNote: { type: String, default: "" },
  },
  { timestamps: true },
);

VehicleSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model("Vehicle", VehicleSchema);

