import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationOutbox1785201000000 implements MigrationInterface {
  name = 'CreateNotificationOutbox1785201000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`batches\`
      ADD \`expiresAt\` datetime NULL,
      ADD INDEX \`IDX_batches_expiry\` (\`expiresAt\`),
      ADD INDEX \`IDX_batches_quarantine_reminder\` (\`status\`, \`updatedAt\`)
    `);
    await queryRunner.query(`
      CREATE TABLE \`email_outbox\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`dedupeKey\` varchar(255) NULL,
        \`recipient\` varchar(255) NOT NULL,
        \`template\` varchar(80) NOT NULL,
        \`data\` json NOT NULL,
        \`attempts\` int NOT NULL DEFAULT 0,
        \`availableAt\` datetime NOT NULL,
        \`leasedUntil\` datetime NULL,
        \`sentAt\` datetime NULL,
        \`lastError\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_email_outbox_dedupe_key\` (\`dedupeKey\`),
        INDEX \`IDX_email_outbox_delivery\` (\`sentAt\`, \`availableAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `email_outbox`');
    await queryRunner.query(`
      ALTER TABLE \`batches\`
      DROP INDEX \`IDX_batches_expiry\`,
      DROP INDEX \`IDX_batches_quarantine_reminder\`,
      DROP COLUMN \`expiresAt\`
    `);
  }
}
