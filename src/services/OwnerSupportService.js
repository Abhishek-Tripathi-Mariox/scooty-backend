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

  // Admin-approved FAQs from the DB; static list is only a fallback when none exist yet.
  const listFaqs = async () => {
    const approved = await models.Faq.find({ status: "APPROVED" })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    if (!approved.length) return faqs();
    return approved.map((faq) => ({
      id: String(faq._id),
      question: faq.question,
      answer: faq.answer,
    }));
  };

  // Support contact shown in the owner app (Call / Email tiles). Admin can override
  // via AdminSetting key "supportContact" -> { phone, email }.
  const supportContact = async () => {
    const setting = await models.AdminSetting.findOne({ key: "supportContact" }).lean();
    const value = setting?.value || {};
    return {
      phone: String(value.phone || "18001234567"),
      email: String(value.email || "support@slydomobility.com"),
    };
  };

  return {
    listTickets,
    createTicket,
    fetchTicket,
    listFaqs,
    supportContact,
  };
};
