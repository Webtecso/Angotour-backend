import { MigrationInterface, QueryRunner } from "typeorm";

export class VehicleReview1792637934912 implements MigrationInterface {
    name = 'VehicleReview1792637934912'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "admin_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(160) NOT NULL, "fullName" character varying(120) NOT NULL, "passwordHash" character varying(200) NOT NULL, "role" character varying(30) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_dcd0c8a4b10af9c986e510b9ecc" UNIQUE ("email"), CONSTRAINT "PK_06744d221bb6145dc61e5dc441d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "admin_audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "adminId" uuid, "adminEmail" character varying(160), "action" character varying(60) NOT NULL, "targetType" character varying(40), "targetId" character varying(80), "details" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_de7a8fc2fbb525484c71a86bb96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a139edf85d191fb20890356d73" ON "admin_audit_logs" ("adminId") `);
        await queryRunner.query(`ALTER TABLE "vehicles" ADD "status" character varying(20) NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "vehicles" ADD "rejectionReason" character varying(300)`);
        await queryRunner.query(`ALTER TABLE "vehicles" ADD "reviewedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicles" DROP COLUMN "reviewedAt"`);
        await queryRunner.query(`ALTER TABLE "vehicles" DROP COLUMN "rejectionReason"`);
        await queryRunner.query(`ALTER TABLE "vehicles" DROP COLUMN "status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a139edf85d191fb20890356d73"`);
        await queryRunner.query(`DROP TABLE "admin_audit_logs"`);
        await queryRunner.query(`DROP TABLE "admin_users"`);
    }

}
