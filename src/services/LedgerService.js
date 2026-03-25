const { models } = require("../models");

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const safeString = (value) => String(value || "").trim();

const buildJournalNo = () => `JRN-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;

const makeSourceKey = ({ sourceType, sourceId, description, entries }) =>
  [
    safeString(sourceType),
    safeString(sourceId),
    safeString(description),
    (entries || [])
      .map((entry) => [entry.accountCode, entry.direction, entry.amount].join(":"))
      .join("|"),
  ].join("::");

const normalizeEntries = (entries) =>
  (entries || []).map((entry) => ({
    accountCode: safeString(entry.accountCode),
    accountName: safeString(entry.accountName),
    accountType: safeString(entry.accountType || "CLEARING").toUpperCase(),
    direction: String(entry.direction || "").toUpperCase(),
    amount: round2(entry.amount),
    note: safeString(entry.note),
    refId: safeString(entry.refId),
    meta: entry.meta || {},
  }));

module.exports = () => {
  const postJournal = async ({
    sourceType = "",
    sourceId = null,
    description = "",
    entries = [],
    currency = "INR",
    postedByRole = "SYSTEM",
    postedByUserId = null,
    meta = {},
  }) => {
    const normalizedEntries = normalizeEntries(entries);
    const debitTotal = normalizedEntries
      .filter((entry) => entry.direction === "DEBIT")
      .reduce((acc, entry) => acc + entry.amount, 0);
    const creditTotal = normalizedEntries
      .filter((entry) => entry.direction === "CREDIT")
      .reduce((acc, entry) => acc + entry.amount, 0);

    for (const entry of normalizedEntries) {
      if (!entry.accountCode) {
        const err = new Error("Ledger entry accountCode is required");
        err.code = "LEDGER_ENTRY_INVALID";
        throw err;
      }
      if (!["DEBIT", "CREDIT"].includes(entry.direction)) {
        const err = new Error("Ledger entry direction must be DEBIT or CREDIT");
        err.code = "LEDGER_ENTRY_INVALID";
        throw err;
      }
      if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
        const err = new Error("Ledger entry amount must be greater than zero");
        err.code = "LEDGER_ENTRY_INVALID";
        throw err;
      }
    }

    if (!normalizedEntries.length) {
      const err = new Error("At least one ledger entry is required");
      err.code = "LEDGER_EMPTY";
      throw err;
    }
    if (Math.abs(debitTotal - creditTotal) > 0.01) {
      const err = new Error("Ledger entries must balance");
      err.code = "LEDGER_UNBALANCED";
      throw err;
    }

    const journal = await models.LedgerJournal.create({
      journalNo: buildJournalNo(),
      sourceType: safeString(sourceType),
      sourceId,
      sourceKey: makeSourceKey({ sourceType, sourceId, description, entries: normalizedEntries }),
      description: safeString(description),
      status: "POSTED",
      currency: safeString(currency || "INR") || "INR",
      totalDebit: round2(debitTotal),
      totalCredit: round2(creditTotal),
      postedByRole: safeString(postedByRole || "SYSTEM").toUpperCase(),
      postedByUserId,
      entries: normalizedEntries,
      meta,
    });

    return journal.toObject();
  };

  const listJournals = async ({ sourceType, sourceId, from, to, page = 1, limit = 20 } = {}) => {
    const query = {};
    if (sourceType) query.sourceType = safeString(sourceType);
    if (sourceId) query.sourceId = sourceId;
    if (from || to) {
      const range = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      query.createdAt = range;
    }

    const pageNumber = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNumber - 1) * pageSize;

    const [total, journals] = await Promise.all([
      models.LedgerJournal.countDocuments(query),
      models.LedgerJournal.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      journals,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    };
  };

  return {
    postJournal,
    listJournals,
  };
};
