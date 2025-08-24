/*
  Warnings:

  - You are about to drop the column `userId` on the `EventSignup` table. All the data in the column will be lost.
  - You are about to alter the column `cid` on the `User` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `userCID` to the `EventSignup` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventSignup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "userCID" INTEGER NOT NULL,
    "availability" JSONB NOT NULL,
    "endorsement" TEXT,
    "breakrequests" TEXT,
    "preferredStations" TEXT,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventSignup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventSignup_userCID_fkey" FOREIGN KEY ("userCID") REFERENCES "User" ("cid") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EventSignup" ("availability", "breakrequests", "createdAt", "endorsement", "eventId", "id", "preferredStations", "remarks", "updatedAt") SELECT "availability", "breakrequests", "createdAt", "endorsement", "eventId", "id", "preferredStations", "remarks", "updatedAt" FROM "EventSignup";
DROP TABLE "EventSignup";
ALTER TABLE "new_EventSignup" RENAME TO "EventSignup";
CREATE UNIQUE INDEX "EventSignup_eventId_userCID_key" ON "EventSignup"("eventId", "userCID");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cid" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONTROLLER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("cid", "createdAt", "id", "name", "rating", "role", "updatedAt") SELECT "cid", "createdAt", "id", "name", "rating", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_cid_key" ON "User"("cid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
