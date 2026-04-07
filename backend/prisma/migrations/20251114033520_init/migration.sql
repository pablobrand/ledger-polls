/*
  Warnings:

  - Made the column `generatedUserId` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'DECIMAL', 'DATE', 'DATETIME', 'BOOLEAN', 'SCALE');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EligibilityOperator" AS ENUM ('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'NOT_IN', 'EXISTS', 'NOT_EXISTS', 'CONTAINS', 'NOT_CONTAINS', 'BETWEEN');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'STARTED', 'COMPLETED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dekWrapInfo" JSONB,
ADD COLUMN     "encryptedDEK" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "walletLabel" TEXT,
ADD COLUMN     "walletProvider" TEXT,
ADD COLUMN     "walletPublicKey" TEXT,
ALTER COLUMN "generatedUserId" SET NOT NULL,
ALTER COLUMN "dateExpire" SET DEFAULT now() + interval '10 days';

-- CreateTable
CREATE TABLE "personas" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "firstName" JSONB,
    "lastName" JSONB,
    "email" JSONB,
    "phone" JSONB,
    "dob" JSONB,
    "address" JSONB,
    "country" JSONB,
    "region" JSONB,
    "city" JSONB,
    "postalCode" JSONB,
    "gender" JSONB,
    "ethnicity" JSONB,
    "education" JSONB,
    "income" JSONB,
    "employment" JSONB,
    "interests" JSONB,
    "profileFacts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_traits" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "hashedValue" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "bucket" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_traits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orgs" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" INTEGER,
    "billingInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" BIGSERIAL NOT NULL,
    "orgId" BIGINT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "eligibility" JSONB,
    "desiredResponses" INTEGER,
    "maxPerUser" INTEGER DEFAULT 1,
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility" (
    "id" BIGSERIAL NOT NULL,
    "surveyId" BIGINT NOT NULL,
    "key" TEXT NOT NULL,
    "operator" "EligibilityOperator" NOT NULL,
    "values" TEXT[],
    "clauseId" INTEGER,

    CONSTRAINT "eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" BIGSERIAL NOT NULL,
    "surveyId" BIGINT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "helpText" TEXT,
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "validation" JSONB,
    "logic" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options" (
    "id" BIGSERIAL NOT NULL,
    "questionId" BIGINT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_assignments" (
    "id" BIGSERIAL NOT NULL,
    "surveyId" BIGINT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "eligibilitySnapshot" JSONB,

    CONSTRAINT "survey_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" BIGSERIAL NOT NULL,
    "assignmentId" BIGINT NOT NULL,
    "userId" INTEGER NOT NULL,
    "surveyId" BIGINT NOT NULL,
    "questionId" BIGINT NOT NULL,
    "value" JSONB NOT NULL,
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" BIGSERIAL NOT NULL,
    "surveyId" BIGINT NOT NULL,
    "userId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actorUserId" INTEGER,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_key_wraps" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "wrappedKey" JSONB NOT NULL,
    "wrapMeta" JSONB,
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "user_key_wraps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "meta" JSONB,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_auths" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "provider" TEXT,
    "lastSignedAt" TIMESTAMP(3),
    "lastNonce" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_auths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encrypted_blobs" (
    "id" BIGSERIAL NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "envelope" JSONB NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encrypted_blobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personas_userId_key" ON "personas"("userId");

-- CreateIndex
CREATE INDEX "user_traits_userId_key_idx" ON "user_traits"("userId", "key");

-- CreateIndex
CREATE INDEX "user_traits_key_hashedValue_idx" ON "user_traits"("key", "hashedValue");

-- CreateIndex
CREATE INDEX "orgs_ownerId_idx" ON "orgs"("ownerId");

-- CreateIndex
CREATE INDEX "surveys_status_idx" ON "surveys"("status");

-- CreateIndex
CREATE INDEX "surveys_orgId_idx" ON "surveys"("orgId");

-- CreateIndex
CREATE INDEX "eligibility_surveyId_key_idx" ON "eligibility"("surveyId", "key");

-- CreateIndex
CREATE INDEX "questions_surveyId_order_idx" ON "questions"("surveyId", "order");

-- CreateIndex
CREATE INDEX "options_questionId_order_idx" ON "options"("questionId", "order");

-- CreateIndex
CREATE INDEX "survey_assignments_userId_status_idx" ON "survey_assignments"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "survey_assignments_surveyId_userId_key" ON "survey_assignments"("surveyId", "userId");

-- CreateIndex
CREATE INDEX "answers_userId_surveyId_idx" ON "answers"("userId", "surveyId");

-- CreateIndex
CREATE INDEX "answers_surveyId_questionId_idx" ON "answers"("surveyId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "answers_assignmentId_questionId_key" ON "answers"("assignmentId", "questionId");

-- CreateIndex
CREATE INDEX "payouts_surveyId_idx" ON "payouts"("surveyId");

-- CreateIndex
CREATE INDEX "payouts_userId_idx" ON "payouts"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_action_idx" ON "audit_logs"("actorUserId", "action");

-- CreateIndex
CREATE INDEX "user_key_wraps_userId_purpose_idx" ON "user_key_wraps"("userId", "purpose");

-- CreateIndex
CREATE INDEX "consents_userId_scope_idx" ON "consents"("userId", "scope");

-- CreateIndex
CREATE INDEX "wallet_auths_userId_idx" ON "wallet_auths"("userId");

-- CreateIndex
CREATE INDEX "wallet_auths_walletAddress_idx" ON "wallet_auths"("walletAddress");

-- CreateIndex
CREATE INDEX "encrypted_blobs_ownerUserId_kind_idx" ON "encrypted_blobs"("ownerUserId", "kind");

-- CreateIndex
CREATE INDEX "users_walletAddress_idx" ON "users"("walletAddress");

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_traits" ADD CONSTRAINT "user_traits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility" ADD CONSTRAINT "eligibility_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options" ADD CONSTRAINT "options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_assignments" ADD CONSTRAINT "survey_assignments_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_assignments" ADD CONSTRAINT "survey_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "survey_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_key_wraps" ADD CONSTRAINT "user_key_wraps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_auths" ADD CONSTRAINT "wallet_auths_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encrypted_blobs" ADD CONSTRAINT "encrypted_blobs_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
