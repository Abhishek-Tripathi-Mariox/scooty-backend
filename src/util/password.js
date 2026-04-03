const bcrypt = require("bcryptjs");

const normalizePassword = (plain) => String(plain ?? "").trim();

const hashPassword = async (plain) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(normalizePassword(plain), salt);
};

const comparePassword = async (plain, hash) => {
  if (!hash) return false;
  const raw = String(plain ?? "");
  if (await bcrypt.compare(raw, String(hash))) return true;

  const normalized = normalizePassword(plain);
  if (normalized !== raw) {
    return await bcrypt.compare(normalized, String(hash));
  }

  return false;
};

module.exports = {
  hashPassword,
  comparePassword,
  normalizePassword,
};
