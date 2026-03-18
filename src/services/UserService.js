const { models } = require("../models");

module.exports = () => {
  const fetchByQuery = async (query) => {
    return await models.User.findOne(query).lean();
  };

  const fetchDocByQuery = async (query) => {
    return await models.User.findOne(query);
  };

  const findByEmailDoc = async (email, roles = null) => {
    const normalized = String(email || "").trim().toLowerCase();
    const query = { email: normalized };
    if (Array.isArray(roles) && roles.length > 0) query.role = { $in: roles };
    return await models.User.findOne(query);
  };

  const findByMobileDoc = async (mobile, roles = null) => {
    const normalized = String(mobile || "").replace(/\D/g, "");
    const query = { mobile: normalized };
    if (Array.isArray(roles) && roles.length > 0) query.role = { $in: roles };
    return await models.User.findOne(query);
  };

  const fetchById = async (id) => {
    return await models.User.findById(id).lean();
  };

  const create = async (payload) => {
    return await models.User.create(payload);
  };

  const emailInUse = async (email, excludeUserId) => {
    if (!email) return false;
    const query = { email: String(email).trim().toLowerCase() };
    if (excludeUserId) query._id = { $ne: excludeUserId };
    const exists = await models.User.exists(query);
    return exists ? true : false;
  };

  const mobileInUse = async (mobile, excludeUserId) => {
    if (!mobile) return false;
    const query = { mobile: String(mobile).replace(/\D/g, "") };
    if (excludeUserId) query._id = { $ne: excludeUserId };
    const exists = await models.User.exists(query);
    return exists ? true : false;
  };

  return {
    fetchByQuery,
    fetchDocByQuery,
    findByEmailDoc,
    findByMobileDoc,
    fetchById,
    create,
    emailInUse,
    mobileInUse,
  };
};
