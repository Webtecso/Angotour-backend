import { MigrationInterface, QueryRunner } from "typeorm";

export class MonthlyExecutions1794067973356 implements MigrationInterface {
    name = 'MonthlyExecutions1794067973356'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "monthly_executions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "contractId" uuid NOT NULL, "driverId" uuid, "vehicleId" uuid, "date" date NOT NULL, "direction" character varying(10) NOT NULL, "scheduledTime" character varying(5) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'agendada', "startedAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_803a0b2938e4526bd5d6d4a87a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b0f2aba623874b8ccfd8f2002e" ON "monthly_executions" ("driverId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1c95d57a0bf33dfec409eb71b8" ON "monthly_executions" ("contractId", "date", "direction") `);
        await queryRunner.query(`ALTER TABLE "monthly_contracts" ADD "proposalExpiresAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "monthly_contracts" ADD "paymentReference" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "monthly_contracts" ADD "paidAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "monthly_contracts" ADD "priceBreakdown" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "monthly_contracts" DROP COLUMN "priceBreakdown"`);
        await queryRunner.query(`ALTER TABLE "monthly_contracts" DROP COLUMN "paidAt"`);
        await queryRunner.query(`ALTER TABLE "monthly_contracts" DROP COLUMN "paymentReference"`);
        await queryRunner.query(`ALTER TABLE "monthly_contracts" DROP COLUMN "proposalExpiresAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1c95d57a0bf33dfec409eb71b8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0f2aba623874b8ccfd8f2002e"`);
        await queryRunner.query(`DROP TABLE "monthly_executions"`);
    }

}
