-- Даяр оюн пакеттери, студенттин кабинетине кирүү коду жана өз алдынча машыгуу
ALTER TABLE "Student" ADD COLUMN "accessCode" TEXT;

-- CreateTable
CREATE TABLE "LibraryPack" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '🎁',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LibraryPackItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "packId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "round" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "LibraryPackItem_packId_fkey" FOREIGN KEY ("packId") REFERENCES "LibraryPack" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryPackItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LibraryQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "details" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryPack_title_key" ON "LibraryPack"("title");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryPackItem_packId_questionId_key" ON "LibraryPackItem"("packId", "questionId");

-- CreateIndex
CREATE INDEX "PracticeAttempt_studentId_kind_day_idx" ON "PracticeAttempt"("studentId", "kind", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Student_accessCode_key" ON "Student"("accessCode");
