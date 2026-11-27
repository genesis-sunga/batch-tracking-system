import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportJobs1785202000000 implements MigrationInterface {
  name = 'CreateReportJobs1785202000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`batches\`
      ADD INDEX \`IDX_batches_location_status\` (\`currentLocationId\`, \`status\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`inventory_movements\`
      ADD INDEX \`IDX_inventory_movements_created_at\` (\`createdAt\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`quality_tests\`
      ADD INDEX \`IDX_quality_tests_outcome_created_at\` (\`outcome\`, \`createdAt\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`purchase_orders\`
      ADD INDEX \`IDX_purchase_orders_status_created_at\` (\`status\`, \`createdAt\`)
    `);
    await queryRunner.query(`
      CREATE TABLE \`report_jobs\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`reportType\` enum('stock','expiry','quality','purchase_orders','movements') NOT NULL,
        \`filters\` json NOT NULL,
        \`status\` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
        \`result\` json NULL,
        \`error\` text NULL,
        \`startedAt\` datetime NULL,
        \`completedAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_report_jobs_status_created_at\` (\`status\`, \`createdAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `report_jobs`');
    await queryRunner.query(`
      ALTER TABLE \`purchase_orders\`
      DROP INDEX \`IDX_purchase_orders_status_created_at\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`quality_tests\`
      DROP INDEX \`IDX_quality_tests_outcome_created_at\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`inventory_movements\`
      DROP INDEX \`IDX_inventory_movements_created_at\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`batches\`
      DROP INDEX \`IDX_batches_location_status\`
    `);
  }
}
