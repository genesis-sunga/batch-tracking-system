# Batch Tracking API

NestJS REST API using TypeORM and MySQL. Modules are separated by domain: authentication/users, purchase orders, inventory/batches, locations, quality, and audit logging.

## Run locally

1. Create a MySQL database and copy `.env.example` to `.env`.
2. Set database credentials and a long random `JWT_SECRET`.
3. Install dependencies with `npm install`.
4. Run `npm run start:dev`.

The application synchronizes the TypeORM schema outside production for local development. Production must use reviewed TypeORM migrations (`synchronize` is disabled when `NODE_ENV=production`).

## Initial administrator

Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in the environment (password must be at least 12 characters), then run `npm run seed:admin`. The command refuses to add an administrator if the users table already contains records. Administrators can create other accounts with `POST /api/users`; public user registration is intentionally not exposed.

## API outline

All routes except login require `Authorization: Bearer <JWT>`.

| Method | Route | Access |
| --- | --- | --- |
| POST | `/api/auth/login` | Public |
| POST | `/api/users` | Admin |
| POST / GET | `/api/locations` | Admin/warehouse operator to create; authenticated users to list |
| POST / GET | `/api/purchase-orders` | Admin/procurement to create; authenticated users to list |
| POST / GET | `/api/batches` | Admin/warehouse operator to create; authenticated users to list |
| POST | `/api/batches/:id/transfer` | Admin/warehouse operator |
| POST | `/api/batches/:id/dispatch` | Admin/warehouse operator; batch must be released |
| POST / GET | `/api/batches/:id/quality-tests` | Admin/QA inspector to record; authenticated users to list |
| GET | `/api/batches/:id/trace` | Authenticated users |
| GET | `/api/purchase-orders/:id/trace` | Authenticated users |
| GET | `/api/locations/:id/batches` | Authenticated users |
| GET | `/api/audit-logs` | Admin (most recent 100 records) |

Batch receipt, transfers, dispatches, quality results, status changes, and account creation use database transactions where appropriate and write audit records. A failing quality test quarantines a batch; enough passing tests (the batch's `requiredTests` count) release it. Batch creation also reserves against the purchase order quantity.
