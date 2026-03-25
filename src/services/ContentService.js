const { models, mongoose } = require("../models");
const AuditLogService = require("./AuditLogService");

const PLAN_TYPES = ["HOURLY", "DAY_PASS", "WEEKLY", "MONTHLY"];
const CONTENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

const normalizePerks = (perks) => {
  if (!Array.isArray(perks)) return [];
  return perks
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

  const validateStation = async (stationId) => {
    if (!mongoose.Types.ObjectId.isValid(String(stationId || ""))) return null;
    return await models.Station.findOne({ _id: stationId, isActive: true }).lean();
  };

  const validateStationAdminStation = async (stationAdminId, stationId) => {
    const stationAdmin = await models.User.findOne({ _id: stationAdminId, role: "STATION_ADMIN" }).lean();
    if (!stationAdmin) return null;

    if (stationAdmin.stationId) {
      if (!stationId) {
        const err = new Error("stationId is required");
        err.code = "STATION_REQUIRED";
        throw err;
      }
      if (String(stationAdmin.stationId) !== String(stationId)) {
        const err = new Error("stationId does not match assigned station");
        err.code = "STATION_MISMATCH";
        throw err;
      }
    }

    return stationAdmin;
  };

module.exports = () => {
  const recordAudit = (payload) => AuditLogService().create(payload);

  const listStationAdminPlans = async ({ stationId, status }) => {
    const query = { stationId };
    if (status && CONTENT_STATUSES.includes(String(status).trim().toUpperCase())) {
      query.status = String(status).trim().toUpperCase();
    }

    return await models.RidePlan.find(query).sort({ createdAt: -1 }).lean();
  };

  const createPlan = async ({ stationId, stationAdminId, payload }) => {
    const stationAdmin = await validateStationAdminStation(stationAdminId, stationId);
    if (!stationAdmin) {
      const err = new Error("Station admin not found");
      err.code = "STATION_ADMIN_NOT_FOUND";
      throw err;
    }
    const station = await validateStation(stationId);
    if (!station) {
      const err = new Error("Station not found");
      err.code = "STATION_NOT_FOUND";
      throw err;
    }

    const code = String(payload.code || "").trim().toUpperCase();
    const name = String(payload.name || "").trim();
    const type = String(payload.type || "").trim().toUpperCase();
    const durationHours = Number(payload.durationHours);
    const price = Number(payload.price);
    const securityDeposit = Number(payload.securityDeposit || 0);

    if (!code) {
      const err = new Error("code is required");
      err.code = "INVALID_PLAN_INPUT";
      throw err;
    }
    if (!name) {
      const err = new Error("name is required");
      err.code = "INVALID_PLAN_INPUT";
      throw err;
    }
    if (!PLAN_TYPES.includes(type)) {
      const err = new Error(`type must be one of ${PLAN_TYPES.join(", ")}`);
      err.code = "INVALID_PLAN_INPUT";
      throw err;
    }
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      const err = new Error("durationHours must be greater than 0");
      err.code = "INVALID_PLAN_INPUT";
      throw err;
    }
    if (!Number.isFinite(price) || price < 0) {
      const err = new Error("price must be a valid number greater than or equal to 0");
      err.code = "INVALID_PLAN_INPUT";
      throw err;
    }

    const existing = await models.RidePlan.findOne({ stationId, code });
    if (existing) {
      const err = new Error("Plan code already exists for this station");
      err.code = "DUPLICATE_PLAN_CODE";
      throw err;
    }

    const plan = await models.RidePlan.create({
      stationId,
      createdBy: stationAdminId,
      code,
      name,
      type,
      durationHours,
      price,
      securityDeposit: Number.isFinite(securityDeposit) ? securityDeposit : 0,
      description: String(payload.description || "").trim(),
      perks: normalizePerks(payload.perks),
      badge: String(payload.badge || "").trim(),
      status: "PENDING",
    });

    await recordAudit({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "RIDE_PLAN_CREATED",
      entityType: "RidePlan",
      entityId: plan._id,
      after: plan,
      meta: { stationId },
    });

    return plan;
  };

  const updatePlan = async ({ stationId, stationAdminId, planId, payload }) => {
    const stationAdmin = await validateStationAdminStation(stationAdminId, stationId);
    if (!stationAdmin) return null;
    const plan = await models.RidePlan.findOne({ _id: planId, stationId, createdBy: stationAdminId });
    if (!plan) return null;
    const before = plan.toObject();

    if (typeof payload.code === "string") {
      const code = payload.code.trim().toUpperCase();
      if (!code) {
        const err = new Error("code cannot be empty");
        err.code = "INVALID_PLAN_INPUT";
        throw err;
      }
      const duplicate = await models.RidePlan.findOne({
        _id: { $ne: plan._id },
        stationId,
        code,
      }).lean();
      if (duplicate) {
        const err = new Error("Plan code already exists for this station");
        err.code = "DUPLICATE_PLAN_CODE";
        throw err;
      }
      plan.code = code;
    }

    if (typeof payload.name === "string") plan.name = payload.name.trim() || plan.name;
    if (typeof payload.type === "string") {
      const type = payload.type.trim().toUpperCase();
      if (!PLAN_TYPES.includes(type)) {
        const err = new Error(`type must be one of ${PLAN_TYPES.join(", ")}`);
        err.code = "INVALID_PLAN_INPUT";
        throw err;
      }
      plan.type = type;
    }
    if (payload.durationHours !== undefined) {
      const durationHours = Number(payload.durationHours);
      if (!Number.isFinite(durationHours) || durationHours <= 0) {
        const err = new Error("durationHours must be greater than 0");
        err.code = "INVALID_PLAN_INPUT";
        throw err;
      }
      plan.durationHours = durationHours;
    }
    if (payload.price !== undefined) {
      const price = Number(payload.price);
      if (!Number.isFinite(price) || price < 0) {
        const err = new Error("price must be a valid number");
        err.code = "INVALID_PLAN_INPUT";
        throw err;
      }
      plan.price = price;
    }
    if (payload.securityDeposit !== undefined) {
      const securityDeposit = Number(payload.securityDeposit);
      if (!Number.isFinite(securityDeposit) || securityDeposit < 0) {
        const err = new Error("securityDeposit must be a valid number");
        err.code = "INVALID_PLAN_INPUT";
        throw err;
      }
      plan.securityDeposit = securityDeposit;
    }
    if (typeof payload.description === "string") plan.description = payload.description.trim();
    if (Array.isArray(payload.perks)) plan.perks = normalizePerks(payload.perks);
    if (typeof payload.badge === "string") plan.badge = payload.badge.trim();

    plan.status = "PENDING";
    plan.rejectionReason = "";
    plan.approvedBy = undefined;
    await plan.save();

    await recordAudit({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "RIDE_PLAN_UPDATED",
      entityType: "RidePlan",
      entityId: plan._id,
      before,
      after: plan,
      meta: { stationId },
    });
    return plan;
  };

  const listAdminPlans = async ({ status, stationId }) => {
    const query = {};
    if (status && CONTENT_STATUSES.includes(String(status).trim().toUpperCase())) {
      query.status = String(status).trim().toUpperCase();
    }
    if (stationId && mongoose.Types.ObjectId.isValid(String(stationId))) {
      query.stationId = stationId;
    }

    return await models.RidePlan.find(query)
      .sort({ createdAt: -1 })
      .populate("stationId", "name address")
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email")
      .lean();
  };

  const reviewPlan = async ({ adminId, planId, status, rejectionReason }) => {
    const normalizedStatus = String(status || "").trim().toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(normalizedStatus)) {
      const err = new Error("status must be APPROVED or REJECTED");
      err.code = "INVALID_REVIEW_STATUS";
      throw err;
    }

    const plan = await models.RidePlan.findById(planId);
    if (!plan) return null;
    const before = plan.toObject();

    plan.status = normalizedStatus;
    plan.approvedBy = adminId;
    plan.rejectionReason = normalizedStatus === "REJECTED" ? String(rejectionReason || "").trim() : "";
    await plan.save();

    await recordAudit({
      actorId: adminId,
      action: `RIDE_PLAN_${normalizedStatus}`,
      entityType: "RidePlan",
      entityId: plan._id,
      before,
      after: plan,
      meta: { status: normalizedStatus },
    });
    return plan;
  };

  const listStationAdminFaqs = async ({ stationId, status }) => {
    const query = { stationId };
    if (status && CONTENT_STATUSES.includes(String(status).trim().toUpperCase())) {
      query.status = String(status).trim().toUpperCase();
    }

    return await models.Faq.find(query).sort({ createdAt: -1 }).lean();
  };

  const createFaq = async ({ stationId, stationAdminId, payload }) => {
    const stationAdmin = await validateStationAdminStation(stationAdminId, stationId);
    if (!stationAdmin) {
      const err = new Error("Station admin not found");
      err.code = "STATION_ADMIN_NOT_FOUND";
      throw err;
    }
    const station = await validateStation(stationId);
    if (!station) {
      const err = new Error("Station not found");
      err.code = "STATION_NOT_FOUND";
      throw err;
    }

    const question = String(payload.question || "").trim();
    const answer = String(payload.answer || "").trim();
    if (!question || !answer) {
      const err = new Error("question and answer are required");
      err.code = "INVALID_FAQ_INPUT";
      throw err;
    }

    const faq = await models.Faq.create({
      stationId,
      createdBy: stationAdminId,
      question,
      answer,
      status: "PENDING",
    });

    await recordAudit({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "FAQ_CREATED",
      entityType: "Faq",
      entityId: faq._id,
      after: faq,
      meta: { stationId },
    });

    return faq;
  };

  const updateFaq = async ({ stationId, stationAdminId, faqId, payload }) => {
    const stationAdmin = await validateStationAdminStation(stationAdminId, stationId);
    if (!stationAdmin) return null;
    const faq = await models.Faq.findOne({ _id: faqId, stationId, createdBy: stationAdminId });
    if (!faq) return null;
    const before = faq.toObject();

    if (typeof payload.question === "string") {
      const question = payload.question.trim();
      if (!question) {
        const err = new Error("question cannot be empty");
        err.code = "INVALID_FAQ_INPUT";
        throw err;
      }
      faq.question = question;
    }

    if (typeof payload.answer === "string") {
      const answer = payload.answer.trim();
      if (!answer) {
        const err = new Error("answer cannot be empty");
        err.code = "INVALID_FAQ_INPUT";
        throw err;
      }
      faq.answer = answer;
    }

    faq.status = "PENDING";
    faq.rejectionReason = "";
    faq.approvedBy = undefined;
    await faq.save();

    await recordAudit({
      actorId: stationAdminId,
      actorRole: "STATION_ADMIN",
      action: "FAQ_UPDATED",
      entityType: "Faq",
      entityId: faq._id,
      before,
      after: faq,
      meta: { stationId },
    });
    return faq;
  };

  const listAdminFaqs = async ({ status, stationId }) => {
    const query = {};
    if (status && CONTENT_STATUSES.includes(String(status).trim().toUpperCase())) {
      query.status = String(status).trim().toUpperCase();
    }
    if (stationId && mongoose.Types.ObjectId.isValid(String(stationId))) {
      query.stationId = stationId;
    }

    return await models.Faq.find(query)
      .sort({ createdAt: -1 })
      .populate("stationId", "name address")
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email")
      .lean();
  };

  const reviewFaq = async ({ adminId, faqId, status, rejectionReason }) => {
    const normalizedStatus = String(status || "").trim().toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(normalizedStatus)) {
      const err = new Error("status must be APPROVED or REJECTED");
      err.code = "INVALID_REVIEW_STATUS";
      throw err;
    }

    const faq = await models.Faq.findById(faqId);
    if (!faq) return null;
    const before = faq.toObject();

    faq.status = normalizedStatus;
    faq.approvedBy = adminId;
    faq.rejectionReason = normalizedStatus === "REJECTED" ? String(rejectionReason || "").trim() : "";
    await faq.save();

    await recordAudit({
      actorId: adminId,
      action: `FAQ_${normalizedStatus}`,
      entityType: "Faq",
      entityId: faq._id,
      before,
      after: faq,
      meta: { status: normalizedStatus },
    });
    return faq;
  };

  const listApprovedPlansForUser = async ({ stationId }) => {
    const query = { status: "APPROVED" };
    if (stationId && mongoose.Types.ObjectId.isValid(String(stationId))) {
      query.stationId = stationId;
    }

    return await models.RidePlan.find(query).sort({ price: 1, createdAt: -1 }).lean();
  };

  const listApprovedFaqsForUser = async ({ stationId }) => {
    const query = { status: "APPROVED" };
    if (stationId && mongoose.Types.ObjectId.isValid(String(stationId))) {
      query.stationId = stationId;
    }

    return await models.Faq.find(query).sort({ createdAt: -1 }).lean();
  };

  const getApprovedPlanByCode = async ({ stationId, code }) => {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) return null;
    return await models.RidePlan.findOne({
      status: "APPROVED",
      stationId,
      code: normalizedCode,
    }).lean();
  };

  return {
    listStationAdminPlans,
    createPlan,
    updatePlan,
    listAdminPlans,
    reviewPlan,
    listStationAdminFaqs,
    createFaq,
    updateFaq,
    listAdminFaqs,
    reviewFaq,
    listApprovedPlansForUser,
    listApprovedFaqsForUser,
    getApprovedPlanByCode,
  };
};
