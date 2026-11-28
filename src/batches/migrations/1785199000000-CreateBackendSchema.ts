import { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates the core schema used by the NestJS API in a dedicated database. */
export class CreateBackendSchema1785199000000 implements MigrationInterface {
  name = 'CreateBackendSchema1785199000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`email\` varchar(255) NOT NULL,
        \`passwordHash\` varchar(255) NOT NULL,
        \`role\` enum('warehouse_operator','qa_inspector','procurement','admin') NOT NULL DEFAULT 'warehouse_operator',
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_users_email\` (\`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`suppliers\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`code\` varchar(100) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NULL,
        \`phone\` varchar(40) NULL,
        \`active\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_suppliers_code\` (\`code\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`products\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`sku\` varchar(100) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`unit\` varchar(40) NOT NULL DEFAULT 'unit',
        \`description\` text NULL,
        \`active\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_products_sku\` (\`sku\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`locations\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`code\` varchar(100) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`active\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_locations_code\` (\`code\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`purchase_orders\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`reference\` varchar(100) NOT NULL,
        \`supplierId\` int NOT NULL,
        \`productId\` int NOT NULL,
        \`quantity\` int unsigned NOT NULL,
        \`receivedQuantity\` int unsigned NOT NULL DEFAULT 0,
        \`status\` enum('open','partially_received','received','cancelled') NOT NULL DEFAULT 'open',
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_purchase_orders_reference\` (\`reference\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_purchase_orders_supplier\` FOREIGN KEY (\`supplierId\`) REFERENCES \`suppliers\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT \`FK_purchase_orders_product\` FOREIGN KEY (\`productId\`) REFERENCES \`products\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`batches\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`batchNumber\` varchar(100) NOT NULL,
        \`purchaseOrderId\` int NOT NULL,
        \`quantity\` int unsigned NOT NULL,
        \`requiredTests\` int unsigned NOT NULL DEFAULT 1,
        \`status\` enum('awaiting_qa','released','on_hold','quarantined','dispatched','rejected','consumed') NOT NULL DEFAULT 'awaiting_qa',
        \`statusBeforeHold\` enum('awaiting_qa','released','on_hold','quarantined','dispatched','rejected','consumed') NULL,
        \`currentLocationId\` int NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_batches_batchNumber\` (\`batchNumber\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`quality_tests\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`batchId\` int NOT NULL,
        \`testType\` varchar(100) NOT NULL,
        \`outcome\` enum('pass','fail','reject') NOT NULL,
        \`notes\` text NULL,
        \`inspectorId\` int NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_quality_tests_batch_created_at\` (\`batchId\`, \`createdAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`inventory_movements\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`batchId\` int NOT NULL,
        \`fromLocationId\` int NULL,
        \`toLocationId\` int NULL,
        \`quantity\` int unsigned NOT NULL,
        \`movementType\` enum('receipt','transfer','consumption','hold','release_hold','dispatch','adjustment') NOT NULL,
        \`actorId\` int NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_inventory_movements_batch_created_at\` (\`batchId\`, \`createdAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`audit_logs\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`actorId\` int NOT NULL,
        \`actorEmail\` varchar(255) NOT NULL,
        \`action\` varchar(80) NOT NULL,
        \`entityType\` varchar(80) NOT NULL,
        \`entityId\` int NOT NULL,
        \`details\` json NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_audit_logs_entity\` (\`entityType\`, \`entityId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`idempotency_records\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`scope\` varchar(80) NOT NULL,
        \`key\` varchar(128) NOT NULL,
        \`requestHash\` varchar(64) NOT NULL,
        \`response\` json NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_idempotency_scope_key\` (\`scope\`, \`key\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `idempotency_records`');
    await queryRunner.query('DROP TABLE `audit_logs`');
    await queryRunner.query('DROP TABLE `inventory_movements`');
    await queryRunner.query('DROP TABLE `quality_tests`');
    await queryRunner.query('DROP TABLE `batches`');
    await queryRunner.query('DROP TABLE `purchase_orders`');
    await queryRunner.query('DROP TABLE `locations`');
    await queryRunner.query('DROP TABLE `products`');
    await queryRunner.query('DROP TABLE `suppliers`');
    await queryRunner.query('DROP TABLE `users`');
  }
}
