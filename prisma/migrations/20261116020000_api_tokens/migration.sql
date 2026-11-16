-- Tokens für die externe API (/api/v1). Nur der Hash wird gespeichert.
CREATE TABLE `ApiToken` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `tokenPrefix` VARCHAR(16) NOT NULL,
  `firCode` VARCHAR(8) NULL,
  `createdByCID` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NULL,
  `lastUsedAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,

  UNIQUE INDEX `ApiToken_tokenHash_key`(`tokenHash`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
