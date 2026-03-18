# Backend APIs (Basic)

Base URL: `http://localhost:3000/v1/api`

Response format:
```json
{ "code": 1, "message": "success", "data": {} }
```

## Roles (single `User` model)
- `ADMIN`
- `STATION_ADMIN`
- `USER`
- `OWNER`

---

## 1) Customer (USER) OTP Login

### `POST /auth/send-otp`
Body:
```json
{ "mobile": "9999999999" }
```

### `POST /auth/verify-otp`
Body:
```json
{ "mobile": "9999999999", "otp": "123456", "name": "User Name" }
```
Success: returns `token` (Bearer) + `user`.

---

## 2) Owner (OWNER) OTP Login

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

---

## 3) Profile

### `GET /user`
Header: `Authorization: Bearer <userToken>`

### `PATCH /user`
Header: `Authorization: Bearer <userToken>`
Body (any):
```json
{ "name": "New Name", "email": "me@example.com", "profilePhotoUrl": "https://..." }
```
Notes:
- Multipart upload `profilePhoto` supported (field name `profilePhoto`).

### `GET /owner/me`
Header: `Authorization: Bearer <ownerToken>`

### `PATCH /owner/me`
Header: `Authorization: Bearer <ownerToken>`
Body:
```json
{ "name": "Owner Name", "email": "owner@example.com", "companyName": "Fleet Owner", "upiId": "owner@upi" }
```

---

## 4) Admin / Station Admin

### `POST /admin/auth/login`
Body:
```json
{ "email": "admin@station.com", "password": "Admin@123" }
```
Success: returns `token` (Bearer) + `admin` (same `User` model, role `ADMIN` or `STATION_ADMIN`).

### `GET /admin/me`
Header: `Authorization: Bearer <adminToken>`

### `PATCH /admin/me`
Header: `Authorization: Bearer <adminToken>`

### `POST /admin/change-password`
Header: `Authorization: Bearer <adminToken>`

### Create Station Admin (ADMIN only)
#### `POST /admin/station-admins`
Header: `Authorization: Bearer <adminToken>`
Body:
```json
{ "name": "Station Admin", "email": "sa@station.com", "password": "Sa@123", "mobile": "9000000000", "stationId": "<stationId>" }
```

#### `GET /admin/station-admins`
Header: `Authorization: Bearer <adminToken>`
Query:
- `page` (default `1`)
- `limit` (default `20`, max `100`)

Response `data.pagination`:
```json
{ "page": 1, "limit": 20, "total": 0, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
```

---

## 5) Station Admin (existing only)

Base: `http://localhost:3000/v1/api/station-admin`

### Password login
#### `POST /station-admin/auth/login`
Body:
```json
{ "email": "sa@station.com", "password": "Sa@123" }
```

### OTP login (existing station admin only)
#### `POST /station-admin/auth/send-otp`
Body:
```json
{ "email": "sa@station.com" }
```
Success: returns `transactionId`.

#### `POST /station-admin/auth/resend-otp`
Body:
```json
{ "transactionId": "<transactionId>" }
```
Note: isme DB query nahi lagti (only transaction lookup).

#### `POST /station-admin/auth/verify-otp`
Body:
```json
{ "email": "sa@station.com", "otp": "123456" }
```
Note: OTP verify se new StationAdmin create nahi hoga — sirf existing login karega.

### Forgot password (Station Admin)
#### `POST /station-admin/auth/forgot-password/send-otp`
Body:
```json
{ "email": "sa@station.com" }
```
Success: returns `transactionId`.

#### `POST /station-admin/auth/forgot-password/resend-otp`
Body:
```json
{ "transactionId": "<transactionId>" }
```
Note: isme DB query nahi lagti (only transaction lookup).

#### `POST /station-admin/auth/forgot-password/reset`
Body:
```json
{ "transactionId": "<transactionId>", "otp": "123456", "newPassword": "NewPass@123" }
```

### Profile
Header: `Authorization: Bearer <stationAdminToken>`
- `GET /station-admin/me`
- `PATCH /station-admin/me`
- `POST /station-admin/change-password`

## Seed Admin

Run:
- `npm run seed:admin`

ENV:
- `SEED_ADMIN_EMAIL=admin@station.com`
- `SEED_ADMIN_PASSWORD=Admin@123`
- `SEED_ADMIN_NAME=Admin User`
