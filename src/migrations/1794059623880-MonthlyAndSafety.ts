import { MigrationInterface, QueryRunner } from "typeorm";

export class MonthlyAndSafety1794059623880 implements MigrationInterface {
    name = 'MonthlyAndSafety1794059623880'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "monthly_service_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "modality" character varying(20) NOT NULL, "originLabel" character varying(160) NOT NULL, "originLocation" geography(Point,4326) NOT NULL, "destinationLabel" character varying(160) NOT NULL, "destinationLocation" geography(Point,4326) NOT NULL, "preferredDays" text NOT NULL DEFAULT '', "departureTime" TIME NOT NULL, "returnTime" TIME, "startDate" date NOT NULL, "passengerCount" integer NOT NULL DEFAULT '1', "specialNeeds" text, "status" character varying(30) NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ea34839d492cb8fefacae1b5de1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2fcb1a2bc709cc8583ff9c6a35" ON "monthly_service_requests" ("userId") `);
        await queryRunner.query(`CREATE TABLE "monthly_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "modality" character varying(20) NOT NULL, "weeklyFrequency" integer NOT NULL DEFAULT '5', "tripsPerDay" integer NOT NULL DEFAULT '2', "includedKm" double precision NOT NULL DEFAULT '0', "includedWaitMinutes" integer NOT NULL DEFAULT '0', "minCapacity" integer, "maxCapacity" integer, "priceKz" double precision NOT NULL, "conditions" text NOT NULL DEFAULT '', "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_373b9d370598f47d57e68059a84" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "monthly_contracts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requestId" uuid NOT NULL, "userId" uuid NOT NULL, "modality" character varying(20) NOT NULL, "planId" uuid, "driverId" uuid, "vehicleId" uuid, "priceKz" double precision NOT NULL, "startDate" date NOT NULL, "endDate" date, "status" character varying(30) NOT NULL DEFAULT 'rascunho', "conditionsAccepted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_09b59c3f0b2cae9ced65729c7f3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_61e218bacc5cd560302848f31d" ON "monthly_contracts" ("requestId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0aea0f57ed36190eaecb24a521" ON "monthly_contracts" ("userId") `);
        await queryRunner.query(`ALTER TABLE "trips" ADD "zoneIncentiveKz" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD "severity" character varying(10) NOT NULL DEFAULT 'normal'`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD "isLiveShare" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD "liveLocationLat" double precision`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD "liveLocationLng" double precision`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD "resolvedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN "resolvedAt"`);
        await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN "liveLocationLng"`);
        await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN "liveLocationLat"`);
        await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN "isLiveShare"`);
        await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN "severity"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "zoneIncentiveKz"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0aea0f57ed36190eaecb24a521"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_61e218bacc5cd560302848f31d"`);
        await queryRunner.query(`DROP TABLE "monthly_contracts"`);
        await queryRunner.query(`DROP TABLE "monthly_plans"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2fcb1a2bc709cc8583ff9c6a35"`);
        await queryRunner.query(`DROP TABLE "monthly_service_requests"`);
    }

}
