const jwt = require("jsonwebtoken");


const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWTSECRET, { expiresIn: "7d" }); // Token valid for 7 days
};

module.exports = {
  generateToken,
  
};