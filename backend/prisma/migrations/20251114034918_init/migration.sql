-- AlterTable
ALTER TABLE "users" ALTER COLUMN "dateExpire" SET DEFAULT now() + interval '10 days';
