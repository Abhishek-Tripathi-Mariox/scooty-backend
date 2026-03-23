const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const ContentService = require("../services/ContentService");

module.exports = {
  listPlans: async (req, res, next) => {
    const plans = await ContentService().listStationAdminPlans({
      stationId: req.query.stationId,
      status: req.query.status,
    });
    req.rData = { plans };
    return ResponseMiddleware(req, res, next, "station ride plans fetched successfully");
  },

  createPlan: async (req, res, next) => {
    const plan = await ContentService().createPlan({
      stationId: req.body.stationId,
      stationAdminId: req.body.stationAdminId,
      payload: req.body || {},
    });
    req.rData = { plan };
    return ResponseMiddleware(req, res, next, "ride plan submitted for approval");
  },

  updatePlan: async (req, res, next) => {
    const plan = await ContentService().updatePlan({
      stationId: req.body.stationId,
      stationAdminId: req.body.stationAdminId,
      planId: req.params.planId,
      payload: req.body || {},
    });
    if (!plan) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Ride plan not found");
    }
    req.rData = { plan };
    return ResponseMiddleware(req, res, next, "ride plan resubmitted for approval");
  },

  listFaqs: async (req, res, next) => {
    const faqs = await ContentService().listStationAdminFaqs({
      stationId: req.query.stationId,
      status: req.query.status,
    });
    req.rData = { faqs };
    return ResponseMiddleware(req, res, next, "station faqs fetched successfully");
  },

  createFaq: async (req, res, next) => {
    const faq = await ContentService().createFaq({
      stationId: req.body.stationId,
      stationAdminId: req.body.stationAdminId,
      payload: req.body || {},
    });
    req.rData = { faq };
    return ResponseMiddleware(req, res, next, "faq submitted for approval");
  },

  updateFaq: async (req, res, next) => {
    const faq = await ContentService().updateFaq({
      stationId: req.body.stationId,
      stationAdminId: req.body.stationAdminId,
      faqId: req.params.faqId,
      payload: req.body || {},
    });
    if (!faq) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "FAQ not found");
    }
    req.rData = { faq };
    return ResponseMiddleware(req, res, next, "faq resubmitted for approval");
  },
};
