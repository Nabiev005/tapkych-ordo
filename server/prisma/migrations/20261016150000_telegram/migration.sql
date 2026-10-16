-- Telegram bot: student chat link, one-time link code, last reminder day
ALTER TABLE "Student" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "Student" ADD COLUMN "telegramLinkCode" TEXT;
ALTER TABLE "Student" ADD COLUMN "telegramRemindedDay" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "Student_telegramChatId_key" ON "Student"("telegramChatId");
CREATE UNIQUE INDEX "Student_telegramLinkCode_key" ON "Student"("telegramLinkCode");
