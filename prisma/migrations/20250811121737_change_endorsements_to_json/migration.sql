/*
  Warnings:

  - You are about to alter the column `endorsements` on the `User` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endorsements" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("cid", "createdAt", "endorsements", "id", "name", "updatedAt") SELECT "cid", "createdAt", "endorsements", "id", "name", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_cid_key" ON "User"("cid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
