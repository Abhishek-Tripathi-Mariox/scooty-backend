const { models } = require("../models");
const AuditLogService = require("./AuditLogService");

const faqs = () => [
  {
    id: "add_vehicle",
    question: "How do I add a new vehicle?",
    answer: "Go to Scooty tab → Add Vehicle and submit documents for approval.",
  },
  {
    id: "payout",
    question: "When will I receive my payout?",
    answer: "Payouts are processed after verification. You can check status in payout history.",
  },
  {
    id: "revenue",
    question: "How is the revenue share calculated?",
    answer: "Revenue share depends on your station agreement and applicable deductions.",
  },
];

module.exports = () => {
  const listTickets = async (ownerId) => {
    return await models.SupportTicket.find({ userId: ownerId }).sort({ createdAt: -1 }).lean();
  };

  const createTicket = async ({ ownerId, subject, message }) => {
    const s = String(subject || "").trim();
    const m = String(message || "").trim();
    if (!s || !m) {
      const err = new Error("subject and message are required");
      err.code = "REQUIRED_FIELDS_MISSING";
      throw err;
    }
    const ticket = await models.SupportTicket.create({ userId: ownerId, subject: s, message: m, status: "OPEN" });
    await AuditLogService().create({
      actorId: ownerId,
      actorRole: "OWNER",
      action: "OWNER_SUPPORT_TICKET_CREATED",
      entityType: "SupportTicket",
      entityId: ticket._id,
      after: ticket,
    });
    return ticket;
  };

  const fetchTicket = async (ownerId, ticketId) => {
    return await models.SupportTicket.findOne({ _id: ticketId, userId: ownerId }).lean();
  };

  const listFaqs = async () => faqs();

  return {
    listTickets,
    createTicket,
    fetchTicket,
    listFaqs,
  };
};
