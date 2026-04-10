const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const POSTMAN_DIR = path.join(ROOT, "postman");
const COLLECTION_PATH = path.join(POSTMAN_DIR, "Scooty Rental APIs.postman_collection.json");
const ENV_PATH = path.join(POSTMAN_DIR, "Scooty Rental APIs.postman_environment.json");

const BASE_URL = "{{baseUrl}}";

const jsonHeader = { key: "Content-Type", value: "application/json", type: "text" };

const envVars = [
  ["baseUrl", "http://localhost:3000/v1/api"],
  ["userToken", ""],
  ["ownerToken", ""],
  ["adminToken", ""],
  ["stationAdminToken", ""],
  ["userId", ""],
  ["ownerId", ""],
  ["adminId", ""],
  ["stationAdminId", ""],
  ["stationId", ""],
  ["vehicleId", ""],
  ["bookingId", ""],
  ["ticketId", ""],
  ["requestId", ""],
  ["notificationId", ""],
  ["settlementId", ""],
  ["rideId", ""],
  ["planId", ""],
  ["faqId", ""],
  ["transactionId", ""],
];

const q = (key, value) => ({ key, value: String(value) });
const rawBody = (value) => ({ mode: "raw", raw: JSON.stringify(value, null, 2) });
const formBody = (fields) => ({ mode: "formdata", formdata: fields });

const url = (path, query = []) => {
  const suffix = query.length ? `?${query.map((item) => `${item.key}=${item.value}`).join("&")}` : "";
  return { raw: `${BASE_URL}${path}${suffix}` };
};

const req = ({ name, method, path, authVar = null, body = null, query = [], description = "" }) => {
  const headers = [];
  if (authVar) {
    headers.push({ key: "Authorization", value: `Bearer {{${authVar}}}`, type: "text" });
  }
  if (body && body.mode === "raw") {
    headers.push(jsonHeader);
  }

  const request = {
    method,
    header: headers,
    url: url(path, query),
  };

  if (description) request.description = description;
  if (body) request.body = body;

  return { name, request };
};

const folder = (name, items, description = "") => ({
  name,
  item: items,
  ...(description ? { description } : {}),
});

