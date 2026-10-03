-- CreateTable
CREATE TABLE "Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "round" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Game" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "phase" TEXT NOT NULL DEFAULT 'IDLE',
    "paused" BOOLEAN NOT NULL DEFAULT false,
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

-- CreateTable
CREATE TABLE "Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "token" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "eliminatedAfter" TEXT,
    "seat" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "questionId" INTEGER,
    "round" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    "startedAt" DATETIME,
    "endsAt" DATETIME,
    "revealedAt" DATETIME,
    CONSTRAINT "GameQuestion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameQuestionId" INTEGER NOT NULL,
    "choice" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "responseMs" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_gameQuestionId_fkey" FOREIGN KEY ("gameQuestionId") REFERENCES "GameQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoreAdjustment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "round" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreAdjustment_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScoreAdjustment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Question_round_order_idx" ON "Question"("round", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Game_code_key" ON "Game"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Player_token_key" ON "Player"("token");

-- CreateIndex
CREATE INDEX "Player_gameId_idx" ON "Player"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_gameId_pin_key" ON "Player"("gameId", "pin");

-- CreateIndex
CREATE UNIQUE INDEX "GameQuestion_gameId_round_order_key" ON "GameQuestion"("gameId", "round", "order");

-- CreateIndex
CREATE INDEX "Answer_gameId_idx" ON "Answer"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_playerId_gameQuestionId_key" ON "Answer"("playerId", "gameQuestionId");

-- CreateIndex
CREATE INDEX "ScoreAdjustment_gameId_idx" ON "ScoreAdjustment"("gameId");
