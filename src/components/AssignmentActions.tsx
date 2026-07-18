"use client";

import { useTransition } from "react";
import { completeAssignment } from "@/app/(app)/karyawan/actions";

export function AssignmentActions({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className="btn btn-ghost" disabled={disabled || pending} onClick={() => startTransition(() => completeAssignment(id))}>
      Tandai selesai
    </button>
  );
}
