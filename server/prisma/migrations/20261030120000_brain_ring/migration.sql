-- Brain-ring mode: team vs team, every question is a buzzer question, a single round
ALTER TABLE "Game" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'CLASSIC';
