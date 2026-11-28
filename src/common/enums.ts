export enum UserRole {
  WAREHOUSE_OPERATOR = 'warehouse_operator',
  QA_INSPECTOR = 'qa_inspector',
  PROCUREMENT = 'procurement',
  ADMIN = 'admin',
}

export enum BatchStatus {
  AWAITING_QA = 'awaiting_qa',
  RELEASED = 'released',
  ON_HOLD = 'on_hold',
  QUARANTINED = 'quarantined',
  DISPATCHED = 'dispatched',
  REJECTED = 'rejected',
  CONSUMED = 'consumed',
}

export enum QualityOutcome {
  PASS = 'pass',
  FAIL = 'fail',
  REJECT = 'reject',
}

export enum MovementType {
  RECEIPT = 'receipt',
  TRANSFER = 'transfer',
  CONSUMPTION = 'consumption',
  HOLD = 'hold',
  RELEASE_HOLD = 'release_hold',
  DISPATCH = 'dispatch',
  ADJUSTMENT = 'adjustment',
}

export enum PurchaseOrderStatus {
  OPEN = 'open',
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}
