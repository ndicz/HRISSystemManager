-- Attendance days filled in automatically from an approved leave request.
ALTER TABLE "AttendanceRecord" ADD COLUMN "leaveRequestId" TEXT;
CREATE INDEX "AttendanceRecord_leaveRequestId_idx" ON "AttendanceRecord"("leaveRequestId");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
