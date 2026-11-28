Batch Tracking API

NestJS REST API using TypeORM and MySQL. Modules are separated by domain: authentication/users, purchase orders, inventory/batches, locations, quality, and audit logging.

Run locally

1. Create a dedicated MySQL/MariaDB database named `batch_tracking_api` (for example, `CREATE DATABASE batch_tracking_api CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`). Keep any separately imported legacy database intact.
2. Copy `.env.example` to `.env`, set database credentials and a long random `JWT_SECRET`, and keep `DB_DATABASE=batch_tracking_api` for the API schema.
3. Install dependencies with `npm install`.
4. Run `npm run start:dev`. With `DB_MIGRATIONS_RUN=true`, TypeORM applies the API migrations at startup.

The API database schema is managed by TypeORM migrations; automatic schema synchronization is disabled. The supplied `batch_tracking_db.sql` schema uses different table and column names and a different data model, so it should not be imported into `batch_tracking_api` as-is. The dump contains table definitions but no data rows to migrate.

Initial administrator

Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in the environment (password must be at least 12 characters), then run `npm run seed:admin`. The command refuses to add an administrator if the users table already contains records. Administrators can create other accounts with `POST /api/users`; public user registration is intentionally not exposed.

API outline

All routes except login require `Authorization: Bearer <JWT>`. List endpoints accept `page` (default 1), `limit` (default 20, maximum 100), and supported filter parameters; they return `{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }`. Errors use `{ "statusCode", "error", "message", "path", "timestamp" }`.

| Method | Route | Access |
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
| PATCH | `/api/batches/:id` | Admin/QA; update expiry or release after required tests pass |
| POST | `/api/batches/:id/storage-movements` | Admin/warehouse operator |
| POST | `/api/batches/:id/adjustments` | Admin/warehouse; cycle-count stock adjustment |
| GET | `/api/batches/:id/movements` | Authenticated |
| GET | `/api/storage-movements` | Authenticated; filter by batch, location, movement type, and date |
| POST | `/api/batches/:id/dispatch` | Admin/warehouse operator; batch must be released |
| POST / GET | `/api/batches/:id/quality-tests` | Admin/QA inspector to submit; authenticated users to list |
| GET | `/api/batches/:id/quality-tests/:testId` | Authenticated |
| GET | `/api/batches/:id/trace` or `/api/batches/code/:code/trace` | Authenticated |
| GET | `/api/products/sku/:sku/trace` | Authenticated; SKU genealogy with batches, tests, and movements |
| GET | `/api/purchase-orders/:id/trace` | Authenticated |
| GET | `/api/locations/:id/batches` | Authenticated |
| GET | `/api/audit-logs` | Admin (most recent 100 records) |
| GET | `/api/reports/stock`, `/api/reports/batches`, `/api/reports/expiry`, `/api/reports/quality`, `/api/reports/quality-tests`, `/api/reports/purchase-orders`, `/api/reports/movements` | Authenticated; `format=json`, `csv`, or `pdf`; date filters `from`/`to` |
| POST / GET | `/api/reports/jobs`, `/api/reports/jobs/:id` | Admin; asynchronous report jobs |
| GET | `/api/health/live`, `/api/health/ready` | Public health probes |

Batch creation, PO receiving, storage movements, stock adjustments, and dispatch require an `Idempotency-Key` header (1–128 characters). Reusing a key with the same request returns the original response; reusing it for different input returns `409 Conflict`. Receive bodies contain `batchNumber`, `locationId`, `quantity`, optional `requiredTests`, and optional ISO-8601 `expiresAt`. Movement bodies use `movementType` values `transfer` (plus `toLocationId`), `consumption` (plus `quantity`), `hold`, or `release_hold`. Adjustment bodies contain the physical `countedQuantity` and optional `reason`; the adjustment and its audit/movement records are committed together. `PATCH /api/batches/:id` accepts an ISO-8601 `expiresAt` (or `null` to clear it), and `status: "released"` only when all required latest quality results pass.

Operations remain in services and use atomic TypeORM transactions. Receipt updates the PO's received quantity and creates the batch and movement together. Consumption cannot exceed available stock; only released stock can be consumed or dispatched. Quality `fail` quarantines a batch, `reject` marks it rejected, and passing the required distinct test types releases it. Master-data references cannot be deleted while used by purchase orders.

