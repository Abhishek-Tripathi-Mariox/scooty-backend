const { redisClient } = require("./redis");
const crypto = require("crypto");

const memoryOtp = new Map();
const memoryOtpTxn = new Map();

const OTP_TTL_SECONDS = 300;

const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
};

const storeOtp = async (mobile, otp) => {
  const key = `otp:${mobile}`;
  if (redisClient?.isOpen) {
    await redisClient.set(key, otp, { EX: OTP_TTL_SECONDS }); // Store OTP for 5 minutes
    return;
  }
  memoryOtp.set(key, { otp, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000 });
};

const createOtpTransaction = async (identifier, ttlSeconds = OTP_TTL_SECONDS) => {
  const transactionId = crypto.randomBytes(16).toString("hex");
  const key = `otp_txn:${transactionId}`;
  const payload = {
    identifier: String(identifier),
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlSeconds * 1000,
  };

  if (redisClient?.isOpen) {
    await redisClient.set(key, JSON.stringify(payload), { EX: ttlSeconds });
  } else {
    memoryOtpTxn.set(key, payload);
  }

  return { transactionId, expiresInSec: ttlSeconds };
};

const getOtpTransaction = async (transactionId) => {
  const key = `otp_txn:${transactionId}`;
  if (redisClient?.isOpen) {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  const payload = memoryOtpTxn.get(key);
  if (!payload) return null;
  if (Date.now() > payload.expiresAt) {
    memoryOtpTxn.delete(key);
    return null;
  }
  return payload;
};

const refreshOtpTransaction = async (transactionId, ttlSeconds = OTP_TTL_SECONDS) => {
  const key = `otp_txn:${transactionId}`;
  const payload = await getOtpTransaction(transactionId);
  if (!payload) return null;
  const next = { ...payload, expiresAt: Date.now() + ttlSeconds * 1000 };

  if (redisClient?.isOpen) {
    await redisClient.set(key, JSON.stringify(next), { EX: ttlSeconds });
  } else {
    memoryOtpTxn.set(key, next);
  }
  return next;
};

const getOtp = async (mobile) => {
  const key = `otp:${mobile}`;
  if (redisClient?.isOpen) return await redisClient.get(key);
  const item = memoryOtp.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryOtp.delete(key);
    return null;
  }
  return item.otp;
};

const verifyOtp = async (mobile, otp) => {
  const masterOtp = process.env.MASTER_OTP_LOGIN;
  if (otp === masterOtp) {
    return true;
  }
  const key = `otp:${mobile}`;
  const storedOtp = await getOtp(mobile);
  if (storedOtp && storedOtp === otp) {
    if (redisClient?.isOpen) await redisClient.del(key);
    else memoryOtp.delete(key);
    return true;
  }
  return false;
};

module.exports = {
  generateOtp,
  storeOtp,
  createOtpTransaction,
  getOtpTransaction,
  refreshOtpTransaction,
  getOtp,
  verifyOtp,
};
