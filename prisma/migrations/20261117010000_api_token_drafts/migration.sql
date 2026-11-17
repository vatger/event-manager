-- API-Tokens dürfen optional auch Entwürfe sehen (Standard: nein)
ALTER TABLE `ApiToken` ADD COLUMN `includeDrafts` BOOLEAN NOT NULL DEFAULT false;
