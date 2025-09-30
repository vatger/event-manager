-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cid" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("cid", "createdAt", "id", "name", "rating", "role", "updatedAt") SELECT "cid", "createdAt", "id", "name", "rating", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_cid_key" ON "User"("cid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
