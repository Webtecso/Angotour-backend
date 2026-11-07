import { MigrationInterface, QueryRunner } from "typeorm";

export class InspectionsAndReporter1794065924777 implements MigrationInterface {
    name = 'InspectionsAndReporter1794065924777'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vehicle_inspections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vehicleId" uuid NOT NULL, "inspectorName" character varying(120) NOT NULL, "tiresOk" boolean NOT NULL DEFAULT true, "brakesOk" boolean NOT NULL DEFAULT true, "lightsOk" boolean NOT NULL DEFAULT true, "acOk" boolean NOT NULL DEFAULT true, "documentationOk" boolean NOT NULL DEFAULT true, "status" character varying(20) NOT NULL DEFAULT 'certified', "notes" character varying(300), "nextDueDate" date, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_45f26ea872b770773c59fa253c6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD "reporterType" character varying(10) NOT NULL DEFAULT 'passenger'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN "reporterType"`);
        await queryRunner.query(`DROP TABLE "vehicle_inspections"`);
    }

}
