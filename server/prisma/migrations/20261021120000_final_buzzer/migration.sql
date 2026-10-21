-- Final round buzzer mode: first to press answers aloud, host judges
ALTER TABLE "Game" ADD COLUMN "finalBuzzer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Answer" ADD COLUMN "judgedAt" DATETIME;
