/*
  Warnings:

  - You are about to drop the column `message` on the `warnings` table. All the data in the column will be lost.
  - You are about to drop the column `severity` on the `warnings` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."QuestionType" AS ENUM ('mcq', 'descriptive', 'video', 'photo');

-- AlterTable
ALTER TABLE "public"."questions" ADD COLUMN     "media_url" TEXT,
ADD COLUMN     "question_type" "public"."QuestionType" NOT NULL DEFAULT 'mcq';

-- AlterTable
ALTER TABLE "public"."responses" ADD COLUMN     "media_response" TEXT,
ADD COLUMN     "text_response" TEXT;

-- AlterTable
ALTER TABLE "public"."warnings" DROP COLUMN "message",
DROP COLUMN "severity";
