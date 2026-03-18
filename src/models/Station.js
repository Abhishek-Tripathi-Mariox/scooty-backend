const mongoose = require("mongoose");

const StationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String },
    parkingType: { type: String, enum: ["COVERED", "OPEN"], default: "OPEN" },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

StationSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Station", StationSchema);
