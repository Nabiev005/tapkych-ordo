-- Phase 1: per-question timer, video questions, shuffled question order, player avatars
ALTER TABLE "Question" ADD COLUMN "timerSeconds" INTEGER;
ALTER TABLE "Question" ADD COLUMN "videoUrl" TEXT;
ALTER TABLE "GameQuestion" ADD COLUMN "timerSeconds" INTEGER;
ALTER TABLE "GameQuestion" ADD COLUMN "videoUrl" TEXT;
ALTER TABLE "Game" ADD COLUMN "shuffle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Player" ADD COLUMN "avatar" TEXT NOT NULL DEFAULT '';
