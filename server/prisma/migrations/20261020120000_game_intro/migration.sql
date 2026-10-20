-- Game intro on the screen: enabled flag and optional custom video
ALTER TABLE "Game" ADD COLUMN "introEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Game" ADD COLUMN "introVideoUrl" TEXT;
