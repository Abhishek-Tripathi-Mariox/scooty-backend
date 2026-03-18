const bcrypt = require("bcryptjs");

const hashPassword = async (plain) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(String(plain), salt);
};

const comparePassword = async (plain, hash) => {
  if (!hash) return false;
  return await bcrypt.compare(String(plain), String(hash));
};

module.exports = {
  hashPassword,
  comparePassword,
};

