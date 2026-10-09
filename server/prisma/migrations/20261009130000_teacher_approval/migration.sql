-- Мугалим Google менен өзү катталганда — башкы алып баруучу ырастаганга чейин approved = false
ALTER TABLE "Teacher" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT true;
