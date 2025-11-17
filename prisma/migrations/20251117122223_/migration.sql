/*
  Warnings:

  - A unique constraint covering the columns `[userId,currency,network]` on the table `wallets` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."wallets_userId_currency_key";

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "network" TEXT NOT NULL DEFAULT 'Base';

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_password_key" ON "Admin"("password");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_currency_network_key" ON "wallets"("userId", "currency", "network");
