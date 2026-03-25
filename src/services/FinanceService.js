const { models, mongoose } = require("../models");
const LedgerService = require("./LedgerService");
const { buildPdfBuffer } = require("../util/pdf");

const DEFAULT_COMMISSION = {
  platformCommissionPercent: 20,
  ownerSharePercent: 80,
  franchiseSharePercent: 0,
};

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildRange = (from, to) => {
  const start = toDate(from);
  const end = toDate(to);
  return {
    ...(start ? { $gte: start } : {}),
    ...(end ? { $lte: end } : {}),
  };
};

const formatDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "0000-00-00" : date.toISOString().slice(0, 10);
};

const safeString = (value) => String(value || "").trim();

const buildInvoiceNumber = (booking) => {
  const dateKey = formatDateKey(booking.createdAt || new Date());
  const suffix = String(booking._id || "").slice(-6).toUpperCase();
  return `INV-${dateKey.replace(/-/g, "")}-${suffix}`;
};

const buildReceiptNumber = (booking) => {
  const dateKey = formatDateKey(booking.payment?.paidAt || booking.createdAt || new Date());
  const suffix = String(booking._id || "").slice(-6).toUpperCase();
  return `RCT-${dateKey.replace(/-/g, "")}-${suffix}`;
};

const makeKey = (transaction) =>
  [
    safeString(transaction.type),
    safeString(transaction.sourceType),
    safeString(transaction.sourceId),
    safeString(transaction.bookingId),
    safeString(transaction.referenceId),
    safeString(transaction.role),
  ].join(":");

const normalizeTransaction = (transaction) => {
  const doc = transaction.toObject ? transaction.toObject() : { ...transaction };
  return {
    ...doc,
    id: doc._id,
    key: makeKey(doc),
  };
};

const resolveCommission = async () => {
  const setting = await models.AdminSetting.findOne({ key: "commission" }).lean();
  return { ...DEFAULT_COMMISSION, ...(setting?.value || {}) };
};

const resolvePricing = async () => {
  const setting = await models.AdminSetting.findOne({ key: "pricing" }).lean();
  return setting?.value || {};
};

const calculatePenalty = async ({ booking, actualDurationMinutes = null, pricingSetting = null }) => {
  const pricing = pricingSetting || (await resolvePricing());
  const bookedMinutes = Math.max(1, Math.round(Number(booking?.durationHours || 0) * 60));
  const actualMinutes = Math.max(0, Math.round(Number(actualDurationMinutes ?? booking?.actualDurationMinutes ?? 0)));
  const overMinutes = Math.max(0, actualMinutes - bookedMinutes);
  const perMinuteRate = round2(
    Array.isArray(pricing.penaltySlabs)
      ? Number(pricing.penaltySlabs?.[0]?.amount ?? pricing.penaltySlabs?.[0] ?? 3)
      : Number(pricing.penaltySlabs ?? 3),
  );
  const minuteCharge = round2(overMinutes * perMinuteRate);

  return {
    bookedMinutes,
    actualMinutes,
    overMinutes,
    perMinuteRate,
    minuteCharge,
    totalAmount: minuteCharge,
    currency: pricing.currency || "INR",
  };
};

const getBreakdown = async (booking) => {
  const commission = await resolveCommission();
  const pricing = booking.pricing || {};
  const rideRevenue = round2(
    Math.max(0, Number(pricing.baseFare || 0) + Number(pricing.convenienceFee || 0) - Number(pricing.discount || 0)),
  );
  const platformAmount = round2(Math.min(rideRevenue, rideRevenue * (Number(commission.platformCommissionPercent || 0) / 100)));
  const ownerAmount = round2(
    Math.min(rideRevenue - platformAmount, rideRevenue * (Number(commission.ownerSharePercent || 0) / 100)),
  );
  const franchiseAmount = round2(Math.max(0, rideRevenue - ownerAmount - platformAmount));

  return {
    rideRevenue,
    platformAmount,
    ownerAmount,
    franchiseAmount,
    taxAmount: round2(Number(pricing.tax || 0)),
  };
};

