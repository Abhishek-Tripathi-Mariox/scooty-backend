# API Reference

Base URLs:
- User: `http://localhost:3000/v1/api/user`
- User auth: `http://localhost:3000/v1/api/user/auth`
- Owner: `http://localhost:3000/v1/api/owner`
- Station Admin: `http://localhost:3000/v1/api/station-admin`
- Admin: `http://localhost:3000/v1/api/admin`

Common response:
```json
{ "code": 1, "message": "success", "data": {} }
```

Auth headers:
- User: `Authorization: Bearer <userToken>`
- Owner: `Authorization: Bearer <ownerToken>`
- Station Admin: `Authorization: Bearer <stationAdminToken>`
- Admin: `Authorization: Bearer <adminToken>`

Notes:
- Station admin auth supports both `STATION_ADMIN` and `SUB_STATION_ADMIN`.
- Admin station APIs accept an optional `stationAdminId` when creating stations and station admins.
- Station admin APIs include `GET /station-admin/stations` and `GET /station-admin/stations/:stationId` for assigned station lookup.

## User Auth

`POST /user/auth/send-otp`
```json
{ "mobile": "9999999999" }
```

`POST /user/auth/verify-otp`
```json
{ "mobile": "9999999999", "otp": "123456" }
```

Notes:
- These routes are available under the user namespace only.
- The same auth flow is used by the user app login/register flow.

## User Role

### Profile

`GET /user/me`

`PATCH /user/me`
```json
{ "name": "New Name", "email": "me@example.com", "profilePhotoUrl": "https://..." }
```

### Discovery

`GET /user/plans?stationId=<stationId>`

`GET /user/stations?lat=22.7196&lng=75.8577&search=central`

`GET /user/stations/:stationId`

`GET /user/time-slots?date=2026-03-25&planCode=DAY_PASS&stationId=<stationId>`

### Booking

`POST /user/bookings/quote`
```json
{
  "pickupStationId": "<stationId>",
  "dropStationId": "<stationId>",
  "planCode": "DAY_PASS",
  "date": "2026-03-25",
  "startTime": "10:00",
  "referralCode": "MVABCD12",
  "walletToUse": 100
}
```

`POST /user/bookings`
```json
{
  "pickupStationId": "<stationId>",
  "dropStationId": "<stationId>",
  "planCode": "DAY_PASS",
  "date": "2026-03-25",
  "startTime": "10:00",
  "paymentMethod": "UPI",
  "paymentReferenceId": "pay_demo_001",
  "walletToUse": 100
}
```

`GET /user/bookings`
- Query: `status=PENDING_PAYMENT|CONFIRMED|ACTIVE|COMPLETED|CANCELLED`

`GET /user/bookings/:bookingId`

`POST /user/bookings/:bookingId/pay`
```json
{ "paymentMethod": "UPI", "paymentReferenceId": "pay_demo_002" }
```

`POST /user/bookings/:bookingId/start`
```json
{ "unlockCode": "MV-ABC123" }
```
Notes:
- `unlockCode` must match the booking's stored unlock code.
- `code` is also accepted as an alias.

`POST /user/bookings/:bookingId/complete`
```json
{
  "dropStationId": "<stationId>",
  "parkingPhotoUrl": "https://example.com/parking.jpg",
  "rating": 5,
  "review": "Smooth ride"
}
```

`GET /user/rides/history`

### Finance

`GET /user/wallet`

`GET /user/transactions`
- Query: `type`, `from`, `to`, `page`, `limit`

`GET /user/bookings/:bookingId/invoice`

`GET /user/bookings/:bookingId/invoice/pdf`

`GET /user/bookings/:bookingId/receipt/pdf`

`GET /user/bookings/:bookingId/refund`

### Referral

`GET /user/referral`

`POST /user/referral/apply`
```json
{ "referralCode": "MVABCD12" }
```

### Notifications

`GET /user/notifications?type=RIDE`

`PATCH /user/notifications/read-all?type=SYSTEM`

`PATCH /user/notifications/:notificationId/read`

### Support

