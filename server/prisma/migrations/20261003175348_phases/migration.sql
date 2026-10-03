-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "phase" TEXT NOT NULL DEFAULT 'IDLE',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "showLeaderboard" BOOLEAN NOT NULL DEFAULT false,
    "currentIndex" INTEGER NOT NULL DEFAULT -1,
    "questionEndsAt" DATETIME,
    "pausedRemainingMs" INTEGER,
    "pointsPerCorrect" INTEGER NOT NULL DEFAULT 1,
    "timerSeconds" INTEGER NOT NULL DEFAULT 15,
    "round1Count" INTEGER NOT NULL DEFAULT 10,
    "round2Count" INTEGER NOT NULL DEFAULT 10,
    "finalQuestionCount" INTEGER NOT NULL DEFAULT 5,
    "advanceToRound2" INTEGER NOT NULL DEFAULT 6,
    "advanceToFinal" INTEGER NOT NULL DEFAULT 3,
    "expectedPlayers" INTEGER NOT NULL DEFAULT 12,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME
);
INSERT INTO "new_Game" ("advanceToFinal", "advanceToRound2", "code", "createdAt", "currentIndex", "expectedPlayers", "finalQuestionCount", "finishedAt", "id", "paused", "pausedRemainingMs", "phase", "pointsPerCorrect", "questionEndsAt", "round1Count", "round2Count", "soundEnabled", "startedAt", "status", "timerSeconds") SELECT "advanceToFinal", "advanceToRound2", "code", "createdAt", "currentIndex", "expectedPlayers", "finalQuestionCount", "finishedAt", "id", "paused", "pausedRemainingMs", "phase", "pointsPerCorrect", "questionEndsAt", "round1Count", "round2Count", "soundEnabled", "startedAt", "status", "timerSeconds" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE UNIQUE INDEX "Game_code_key" ON "Game"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
