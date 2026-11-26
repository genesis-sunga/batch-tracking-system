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
}

export enum QualityOutcome {
  PASS = 'pass',
  FAIL = 'fail',
}