`GET /user/support/faqs?stationId=<stationId>`

`GET /user/support/tickets`

`POST /user/support/tickets`
```json
{ "subject": "Ride issue", "message": "Unable to unlock the scooter" }
```

`GET /user/support/tickets/:ticketId`

## Owner Role

### Auth

`POST /owner/auth/send-otp`
```json
{ "mobile": "7777777777" }
```

`POST /owner/auth/verify-otp`
```json
{ "mobile": "7777777777", "otp": "123456", "name": "Owner Name", "companyName": "Fleet Owner" }
```

### Dashboard / Earnings

`GET /owner/dashboard`

`GET /owner/earnings`
- Query: `from`, `to`

`GET /owner/transactions`
- Query: `type`, `from`, `to`, `page`, `limit`

### Notifications

`GET /owner/notifications`
- Query: `type=RIDE|EARNING|ALERT|SYSTEM`

`PATCH /owner/notifications/:notificationId/read`

### Profile / Account

`GET /owner/me`

`PATCH /owner/me`
```json
{ "name": "Owner Name", "email": "owner@example.com", "companyName": "Fleet Owner", "city": "Indore" }
```

`GET /owner/bank`

`PATCH /owner/bank`
```json
{ "accountHolderName": "Ravi", "accountNumber": "1234567890", "bankName": "ICICI", "ifsc": "ICIC0000123", "upiId": "ravi@upi" }
```

`GET /owner/kyc`

`PATCH /owner/kyc`
```json
{}
```
Multipart files:
- `profilePhoto`
- `adharFile`
- `panFile`

### Payouts

`GET /owner/payouts`

`POST /owner/payouts/request`
```json
{ "amount": 1000 }
```

### Vehicles

`GET /owner/vehicles?status=ACTIVE`

`POST /owner/vehicles`
```json
{ "modelName": "Ola S1 Pro", "registrationNumber": "KA-01-AB-1234", "chassisNumber": "CHASSIS123", "stationId": "<stationId>" }
```

`GET /owner/vehicles/:vehicleId`

`PATCH /owner/vehicles/:vehicleId`
```json
{ "modelName": "Ola S1 Pro", "stationId": "<stationId>", "submit": true }
```
Multipart files:
- `frontPhoto`
- `sidePhoto`
- `rcDocument`
- `insuranceDocument`

`DELETE /owner/vehicles/:vehicleId`

### Maintenance

`GET /owner/maintenance?status=OPEN`

`POST /owner/maintenance`
```json
{ "vehicleId": "<vehicleId>", "issueType": "BATTERY", "description": "Battery not charging" }
```

`GET /owner/maintenance/:requestId`

### Support

`GET /owner/support/faqs`

`GET /owner/support/tickets`

`POST /owner/support/tickets`
```json
{ "subject": "Payout issue", "message": "My payout is stuck" }
```

`GET /owner/support/tickets/:ticketId`

### Settings

`GET /owner/settings`

`PATCH /owner/settings`
```json
{ "settings": { "notifications": { "rideUpdates": true, "earnings": true } }, "language": "en" }
```

## Station Admin Role

### Auth

`POST /station-admin/auth/login`
```json
{ "email": "sa@station.com", "password": "Sa@123" }
```

`POST /station-admin/auth/send-otp`
```json
{ "email": "sa@station.com" }
```

`POST /station-admin/auth/resend-otp`
```json
{ "transactionId": "<transactionId>" }
```

`POST /station-admin/auth/verify-otp`
```json
{ "email": "sa@station.com", "otp": "123456" }
```

`POST /station-admin/auth/forgot-password/send-otp`
```json
{ "email": "sa@station.com" }
```

`POST /station-admin/auth/forgot-password/resend-otp`
```json
{ "transactionId": "<transactionId>" }
```

`POST /station-admin/auth/forgot-password/reset`
```json
{ "transactionId": "<transactionId>", "otp": "123456", "newPassword": "NewPass@123" }
```

### Profile / Settings

`GET /station-admin/me`

`PATCH /station-admin/me`

`POST /station-admin/change-password`

