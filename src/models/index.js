const mongoose = require("mongoose");

const url = process.env.LOCAL_MONGO_DB;
mongoose.set("strictQuery", true);
mongoose.connect(url);

const con = mongoose.connection;

const models = {
  User: require("./User"),
  Station: require("./Station"),
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
