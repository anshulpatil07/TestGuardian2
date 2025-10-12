/*
  Warnings:

  - Added the required column `message` to the `warnings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."warnings" ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "severity" VARCHAR(10) NOT NULL DEFAULT 'medium';
