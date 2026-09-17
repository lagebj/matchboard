-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "breakDurationMinutesOverride" INTEGER,
ADD COLUMN     "numberOfPeriodsOverride" INTEGER,
ADD COLUMN     "periodDurationMinutesOverride" INTEGER;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "breakDurationMinutesOverride" INTEGER,
ADD COLUMN     "numberOfPeriodsOverride" INTEGER,
ADD COLUMN     "periodDurationMinutesOverride" INTEGER;

-- AlterTable
ALTER TABLE "LeagueSeason" ADD COLUMN     "defaultBreakDurationMinutes" INTEGER,
ADD COLUMN     "defaultNumberOfPeriods" INTEGER,
ADD COLUMN     "defaultPeriodDurationMinutes" INTEGER;

