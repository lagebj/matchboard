-- AlterEnum: Add notification template values
ALTER TYPE "NotificationTemplate" ADD VALUE 'REVIEW_REQUESTED';
ALTER TYPE "NotificationTemplate" ADD VALUE 'REVIEW_CHANGES_REQUESTED';
ALTER TYPE "NotificationTemplate" ADD VALUE 'OWNERSHIP_ASSIGNED';
ALTER TYPE "NotificationTemplate" ADD VALUE 'OWNERSHIP_HANDOVER_REQUESTED';