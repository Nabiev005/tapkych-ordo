-- Жалпы суроолор китепканасы: мугалимдер ырасталган суроолорду өз банкына көчүрөт
-- Question.libraryId — кайсы китепкана суроосунан көчүрүлгөнү (кайра көчүрбөө үчүн)
ALTER TABLE "Question" ADD COLUMN "libraryId" INTEGER;

-- CreateTable
CREATE TABLE "LibraryQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "authorId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
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
    "copiedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryQuestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LibraryQuestion_status_category_idx" ON "LibraryQuestion"("status", "category");