### Dashboard

`GET /station-admin/dashboard`

### Ride Plans

`GET /station-admin/ride-plans?stationId=<stationId>&status=PENDING`

`POST /station-admin/ride-plans`
```json
{
  "stationId": "<stationId>",
  "code": "DAY_PASS",
  "name": "Full Day",
  "type": "DAY_PASS",
  "durationHours": 12,
  "price": 399,
  "securityDeposit": 500,
  "description": "A full-day option for work or travel.",
  "perks": ["Up to 12 hours", "Best value per hour"],
  "badge": "Most Popular"
}
```

`PATCH /station-admin/ride-plans/:planId`
```json
{
  "stationId": "<stationId>",
  "name": "Full Day",
  "type": "DAY_PASS",
  "durationHours": 12,
  "price": 399,
  "securityDeposit": 500,
  "description": "Updated description",
  "perks": ["Up to 12 hours", "Best value per hour"],
  "badge": "Most Popular"
}
```

### FAQs

`GET /station-admin/faqs?stationId=<stationId>&status=PENDING`

`POST /station-admin/faqs`
```json
{
  "stationId": "<stationId>",
  "question": "How do I unlock the scooty?",
  "answer": "Open the active booking and use the unlock code from the app."
}
```

`PATCH /station-admin/faqs/:faqId`
```json
{
  "stationId": "<stationId>",
  "question": "How do I unlock the scooty?",
  "answer": "Updated answer"
}
```

### Vehicles

`GET /station-admin/vehicles?page=1&limit=20`

`POST /station-admin/vehicles`
```json
{
  "ownerId": "<stationAdminId>",
  "modelName": "Ola S1 Pro",
  "registrationNumber": "KA-01-AB-1234",
  "chassisNumber": "CHASSIS123",
  "batteryPercent": 85,
  "locationLabel": "Station A - Bay 3"
}
```
Notes:
- `ownerId` should be the authenticated station admin id. If sent, it must match the station admin id.
- `stationId` is taken from the authenticated station admin profile.
- If `stationId` is sent in the body, it must match the station admin's station.
- Multipart upload is supported with the same file field names as owner vehicle add.
- Vehicle is created as `DRAFT`, same as the owner flow.

`GET /station-admin/vehicles/:vehicleId`

`PATCH /station-admin/vehicles/:vehicleId/status`
```json
{ "status": "MAINTENANCE" }
```

### Bookings / Rides

`GET /station-admin/bookings?stationId=<stationId>&status=ACTIVE`

`GET /station-admin/bookings/:bookingId`

`PATCH /station-admin/bookings/:bookingId/approve`
```json
{ "note": "Approved by station admin" }
```

`PATCH /station-admin/bookings/:bookingId/cancel`
```json
{ "reason": "Customer requested cancellation" }
```

`GET /station-admin/rides?stationId=<stationId>&status=ACTIVE`

`GET /station-admin/rides/:rideId`

`POST /station-admin/rides/:rideId/force-end`
```json
{ "note": "Ended from control room" }
```

`POST /station-admin/rides/:rideId/lock-vehicle`
```json
{ "note": "Vehicle lock issued" }
```

### Maintenance Logs

`GET /station-admin/maintenance-logs`

`POST /station-admin/maintenance-logs`
```json
{ "vehicleId": "<vehicleId>", "issueType": "BATTERY", "description": "Battery not charging" }
```

`GET /station-admin/maintenance-logs/:requestId`

`PATCH /station-admin/maintenance-logs/:requestId/status`
```json
{ "status": "IN_PROGRESS", "note": "Technician assigned" }
```

### Support

`GET /station-admin/support/tickets`

`GET /station-admin/support/tickets/:ticketId`

`PATCH /station-admin/support/tickets/:ticketId/status`
```json
{ "status": "RESOLVED", "note": "Issue resolved" }
```

`PATCH /station-admin/support/tickets/:ticketId/escalate`
```json
{ "note": "Escalated to admin" }
```

### Notifications

`GET /station-admin/notifications`

`PATCH /station-admin/notifications/:notificationId/read`

