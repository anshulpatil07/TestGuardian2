-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('student', 'instructor');

-- CreateEnum
CREATE TYPE "public"."AttemptStatus" AS ENUM ('in_progress', 'submitted', 'auto_submitted');

-- CreateTable
CREATE TABLE "public"."users" (
    "user_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."quizzes" (
    "quiz_id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "created_by" INTEGER NOT NULL,
    "access_password" VARCHAR(100) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("quiz_id")
);

-- CreateTable
CREATE TABLE "public"."questions" (
    "question_id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "public"."options" (
    "option_id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "options_pkey" PRIMARY KEY ("option_id")
);

-- CreateTable
CREATE TABLE "public"."attempts" (
    "attempt_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "score" DECIMAL(5,2),
    "status" "public"."AttemptStatus" NOT NULL DEFAULT 'in_progress',

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "public"."responses" (
    "response_id" SERIAL NOT NULL,
    "attempt_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "selected_option_id" INTEGER,
    "answered_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("response_id")
);

-- CreateTable
CREATE TABLE "public"."warnings" (
    "warning_id" SERIAL NOT NULL,
    "attempt_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "warning_type" VARCHAR(50) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("warning_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_user_id_quiz_id_key" ON "public"."attempts"("user_id", "quiz_id");

-- AddForeignKey
ALTER TABLE "public"."quizzes" ADD CONSTRAINT "quizzes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."questions" ADD CONSTRAINT "questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."options" ADD CONSTRAINT "options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attempts" ADD CONSTRAINT "attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attempts" ADD CONSTRAINT "attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("attempt_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "public"."options"("option_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."warnings" ADD CONSTRAINT "warnings_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("attempt_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."warnings" ADD CONSTRAINT "warnings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
