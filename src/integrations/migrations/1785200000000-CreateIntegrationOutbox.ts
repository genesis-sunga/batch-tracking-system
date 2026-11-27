import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIntegrationOutbox1785200000000 implements MigrationInterface {
  name = 'CreateIntegrationOutbox1785200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`integration_outbox\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`eventId\` varchar(36) NOT NULL,
        \`eventType\` varchar(100) NOT NULL,
        \`data\` json NOT NULL,
        \`attempts\` int NOT NULL DEFAULT 0,
        \`availableAt\` datetime NOT NULL,
        \`leasedUntil\` datetime NULL,
        \`deliveredAt\` datetime NULL,
        \`lastError\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_integration_outbox_event_id\` (\`eventId\`),
        INDEX \`IDX_integration_outbox_delivery\` (\`deliveredAt\`, \`availableAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `integration_outbox`');
  }
}
