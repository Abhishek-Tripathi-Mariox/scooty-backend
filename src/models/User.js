const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["ADMIN", "STATION_ADMIN", "USER", "OWNER","SUB_STATION_ADMIN"],
      default: "USER",
      index: true,
      required: true,
    },

    // Common profile
    name: { type: String ,default: "" },
    email: { type: String, unique: true, sparse: true, index: true },
    mobile: { type: String, unique: true, sparse: true, index: true ,default: "" },
    profilePhotoUrl: { type: String },
    isActive: { type: Boolean, default: true },
    city:{type:String,default:""},
    adress:{type:String,default:""},
    state:{type:String,default:""},
    pincode:{type:String,default:""},

    // Auth (Admin / Station Admin)
    passwordHash: { type: String },
    adminPermissions: { type: [String], default: [] },

    // User wallet + referrals (Customer)
    walletBalance: { type: Number, default: 0 },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    referralEarnings: { type: Number, default: 0 },


    // Owner / Station mapping
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station" },

    // Owner fields
    companyName: { type: String },

    //documents...
    adharFile: { type: String },
    panFile: { type: String },
    // Owner KYC
    kycStatus: {
      type: String,
      enum: ["NOT_SUBMITTED", "PENDING", "APPROVED", "REJECTED"],
      default: "NOT_SUBMITTED",
      index: true,
    },
    kycRejectionReason: { type: String, default: "" },
    kycSubmittedAt: { type: Date },
    kycVerifiedAt: { type: Date },

    // App preferences
    settings: {
      language: { type: String, default: "en" },
      notifications: {
        rideUpdates: { type: Boolean, default: true },
        earnings: { type: Boolean, default: true },
        payout: { type: Boolean, default: true },
        promotions: { type: Boolean, default: true },
        maintenance: { type: Boolean, default: true },
      },
      permissions: {
        location: { type: Boolean, default: false },
        camera: { type: Boolean, default: false },
        notifications: { type: Boolean, default: false },
      },
      location: {
        isEnabled: { type: Boolean, default: false },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        accuracy: { type: Number, default: null },
        source: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        pincode: { type: String, default: "" },
        updatedAt: { type: Date },
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);
