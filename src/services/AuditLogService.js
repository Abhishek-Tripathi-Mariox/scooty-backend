const { models } = require("../models");

module.exports = () => {
  const create = async ({
    actorId,
    actorRole = "ADMIN",
    action,
    entityType = "",
    entityId = null,
    before = null,
    after = null,
    meta = {},
  }) => {
    return await models.AuditLog.create({
      actorId,
      actorRole,
      action,
      entityType,
      entityId,
      before,
      after,
      meta,
    });
  };

  return { create };
};

