-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StudyDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "isTestDay" BOOLEAN NOT NULL DEFAULT false,
    "plannedBlocks" JSONB NOT NULL DEFAULT [],
    "plannedMinutes" INTEGER NOT NULL,
    "minutesStudied" INTEGER NOT NULL DEFAULT 0,
    "topicsTouched" JSONB NOT NULL DEFAULT [],
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" DATETIME,
    "recapText" TEXT,
    CONSTRAINT "StudyDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StudyDay" ("closed", "closedAt", "date", "id", "minutesStudied", "plannedMinutes", "recapText", "topicsTouched", "userId", "weekNumber") SELECT "closed", "closedAt", "date", "id", "minutesStudied", "plannedMinutes", "recapText", "topicsTouched", "userId", "weekNumber" FROM "StudyDay";
DROP TABLE "StudyDay";
ALTER TABLE "new_StudyDay" RENAME TO "StudyDay";
CREATE UNIQUE INDEX "StudyDay_userId_date_key" ON "StudyDay"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
