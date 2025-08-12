/*
  Warnings:

  - You are about to drop the `Signup` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `Event` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `airport` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `googleSheetId` on the `Event` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Event` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `endorsements` on the `User` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `User` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `airports` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bannerUrl` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `staffedStations` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `rating` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Signup_userCid_idx";

-- DropIndex
DROP INDEX "Signup_eventId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Signup";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "EventSignup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "availability" JSONB NOT NULL,
    "preferredStations" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventSignup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventSignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventDocument_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bannerUrl" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "airports" JSONB NOT NULL,
    "signupDeadline" DATETIME NOT NULL,
    "staffedStations" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("createdAt", "description", "endTime", "id", "name", "signupDeadline", "startTime", "status") SELECT "createdAt", "description", "endTime", "id", "name", "signupDeadline", "startTime", "status" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONTROLLER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("cid", "createdAt", "id", "name", "updatedAt") SELECT "cid", "createdAt", "id", "name", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_cid_key" ON "User"("cid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
