# Station Admin APIs

Base URL: `http://localhost:3000/v1/api/station-admin`

Response format:
```json
{ "code": 1, "message": "success", "data": {} }
```

Auth header:
- `Authorization: Bearer <stationAdminToken>`

---

## Auth

### `POST /station-admin/auth/login`
Body:
```json
{ "email": "sa@station.com", "password": "Sa@123" }
```

### `POST /station-admin/auth/send-otp`
Body:
```json
{ "email": "sa@station.com" }
```

### `POST /station-admin/auth/resend-otp`
Body:
```json
{ "transactionId": "<transactionId>" }
```

### `POST /station-admin/auth/verify-otp`
Body:
```json
{ "email": "sa@station.com", "otp": "123456" }
```

### `POST /station-admin/auth/forgot-password/send-otp`
Body:
```json
{ "email": "sa@station.com" }
```

### `POST /station-admin/auth/forgot-password/resend-otp`
Body:
```json
{ "transactionId": "<transactionId>" }
```

### `POST /station-admin/auth/forgot-password/reset`
Body:
```json
{ "transactionId": "<transactionId>", "otp": "123456", "newPassword": "NewPass@123" }
```

---

## Profile

### `GET /station-admin/me`

### `PATCH /station-admin/me`

### `POST /station-admin/change-password`

---

## Content Submission

### `GET /station-admin/ride-plans`
Optional query:
- `stationId`
- `status` = `PENDING|APPROVED|REJECTED`

### `POST /station-admin/ride-plans`
Body:
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
Validation:
- `stationId` is required in the body.
- `code` is required, unique for the station, and stored uppercase.
- `name` is required.
- `type` must be one of `HOURLY|DAY_PASS|WEEKLY|MONTHLY`.
- `durationHours` must be greater than `0`.
- `price` must be `>= 0`.
- `securityDeposit` is optional and must be `>= 0` if provided.
- `perks` should be an array of strings.

### `PATCH /station-admin/ride-plans/:planId`
Body: same as create, any field can be sent.
Validation:
- Same rules as create.
- `stationId` is required in the body.
- Only the station admin who created the plan can update it.
- Updated records return to `PENDING`.

### `GET /station-admin/faqs`
Optional query:
- `stationId`
- `status` = `PENDING|APPROVED|REJECTED`

### `POST /station-admin/faqs`
Body:
```json
{
  "stationId": "<stationId>",
  "question": "How do I unlock the scooty?",
  "answer": "Open the active booking and use the unlock code from the app."
}
```
Validation:
- `stationId` is required in the body.
- `question` is required.
- `answer` is required.

### `PATCH /station-admin/faqs/:faqId`
Body: same as create, any field can be sent.
Validation:
- Same rules as create.
- `stationId` is required in the body.
- Only the station admin who created the FAQ can update it.
- Updated records return to `PENDING`.

---

## Vehicles

### `GET /station-admin/vehicles`
Optional query:
- `status`
- `q` = search by vehicle id, model, registration, or chassis number
- `page` = page number, default `1`
- `limit` = items per page, default `20`, max `100`

Response:
```json
{
  "vehicles": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### `POST /station-admin/vehicles`
Body:
```json
{
  "modelName": "Ola S1 Pro",
  "registrationNumber": "KA-01-AB-1234",
  "chassisNumber": "CHASSIS123",
  "batteryPercent": 85,
  "locationLabel": "Station A - Bay 3"
}
```
Notes:
- `stationId` is taken from the authenticated station admin profile.
- If `stationId` is sent in the body, it must match the station admin's station.
- Multipart upload is supported with the same file field names as owner vehicle add.
- Vehicle is created as `DRAFT`, same as the owner flow.

### `GET /station-admin/vehicles/:vehicleId`
Returns:
- `vehicle`
- `performance` with ride count, revenue, active rides, and average rating
- `recentRideHistory`
- `maintenanceHistory`

### `PATCH /station-admin/vehicles/:vehicleId/status`
Body:
```json
{ "status": "MAINTENANCE" }
```
Supported status values:
- `ACTIVE`
- `MAINTENANCE`
- `CHARGING`
- `INACTIVE`

Action aliases are also accepted:
- `MARK_ACTIVE`
- `MARK_MAINTENANCE`
- `ASSIGN_CHARGING`
- `MARK_INACTIVE`

This is the endpoint behind the status action menu in the station admin fleet screen.
