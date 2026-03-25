# Owner APIs

Base URL: `http://localhost:3000/v1/api`

Response format:
```json
{ "code": 1, "message": "success", "data": {} }
```

Auth header (for protected routes):
- `Authorization: Bearer <ownerToken>`

---

## Auth (Public)

### `POST /owner/auth/send-otp`
Body:
```json
{ "mobile": "7777777777" }
```

### `POST /owner/auth/verify-otp`
Body:
```json
{ "mobile": "7777777777", "otp": "123456", "name": "Owner Name", "companyName": "Fleet Owner" }
```
Success: returns `token` + `owner`.

---

## Dashboard / Earnings (Protected)




### `GET /owner/dashboard`

### `GET /owner/earnings`
Returns owner earnings summary derived from booking and payout ledger entries.

### `GET /owner/transactions`
Optional query:
- `type`
- `from`
- `to`
- `page`
- `limit`

---

## Notifications (Protected)

### `GET /owner/notifications`
Optional query:
- `type` = `RIDE|EARNING|ALERT|SYSTEM`

### `PATCH /owner/notifications/:notificationId/read`

---

## Profile (Protected)

### `GET /owner/me`
Returns `{ owner, bank }`

### `PATCH /owner/me`
Body (any):
```json
{ "name": "Owner Name", "email": "owner@example.com", "companyName": "Fleet Owner", "city": "Indore" }
```
Multipart supported:
- `profilePhoto`
- `adharFile`
- `panFile`

Backward compatible (optional in same request):
- `accountHolderName`, `accountNumber`, `bankName`, `ifsc`, `upiId`, `bankFile` (also accepts `bankfile` / `bank_file`)

---

## Bank (Protected)

### `GET /owner/bank`

### `PATCH /owner/bank`
Body (any):
```json
{ "accountHolderName": "Ravi", "accountNumber": "1234567890", "bankName": "ICICI", "ifsc": "ICIC0000123", "upiId": "ravi@upi" }
```
Multipart supported:
- `bankFile` (also accepts `bankfile` / `bank_file`)

---

## KYC (Protected)

### `GET /owner/kyc`

### `PATCH /owner/kyc`
Multipart supported:
- `profilePhoto`
- `adharFile`
- `panFile`

---

## Payouts (Protected)

### `GET /owner/payouts`

### `POST /owner/payouts/request`
Body:
```json
{ "amount": 1000 }
```

---

## Vehicles / Scooty (Protected)

### `GET /owner/vehicles`
Optional query:
- `status` = `DRAFT|PENDING_APPROVAL|ACTIVE|IN_RIDE|MAINTENANCE|CHARGING|INACTIVE|REMOVAL_REQUESTED|REMOVED`

### `POST /owner/vehicles`
Body:
```json
{ "modelName": "Ola S1 Pro", "registrationNumber": "KA-01-AB-1234", "chassisNumber": "CHASSIS123", "stationId": "<stationId>" }
```
Creates a draft vehicle. `stationId` can be any active station.

### `GET /owner/vehicles/:vehicleId`

### `PATCH /owner/vehicles/:vehicleId`
Body (any):
```json
{ "modelName": "Ola S1 Pro", "stationId": "<stationId>", "submit": true }
```
Multipart supported:
- `frontPhoto`
- `sidePhoto`
- `rcDocument`
- `insuranceDocument`

### `DELETE /owner/vehicles/:vehicleId`
Requests vehicle removal (sets status to `REMOVAL_REQUESTED`).

---

## Maintenance (Protected)

### `GET /owner/maintenance`
Optional query:
- `status` = `OPEN|IN_PROGRESS|COMPLETED|REJECTED`

### `POST /owner/maintenance`
Body:
```json
{ "vehicleId": "<vehicleId>", "issueType": "BATTERY", "description": "Battery not charging" }
```
Multipart supported:
- `photo`

### `GET /owner/maintenance/:requestId`

---

## Support (Protected)

### `GET /owner/support/faqs`

### `GET /owner/support/tickets`

### `POST /owner/support/tickets`
Body:
```json
{ "subject": "Payout issue", "message": "My payout is stuck" }
```

### `GET /owner/support/tickets/:ticketId`

---

## Settings (Protected)

### `GET /owner/settings`

### `PATCH /owner/settings`
Body:
```json
{ "settings": { "notifications": { "rideUpdates": true, "earnings": true } }, "language": "en" }
```
