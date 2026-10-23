import { MigrationInterface, QueryRunner } from "typeorm";

export class Partners1792721995660 implements MigrationInterface {
    name = 'Partners1792721995660'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "owners" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying(120) NOT NULL, "phone" character varying(20) NOT NULL, "email" character varying(120), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_42838282f2e6b216301a70b02d6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f9635fa45f0cc7d71023abb330" ON "owners" ("phone") `);
        await queryRunner.query(`CREATE TABLE "fleets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "name" character varying(120) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18a71e919faac62c1da6b5f8754" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2c052722363e280d31c351f5de" ON "fleets" ("ownerId") `);
        await queryRunner.query(`CREATE TABLE "fleet_vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fleetId" uuid NOT NULL, "vehicleId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_24163e3ecefa1ea569d00d85515" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_69c8b59d543d216c166937dfa0" ON "fleet_vehicles" ("fleetId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d77160c9158c361b7c1abf31d8" ON "fleet_vehicles" ("vehicleId") `);
        await queryRunner.query(`CREATE TABLE "agents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying(120) NOT NULL, "phone" character varying(20) NOT NULL, "email" character varying(120), "referralCode" character varying(12) NOT NULL, "commissionPercent" double precision NOT NULL DEFAULT '10', "status" character varying(20) NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c653f28ae19c5884d5baf6a1d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9cc5b4b9688d72b86b87f4f0a0" ON "agents" ("phone") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_52e8ae6079a69397879f45a88b" ON "agents" ("referralCode") `);
        await queryRunner.query(`CREATE TABLE "agent_drivers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agentId" uuid NOT NULL, "driverId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_55165623db7dc9aa545c9dddb46" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8d7d759d7daaba82821b36d348" ON "agent_drivers" ("agentId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8600fa0826d69103838df1e88b" ON "agent_drivers" ("driverId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_8600fa0826d69103838df1e88b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d7d759d7daaba82821b36d348"`);
        await queryRunner.query(`DROP TABLE "agent_drivers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52e8ae6079a69397879f45a88b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9cc5b4b9688d72b86b87f4f0a0"`);
        await queryRunner.query(`DROP TABLE "agents"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d77160c9158c361b7c1abf31d8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_69c8b59d543d216c166937dfa0"`);
        await queryRunner.query(`DROP TABLE "fleet_vehicles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c052722363e280d31c351f5de"`);
        await queryRunner.query(`DROP TABLE "fleets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f9635fa45f0cc7d71023abb330"`);
        await queryRunner.query(`DROP TABLE "owners"`);
    }

}
