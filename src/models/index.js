const mongoose = require("mongoose");

const url = process.env.LOCAL_MONGO_DB;
mongoose.set("strictQuery", true);
mongoose.connect(url);

const con = mongoose.connection;

const models = {
  User: require("./User"),
  AdminSetting: require("./AdminSetting"),
  AuditLog: require("./AuditLog"),
  Station: require("./Station"),
  RidePlan: require("./RidePlan"),
  Faq: require("./Faq"),
  Bank: require("./Bank"),
  Vehicle: require("./Vehicle"),
  Booking: require("./Booking"),
  Transaction: require("./Transaction"),
  LedgerJournal: require("./LedgerJournal"),
  Notification: require("./Notification"),
  PayoutRequest: require("./PayoutRequest"),
  MaintenanceRequest: require("./MaintenanceRequest"),
  SupportTicket: require("./SupportTicket"),
};

con.on("open", () => {
  console.log("Connected to database");
});

con.on("error", (error) => {
  console.error("Error connecting to database", { error: error.message });
});

module.exports = con;
module.exports.mongoose = mongoose;
module.exports.models = models;
