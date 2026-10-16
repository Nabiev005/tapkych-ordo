-- Mektepter aralyk liga (league): League table, Assignment.leagueId, Submission.school
CREATE TABLE "League" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" INTEGER,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "schools" TEXT NOT NULL DEFAULT '[]',
    "topN" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "League_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "League_code_key" ON "League"("code");

ALTER TABLE "Assignment" ADD COLUMN "leagueId" INTEGER REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Assignment_leagueId_idx" ON "Assignment"("leagueId");

ALTER TABLE "Submission" ADD COLUMN "school" TEXT NOT NULL DEFAULT '';