const ACCOUNT_CODES = {
  BANK_CLEARING: { code: "BANK_CLEARING", name: "Bank Clearing", type: "ASSET" },
  USER_WALLET: { code: "USER_WALLET", name: "User Wallet Liability", type: "LIABILITY" },
  BOOKING_CLEARING: { code: "BOOKING_CLEARING", name: "Booking Clearing", type: "CLEARING" },
  OWNER_PAYABLE: { code: "OWNER_PAYABLE", name: "Owner Payable", type: "LIABILITY" },
  PLATFORM_REVENUE: { code: "PLATFORM_REVENUE", name: "Platform Revenue", type: "REVENUE" },
  FRANCHISE_REVENUE: { code: "FRANCHISE_REVENUE", name: "Franchise Revenue", type: "REVENUE" },
  GST_PAYABLE: { code: "GST_PAYABLE", name: "GST Payable", type: "LIABILITY" },
  SECURITY_DEPOSIT_HOLD: { code: "SECURITY_DEPOSIT_HOLD", name: "Security Deposit Hold", type: "LIABILITY" },
};

module.exports = () => {
  const recordTransaction = async (payload) => {
    const amount = round2(payload.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      const err = new Error("Invalid transaction amount");
      err.code = "INVALID_AMOUNT";
      throw err;
    }

    const tx = await models.Transaction.create({
      userId: payload.userId,
      role: String(payload.role || "USER").trim().toUpperCase(),
      type: String(payload.type || "").trim().toUpperCase(),
      direction: String(payload.direction || "DEBIT").trim().toUpperCase(),
      status: String(payload.status || "SUCCESS").trim().toUpperCase(),
      amount,
      taxAmount: round2(payload.taxAmount),
      commissionAmount: round2(payload.commissionAmount),
      ownerAmount: round2(payload.ownerAmount),
      platformAmount: round2(payload.platformAmount),
      sourceType: safeString(payload.sourceType),
      stationId: payload.stationId || null,
      sourceId: payload.sourceId || null,
      bookingId: payload.bookingId || null,
      referenceId: safeString(payload.referenceId),
      description: safeString(payload.description),
      currency: safeString(payload.currency || "INR") || "INR",
      balanceBefore: payload.balanceBefore ?? null,
      balanceAfter: payload.balanceAfter ?? null,
      meta: payload.meta || {},
      createdAt: payload.createdAt || undefined,
    });

    return normalizeTransaction(tx);
  };

  const postJournal = async ({ sourceType, sourceId, description, entries, postedByRole = "SYSTEM", postedByUserId = null, meta = {} }) => {
    return await LedgerService().postJournal({
      sourceType,
      sourceId,
      description,
      entries,
      postedByRole,
      postedByUserId,
      meta,
    });
  };

  const postBookingPaymentJournal = async ({ booking, walletUsed = 0, paidAmount = 0 }) => {
    const totalPayable = round2(Number(booking.pricing?.totalPayable || paidAmount || 0));
    const walletAmount = round2(Number(walletUsed || 0));
    const externalAmount = round2(Math.max(0, totalPayable - walletAmount));

    return await postJournal({
      sourceType: "Booking",
      sourceId: booking._id,
      description: `Booking payment received for ${booking.planName || booking.planCode || "booking"}`,
      entries: [
        ...(walletAmount > 0
          ? [{
              accountCode: ACCOUNT_CODES.USER_WALLET.code,
              accountName: ACCOUNT_CODES.USER_WALLET.name,
              accountType: ACCOUNT_CODES.USER_WALLET.type,
              direction: "DEBIT",
              amount: walletAmount,
              note: "Wallet applied to booking",
            }]
          : []),
        ...(externalAmount > 0
          ? [{
              accountCode: ACCOUNT_CODES.BANK_CLEARING.code,
              accountName: ACCOUNT_CODES.BANK_CLEARING.name,
              accountType: ACCOUNT_CODES.BANK_CLEARING.type,
              direction: "DEBIT",
              amount: externalAmount,
              note: "External payment received",
            }]
          : []),
        {
          accountCode: ACCOUNT_CODES.BOOKING_CLEARING.code,
          accountName: ACCOUNT_CODES.BOOKING_CLEARING.name,
          accountType: ACCOUNT_CODES.BOOKING_CLEARING.type,
          direction: "CREDIT",
          amount: totalPayable,
          note: "Booking payment liability",
        },
      ],
      meta: { bookingId: booking._id, walletUsed: walletAmount, externalAmount },
    });
  };

  const postRideCompletionJournal = async ({ booking, breakdown }) => {
    const securityDeposit = round2(Number(booking.pricing?.securityDeposit || 0));
    const ownerAmount = round2(Number(breakdown.ownerAmount || 0));
    const platformAmount = round2(Number(breakdown.platformAmount || 0));
    const franchiseAmount = round2(Number(breakdown.franchiseAmount || 0));
    const taxAmount = round2(Number(breakdown.taxAmount || 0));
    const totalPayable = round2(Number(booking.pricing?.totalPayable || 0));

    return await postJournal({
      sourceType: "Booking",
      sourceId: booking._id,
      description: `Ride settlement posted for ${booking.planName || booking.planCode || "booking"}`,
      entries: [
        {
          accountCode: ACCOUNT_CODES.BOOKING_CLEARING.code,
          accountName: ACCOUNT_CODES.BOOKING_CLEARING.name,
          accountType: ACCOUNT_CODES.BOOKING_CLEARING.type,
          direction: "DEBIT",
          amount: totalPayable,
          note: "Release booking clearing",
        },
        ...(ownerAmount > 0
          ? [{
              accountCode: ACCOUNT_CODES.OWNER_PAYABLE.code,
              accountName: ACCOUNT_CODES.OWNER_PAYABLE.name,
              accountType: ACCOUNT_CODES.OWNER_PAYABLE.type,
              direction: "CREDIT",
              amount: ownerAmount,
              note: "Owner earnings",
            }]
          : []),
        ...(platformAmount > 0
          ? [{
              accountCode: ACCOUNT_CODES.PLATFORM_REVENUE.code,
              accountName: ACCOUNT_CODES.PLATFORM_REVENUE.name,
              accountType: ACCOUNT_CODES.PLATFORM_REVENUE.type,
              direction: "CREDIT",
              amount: platformAmount,
              note: "Platform commission",
            }]
          : []),
        ...(franchiseAmount > 0
          ? [{
              accountCode: ACCOUNT_CODES.FRANCHISE_REVENUE.code,
              accountName: ACCOUNT_CODES.FRANCHISE_REVENUE.name,
              accountType: ACCOUNT_CODES.FRANCHISE_REVENUE.type,
              direction: "CREDIT",
              amount: franchiseAmount,
              note: "Franchise share",
            }]
          : []),
        ...(taxAmount > 0
          ? [{
              accountCode: ACCOUNT_CODES.GST_PAYABLE.code,
              accountName: ACCOUNT_CODES.GST_PAYABLE.name,
              accountType: ACCOUNT_CODES.GST_PAYABLE.type,
              direction: "CREDIT",
              amount: taxAmount,
              note: "GST collected",
            }]
          : []),
        ...(securityDeposit > 0
          ? [{
              accountCode: ACCOUNT_CODES.SECURITY_DEPOSIT_HOLD.code,
              accountName: ACCOUNT_CODES.SECURITY_DEPOSIT_HOLD.name,
              accountType: ACCOUNT_CODES.SECURITY_DEPOSIT_HOLD.type,
              direction: "CREDIT",
              amount: securityDeposit,
              note: "Security deposit held",
            }]
          : []),
      ],
      meta: { bookingId: booking._id },
    });
  };

  const postRefundJournal = async ({ booking, amount, destination = "WALLET" }) => {
    const n = round2(Number(amount || 0));
    if (n <= 0) return null;

    return await postJournal({
      sourceType: "Booking",
      sourceId: booking._id,
      description: `Security deposit refund for ${booking.planName || booking.planCode || "booking"}`,
      entries: [
        {
          accountCode: ACCOUNT_CODES.SECURITY_DEPOSIT_HOLD.code,
          accountName: ACCOUNT_CODES.SECURITY_DEPOSIT_HOLD.name,
          accountType: ACCOUNT_CODES.SECURITY_DEPOSIT_HOLD.type,
          direction: "DEBIT",
          amount: n,
          note: "Refund security deposit",
        },
        {
          accountCode: destination === "BANK" ? ACCOUNT_CODES.BANK_CLEARING.code : ACCOUNT_CODES.USER_WALLET.code,
          accountName: destination === "BANK" ? ACCOUNT_CODES.BANK_CLEARING.name : ACCOUNT_CODES.USER_WALLET.name,
          accountType: destination === "BANK" ? ACCOUNT_CODES.BANK_CLEARING.type : ACCOUNT_CODES.USER_WALLET.type,
          direction: "CREDIT",
          amount: n,
          note: `Refund to ${destination.toLowerCase()}`,
        },
      ],
      meta: { bookingId: booking._id, destination },
    });
  };

  const postPayoutJournal = async ({ payout, amount }) => {
    const n = round2(Number(amount || payout?.amount || 0));
    if (n <= 0) return null;

    return await postJournal({
      sourceType: "PayoutRequest",
      sourceId: payout._id,
      description: `Payout completed for ${String(payout.userId || "")}`,
      entries: [
        {
          accountCode: ACCOUNT_CODES.OWNER_PAYABLE.code,
          accountName: ACCOUNT_CODES.OWNER_PAYABLE.name,
          accountType: ACCOUNT_CODES.OWNER_PAYABLE.type,
          direction: "DEBIT",
          amount: n,
          note: "Owner payout settled",
        },
        {
          accountCode: ACCOUNT_CODES.BANK_CLEARING.code,
          accountName: ACCOUNT_CODES.BANK_CLEARING.name,
          accountType: ACCOUNT_CODES.BANK_CLEARING.type,
          direction: "CREDIT",
          amount: n,
          note: "Cash/bank outflow",
        },
      ],
      meta: { payoutId: payout._id },
    });
  };

  const markRefundState = async ({
    bookingId,
    status,
    note = "",
    failureReason = "",
    referenceId = "",
    method = "",
    processedByRole = "SYSTEM",
    processedByUserId = null,
  }) => {
    const booking = await models.Booking.findById(bookingId);
    if (!booking) return null;

    const normalized = String(status || "").trim().toUpperCase();
    const allowed = ["PENDING", "INITIATED", "PROCESSING", "COMPLETED", "FAILED", "NOT_APPLICABLE"];
    if (!allowed.includes(normalized)) {
      const err = new Error("Invalid refund status");
      err.code = "INVALID_REFUND_STATUS";
      throw err;
    }

    const amount = round2(Number(booking.pricing?.securityDeposit || 0));
    const before = booking.toObject();
    booking.refund = {
      ...(booking.refund || {}),
      status: normalized,
      amount,
      method: String(method || booking.refund?.method || "WALLET").trim().toUpperCase(),
      referenceId: referenceId || booking.refund?.referenceId || `RF-${Date.now()}`,
      note: note || booking.refund?.note || "",
      failureReason: normalized === "FAILED" ? String(failureReason || "").trim() : "",
      processedByRole: String(processedByRole || booking.refund?.processedByRole || "SYSTEM").trim().toUpperCase(),
      processedByUserId: processedByUserId || booking.refund?.processedByUserId || null,
      requestedAt: booking.refund?.requestedAt || (normalized !== "NOT_APPLICABLE" ? new Date() : booking.refund?.requestedAt),
      initiatedAt: ["INITIATED", "PROCESSING", "COMPLETED"].includes(normalized)
        ? booking.refund?.initiatedAt || new Date()
        : booking.refund?.initiatedAt,
      processedAt: ["PROCESSING", "COMPLETED", "FAILED"].includes(normalized)
        ? new Date()
        : booking.refund?.processedAt,
      completedAt: normalized === "COMPLETED" ? new Date() : booking.refund?.completedAt,
    };
    if (normalized === "COMPLETED") {
      booking.payment = {
        ...(booking.payment || {}),
        status: "REFUNDED",
      };
    }
    await booking.save();

    if (normalized === "COMPLETED" && amount > 0) {
      const user = await models.User.findById(booking.userId);
      if (user) {
        if (booking.refund.method === "BANK") {
          await postRefundJournal({ booking, amount, destination: "BANK" });
        } else {
          user.walletBalance = round2(Number(user.walletBalance || 0) + amount);
          await user.save();
          await postRefundJournal({ booking, amount, destination: "WALLET" });
        }
        await recordTransaction({
          userId: user._id,
          role: "USER",
          type: "REFUND",
          direction: "CREDIT",
          status: "SUCCESS",
          amount,
          sourceType: "Booking",
          sourceId: booking._id,
          bookingId: booking._id,
          referenceId: booking.refund.referenceId,
          description: `Security deposit refunded to ${booking.refund.method.toLowerCase()}`,
          meta: { bookingId: booking._id, destination: booking.refund.method },
          stationId: booking.pickupStationId,
          createdAt: booking.refund.completedAt,
        });
      }
    }

    return { booking: booking.toObject(), before };
  };

  const generatePdfDocument = ({ title, invoice, footer = "" }) => {
    const fmt = (value) => {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    };
    const lines = [
      `Invoice No: ${invoice.invoiceNumber}`,
      `Receipt No: ${invoice.receiptNumber}`,
      `Booking ID: ${String(invoice.bookingId)}`,
      `Booking Status: ${invoice.bookingStatus}`,
      `Payment Status: ${invoice.paymentStatus}`,
      `Payment Method: ${invoice.paymentMethod || "-"}`,
      `Payment Reference: ${invoice.paymentReferenceId || "-"}`,
      `Customer: ${invoice.customer?.name || "-"}`,
      `Mobile: ${invoice.customer?.mobile || "-"}`,
      `Station: ${invoice.station?.name || "-"}`,
      `Vehicle: ${invoice.vehicle?.modelName || "-"}`,
      `Registration: ${invoice.vehicle?.registrationNumber || "-"}`,
      `Start: ${fmt(invoice.schedule?.startAt)}`,
      `End: ${fmt(invoice.schedule?.endAt)}`,
      `Base Fare: ${invoice.totals?.baseFare || 0}`,
      `Security Deposit: ${invoice.totals?.securityDeposit || 0}`,
      `Convenience Fee: ${invoice.totals?.convenienceFee || 0}`,
      `GST: ${invoice.totals?.taxAmount || 0}`,
      `Discount: ${invoice.totals?.discount || 0}`,
      `Wallet Used: ${invoice.totals?.walletUsed || 0}`,
      `Total Payable: ${invoice.totals?.totalPayable || 0}`,
      `Penalty Amount: ${invoice.totals?.penaltyAmount || 0}`,
      `Grand Total: ${invoice.totals?.grandTotal || invoice.totals?.totalPayable || 0}`,
      `Refund Status: ${invoice.refund?.status || "NOT_APPLICABLE"}`,
      `Refund Amount: ${invoice.refund?.amount || 0}`,
      invoice.penalty?.totalAmount > 0
        ? `Late Fee: ${invoice.penalty.totalAmount} (${invoice.penalty.overMinutes} min @ ₹${invoice.penalty.perMinuteRate}/min)`
        : "",
      "",
      "Ledger Breakdown",
      `Ride Revenue: ${invoice.breakdown?.rideRevenue || 0}`,
      `Owner Amount: ${invoice.breakdown?.ownerAmount || 0}`,
      `Platform Amount: ${invoice.breakdown?.platformAmount || 0}`,
      `Franchise Amount: ${invoice.breakdown?.franchiseAmount || 0}`,
      `GST Amount: ${invoice.breakdown?.taxAmount || 0}`,
    ];
    return buildPdfBuffer({
      title,
      lines,
      footer: footer || `Generated on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
    });
  };

  const listJournals = async ({ sourceType, sourceId, from, to, page, limit } = {}) => {
    return await LedgerService().listJournals({
      sourceType,
      sourceId,
      from,
      to,
      page,
      limit,
    });
  };

  const buildBookingInvoice = async ({ bookingId, bookingDoc = null, customer = null, station = null, vehicle = null }) => {
    const booking = bookingDoc || (await models.Booking.findById(bookingId)
      .populate("vehicleId", "modelName registrationNumber photos ownerId")
      .populate("pickupStationId", "name address")
      .populate("dropStationId", "name address")
      .populate("userId", "name email mobile")
      .lean());

    if (!booking) return null;

    const pricing = booking.pricing || {};
    const pricingSetting = await resolvePricing();
    const breakdown = await getBreakdown(booking);
    const penalty = await calculatePenalty({
      booking,
      actualDurationMinutes: booking.actualDurationMinutes || null,
      pricingSetting,
    });
    const paidAmount = round2(Number(booking.payment?.paidAmount || pricing.totalPayable || 0));
    const securityDeposit = round2(Number(pricing.securityDeposit || 0));
    const convenienceFee = round2(Number(pricing.convenienceFee || 0));
    const baseFare = round2(Number(pricing.baseFare || 0));
    const discount = round2(Number(pricing.discount || 0));
    const walletUsed = round2(Number(pricing.walletUsed || 0));
    const taxAmount = round2(Number(pricing.tax || 0));

    return {
      invoiceNumber: buildInvoiceNumber(booking),
      receiptNumber: buildReceiptNumber(booking),
      bookingId: booking._id,
      bookingStatus: booking.status,
      paymentStatus: booking.payment?.status || "PENDING",
      paymentMethod: booking.payment?.method || "",
      paymentReferenceId: booking.payment?.referenceId || "",
      paidAmount,
      currency: pricingSetting.currency || "INR",
      issuedAt: booking.payment?.paidAt || booking.createdAt,
      customer: customer || {
        id: booking.userId?._id || booking.userId || null,
        name: booking.userId?.name || "",
        mobile: booking.userId?.mobile || "",
        email: booking.userId?.email || "",
      },
      station: station || {
        id: booking.pickupStationId?._id || booking.pickupStationId || null,
        name: booking.pickupStationId?.name || "",
        address: booking.pickupStationId?.address || "",
      },
      vehicle: vehicle || {
        id: booking.vehicleId?._id || booking.vehicleId || null,
        modelName: booking.vehicleId?.modelName || "",
        registrationNumber: booking.vehicleId?.registrationNumber || "",
      },
      schedule: {
        startAt: booking.startAt,
        endAt: booking.endAt,
        durationHours: booking.durationHours,
      },
      totals: {
        baseFare,
        securityDeposit,
        convenienceFee,
        taxAmount,
        discount,
        walletUsed,
        totalPayable: paidAmount,
        penaltyAmount: penalty.totalAmount,
        grandTotal: round2(paidAmount + penalty.totalAmount),
      },
      penalty: {
        bookedMinutes: penalty.bookedMinutes,
        actualMinutes: penalty.actualMinutes,
        overMinutes: penalty.overMinutes,
        perMinuteRate: penalty.perMinuteRate,
        minuteCharge: penalty.minuteCharge,
        totalAmount: penalty.totalAmount,
        currency: penalty.currency,
      },
      refund: {
        status: booking.refund?.status || "NOT_APPLICABLE",
        amount: round2(Number(booking.refund?.amount || 0)),
        method: booking.refund?.method || "WALLET",
        referenceId: booking.refund?.referenceId || "",
        requestedAt: booking.refund?.requestedAt || null,
        initiatedAt: booking.refund?.initiatedAt || null,
        processedAt: booking.refund?.processedAt || null,
        completedAt: booking.refund?.completedAt || null,
        failureReason: booking.refund?.failureReason || "",
        note: booking.refund?.note || "",
      },
      lineItems: [
        { label: "Ride Fare", amount: baseFare },
        { label: "Security Deposit", amount: securityDeposit },
        { label: "Convenience Fee", amount: convenienceFee },
        { label: `GST${pricingSetting.taxPercent != null ? ` (${pricingSetting.taxPercent}%)` : ""}`, amount: taxAmount },
        { label: "Discount", amount: -discount },
        { label: "Wallet Used", amount: -walletUsed },
        ...(penalty.totalAmount > 0
          ? [{ label: `Late Return Penalty (${penalty.overMinutes} min @ ₹${penalty.perMinuteRate}/min)`, amount: penalty.totalAmount }]
          : []),
      ],
      breakdown: {
        rideRevenue: breakdown.rideRevenue,
        platformAmount: breakdown.platformAmount,
        ownerAmount: breakdown.ownerAmount,
        franchiseAmount: breakdown.franchiseAmount,
        taxAmount: breakdown.taxAmount,
      },
    };
  };

  const deriveBookingTransactions = async ({ userId = null, role = null, type = null, from = null, to = null, stationId = null, ownerId = null } = {}) => {
    const query = {};
    const range = buildRange(from, to);
    if (Object.keys(range).length > 0) query.createdAt = range;
    if (userId) query.userId = userId;
    if (stationId && mongoose.Types.ObjectId.isValid(String(stationId))) query.stationId = stationId;

    if (ownerId && mongoose.Types.ObjectId.isValid(String(ownerId))) {
      const vehicleIds = await models.Vehicle.find({ ownerId }).distinct("_id");
      query.vehicleId = { $in: vehicleIds };
    }

    const bookings = await models.Booking.find(query)
      .populate("vehicleId", "modelName registrationNumber ownerId")
      .populate("pickupStationId", "name address")
      .populate("dropStationId", "name address")
      .populate("userId", "name email mobile")
      .lean();

    const rows = [];
    for (const booking of bookings) {
      const baseRecord = {
        bookingId: booking._id,
        sourceType: "Booking",
        sourceId: booking._id,
        currency: "INR",
        meta: { bookingId: booking._id },
      };

      if (booking.payment?.status === "PAID" || booking.status !== "PENDING_PAYMENT") {
        rows.push({
          ...baseRecord,
          userId: booking.userId?._id || booking.userId,
          role: "USER",
          type: "BOOKING_PAYMENT",
          direction: "DEBIT",
          status: booking.payment?.status || "SUCCESS",
          amount: round2(Number(booking.payment?.paidAmount || booking.pricing?.totalPayable || 0)),
          taxAmount: round2(Number(booking.pricing?.tax || 0)),
          referenceId: booking.payment?.referenceId || "",
          description: `Payment for ${booking.planName || booking.planCode || "booking"}`,
          createdAt: booking.payment?.paidAt || booking.createdAt,
          stationId: booking.pickupStationId?._id || booking.pickupStationId || null,
        });
      }

      if (Number(booking.pricing?.walletUsed || 0) > 0) {
        rows.push({
          ...baseRecord,
          userId: booking.userId?._id || booking.userId,
          role: "USER",
          type: "WALLET_DEBIT",
          direction: "DEBIT",
          status: "SUCCESS",
          amount: round2(Number(booking.pricing.walletUsed || 0)),
          referenceId: booking.payment?.referenceId || "",
          description: "Wallet used for booking",
          createdAt: booking.payment?.paidAt || booking.createdAt,
          stationId: booking.pickupStationId?._id || booking.pickupStationId || null,
        });
      }

      if (booking.status === "COMPLETED") {
        const breakdown = await getBreakdown(booking);
        const ownerIdValue = booking.vehicleId?.ownerId || null;
        if (ownerIdValue) {
          rows.push({
            ...baseRecord,
            userId: ownerIdValue,
            role: "OWNER",
            type: "OWNER_EARNING",
            direction: "CREDIT",
            status: "SUCCESS",
            amount: breakdown.ownerAmount,
            commissionAmount: breakdown.platformAmount,
            ownerAmount: breakdown.ownerAmount,
            platformAmount: breakdown.platformAmount,
            taxAmount: breakdown.taxAmount,
            referenceId: booking.payment?.referenceId || "",
            description: `Earning for ${booking.planName || booking.planCode || "ride"}`,
            createdAt: booking.rideEndedAt || booking.updatedAt || booking.createdAt,
            stationId: booking.pickupStationId?._id || booking.pickupStationId || null,
          });
        }

        rows.push({
          ...baseRecord,
          userId: booking.vehicleId?.ownerId || null,
          role: "ADMIN",
          type: "PLATFORM_COMMISSION",
          direction: "CREDIT",
          status: "SUCCESS",
          amount: breakdown.platformAmount,
          commissionAmount: breakdown.platformAmount,
          taxAmount: breakdown.taxAmount,
          referenceId: booking.payment?.referenceId || "",
          description: `Platform commission for ${booking.planName || booking.planCode || "ride"}`,
          createdAt: booking.rideEndedAt || booking.updatedAt || booking.createdAt,
          stationId: booking.pickupStationId?._id || booking.pickupStationId || null,
        });

        rows.push({
          ...baseRecord,
          userId: booking.vehicleId?.ownerId || null,
          role: "ADMIN",
          type: "GST_COLLECTION",
          direction: "CREDIT",
          status: "SUCCESS",
          amount: breakdown.taxAmount,
          taxAmount: breakdown.taxAmount,
          referenceId: booking.payment?.referenceId || "",
          description: `GST for ${booking.planName || booking.planCode || "ride"}`,
          createdAt: booking.rideEndedAt || booking.updatedAt || booking.createdAt,
          stationId: booking.pickupStationId?._id || booking.pickupStationId || null,
        });
      }

      if (booking.refund && booking.refund.status && booking.refund.status !== "NOT_APPLICABLE") {
        rows.push({
          ...baseRecord,
          userId: booking.userId?._id || booking.userId,
          role: "USER",
          type: "REFUND",
          direction: booking.refund.status === "COMPLETED" ? "CREDIT" : "DEBIT",
          status: booking.refund.status === "COMPLETED" ? "SUCCESS" : "PROCESSING",
          amount: round2(Number(booking.refund.amount || booking.pricing?.securityDeposit || 0)),
          referenceId: booking.refund.referenceId || "",
          description: `Security deposit refund ${booking.refund.status.toLowerCase()}`,
          createdAt: booking.refund.completedAt || booking.refund.processedAt || booking.refund.requestedAt || booking.updatedAt || booking.createdAt,
          stationId: booking.pickupStationId?._id || booking.pickupStationId || null,
          meta: {
            bookingId: booking._id,
            refundStatus: booking.refund.status,
          },
        });
      }
    }

    return rows.filter((row) => {
      if (userId && String(row.userId) !== String(userId)) return false;
      if (role && String(row.role).toUpperCase() !== String(role).toUpperCase()) return false;
      if (type && String(row.type).toUpperCase() !== String(type).toUpperCase()) return false;
      return true;
    });
  };

  const listTransactions = async ({
    userId = null,
    role = null,
    type = null,
    from = null,
    to = null,
    stationId = null,
    ownerId = null,
    page = 1,
    limit = 20,
  } = {}) => {
    const pageNumber = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNumber - 1) * pageSize;

    const query = {};
    if (userId) query.userId = userId;
    if (role) query.role = String(role).trim().toUpperCase();
    if (type) query.type = String(type).trim().toUpperCase();
    const range = buildRange(from, to);
    if (Object.keys(range).length > 0) query.createdAt = range;

    const [persisted, fallback] = await Promise.all([
      models.Transaction.find(query).sort({ createdAt: -1 }).lean(),
      deriveBookingTransactions({ userId, role, type, from, to, stationId, ownerId }),
    ]);

    const seen = new Set(persisted.map((item) => makeKey(item)));
    const merged = [...persisted.map(normalizeTransaction)];

    for (const item of fallback) {
      const normalized = {
        ...item,
        _id: item._id || `${item.type}-${item.bookingId || item.sourceId || item.createdAt}`,
      };
      const key = makeKey(normalized);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({
        ...normalized,
        id: normalized._id,
        key,
      });
    }

    merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const total = merged.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      transactions: merged.slice(skip, skip + pageSize),
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

  const getTransactionSummary = async ({ userId = null, role = null, from = null, to = null, stationId = null, ownerId = null } = {}) => {
    const data = await listTransactions({ userId, role, from, to, stationId, ownerId, page: 1, limit: 1000 });
    const items = data.transactions || [];

    return items.reduce(
      (acc, item) => {
        const amount = round2(item.amount || 0);
        acc.count += 1;
        if (item.direction === "CREDIT") acc.credit += amount;
        if (item.direction === "DEBIT") acc.debit += amount;
        if (item.type === "GST_COLLECTION") acc.gst += amount;
        if (item.type === "PLATFORM_COMMISSION") acc.platformCommission += amount;
        if (item.type === "OWNER_EARNING") acc.ownerEarnings += amount;
        if (item.type === "PAYOUT_REQUEST") acc.payouts += amount;
        return acc;
      },
      { count: 0, credit: 0, debit: 0, gst: 0, platformCommission: 0, ownerEarnings: 0, payouts: 0 },
    );
  };

  return {
    recordTransaction,
    buildBookingInvoice,
    postBookingPaymentJournal,
    postRideCompletionJournal,
    postRefundJournal,
    postPayoutJournal,
    markRefundState,
    generatePdfDocument,
    listJournals,
    listTransactions,
    getTransactionSummary,
    getBreakdown,
    calculatePenalty,
  };
};
