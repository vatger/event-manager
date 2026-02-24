-- AddForeignKey
ALTER TABLE `WeeklyEventSignup` ADD CONSTRAINT `WeeklyEventSignup_userCID_fkey` FOREIGN KEY (`userCID`) REFERENCES `User`(`cid`) ON DELETE RESTRICT ON UPDATE CASCADE;
