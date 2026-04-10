# User APIs

Base URL: `http://localhost:3000/v1/api`

Response format:
```json
{ "code": 1, "message": "success", "data": {} }
```

Auth header:
- `Authorization: Bearer <userToken>`

---

## Auth

### `POST /user/auth/send-otp`
Body:
```json
{ "mobile": "9999999999" }
```

### `POST /user/auth/verify-otp`
Body:
```json
{ "mobile": "9999999999", "otp": "1234", "name": "User Name" }
```
Success: returns `token` and `user`.

---

## Profile

### `GET /user/me`

### `PATCH /user/me`
Body:
```json
{ "name": "New Name", "email": "me@example.com", "profilePhotoUrl": "https://..." }
```
Notes:
- Multipart upload `profilePhoto` is supported.

---

## Explore

### `GET /user/plans`
Optional query:
- `stationId`

### `GET /user/stations`
Optional query:
- `lat`
- `lng`
- `search`

### `GET /user/stations/:stationId`

### `GET /user/time-slots`
Optional query:
- `date` in `YYYY-MM-DD`
- `planCode`
- `stationId`

Notes:
- Only approved ride plans and FAQs are visible to users.

---

## Booking

### `POST /user/bookings/quote`
Body:
```json
{
  "pickupStationId": "<stationId>",
  "dropStationId": "<stationId>",
  "planCode": "DAY_PASS",
  "date": "2026-03-23",
  "startTime": "10:00",
  "referralCode": "MVABCD12",
  "walletToUse": 100
}
```

### `POST /user/bookings`
Body:
```json
{
  "pickupStationId": "<stationId>",
  "dropStationId": "<stationId>",
  "planCode": "DAY_PASS",
  "date": "2026-03-23",
  "startTime": "10:00",
  "paymentMethod": "UPI",
  "paymentReferenceId": "pay_demo_001",
  "walletToUse": 100
}
```

### `GET /user/bookings`
Optional query:
- `status` = `PENDING_PAYMENT|CONFIRMED|ACTIVE|COMPLETED|CANCELLED`

### `GET /user/bookings/:bookingId`

### `POST /user/bookings/:bookingId/pay`
Body:
```json
{ "paymentMethod": "UPI", "paymentReferenceId": "pay_demo_002" }
```

### `POST /user/bookings/:bookingId/start`
Body:
```json
{ "unlockCode": "MV-ABC123" }
```
Notes:
- `unlockCode` must match the code stored on the booking.
- `code` is also accepted as an alias.

### `POST /user/bookings/:bookingId/complete`
Body:
```json
{
  "dropStationId": "<stationId>",
  "parkingPhotoUrl": "https://example.com/parking.jpg",
  "rating": 5,
  "review": "Smooth ride"
}
```

### `GET /user/rides/history`

### `GET /user/transactions`
Optional query:
- `type`
- `from`
- `to`
- `page`
- `limit`

### `GET /user/bookings/:bookingId/invoice`

### `GET /user/bookings/:bookingId/invoice/pdf`

### `GET /user/bookings/:bookingId/receipt/pdf`

### `GET /user/bookings/:bookingId/refund`
Returns the current refund state for the booking.

---

## Wallet / Referral

### `GET /user/wallet`

### `GET /user/referral`

### `POST /user/referral/apply`
Body:
```json
{ "referralCode": "MVABCD12" }
```

---

## Notifications

### `GET /user/notifications`
Optional query:
- `type` = `RIDE|EARNING|ALERT|SYSTEM`

### `PATCH /user/notifications/read-all`
Optional query:
- `type` = `RIDE|EARNING|ALERT|SYSTEM`

### `PATCH /user/notifications/:notificationId/read`

---

## Support

### `GET /user/support/faqs`
Optional query:
- `stationId`

### `GET /user/support/tickets`

### `POST /user/support/tickets`
Body:
```json
{ "subject": "Ride issue", "message": "Unable to unlock the scooter" }
```

### `GET /user/support/tickets/:ticketId`
