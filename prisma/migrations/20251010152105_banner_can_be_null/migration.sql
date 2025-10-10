-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bannerUrl" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "airports" JSONB NOT NULL,
    "signupDeadline" DATETIME,
    "staffedStations" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "rosterlink" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("airports", "bannerUrl", "createdAt", "createdById", "description", "endTime", "id", "name", "rosterlink", "signupDeadline", "staffedStations", "startTime", "status", "updatedAt") SELECT "airports", "bannerUrl", "createdAt", "createdById", "description", "endTime", "id", "name", "rosterlink", "signupDeadline", "staffedStations", "startTime", "status", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
