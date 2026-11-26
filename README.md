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

All routes except login require `Authorization: Bearer <JWT>`. List endpoints accept `page` (default 1), `limit` (default 20, maximum 100), and supported filter parameters; they return `{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }`. Errors use `{ "statusCode", "error", "message", "path", "timestamp" }`.

| Method | Route | Access |
| --- | --- | --- |
| POST | `/api/auth/login` | Public |
| POST | `/api/users` | Admin |
| GET / POST | `/api/products` | Authenticated read; admin/procurement write |
| GET / PATCH / DELETE | `/api/products/:id` | Admin/procurement update; admin delete |
| GET | `/api/products/sku/:sku` | Authenticated |
| GET / POST | `/api/suppliers` | Authenticated read; admin/procurement write |
| GET / PATCH / DELETE | `/api/suppliers/:id` | Admin/procurement update; admin delete |
| GET | `/api/suppliers/code/:code` | Authenticated |
| GET / POST | `/api/purchase-orders` | Authenticated read; admin/procurement write |
| GET / PATCH / DELETE | `/api/purchase-orders/:id` | Authenticated read; admin/procurement write |
| GET | `/api/purchase-orders/reference/:reference` | Authenticated |
| POST | `/api/purchase-orders/:id/receive` | Admin, procurement, warehouse operator |
| GET / POST | `/api/locations` | Authenticated read; admin/warehouse operator create |
| GET / POST | `/api/batches` | Authenticated read; admin/warehouse operator create |
| GET | `/api/batches/:id` or `/api/batches/code/:code` | Authenticated |
| POST | `/api/batches/:id/storage-movements` | Admin/warehouse operator |
| GET | `/api/batches/:id/movements` | Authenticated |
| POST | `/api/batches/:id/dispatch` | Admin/warehouse operator; batch must be released |
| POST / GET | `/api/batches/:id/quality-tests` | Admin/QA inspector to submit; authenticated users to list |
| GET | `/api/batches/:id/trace` or `/api/batches/code/:code/trace` | Authenticated |
| GET | `/api/purchase-orders/:id/trace` | Authenticated |
| GET | `/api/locations/:id/batches` | Authenticated |
| GET | `/api/audit-logs` | Admin (most recent 100 records) |

Batch creation, PO receiving, storage movements, and dispatch require an `Idempotency-Key` header (1–128 characters). Reusing a key with the same request returns the original response; reusing it for different input returns `409 Conflict`. Receive bodies contain `batchNumber`, `locationId`, `quantity`, and optional `requiredTests`. Movement bodies use `movementType` values `transfer` (plus `toLocationId`), `consumption` (plus `quantity`), `hold`, or `release_hold`.

Operations remain in services and use atomic TypeORM transactions. Receipt updates the PO's received quantity and creates the batch and movement together. Consumption cannot exceed available stock; only released stock can be consumed or dispatched. Quality `fail` quarantines a batch, `reject` marks it rejected, and passing the required distinct test types releases it. Master-data references cannot be deleted while used by purchase orders.
