import { MigrationInterface, QueryRunner } from "typeorm";

export class IdentityDocuments1794228123473 implements MigrationInterface {
    name = 'IdentityDocuments1794228123473'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" character varying(30) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "filePath" character varying(400) NOT NULL, "mimeType" character varying(20) NOT NULL, "rejectionReason" character varying(300), "reviewedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cea43819156528b63504c4afd4b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7dc8609606e081e1ae0f0d43b4" ON "user_documents" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_25791735d6c656831ad08c618b" ON "user_documents" ("userId", "type") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_25791735d6c656831ad08c618b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7dc8609606e081e1ae0f0d43b4"`);
        await queryRunner.query(`DROP TABLE "user_documents"`);
    }

}
