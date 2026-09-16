ALTER TABLE "counters"
    ALTER COLUMN "count" TYPE DECIMAL(15,6),
    ADD COLUMN "increment" DECIMAL(15,6) NOT NULL DEFAULT 1,
    ADD COLUMN "metric" VARCHAR(80);

ALTER TABLE "counters" ADD CONSTRAINT "counters_increment_positive" CHECK ("increment" > 0);
