const mongoose = require("mongoose");

const LedgerEntrySchema = new mongoose.Schema(
  {
    accountCode: { type: String, required: true, index: true },
    accountName: { type: String, default: "" },
    accountType: {
      type: String,
      enum: [
        "ASSET",
        "LIABILITY",
        "EQUITY",
        "REVENUE",
        "EXPENSE",
        "CLEARING",
      ],
      default: "CLEARING",
    },
    direction: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },
    refId: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const LedgerJournalSchema = new mongoose.Schema(
  {
    journalNo: { type: String, required: true, unique: true, index: true },
    sourceType: { type: String, default: "", index: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    sourceKey: { type: String, default: "", index: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["POSTED", "REVERSED", "VOID"],
      default: "POSTED",
      index: true,
    },
    currency: { type: String, default: "INR" },
    totalDebit: { type: Number, default: 0 },
    totalCredit: { type: Number, default: 0 },
    postedByRole: { type: String, default: "SYSTEM" },
    postedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    entries: { type: [LedgerEntrySchema], default: [] },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

LedgerJournalSchema.index({ sourceType: 1, sourceId: 1, createdAt: -1 });
LedgerJournalSchema.index({ sourceKey: 1, createdAt: -1 });

module.exports = mongoose.model("LedgerJournal", LedgerJournalSchema);
