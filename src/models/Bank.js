const mongoose = require("mongoose");

const BankSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    accountHolderName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    bankName: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    upiId: { type: String, default: "" },
    fileUrl: { type: String, default: "" },

    isVerified: { type: Boolean, default: false, index: true },
    verificationNote: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Bank", BankSchema);

