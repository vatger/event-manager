-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "endorsements" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Signup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userCid" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "rating" INTEGER,
    "endorsements" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "breaks" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Signup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Signup_userCid_fkey" FOREIGN KEY ("userCid") REFERENCES "User" ("cid") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Signup" ("breaks", "createdAt", "endorsements", "eventId", "from", "id", "rating", "station", "to", "updatedAt", "userCid", "userName") SELECT "breaks", "createdAt", "endorsements", "eventId", "from", "id", "rating", "station", "to", "updatedAt", "userCid", "userName" FROM "Signup";
DROP TABLE "Signup";
ALTER TABLE "new_Signup" RENAME TO "Signup";
CREATE INDEX "Signup_eventId_idx" ON "Signup"("eventId");
CREATE INDEX "Signup_userCid_idx" ON "Signup"("userCid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_cid_key" ON "User"("cid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
