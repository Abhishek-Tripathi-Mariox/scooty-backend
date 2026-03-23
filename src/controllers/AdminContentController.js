const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const ContentService = require("../services/ContentService");

module.exports = {
  listPlans: async (req, res, next) => {
    const plans = await ContentService().listAdminPlans({
      status: req.query.status,
      stationId: req.query.stationId,
    });
    req.rData = { plans };
    return ResponseMiddleware(req, res, next, "ride plans fetched successfully");
  },

  reviewPlan: async (req, res, next) => {
    const plan = await ContentService().reviewPlan({
      adminId: req.body.adminId,
      planId: req.params.planId,
      status: req.body.status,
      rejectionReason: req.body.rejectionReason,
    });
    if (!plan) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Ride plan not found");
    }
    req.rData = { plan };
    return ResponseMiddleware(req, res, next, "ride plan review updated successfully");
  },

  listFaqs: async (req, res, next) => {
    const faqs = await ContentService().listAdminFaqs({
      status: req.query.status,
      stationId: req.query.stationId,
    });
    req.rData = { faqs };
    return ResponseMiddleware(req, res, next, "faqs fetched successfully");
  },

  reviewFaq: async (req, res, next) => {
    const faq = await ContentService().reviewFaq({
      adminId: req.body.adminId,
      faqId: req.params.faqId,
      status: req.body.status,
      rejectionReason: req.body.rejectionReason,
    });
    if (!faq) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "FAQ not found");
    }
    req.rData = { faq };
    return ResponseMiddleware(req, res, next, "faq review updated successfully");
  },
};
