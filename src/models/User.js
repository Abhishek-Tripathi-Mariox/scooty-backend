const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["ADMIN", "STATION_ADMIN", "USER", "OWNER"],
      default: "USER",
      index: true,
      required: true,
    },

    // Common profile
    name: { type: String ,default: "" },
    email: { type: String, unique: true, sparse: true, index: true },
    mobile: { type: String, unique: true, sparse: true, index: true ,default: "" },
    profilePhotoUrl: { type: String },
    language: { type: String, default: "en" },
    isActive: { type: Boolean, default: true },
    city:{type:String,default:""},
    adress:{type:String,default:""},
    state:{type:String,default:""},
    pincode:{type:String,default:""},

    // Auth (Admin / Station Admin)
    passwordHash: { type: String },

    // User wallet + referrals (Customer)
    walletBalance: { type: Number, default: 0 },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    referralEarnings: { type: Number, default: 0 },


    // Owner / Station mapping
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station" },

    // Owner fields
    companyName: { type: String },
    bank: {
      accountHolderName: { type: String },
      accountNumber: { type: String },
      bankName: { type: String },
      ifsc: { type: String },
      file:  {type:String}
    },

    //documents...
    adharFile: { type: String },
    panFile: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);