## Outbound integrations

Set `INTEGRATION_WEBHOOK_URL` to enable the generic outbound webhook connector; `INTEGRATION_WEBHOOK_TOKEN` optionally supplies a bearer token. Business changes are written to a transactional outbox, so a remote outage does not roll back batch or purchase-order operations. The worker retries failed deliveries with exponential backoff (up to 15 minutes), applies a circuit breaker, and resumes delivery after recovery. Delivery is at least once; consumers should deduplicate using `eventId`. Events include `eventId`, `eventType`, `occurredAt`, and `data`; the event ID is also sent as `X-Event-ID` and `X-Correlation-ID`. Successful response `X-Correlation-ID` or `X-Request-ID` values and delivery failures are logged. The connector emits PO creation/status changes, shipment receipt/dispatch, quality results, and batch release/recall events. With no webhook URL configured, events are not queued.

The outbox table is managed by the `CreateIntegrationOutbox1785200000000` migration. In production, review and apply migrations before enabling the webhook; set `DB_MIGRATIONS_RUN=true` during a deployment to apply configured migrations at application startup, then disable it if migrations should remain a separate deployment step.

## Email notifications

Set `SMTP_HOST` and `SMTP_FROM` to enable asynchronous email delivery. Configure `SMTP_PORT`, `SMTP_SECURE`, and optional `SMTP_USER`/`SMTP_PASSWORD` for the provider. Notifications are queued in the same transaction as the triggering change, then sent by a background worker; temporary delivery failures retry with exponential backoff and a circuit breaker. Messages use reusable escaped HTML and text templates. QA, warehouse, and admin roles receive failed-test and hold alerts; procurement/admin receive receipt notices; operations teams receive release/recall notices.

The scheduled worker checks daily for batches expiring within `EXPIRY_REMINDER_DAYS` (default 7), including batches already past expiry, and quarantined batches that have remained in that state for at least 24 hours. Reminders are deduplicated per batch, recipient, and day. The `CreateNotificationOutbox1785201000000` migration adds the email outbox and nullable batch expiry date; apply it before enabling SMTP in production. With SMTP unset, notifications are not queued or sent.

## Reports and production operations

Report endpoints support `page` (default 1), `limit` (default 1,000; maximum 10,000), date filters (`from`, `to`), and report-specific filters including SKU, location, and batch. Use `format=csv` or `format=pdf` for downloads; JSON is the default. Stock, batch, expiry, grouped quality outcomes, detailed quality inspections, PO fulfillment, and movement/traceability reports are available. For larger reports, admins can submit `POST /api/reports/jobs` with a `reportType` (`stock`, `batches`, `expiry`, `quality`, `quality_tests`, `purchase_orders`, or `movements`) and filters, then poll `/api/reports/jobs/:id`. Job results and failures are retained in the database.

The `AddInventoryAdjustments1785203000000` migration adds the stock-adjustment movement type. Apply this migration in production before using the adjustment endpoint; development schema synchronization includes it automatically.

Production configuration rejects placeholder or short JWT secrets. Global IP-based rate limiting defaults to 100 requests per 60 seconds and can be changed with `RATE_LIMIT_LIMIT` and `RATE_LIMIT_WINDOW_SECONDS`; set `TRUST_PROXY_HOPS` only to the number of trusted reverse-proxy hops in front of the app. The in-memory limiter is per instance, so use shared storage or an edge gateway for multi-replica deployments. Helmet security headers are enabled. Logs are newline-delimited JSON with request IDs, route, status, and duration; send stdout/stderr to your approved log and error-tracking collector.

The database backup script is [scripts/backup-mysql.ps1](./scripts/backup-mysql.ps1). Set database credentials and `DB_BACKUP_DIR`, then schedule it with Windows Task Scheduler. Store backups in access-controlled storage, encrypt off-host copies, define retention, and regularly test restores. Never commit production secrets or backup files. Apply the `CreateReportJobs1785202000000` migration together with earlier migrations before deploying the reporting feature.
