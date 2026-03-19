const mongoose = require("mongoose");

const PayoutRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "PROCESSING", "COMPLETED"],
      default: "PENDING",
      index: true,
    },
    bankSnapshot: {
      accountHolderName: { type: String, default: "" },
      bankName: { type: String, default: "" },
      accountNumberLast4: { type: String, default: "" },
      ifsc: { type: String, default: "" },
      upiId: { type: String, default: "" },
      fileUrl: { type: String, default: "" },
    },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

PayoutRequestSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("PayoutRequest", PayoutRequestSchema);
