const ResponseMiddleware = require("../middleware/ResponseMiddleware");
const OwnerSupportService = require("../services/OwnerSupportService");

module.exports = {
  faqs: async (req, res, next) => {
    const faqs = await OwnerSupportService().listFaqs();
    req.rData = { faqs };
    req.msg = "faqs_list";
    return ResponseMiddleware(req, res, next);
  },

  listTickets: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const tickets = await OwnerSupportService().listTickets(ownerId);
    req.rData = { tickets };
    req.msg = "tickets_list";
    return ResponseMiddleware(req, res, next);
  },

  createTicket: async (req, res, next) => {
    try {
      const ownerId = req.body.ownerId;
      const ticket = await OwnerSupportService().createTicket({
        ownerId,
        subject: req.body.subject,
        message: req.body.message,
      });
      req.rData = { ticket };
      req.msg = "ticket_created";
      return ResponseMiddleware(req, res, next);
    } catch (ex) {
      if (ex.code === "REQUIRED_FIELDS_MISSING") {
        req.rCode = 0;
        req.msg = "required_fields_missing";
        return ResponseMiddleware(req, res, next);
      }
      req.rCode = 0;
      return ResponseMiddleware(req, res, next, ex.message || "Invalid request");
    }
  },

  ticketDetail: async (req, res, next) => {
    const ownerId = req.body.ownerId;
    const ticket = await OwnerSupportService().fetchTicket(ownerId, req.params.ticketId);
    if (!ticket) {
      req.rCode = 5;
      return ResponseMiddleware(req, res, next, "Ticket not found");
    }
    req.rData = { ticket };
    req.msg = "ticket_detail";
    return ResponseMiddleware(req, res, next);
  },
};

