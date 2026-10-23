import { MigrationInterface, QueryRunner } from "typeorm";

export class PricingSettings1792716789499 implements MigrationInterface {
    name = 'PricingSettings1792716789499'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "settings_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(20) NOT NULL, "target" character varying(60) NOT NULL, "oldValue" jsonb, "newValue" jsonb, "adminId" uuid, "adminEmail" character varying(160), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a28fc82c541fd112ebcaef8d3a7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "pricing_rules" ("categoryId" character varying(30) NOT NULL, "tarifaBaseKz" integer NOT NULL, "precoPorKmKz" integer NOT NULL, "precoPorMinKz" integer NOT NULL, "tarifaMinimaKz" integer NOT NULL, "velocidadeMediaKmh" integer NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2711b0ea2a8142eaea93653c005" PRIMARY KEY ("categoryId"))`);
        await queryRunner.query(`CREATE TABLE "platform_settings" ("key" character varying(60) NOT NULL, "value" character varying(200) NOT NULL, CONSTRAINT "PK_5d9031e30fac3ec3ec8b9602e17" PRIMARY KEY ("key"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "platform_settings"`);
        await queryRunner.query(`DROP TABLE "pricing_rules"`);
        await queryRunner.query(`DROP TABLE "settings_history"`);
    }

}
