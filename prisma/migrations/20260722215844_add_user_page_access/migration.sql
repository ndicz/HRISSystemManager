-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pageAccess" TEXT[] DEFAULT ARRAY[]::TEXT[];
