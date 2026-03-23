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
