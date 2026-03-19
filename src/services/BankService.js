const mongoose = require("mongoose");
const { models } = require("../models");
const fileUploadService = require("../util/s3");

const normalizeStr = (v) => (typeof v === "string" ? v.trim() : "");

const hasAnyLegacyBank = (bank) => {
  if (!bank) return false;
  const keys = ["accountHolderName", "accountNumber", "bankName", "ifsc", "upiId", "file", "fileUrl"];
  return keys.some((k) => normalizeStr(bank[k]));
};

module.exports = () => {
  const pickBankFile = (files) => {
    if (!files) return null;
    return files.bankFile || files.bankfile || files.bank_file || null;
  };

  const fetchByOwnerId = async (ownerId) => {
    return await models.Bank.findOne({ ownerId }).lean();
  };

  const fetchDocByOwnerId = async (ownerId) => {
    return await models.Bank.findOne({ ownerId });
  };

  const fetchLegacyOwnerBankRaw = async (ownerId) => {
    // Even if the `User` schema no longer contains `bank`, old DB records may still have it.
    const _id = typeof ownerId === "string" ? new mongoose.Types.ObjectId(ownerId) : ownerId;
    return await models.User.collection.findOne(
      { _id, role: "OWNER" },
      { projection: { bank: 1 } },
    );
  };

  const ensureFromLegacyUserBank = async (ownerId) => {
    const existing = await fetchDocByOwnerId(ownerId);
    if (existing) return existing;

    const legacy = await fetchLegacyOwnerBankRaw(ownerId);
    if (!legacy || !hasAnyLegacyBank(legacy.bank)) return null;

    return await models.Bank.create({
      ownerId,
      accountHolderName: normalizeStr(legacy.bank.accountHolderName),
      accountNumber: normalizeStr(legacy.bank.accountNumber),
      bankName: normalizeStr(legacy.bank.bankName),
      ifsc: normalizeStr(legacy.bank.ifsc),
      upiId: normalizeStr(legacy.bank.upiId),
      fileUrl: normalizeStr(legacy.bank.fileUrl || legacy.bank.file),
    });
  };

  const getOrCreate = async (ownerId) => {
    const doc = await ensureFromLegacyUserBank(ownerId);
    if (doc) return doc.toObject ? doc.toObject() : doc;
    return await fetchByOwnerId(ownerId);
  };

  const upsert = async ({ ownerId, payload = {}, files = null }) => {
    let bank = await fetchDocByOwnerId(ownerId);
    if (!bank) bank = await ensureFromLegacyUserBank(ownerId);
    if (!bank) bank = new models.Bank({ ownerId });

    const { accountHolderName, accountNumber, bankName, ifsc, upiId } = payload || {};

    if (typeof accountHolderName === "string") bank.accountHolderName = accountHolderName.trim();
    if (typeof accountNumber === "string") bank.accountNumber = accountNumber.trim();
    if (typeof bankName === "string") bank.bankName = bankName.trim();
    if (typeof ifsc === "string") bank.ifsc = ifsc.trim();
    if (typeof upiId === "string") bank.upiId = upiId.trim();

    const bankFile = pickBankFile(files);
    if (bankFile) {
      const uploadRes = await fileUploadService.uploadFileToAws(bankFile);
      bank.fileUrl = uploadRes.images?.[0] || bank.fileUrl;
    }

    bank.isVerified = false;
    bank.verificationNote = "";

    await bank.save();
    return bank;
  };

  return {
    fetchByOwnerId,
    getOrCreate,
    upsert,
  };
};
