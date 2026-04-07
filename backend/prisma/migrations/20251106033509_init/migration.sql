-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "generatedUserId" TEXT,
    "sessionToken" TEXT,
    "dateLogged" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateExpire" TIMESTAMP(3) NOT NULL DEFAULT now() + interval '10 days',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "users_generatedUserId_key" ON "users"("generatedUserId");
