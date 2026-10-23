import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1792495407649 implements MigrationInterface {
    name = 'InitialSchema1792495407649'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "wallet_topups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "amountKz" integer NOT NULL, "reference" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'processing', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b0f950a3254046c68069d91f68b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_80eb6d0aa5717931bcfb9a0255" ON "wallet_topups" ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."users_preferredlanguage_enum" AS ENUM('pt', 'en')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying(120) NOT NULL, "phone" character varying(20) NOT NULL, "email" character varying(120), "birthDate" date, "photoUrl" character varying, "preferredLanguage" "public"."users_preferredlanguage_enum" NOT NULL DEFAULT 'pt', "isVerified" boolean NOT NULL DEFAULT false, "angoPoints" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."trips_categoryid_enum" AS ENUM('ango_taxi', 'ango_conforto', 'ango_executivo', 'ango_family', 'ango_grupo', 'ango_aeroporto', 'ango_tour', 'ango_moto', 'ango_acessivel')`);
        await queryRunner.query(`CREATE TYPE "public"."trips_status_enum" AS ENUM('searching_driver', 'driver_assigned', 'driver_arriving', 'in_progress', 'completed', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "categoryId" "public"."trips_categoryid_enum" NOT NULL, "origin" jsonb NOT NULL, "destination" jsonb NOT NULL, "distanceKm" double precision NOT NULL, "etaMinutes" integer NOT NULL, "priceKz" integer NOT NULL, "priceBreakdown" jsonb, "status" "public"."trips_status_enum" NOT NULL DEFAULT 'searching_driver', "boardingCode" character varying(6), "scheduledFor" TIMESTAMP WITH TIME ZONE, "paymentMethodType" character varying(30) NOT NULL DEFAULT 'wallet', "cashNoteKz" integer, "cancelReason" character varying(200), "startedAt" TIMESTAMP WITH TIME ZONE, "boardingConfirmedAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, "actualDistanceKm" double precision, "comfortPreferences" jsonb, "splitCount" integer, "airportPickup" jsonb, "womenMode" boolean NOT NULL DEFAULT false, "changeKz" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "passengerId" uuid, "driverId" uuid, CONSTRAINT "PK_f71c231dee9c05a9522f9e840f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."drivers_status_enum" AS ENUM('offline', 'online', 'on_trip')`);
        await queryRunner.query(`CREATE TABLE "drivers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying(120) NOT NULL, "phone" character varying(20) NOT NULL, "photoUrl" character varying, "rating" double precision NOT NULL DEFAULT '5', "status" "public"."drivers_status_enum" NOT NULL DEFAULT 'offline', "currentLocation" geography(Point,4326), "isVerified" boolean NOT NULL DEFAULT false, "gender" character varying(10) NOT NULL DEFAULT 'male', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b97a5a68c766d2d1ec25e6a85b2" UNIQUE ("phone"), CONSTRAINT "PK_92ab3fb69e566d3eb0cae896047" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."vehicles_categoryid_enum" AS ENUM('ango_taxi', 'ango_conforto', 'ango_executivo', 'ango_family', 'ango_grupo', 'ango_aeroporto', 'ango_tour', 'ango_moto', 'ango_acessivel')`);
        await queryRunner.query(`CREATE TABLE "vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "model" character varying(60) NOT NULL, "plate" character varying(20) NOT NULL, "color" character varying(30) NOT NULL, "categoryId" "public"."vehicles_categoryid_enum" NOT NULL DEFAULT 'ango_taxi', "capacity" integer NOT NULL DEFAULT '4', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "driverId" uuid, CONSTRAINT "UQ_ec7181ebdab798d97070122a5bf" UNIQUE ("plate"), CONSTRAINT "REL_28d7607488252336b22511e9e8" UNIQUE ("driverId"), CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "trip_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tripRef" character varying(60) NOT NULL, "type" character varying(40) NOT NULL, "meta" jsonb, "clientAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_df6ea3b2ad6f86f525d796220da" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6176fbe88cfc09d3bd3e71d041" ON "trip_events" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d22f05cca85b705f07511bb9c3" ON "trip_events" ("tripRef") `);
        await queryRunner.query(`CREATE TABLE "incidents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "caseNumber" character varying(20) NOT NULL, "userId" uuid NOT NULL, "kind" character varying(20) NOT NULL DEFAULT 'incident', "category" character varying(80) NOT NULL, "description" text NOT NULL DEFAULT '', "tripRef" character varying(60), "status" character varying(30) NOT NULL DEFAULT 'recebido', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ccb34c01719889017e2246469f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5602596fc4f0b1fb5b5eb14ab3" ON "incidents" ("caseNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_bbf0491d4505ead46d8c27a0b2" ON "incidents" ("userId") `);
        await queryRunner.query(`CREATE TABLE "reward_redemptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "rewardId" character varying(20) NOT NULL, "title" character varying(160) NOT NULL, "costPoints" integer NOT NULL, "code" character varying(20) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e02d178fa8c54295d8edc8781b3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5490172918e20aa466c63c9ac1" ON "reward_redemptions" ("userId") `);
        await queryRunner.query(`CREATE TABLE "user_profiles" ("userId" uuid NOT NULL, "isVerified" boolean NOT NULL DEFAULT false, "verificationStatus" character varying(20) NOT NULL DEFAULT 'none', "angoPoints" integer NOT NULL DEFAULT '0', "verifiedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_8481388d6325e752cd4d7e26c6d" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`CREATE TABLE "price_changes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tripRef" character varying(60) NOT NULL, "originalPriceKz" integer NOT NULL, "proposedPriceKz" integer NOT NULL, "reason" character varying(200), "status" character varying(20) NOT NULL DEFAULT 'proposta', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "resolvedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_44ba7d1ffce2e0e44d57afe3ca8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_43ed5ad9a37349d6950a87da2b" ON "price_changes" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_830a39f1d76b7a9f555a953887" ON "price_changes" ("tripRef") `);
        await queryRunner.query(`CREATE TABLE "favorite_places" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "placeKey" character varying(60) NOT NULL, "label" character varying(80) NOT NULL, "kind" character varying(20) NOT NULL DEFAULT 'favorite', "address" character varying(200) NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0c0591bffc1e6e4529a8e0d1aa1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9675bf308590c3cc2a9de0cb3d" ON "favorite_places" ("userId", "placeKey") `);
        await queryRunner.query(`CREATE TABLE "family_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "name" character varying(120) NOT NULL, "phone" character varying(30) NOT NULL, "relationship" character varying(40) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_186da7c7fcbf23775fdd888a747" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ccda8487d562e954d3c93bfbd0" ON "family_members" ("userId") `);
        await queryRunner.query(`CREATE TABLE "driver_wallet_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driverId" uuid NOT NULL, "kind" character varying(20) NOT NULL, "amountKz" integer NOT NULL, "status" character varying(20) NOT NULL, "tripId" uuid, "reference" character varying(20), "settledAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f5edc8629f58ccf0d1f3b82d2c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d79f1e7f5da13903227783c6de" ON "driver_wallet_entries" ("driverId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_15d070c4225773850738493b7c" ON "driver_wallet_entries" ("driverId", "tripId", "kind") `);
        await queryRunner.query(`CREATE TABLE "ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tripRef" character varying(60) NOT NULL, "driverId" character varying(60), "stars" integer NOT NULL, "comment" text NOT NULL DEFAULT '', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0f31425b073219379545ad68ed9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fdadf4761e308eda077d6da9c7" ON "ratings" ("userId", "tripRef") `);
        await queryRunner.query(`CREATE TABLE "favorite_drivers" ("userId" uuid NOT NULL, "driverId" character varying(60) NOT NULL, "driverName" character varying(120) NOT NULL, CONSTRAINT "PK_5e81991945522861b8b794fb413" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`CREATE TABLE "driver_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driverId" uuid NOT NULL, "type" character varying(30) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "filePath" character varying(400) NOT NULL, "mimeType" character varying(20) NOT NULL, "rejectionReason" character varying(300), "reviewedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_31c28b4e8f55a5d411597d45ab2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_22eb4a151d293e1bdff7a4dcc5" ON "driver_documents" ("driverId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_76bfb389e7c9fe9c199a06fc18" ON "driver_documents" ("driverId", "type") `);
        await queryRunner.query(`CREATE TABLE "cancellations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tripRef" character varying(60), "reason" character varying(200) NOT NULL, "risk" character varying(20) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a4cc24d65fd356b0781f9a3daed" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1c8021007b07f37abcb0c3f291" ON "cancellations" ("userId") `);
        await queryRunner.query(`ALTER TABLE "trips" ADD CONSTRAINT "FK_a4d572e126f5475433560c9a370" FOREIGN KEY ("passengerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trips" ADD CONSTRAINT "FK_fc5a8911f85074a660a4304baa1" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vehicles" ADD CONSTRAINT "FK_28d7607488252336b22511e9e80" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicles" DROP CONSTRAINT "FK_28d7607488252336b22511e9e80"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP CONSTRAINT "FK_fc5a8911f85074a660a4304baa1"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP CONSTRAINT "FK_a4d572e126f5475433560c9a370"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1c8021007b07f37abcb0c3f291"`);
        await queryRunner.query(`DROP TABLE "cancellations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_76bfb389e7c9fe9c199a06fc18"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_22eb4a151d293e1bdff7a4dcc5"`);
        await queryRunner.query(`DROP TABLE "driver_documents"`);
        await queryRunner.query(`DROP TABLE "favorite_drivers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fdadf4761e308eda077d6da9c7"`);
        await queryRunner.query(`DROP TABLE "ratings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_15d070c4225773850738493b7c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d79f1e7f5da13903227783c6de"`);
        await queryRunner.query(`DROP TABLE "driver_wallet_entries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ccda8487d562e954d3c93bfbd0"`);
        await queryRunner.query(`DROP TABLE "family_members"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9675bf308590c3cc2a9de0cb3d"`);
        await queryRunner.query(`DROP TABLE "favorite_places"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_830a39f1d76b7a9f555a953887"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_43ed5ad9a37349d6950a87da2b"`);
        await queryRunner.query(`DROP TABLE "price_changes"`);
        await queryRunner.query(`DROP TABLE "user_profiles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5490172918e20aa466c63c9ac1"`);
        await queryRunner.query(`DROP TABLE "reward_redemptions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bbf0491d4505ead46d8c27a0b2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5602596fc4f0b1fb5b5eb14ab3"`);
        await queryRunner.query(`DROP TABLE "incidents"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d22f05cca85b705f07511bb9c3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6176fbe88cfc09d3bd3e71d041"`);
        await queryRunner.query(`DROP TABLE "trip_events"`);
        await queryRunner.query(`DROP TABLE "vehicles"`);
        await queryRunner.query(`DROP TYPE "public"."vehicles_categoryid_enum"`);
        await queryRunner.query(`DROP TABLE "drivers"`);
        await queryRunner.query(`DROP TYPE "public"."drivers_status_enum"`);
        await queryRunner.query(`DROP TABLE "trips"`);
        await queryRunner.query(`DROP TYPE "public"."trips_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."trips_categoryid_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_preferredlanguage_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_80eb6d0aa5717931bcfb9a0255"`);
        await queryRunner.query(`DROP TABLE "wallet_topups"`);
    }

}