const collection = {
  info: {
    name: "Scooty Rental APIs",
    description:
      "Folder-wise Postman collection for user, owner, admin, and station admin roles.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: [
    folder("User", [
      folder("Auth", [
        req({
          name: "User Signup",
          method: "POST",
          path: "/user/auth/signup",
          body: rawBody({
            name: "User Name",
            address: "AB Road, Indore",
            mobile: "9999999999",
            city: "Indore",
          }),
        }),
        req({
          name: "Send OTP",
          method: "POST",
          path: "/user/auth/send-otp",
          body: rawBody({ mobile: "9999999999" }),
        }),
        req({
          name: "Verify OTP",
          method: "POST",
          path: "/user/auth/verify-otp",
          body: rawBody({ mobile: "9999999999", otp: "1234" }),
        }),
      ]),
      folder("Discovery", [
        req({
          name: "List Plans",
          method: "GET",
          path: "/user/plans",
          authVar: "userToken",
          query: [q("stationId", "{{stationId}}")],
        }),
        req({
          name: "List Stations",
          method: "GET",
          path: "/user/stations",
          authVar: "userToken",
          query: [q("lat", "22.7196"), q("lng", "75.8577"), q("search", "central")],
        }),
        req({
          name: "Station Detail",
          method: "GET",
          path: "/user/stations/{{stationId}}",
          authVar: "userToken",
        }),
        req({
          name: "Time Slots",
          method: "GET",
          path: "/user/time-slots",
          authVar: "userToken",
          query: [q("date", "2026-03-25"), q("planCode", "DAY_PASS"), q("stationId", "{{stationId}}")],
        }),
      ]),
      folder("Profile", [
        req({
          name: "My Profile",
          method: "GET",
          path: "/user/me",
          authVar: "userToken",
        }),
        req({
          name: "Update Profile",
          method: "PATCH",
          path: "/user/me",
          authVar: "userToken",
          body: rawBody({
            name: "New Name",
            email: "me@example.com",
            profilePhotoUrl: "https://example.com/photo.jpg",
          }),
        }),
      ]),
      folder("Bookings", [
        req({
          name: "Booking Quote",
          method: "POST",
          path: "/user/bookings/quote",
          authVar: "userToken",
          body: rawBody({
            pickupStationId: "{{stationId}}",
            dropStationId: "{{stationId}}",
            planCode: "DAY_PASS",
            date: "2026-03-25",
            startTime: "10:00",
            referralCode: "MVABCD12",
            walletToUse: 100,
          }),
        }),
        req({
          name: "Create Booking",
          method: "POST",
          path: "/user/bookings",
          authVar: "userToken",
          body: rawBody({
            pickupStationId: "{{stationId}}",
            dropStationId: "{{stationId}}",
            planCode: "DAY_PASS",
            date: "2026-03-25",
            startTime: "10:00",
            paymentMethod: "UPI",
            paymentReferenceId: "pay_demo_001",
            walletToUse: 100,
          }),
        }),
        req({
          name: "List Bookings",
          method: "GET",
          path: "/user/bookings",
          authVar: "userToken",
          query: [q("status", "CONFIRMED")],
        }),
        req({
          name: "Booking Detail",
          method: "GET",
          path: "/user/bookings/{{bookingId}}",
          authVar: "userToken",
        }),
        req({
          name: "Pay Booking",
          method: "POST",
          path: "/user/bookings/{{bookingId}}/pay",
          authVar: "userToken",
          body: rawBody({ paymentMethod: "UPI", paymentReferenceId: "pay_demo_002" }),
        }),
        req({
          name: "Start Ride",
          method: "POST",
          path: "/user/bookings/{{bookingId}}/start",
          authVar: "userToken",
          body: rawBody({ unlockCode: "MV-ABC123" }),
        }),
        req({
          name: "Complete Ride",
          method: "POST",
          path: "/user/bookings/{{bookingId}}/complete",
          authVar: "userToken",
          body: rawBody({
            dropStationId: "{{stationId}}",
            parkingPhotoUrl: "https://example.com/parking.jpg",
            rating: 5,
            review: "Smooth ride",
          }),
        }),
      ]),
      folder("Finance & Referral", [
        req({
          name: "Ride History",
          method: "GET",
          path: "/user/rides/history",
          authVar: "userToken",
        }),
        req({
          name: "Wallet Summary",
          method: "GET",
          path: "/user/wallet",
          authVar: "userToken",
        }),
        req({
          name: "Transactions",
          method: "GET",
          path: "/user/transactions",
          authVar: "userToken",
          query: [q("type", "CREDIT"), q("from", "2026-01-01"), q("to", "2026-12-31"), q("page", "1"), q("limit", "20")],
        }),
        req({
          name: "Booking Invoice",
          method: "GET",
          path: "/user/bookings/{{bookingId}}/invoice",
          authVar: "userToken",
        }),
        req({
          name: "Booking Refund",
          method: "GET",
          path: "/user/bookings/{{bookingId}}/refund",
          authVar: "userToken",
        }),
        req({
          name: "Invoice PDF",
          method: "GET",
          path: "/user/bookings/{{bookingId}}/invoice/pdf",
          authVar: "userToken",
        }),
        req({
          name: "Receipt PDF",
          method: "GET",
          path: "/user/bookings/{{bookingId}}/receipt/pdf",
          authVar: "userToken",
        }),
        req({
          name: "Referral Summary",
          method: "GET",
          path: "/user/referral",
          authVar: "userToken",
        }),
        req({
          name: "Apply Referral",
          method: "POST",
          path: "/user/referral/apply",
          authVar: "userToken",
          body: rawBody({ referralCode: "MVABCD12" }),
        }),
      ]),
      folder("Notifications", [
        req({
          name: "List Notifications",
          method: "GET",
          path: "/user/notifications",
          authVar: "userToken",
          query: [q("type", "SYSTEM")],
        }),
        req({
          name: "Mark All Read",
          method: "PATCH",
          path: "/user/notifications/read-all",
          authVar: "userToken",
          query: [q("type", "SYSTEM")],
        }),
        req({
          name: "Mark Read",
          method: "PATCH",
          path: "/user/notifications/{{notificationId}}/read",
          authVar: "userToken",
        }),
      ]),
      folder("Support", [
        req({
          name: "Support FAQs",
          method: "GET",
          path: "/user/support/faqs",
          authVar: "userToken",
          query: [q("stationId", "{{stationId}}")],
        }),
        req({
          name: "Support Tickets",
          method: "GET",
          path: "/user/support/tickets",
          authVar: "userToken",
        }),
        req({
          name: "Create Ticket",
          method: "POST",
          path: "/user/support/tickets",
          authVar: "userToken",
          body: rawBody({ subject: "Ride issue", message: "Unable to unlock the scooter" }),
        }),
        req({
          name: "Ticket Detail",
          method: "GET",
          path: "/user/support/tickets/{{ticketId}}",
          authVar: "userToken",
        }),
      ]),
    ]),

    folder("Owner", [
      folder("Auth", [
        req({
          name: "Owner Signup",
          method: "POST",
          path: "/owner/auth/signup",
          body: rawBody({
            fullName: "Owner Name",
            address: "AB Road, Indore",
            mobile: "7777777777",
            city: "Indore",
          }),
        }),
        req({
          name: "Send OTP",
          method: "POST",
          path: "/owner/auth/send-otp",
          body: rawBody({ mobile: "7777777777" }),
        }),
        req({
          name: "Verify OTP",
          method: "POST",
          path: "/owner/auth/verify-otp",
          body: rawBody({
            mobile: "7777777777",
            otp: "1234",
            name: "Owner Name",
            companyName: "Fleet Owner",
          }),
        }),
      ]),
      folder("Dashboard & Earnings", [
        req({
          name: "Dashboard",
          method: "GET",
          path: "/owner/dashboard",
          authVar: "ownerToken",
        }),
        req({
          name: "Earnings",
          method: "GET",
          path: "/owner/earnings",
          authVar: "ownerToken",
          query: [q("from", "2026-01-01"), q("to", "2026-12-31")],
        }),
        req({
          name: "Transactions",
          method: "GET",
          path: "/owner/transactions",
          authVar: "ownerToken",
          query: [q("type", "CREDIT"), q("from", "2026-01-01"), q("to", "2026-12-31"), q("page", "1"), q("limit", "20")],
        }),
      ]),
      folder("Profile & KYC", [
        req({
          name: "My Profile",
          method: "GET",
          path: "/owner/me",
          authVar: "ownerToken",
        }),
        req({
          name: "Update Profile",
          method: "PATCH",
          path: "/owner/me",
          authVar: "ownerToken",
          body: rawBody({
            name: "Owner Name",
            email: "owner@example.com",
            city: "Indore",
            companyName: "Fleet Owner",
            adress: "AB Road",
            state: "MP",
            pincode: "452001",
          }),
          description:
            "If you need to upload profile or KYC files, send multipart/form-data from Postman.",
        }),
        req({
          name: "Bank Details",
          method: "GET",
          path: "/owner/bank",
          authVar: "ownerToken",
        }),
        req({
          name: "KYC Status",
          method: "GET",
          path: "/owner/kyc",
          authVar: "ownerToken",
        }),
        req({
          name: "Submit KYC",
          method: "PATCH",
          path: "/owner/kyc",
          authVar: "ownerToken",
          description:
            "Send multipart/form-data with file fields: profilePhoto, adharFile, panFile.",
        }),
      ]),
      folder("Payouts", [
        req({
          name: "List Payouts",
          method: "GET",
          path: "/owner/payouts",
          authVar: "ownerToken",
        }),
        req({
          name: "Request Payout",
          method: "POST",
          path: "/owner/payouts/request",
          authVar: "ownerToken",
          body: rawBody({ amount: 1000, note: "Monthly payout request" }),
        }),
      ]),
      folder("Vehicles", [
        req({
          name: "List Vehicles",
          method: "GET",
          path: "/owner/vehicles",
          authVar: "ownerToken",
          query: [q("status", "ACTIVE")],
        }),
        req({
          name: "Create Vehicle",
          method: "POST",
          path: "/owner/vehicles",
          authVar: "ownerToken",
          description:
            "If vehicle media/files are required, send multipart/form-data using the fields expected by the vehicle controller.",
        }),
        req({
          name: "Vehicle Detail",
          method: "GET",
          path: "/owner/vehicles/{{vehicleId}}",
          authVar: "ownerToken",
        }),
        req({
          name: "Update Vehicle",
          method: "PATCH",
          path: "/owner/vehicles/{{vehicleId}}",
          authVar: "ownerToken",
          description:
            "If vehicle media/files are required, send multipart/form-data using the fields expected by the vehicle controller.",
        }),
        req({
          name: "Request Removal",
          method: "DELETE",
          path: "/owner/vehicles/{{vehicleId}}",
          authVar: "ownerToken",
        }),
      ]),
      folder("Maintenance", [
        req({
          name: "List Maintenance",
          method: "GET",
          path: "/owner/maintenance",
          authVar: "ownerToken",
          query: [q("status", "OPEN")],
        }),
        req({
          name: "Create Maintenance",
          method: "POST",
          path: "/owner/maintenance",
          authVar: "ownerToken",
          body: rawBody({ vehicleId: "{{vehicleId}}", title: "Battery issue", description: "Battery draining fast" }),
        }),
        req({
          name: "Maintenance Detail",
          method: "GET",
          path: "/owner/maintenance/{{requestId}}",
          authVar: "ownerToken",
        }),
      ]),
      folder("Support", [
        req({
          name: "Support FAQs",
          method: "GET",
          path: "/owner/support/faqs",
          authVar: "ownerToken",
        }),
        req({
          name: "Support Tickets",
          method: "GET",
          path: "/owner/support/tickets",
          authVar: "ownerToken",
        }),
        req({
          name: "Create Ticket",
          method: "POST",
          path: "/owner/support/tickets",
          authVar: "ownerToken",
          body: rawBody({ subject: "Payout delay", message: "My payout is pending for long" }),
        }),
        req({
          name: "Ticket Detail",
          method: "GET",
          path: "/owner/support/tickets/{{ticketId}}",
          authVar: "ownerToken",
        }),
      ]),
      folder("Settings", [
        req({
          name: "Settings",
          method: "GET",
          path: "/owner/settings",
          authVar: "ownerToken",
        }),
        req({
          name: "Update Settings",
          method: "PATCH",
          path: "/owner/settings",
          authVar: "ownerToken",
          body: rawBody({
            notifications: {
              rideUpdates: true,
              earnings: true,
              payout: true,
              promotions: true,
              maintenance: true,
            },
          }),
        }),
      ]),
    ]),

    folder("Admin", [
      folder("Auth", [
        req({
          name: "Admin Login",
          method: "POST",
          path: "/admin/auth/login",
          body: rawBody({ email: "admin@station.com", password: "Admin@123" }),
        }),
        req({
          name: "Forgot Password Send OTP",
          method: "POST",
          path: "/admin/auth/forgot-password/send-otp",
          body: rawBody({ email: "admin@station.com" }),
        }),
        req({
          name: "Forgot Password Resend OTP",
          method: "POST",
          path: "/admin/auth/forgot-password/resend-otp",
          body: rawBody({ transactionId: "{{transactionId}}" }),
        }),
        req({
          name: "Forgot Password Reset",
          method: "POST",
          path: "/admin/auth/forgot-password/reset",
          body: rawBody({
            transactionId: "{{transactionId}}",
            otp: "123456",
            newPassword: "NewPass@123",
          }),
        }),
      ]),
      folder("Profile & Account", [
        req({
          name: "My Profile",
          method: "GET",
          path: "/admin/me",
          authVar: "adminToken",
        }),
        req({
          name: "Update Profile",
          method: "PATCH",
          path: "/admin/me",
          authVar: "adminToken",
          body: rawBody({ name: "Admin Name", email: "admin@example.com", mobile: "9000000000" }),
        }),
        req({
          name: "Change Password",
          method: "POST",
          path: "/admin/change-password",
          authVar: "adminToken",
          body: rawBody({ oldPassword: "Admin@123", newPassword: "Admin@1234" }),
        }),
      ]),
      folder("Users & KYC", [
        req({
          name: "List Users",
          method: "GET",
          path: "/admin/users",
          authVar: "adminToken",
          query: [q("role", "OWNER"), q("status", "ACTIVE"), q("q", ""), q("page", "1"), q("limit", "20")],
        }),
        req({
          name: "Update User Status",
          method: "PATCH",
          path: "/admin/users/{{userId}}/status",
          authVar: "adminToken",
          body: rawBody({ isActive: false, note: "Fraud review" }),
        }),
        req({
          name: "Update Owner KYC Status",
          method: "PATCH",
          path: "/admin/users/{{userId}}/kyc-status",
          authVar: "adminToken",
          body: rawBody({ kycStatus: "APPROVED", rejectionReason: "Document unclear" }),
        }),
      ]),
      folder("Stations & Staff", [
        req({
          name: "List Station Admins",
          method: "GET",
          path: "/admin/station-admins",
          authVar: "adminToken",
        }),
        req({
          name: "Create Station Admin",
          method: "POST",
          path: "/admin/station-admins",
          authVar: "adminToken",
          body: rawBody({
            name: "Station Admin",
            email: "sa@example.com",
            password: "Sa@123",
            mobile: "8888888888",
            isActive: true,
            role: "STATION_ADMIN",
            stationId: "{{stationId}}",
          }),
        }),
        req({
          name: "List Stations",
          method: "GET",
          path: "/admin/stations",
          authVar: "adminToken",
        }),
        req({
          name: "Create Station",
          method: "POST",
          path: "/admin/stations",
          authVar: "adminToken",
          body: rawBody({
            name: "Indore Station 1",
            address: "AB Road, Indore",
            parkingType: "OPEN",
            lat: 22.7196,
            lng: 75.8577,
            isActive: true,
            stationAdminId: "{{stationAdminId}}",
          }),
        }),
      ]),
      folder("Content Moderation", [
        req({
          name: "List Ride Plans",
          method: "GET",
          path: "/admin/ride-plans",
          authVar: "adminToken",
        }),
        req({
          name: "Review Ride Plan",
          method: "PATCH",
          path: "/admin/ride-plans/{{planId}}/review",
          authVar: "adminToken",
          body: rawBody({ status: "APPROVED", note: "Looks good" }),
        }),
        req({
          name: "List FAQs",
          method: "GET",
          path: "/admin/faqs",
          authVar: "adminToken",
        }),
        req({
          name: "Review FAQ",
          method: "PATCH",
          path: "/admin/faqs/{{faqId}}/review",
          authVar: "adminToken",
          body: rawBody({ status: "APPROVED", note: "Accepted" }),
        }),
      ]),
      folder("Pricing & Commission", [
        req({
          name: "Get Pricing",
          method: "GET",
          path: "/admin/pricing",
          authVar: "adminToken",
        }),
        req({
          name: "Update Pricing",
          method: "PATCH",
          path: "/admin/pricing",
          authVar: "adminToken",
          body: rawBody({
            currency: "INR",
            baseFarePerHour: 100,
            baseFarePerDay: 450,
            securityDepositDefault: 500,
            convenienceFeePercent: 3,
            minimumConvenienceFee: 9,
            taxPercent: 18,
            penaltySlabs: 3,
          }),
        }),
        req({
          name: "Get Commission",
          method: "GET",
          path: "/admin/commission",
          authVar: "adminToken",
        }),
        req({
          name: "Update Commission",
          method: "PATCH",
          path: "/admin/commission",
          authVar: "adminToken",
          body: rawBody({ platformCommissionPercent: 20, ownerSharePercent: 80, franchiseSharePercent: 0 }),
        }),
      ]),
      folder("Settlements", [
        req({
          name: "List Settlements",
          method: "GET",
          path: "/admin/settlements",
          authVar: "adminToken",
          query: [q("status", "PENDING"), q("userId", "{{ownerId}}"), q("page", "1"), q("limit", "20")],
        }),
        req({
          name: "Create Settlement",
          method: "POST",
          path: "/admin/settlements",
          authVar: "adminToken",
          body: rawBody({ userId: "{{ownerId}}", amount: 1000, note: "Monthly settlement" }),
        }),
        req({
          name: "Update Settlement Status",
          method: "PATCH",
          path: "/admin/settlements/{{settlementId}}/status",
          authVar: "adminToken",
          body: rawBody({ status: "PROCESSING", note: "Queued for payout" }),
        }),
      ]),
      folder("Reports & Finance", [
        req({
          name: "Reports",
          method: "GET",
          path: "/admin/reports",
          authVar: "adminToken",
          query: [q("from", "2026-01-01"), q("to", "2026-12-31"), q("stationId", "{{stationId}}")],
        }),
        req({
          name: "Transactions",
          method: "GET",
          path: "/admin/transactions",
          authVar: "adminToken",
          query: [q("type", "CREDIT"), q("from", "2026-01-01"), q("to", "2026-12-31"), q("stationId", "{{stationId}}"), q("userId", "{{ownerId}}"), q("page", "1"), q("limit", "20")],
        }),
        req({
          name: "Booking Invoice",
          method: "GET",
          path: "/admin/bookings/{{bookingId}}/invoice",
          authVar: "adminToken",
        }),
        req({
          name: "Booking Invoice PDF",
          method: "GET",
          path: "/admin/bookings/{{bookingId}}/invoice/pdf",
          authVar: "adminToken",
        }),
        req({
          name: "Booking Refund",
          method: "PATCH",
          path: "/admin/bookings/{{bookingId}}/refund",
          authVar: "adminToken",
          body: rawBody({
            status: "PROCESSING",
            method: "WALLET",
            note: "Refund under review",
          }),
        }),
        req({
          name: "Ledger",
          method: "GET",
          path: "/admin/ledger",
          authVar: "adminToken",
          query: [q("sourceType", "BOOKING"), q("sourceId", "{{bookingId}}"), q("from", "2026-01-01"), q("to", "2026-12-31"), q("page", "1"), q("limit", "20")],
        }),
      ]),
      folder("Access Control", [
        req({
          name: "List Admins",
          method: "GET",
          path: "/admin/access-control/admins",
          authVar: "adminToken",
          query: [q("q", ""), q("page", "1"), q("limit", "20")],
        }),
        req({
          name: "Create Admin",
          method: "POST",
          path: "/admin/access-control/admins",
          authVar: "adminToken",
          body: rawBody({
            name: "Ops Admin",
            email: "ops@example.com",
            password: "Ops@123",
            mobile: "9000000000",
            isActive: true,
            permissions: ["dashboard", "reports"],
          }),
        }),
        req({
          name: "Update Admin",
          method: "PATCH",
          path: "/admin/access-control/admins/{{adminId}}",
          authVar: "adminToken",
          body: rawBody({
            name: "Ops Admin",
            mobile: "9000000001",
            isActive: true,
            permissions: ["dashboard", "reports", "settlements"],
          }),
        }),
      ]),
      folder("Audit Logs", [
        req({
          name: "List Audit Logs",
          method: "GET",
          path: "/admin/audit-logs",
          authVar: "adminToken",
          query: [
            q("action", ""),
            q("entityType", ""),
            q("adminId", "{{adminId}}"),
            q("from", "2026-01-01"),
            q("to", "2026-12-31"),
            q("page", "1"),
            q("limit", "20"),
          ],
        }),
      ]),
    ]),

    folder("Station Admin / Franchise", [
      folder("Auth", [
        req({
          name: "Login",
          method: "POST",
          path: "/station-admin/auth/login",
          body: rawBody({ email: "sa@station.com", password: "Sa@123" }),
        }),
        req({
          name: "Send OTP",
          method: "POST",
          path: "/station-admin/auth/send-otp",
          body: rawBody({ email: "sa@station.com" }),
        }),
        req({
          name: "Resend OTP",
          method: "POST",
          path: "/station-admin/auth/resend-otp",
          body: rawBody({ transactionId: "{{transactionId}}" }),
        }),
        req({
          name: "Verify OTP",
          method: "POST",
          path: "/station-admin/auth/verify-otp",
          body: rawBody({ email: "sa@station.com", otp: "123456" }),
        }),
        req({
          name: "Forgot Password Send OTP",
          method: "POST",
          path: "/station-admin/auth/forgot-password/send-otp",
          body: rawBody({ email: "sa@station.com" }),
        }),
        req({
          name: "Forgot Password Resend OTP",
          method: "POST",
          path: "/station-admin/auth/forgot-password/resend-otp",
          body: rawBody({ transactionId: "{{transactionId}}" }),
        }),
        req({
          name: "Forgot Password Reset",
          method: "POST",
          path: "/station-admin/auth/forgot-password/reset",
          body: rawBody({
            transactionId: "{{transactionId}}",
            otp: "123456",
            newPassword: "NewPass@123",
          }),
        }),
      ]),
      folder("Profile & Stations", [
        req({
          name: "My Profile",
          method: "GET",
          path: "/station-admin/me",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Update Profile",
          method: "PATCH",
          path: "/station-admin/me",
          authVar: "stationAdminToken",
          body: rawBody({ name: "Station Admin", mobile: "8888888888" }),
        }),
        req({
          name: "Change Password",
          method: "POST",
          path: "/station-admin/change-password",
          authVar: "stationAdminToken",
          body: rawBody({ oldPassword: "Sa@123", newPassword: "Sa@1234" }),
        }),
        req({
          name: "List Stations",
          method: "GET",
          path: "/station-admin/stations",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Station Detail",
          method: "GET",
          path: "/station-admin/stations/{{stationId}}",
          authVar: "stationAdminToken",
        }),
      ]),
      folder("Dashboard", [
        req({
          name: "Dashboard",
          method: "GET",
          path: "/station-admin/dashboard",
          authVar: "stationAdminToken",
          query: [q("stationId", "{{stationId}}")],
        }),
      ]),
      folder("Content", [
        req({
          name: "List Ride Plans",
          method: "GET",
          path: "/station-admin/ride-plans",
          authVar: "stationAdminToken",
          query: [q("stationId", "{{stationId}}"), q("status", "PENDING")],
        }),
        req({
          name: "Create Ride Plan",
          method: "POST",
          path: "/station-admin/ride-plans",
          authVar: "stationAdminToken",
          body: rawBody({
            stationId: "{{stationId}}",
            code: "DAY_PASS",
            name: "Full Day",
            type: "DAY_PASS",
            durationHours: 12,
            price: 399,
            securityDeposit: 500,
            description: "A full-day option for work or travel.",
            perks: ["Up to 12 hours", "Best value per hour"],
            badge: "Most Popular",
          }),
        }),
        req({
          name: "Update Ride Plan",
          method: "PATCH",
          path: "/station-admin/ride-plans/{{planId}}",
          authVar: "stationAdminToken",
          body: rawBody({
            stationId: "{{stationId}}",
            code: "DAY_PASS",
            name: "Full Day",
            type: "DAY_PASS",
            durationHours: 12,
            price: 399,
            securityDeposit: 500,
            description: "Updated description",
            perks: ["Up to 12 hours"],
            badge: "Most Popular",
          }),
        }),
        req({
          name: "List FAQs",
          method: "GET",
          path: "/station-admin/faqs",
          authVar: "stationAdminToken",
          query: [q("stationId", "{{stationId}}"), q("status", "PENDING")],
        }),
        req({
          name: "Create FAQ",
          method: "POST",
          path: "/station-admin/faqs",
          authVar: "stationAdminToken",
          body: rawBody({
            stationId: "{{stationId}}",
            question: "How do I unlock the scooty?",
            answer: "Open the active booking and use the unlock code from the app.",
          }),
        }),
        req({
          name: "Update FAQ",
          method: "PATCH",
          path: "/station-admin/faqs/{{faqId}}",
          authVar: "stationAdminToken",
          body: rawBody({
            stationId: "{{stationId}}",
            question: "How do I unlock the scooty?",
            answer: "Use the unlock code from the app.",
          }),
        }),
      ]),
      folder("Vehicles", [
        req({
          name: "List Vehicles",
          method: "GET",
          path: "/station-admin/vehicles",
          authVar: "stationAdminToken",
          query: [q("status", "ACTIVE"), q("q", ""), q("page", "1"), q("limit", "20")],
        }),
        req({
          name: "Create Vehicle",
          method: "POST",
          path: "/station-admin/vehicles",
          authVar: "stationAdminToken",
          body: rawBody({
            ownerId: "{{ownerId}}",
            modelName: "Ola S1 Pro",
            registrationNumber: "KA-01-AB-1234",
            chassisNumber: "CHASSIS123",
            batteryPercent: 85,
            locationLabel: "Station A - Bay 3",
          }),
          description:
            "If the controller expects files, send multipart/form-data in Postman.",
        }),
        req({
          name: "Vehicle Detail",
          method: "GET",
          path: "/station-admin/vehicles/{{vehicleId}}",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Update Vehicle Status",
          method: "PATCH",
          path: "/station-admin/vehicles/{{vehicleId}}/status",
          authVar: "stationAdminToken",
          body: rawBody({ status: "MAINTENANCE" }),
        }),
      ]),
      folder("Bookings", [
        req({
          name: "List Bookings",
          method: "GET",
          path: "/station-admin/bookings",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Booking Detail",
          method: "GET",
          path: "/station-admin/bookings/{{bookingId}}",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Approve Booking",
          method: "PATCH",
          path: "/station-admin/bookings/{{bookingId}}/approve",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Cancel Booking",
          method: "PATCH",
          path: "/station-admin/bookings/{{bookingId}}/cancel",
          authVar: "stationAdminToken",
        }),
      ]),
      folder("Rides", [
        req({
          name: "List Rides",
          method: "GET",
          path: "/station-admin/rides",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Ride Detail",
          method: "GET",
          path: "/station-admin/rides/{{rideId}}",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Force End Ride",
          method: "POST",
          path: "/station-admin/rides/{{rideId}}/force-end",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Lock Vehicle",
          method: "POST",
          path: "/station-admin/rides/{{rideId}}/lock-vehicle",
          authVar: "stationAdminToken",
        }),
      ]),
      folder("Maintenance", [
        req({
          name: "List Maintenance Logs",
          method: "GET",
          path: "/station-admin/maintenance-logs",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Create Maintenance Log",
          method: "POST",
          path: "/station-admin/maintenance-logs",
          authVar: "stationAdminToken",
          body: rawBody({ vehicleId: "{{vehicleId}}", title: "Tyre issue", description: "Need tyre replacement" }),
        }),
        req({
          name: "Maintenance Detail",
          method: "GET",
          path: "/station-admin/maintenance-logs/{{requestId}}",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Update Maintenance Status",
          method: "PATCH",
          path: "/station-admin/maintenance-logs/{{requestId}}/status",
          authVar: "stationAdminToken",
          body: rawBody({ status: "IN_PROGRESS" }),
        }),
      ]),
      folder("Support", [
        req({
          name: "Support Tickets",
          method: "GET",
          path: "/station-admin/support/tickets",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Support Ticket Detail",
          method: "GET",
          path: "/station-admin/support/tickets/{{ticketId}}",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Update Ticket Status",
          method: "PATCH",
          path: "/station-admin/support/tickets/{{ticketId}}/status",
          authVar: "stationAdminToken",
          body: rawBody({ status: "IN_PROGRESS" }),
        }),
        req({
          name: "Escalate Ticket",
          method: "PATCH",
          path: "/station-admin/support/tickets/{{ticketId}}/escalate",
          authVar: "stationAdminToken",
          body: rawBody({ reason: "Needs admin attention" }),
        }),
      ]),
      folder("Notifications", [
        req({
          name: "List Notifications",
          method: "GET",
          path: "/station-admin/notifications",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Mark Notification Read",
          method: "PATCH",
          path: "/station-admin/notifications/{{notificationId}}/read",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Mark All Notifications Read",
          method: "PATCH",
          path: "/station-admin/notifications/read-all",
          authVar: "stationAdminToken",
        }),
      ]),
      folder("Reports & Finance", [
        req({
          name: "Reports",
          method: "GET",
          path: "/station-admin/reports",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Transactions",
          method: "GET",
          path: "/station-admin/transactions",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Booking Invoice",
          method: "GET",
          path: "/station-admin/bookings/{{bookingId}}/invoice",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Booking Invoice PDF",
          method: "GET",
          path: "/station-admin/bookings/{{bookingId}}/invoice/pdf",
          authVar: "stationAdminToken",
        }),
        req({
          name: "Booking Refund",
          method: "PATCH",
          path: "/station-admin/bookings/{{bookingId}}/refund",
          authVar: "stationAdminToken",
          body: rawBody({
            status: "PROCESSING",
            note: "Refund under review",
          }),
        }),
      ]),
    ]),
  ],
  variable: envVars.map(([key, value]) => ({ key, value, type: "string" })),
};

const environment = {
  name: "Scooty Rental Local",
  values: envVars.map(([key, value]) => ({
    key,
    value,
    enabled: true,
  })),
  _postman_variable_scope: "environment",
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: "Codex",
};

fs.mkdirSync(POSTMAN_DIR, { recursive: true });
fs.writeFileSync(COLLECTION_PATH, `${JSON.stringify(collection, null, 2)}\n`);
fs.writeFileSync(
  ENV_PATH,
  `${JSON.stringify(
    {
      ...environment,
      schema: "https://schema.getpostman.com/json/environment/v2.1.0/environment.json",
    },
    null,
    2,
  )}\n`,
);

console.log(`Wrote ${COLLECTION_PATH}`);
console.log(`Wrote ${ENV_PATH}`);
