"use client";

import { useState } from "react";
import { AttendanceRecapPanel } from "@/components/AttendanceRecapPanel";

export function RecapDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Rekap bulanan
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ maxWidth: 680, width: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Rekap Absensi &mdash; {employeeName}</div>
            <div className="dialog-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <AttendanceRecapPanel employeeId={employeeId} employeeName={employeeName} />
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
