# Admin APIs

Base URL: `http://localhost:3000/v1/api`

Response format:
```json
{ "code": 1, "message": "success", "data": {} }
```

Auth header:
- `Authorization: Bearer <adminToken>`

---

## Auth

### `POST /admin/auth/login`
Body:
```json
{ "email": "admin@station.com", "password": "Admin@123" }
```

### `GET /admin/me`

### `PATCH /admin/me`

### `POST /admin/change-password`
---
## Super Admin Panel

### `GET /admin/dashboard`
Optional query:
- `from`
- `to`

### `GET /admin/users`
Optional query:
- `role` = `ADMIN|STATION_ADMIN|USER|OWNER|SUB_STATION_ADMIN`
- `status` = `ACTIVE|BLOCKED`
- `q`
- `page`
- `limit`

### `PATCH /admin/users/:userId/status`
Body:
```json
{ "isActive": false, "note": "Fraud review" }
```

### `GET /admin/pricing`

### `PATCH /admin/pricing`
Body:
```json
{
  "currency": "INR",
  "baseFarePerHour": 100,
  "baseFarePerDay": 450,
  "securityDepositDefault": 500,
  "convenienceFeePercent": 3,
  "minimumConvenienceFee": 9,
  "taxPercent": 18,
  "penaltySlabs": 3
}
```
Notes:
- `penaltySlabs` is a single numeric value.
- `penaltySlabs: 3` means `₹3 per minute` overstay penalty.

### `GET /admin/commission`

### `PATCH /admin/commission`
Body:
```json
{
  "platformCommissionPercent": 20,
  "ownerSharePercent": 80,
  "franchiseSharePercent": 0
}
```

### `GET /admin/settlements`
Optional query:
- `status`
- `userId`
- `page`
- `limit`

### `POST /admin/settlements`
Body:
```json
{ "userId": "<ownerId>", "amount": 1000, "note": "Monthly settlement" }
```

### `PATCH /admin/settlements/:settlementId/status`
Body:
```json
{ "status": "PROCESSING", "note": "Queued for payout" }
```

### `GET /admin/reports`
Optional query:
- `from`
- `to`
- `stationId`

### `GET /`
Optional query:
- `type`
- `from`
- `to`
- `stationId`
- `userId`
- `page`
- `limit`

### `GET /admin/bookings/:bookingId/invoice`

### `GET /admin/bookings/:bookingId/invoice/pdf`

### `PATCH /admin/bookings/:bookingId/refund`
Body:
```json
{ "status": "PROCESSING", "method": "WALLET", "note": "Refund under review" }
```

### `GET /admin/ledger`
Optional query:
- `sourceType`
- `sourceId`
- `from`
- `to`
- `page`
- `limit`

### `GET /admin/access-control/admins`
Optional query:
- `q`
- `page`
- `limit`

### `POST /admin/access-control/admins`
Body:
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

### `PATCH /admin/access-control/admins/:adminId`
Body:
```json
{
  "name": "Ops Admin",
  "mobile": "9000000001",
  "isActive": true,
  "permissions": ["dashboard", "reports", "settlements"]
}
```

### `GET /admin/audit-logs`
Optional query:
- `action`
- `entityType`
- `adminId`
- `from`
- `to`
- `page`
- `limit`

---

## Stations

### `GET /admin/stations`

### `POST /admin/stations`
Body:
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
Validation:
- `name` is required.
- `parkingType` must be `COVERED` or `OPEN`.
- `lat` and `lng` are optional and saved as `[lng, lat]`.
- `isActive` defaults to `true`.

---

## Station Admins

### `GET /admin/station-admins`
Query:
- `page` (default `1`)
- `limit` (default `20`, max `100`)

### `POST /admin/station-admins`
Body:
```json
{ "name": "Station Admin", "email": "sa@station.com", "password": "Sa@123", "mobile": "9000000000", "stationId": "<stationId>" }
```
Validation:
- `name`, `email`, `password`, and `stationId` are required.
- `stationId` must point to an existing station.

Response note:
- Auth/profile APIs return the admin object without `passwordHash`.

---

## Approval

### `GET /admin/ride-plans`
Optional query:
- `status` = `PENDING|APPROVED|REJECTED`
- `stationId`

### `PATCH /admin/ride-plans/:planId/review`
Body:
```json
{ "status": "APPROVED" }
```
or
```json
{ "status": "REJECTED", "rejectionReason": "Please fix pricing details" }
```

### `GET /admin/faqs`
Optional query:
- `status` = `PENDING|APPROVED|REJECTED`
- `stationId`

### `PATCH /admin/faqs/:faqId/review`
Body:
```json
{ "status": "APPROVED" }
```
or
```json
{ "status": "REJECTED", "rejectionReason": "Please improve the answer" }
```
