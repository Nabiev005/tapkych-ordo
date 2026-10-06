-- CreateTable
CREATE TABLE "Teacher" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AudienceVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameQuestionId" INTEGER NOT NULL,
    "voterId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AudienceVote_gameQuestionId_fkey" FOREIGN KEY ("gameQuestionId") REFERENCES "GameQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" INTEGER,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timerSeconds" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "closesAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssignmentQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assignmentId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CHOICE',
    "category" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "audioUrl" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    CONSTRAINT "AssignmentQuestion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assignmentId" INTEGER NOT NULL,
    "studentId" INTEGER,
    "name" TEXT NOT NULL,
    "className" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "index" INTEGER NOT NULL DEFAULT 0,
    "currentStartedAt" DATETIME,
    "answers" TEXT NOT NULL DEFAULT '[]',
    "score" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Answer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameQuestionId" INTEGER NOT NULL,
    "choice" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "responseMs" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_gameQuestionId_fkey" FOREIGN KEY ("gameQuestionId") REFERENCES "GameQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Answer" ("choice", "createdAt", "gameId", "gameQuestionId", "id", "isCorrect", "playerId", "points", "responseMs") SELECT "choice", "createdAt", "gameId", "gameQuestionId", "id", "isCorrect", "playerId", "points", "responseMs" FROM "Answer";
DROP TABLE "Answer";
ALTER TABLE "new_Answer" RENAME TO "Answer";
CREATE INDEX "Answer_gameId_idx" ON "Answer"("gameId");
CREATE UNIQUE INDEX "Answer_playerId_gameQuestionId_key" ON "Answer"("playerId", "gameQuestionId");
CREATE TABLE "new_Game" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" INTEGER,
    "code" TEXT NOT NULL,
    "title" TEXT,
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
    "teamMode" BOOLEAN NOT NULL DEFAULT false,
    "speedBonus" INTEGER NOT NULL DEFAULT 0,
    "fiftyFifty" BOOLEAN NOT NULL DEFAULT false,
    "selectionMode" TEXT NOT NULL DEFAULT 'ORDER',
    "categories" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "Game_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Game" ("advanceToFinal", "advanceToRound2", "code", "createdAt", "currentIndex", "expectedPlayers", "finalQuestionCount", "finishedAt", "id", "paused", "pausedRemainingMs", "phase", "pointsPerCorrect", "questionEndsAt", "round1Count", "round2Count", "showLeaderboard", "soundEnabled", "startedAt", "status", "timerSeconds", "title") SELECT "advanceToFinal", "advanceToRound2", "code", "createdAt", "currentIndex", "expectedPlayers", "finalQuestionCount", "finishedAt", "id", "paused", "pausedRemainingMs", "phase", "pointsPerCorrect", "questionEndsAt", "round1Count", "round2Count", "showLeaderboard", "soundEnabled", "startedAt", "status", "timerSeconds", "title" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE UNIQUE INDEX "Game_code_key" ON "Game"("code");
CREATE TABLE "new_GameQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "questionId" INTEGER,
    "round" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CHOICE',
    "category" TEXT NOT NULL DEFAULT '',
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "audioUrl" TEXT,
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
INSERT INTO "new_GameQuestion" ("correct", "endsAt", "gameId", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "order", "questionId", "revealedAt", "round", "startedAt", "text") SELECT "correct", "endsAt", "gameId", "id", "imageUrl", "optionA", "optionB", "optionC", "optionD", "order", "questionId", "revealedAt", "round", "startedAt", "text" FROM "GameQuestion";
DROP TABLE "GameQuestion";
ALTER TABLE "new_GameQuestion" RENAME TO "GameQuestion";
CREATE UNIQUE INDEX "GameQuestion_gameId_round_order_key" ON "GameQuestion"("gameId", "round", "order");
CREATE TABLE "new_Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "token" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "eliminatedAfter" TEXT,
    "seat" INTEGER NOT NULL DEFAULT 0,
    "studentId" INTEGER,
    "team" TEXT NOT NULL DEFAULT '',
    "fiftyQuestionId" INTEGER,
    "fiftyHidden" TEXT,
    "joinedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Player_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("createdAt", "eliminatedAfter", "gameId", "id", "joinedAt", "name", "pin", "seat", "status", "studentId", "token") SELECT "createdAt", "eliminatedAfter", "gameId", "id", "joinedAt", "name", "pin", "seat", "status", "studentId", "token" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_token_key" ON "Player"("token");
CREATE INDEX "Player_gameId_idx" ON "Player"("gameId");
CREATE INDEX "Player_studentId_idx" ON "Player"("studentId");
CREATE UNIQUE INDEX "Player_gameId_pin_key" ON "Player"("gameId", "pin");
CREATE TABLE "new_Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" INTEGER,
    "round" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CHOICE',
    "category" TEXT NOT NULL DEFAULT '',
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "audioUrl" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("archived", "correct", "createdAt", "id", "imageUrl", "lastUsedAt", "optionA", "optionB", "optionC", "optionD", "order", "round", "text", "updatedAt", "usedCount") SELECT "archived", "correct", "createdAt", "id", "imageUrl", "lastUsedAt", "optionA", "optionB", "optionC", "optionD", "order", "round", "text", "updatedAt", "usedCount" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE INDEX "Question_ownerId_round_archived_order_idx" ON "Question"("ownerId", "round", "archived", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_username_key" ON "Teacher"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AudienceVote_gameQuestionId_voterId_key" ON "AudienceVote"("gameQuestionId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_code_key" ON "Assignment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentQuestion_assignmentId_order_key" ON "AssignmentQuestion"("assignmentId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_token_key" ON "Submission"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assignmentId_studentId_key" ON "Submission"("assignmentId", "studentId");
