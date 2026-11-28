import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryAdjustments1785203000000 implements MigrationInterface {
  name = 'AddInventoryAdjustments1785203000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `inventory_movements` MODIFY `movementType` enum('receipt','transfer','consumption','hold','release_hold','dispatch','adjustment') NOT NULL",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [result] = (await queryRunner.query(
      "SELECT COUNT(*) AS count FROM `inventory_movements` WHERE `movementType` = 'adjustment'",
    )) as [{ count: number | string }];
    if (Number(result.count) > 0) {
      throw new Error('Cannot remove adjustment movement type while adjustment records exist');
    }
    await queryRunner.query(
      "ALTER TABLE `inventory_movements` MODIFY `movementType` enum('receipt','transfer','consumption','hold','release_hold','dispatch') NOT NULL",
    );
  }
}