`PATCH /station-admin/notifications/read-all`

### Reports / Finance

`GET /station-admin/reports`

`GET /station-admin/transactions?stationId=<stationId>&type=BOOKING_PAYMENT`

`GET /station-admin/bookings/:bookingId/invoice`

`GET /station-admin/bookings/:bookingId/invoice/pdf`

`PATCH /station-admin/bookings/:bookingId/refund`
```json
{ "status": "PROCESSING", "method": "WALLET", "note": "Refund under review" }
```

## Admin Role

### Auth / Profile

`POST /admin/auth/login`
```json
{ "email": "admin@station.com", "password": "Admin@123" }
```

`GET /admin/me`

`PATCH /admin/me`

`POST /admin/change-password`

### Station Admin Management

`GET /admin/station-admins?page=1&limit=20`

`POST /admin/station-admins`
```json
{ "name": "Station Admin", "email": "sa@station.com", "password": "Sa@123", "mobile": "9000000000", "stationId": "<stationId>" }
```

### Station Management

`GET /admin/stations`

`POST /admin/stations`
```json
{
  "name": "Indore Station 1",
  "address": "AB Road, Indore",
  "parkingType": "OPEN",
  "lat": 22.7196,
  "lng": 75.8577,
  "isActive": true
}
```

### Content Moderation

`GET /admin/ride-plans`

`PATCH /admin/ride-plans/:planId/review`
```json
{ "status": "APPROVED" }
```

`GET /admin/faqs`

`PATCH /admin/faqs/:faqId/review`
```json
{ "status": "APPROVED" }
```

### Super Admin Panel

`GET /admin/dashboard`

`GET /admin/users?role=USER&status=ACTIVE&q=john&page=1&limit=20`

`PATCH /admin/users/:userId/status`
```json
{ "isActive": false, "note": "Fraud review" }
```

`GET /admin/pricing`

`PATCH /admin/pricing`
```json
{
  "currency": "INR",
  "baseFarePerHour": 100,
  "baseFarePerDay": 450,
  "securityDepositDefault": 500,
  "penaltySlabs": 3,
  "convenienceFeePercent": 3,
  "minimumConvenienceFee": 9,
  "taxPercent": 18
}
```
Notes:
- `penaltySlabs` is a single numeric value.
- `penaltySlabs: 3` means `₹3 per minute` overstay penalty.

`GET /admin/commission`

`PATCH /admin/commission`
```json
{
  "platformCommissionPercent": 20,
  "ownerSharePercent": 80,
  "franchiseSharePercent": 0
}
```

`GET /admin/settlements?status=PENDING&userId=<ownerId>`

`POST /admin/settlements`
```json
{ "userId": "<ownerId>", "amount": 1000, "note": "Monthly settlement" }
```

`PATCH /admin/settlements/:settlementId/status`
```json
{ "status": "PROCESSING", "note": "Queued for payout" }
```

`GET /admin/reports?from=2026-03-01&to=2026-03-25&stationId=<stationId>`

`GET /admin/transactions?type=BOOKING_PAYMENT&from=2026-03-01&to=2026-03-25`

`GET /admin/bookings/:bookingId/invoice`

`GET /admin/bookings/:bookingId/invoice/pdf`

`PATCH /admin/bookings/:bookingId/refund`
```json
{ "status": "PROCESSING", "method": "WALLET", "note": "Refund under review" }
```

`GET /admin/ledger?sourceType=Booking&sourceId=<bookingId>`

### Access Control

`GET /admin/access-control/admins`

`POST /admin/access-control/admins`
```json
{
  "name": "Ops Admin",
  "email": "ops@example.com",
  "password": "Ops@123",
  "mobile": "9000000000",
  "isActive": true,
  "permissions": ["dashboard", "reports"]
}
```

`PATCH /admin/access-control/admins/:adminId`
```json
{
  "name": "Ops Admin",
  "mobile": "9000000001",
  "isActive": true,
  "permissions": ["dashboard", "reports", "settlements"]
}
```

### Audit Logs

`GET /admin/audit-logs`
