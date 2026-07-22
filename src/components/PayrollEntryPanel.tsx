"use client";

import { useState, useTransition } from "react";
import type { PayrollEntry, OvertimeDay } from "@prisma/client";
import { savePayrollEntry, addOvertimeDay, removeOvertimeDay } from "@/app/(app)/penggajian/actions";

function todayInputValue() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Isi form Lembur/Allowance/Potongan manual, murni (tanpa dialog/tombol
// sendiri) — ditempel sebagai tab di PayrollDetailDialog. Sebelumnya ini
// adalah dialog sendiri yang dibuka dari dalam dialog Detail lain, hasilnya
// dialog-di-dalam-dialog yang numpuk secara visual.
export function PayrollEntryPanel({
  employeeId,
  period,
  entry,
  overtimeDays,
}: {
  employeeId: string;
  period: string;
  entry: PayrollEntry | null;
  overtimeDays: OvertimeDay[];
}) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newDate, setNewDate] = useState(todayInputValue());
  const [newType, setNewType] = useState<"reguler" | "merah">("reguler");
  const [dayError, setDayError] = useState("");
  const [dayPending, startDayTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setSaved(false);
    try {
      await savePayrollEntry(formData);
      setSaved(true);
    } finally {
      setPending(false);
    }
  }

  function handleAddDay() {
    if (!newDate) return;
    setDayError("");
    startDayTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("employeeId", employeeId);
        fd.set("date", newDate);
        fd.set("type", newType);
        await addOvertimeDay(fd);
      } catch (err) {
        setDayError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleRemoveDay(id: string) {
    setDayError("");
    startDayTransition(async () => {
      try {
        await removeOvertimeDay(id);
      } catch (err) {
        setDayError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div>
      <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)", marginBottom: "var(--space-4)" }}>
        <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Tanggal lembur</div>
        {overtimeDays.length > 0 && (
          <table className="table" style={{ marginBottom: "var(--space-2)" }}>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {overtimeDays.map((d) => (
                <tr key={d.id}>
                  <td>{d.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</td>
                  <td>
                    <span className={d.type === "merah" ? "tag tag-accent" : "tag tag-outline"}>
                      {d.type === "merah" ? "Tanggal Merah" : "Reguler"}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost" disabled={dayPending} onClick={() => handleRemoveDay(d.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {dayError && <p style={{ color: "var(--color-accent-800)", fontSize: 13 }}>{dayError}</p>}
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="new-overtime-date">Tanggal</label>
            <input className="input" id="new-overtime-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="new-overtime-type">Jenis</label>
            <select className="input" id="new-overtime-type" value={newType} onChange={(e) => setNewType(e.target.value as "reguler" | "merah")}>
              <option value="reguler">Reguler</option>
              <option value="merah">Tanggal Merah</option>
            </select>
          </div>
          <button type="button" className="btn btn-primary" disabled={dayPending || !newDate} onClick={handleAddDay}>
            Tambah
          </button>
        </div>
      </div>

      <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-4)" }}>
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="period" value={period} />

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="allowance">Allowance (Rp)</label>
          <input className="input" id="allowance" name="allowance" type="number" min={0} defaultValue={entry?.allowance ?? 0} />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="lemburOverride">Lembur manual (Rp)</label>
          <input
            className="input"
            id="lemburOverride"
            name="lemburOverride"
            type="number"
            min={0}
            placeholder="Otomatis dari tanggal lembur di atas"
            defaultValue={entry?.lemburOverride ?? ""}
          />
          <p style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
            Rate lembur bisa beda per orang — isi ini kalau perhitungan otomatis tidak sesuai untuk karyawan ini.
          </p>
        </div>

        <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}>
          <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Potongan manual (kosongkan = otomatis dari absensi &times; tarif)</div>
          <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="potonganIzinOverride">Izin (Rp)</label>
              <input className="input" id="potonganIzinOverride" name="potonganIzinOverride" type="number" min={0} placeholder="Otomatis" defaultValue={entry?.potonganIzinOverride ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="potonganAlphaOverride">Alfa (Rp)</label>
              <input className="input" id="potonganAlphaOverride" name="potonganAlphaOverride" type="number" min={0} placeholder="Otomatis" defaultValue={entry?.potonganAlphaOverride ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="potonganTerlambatOverride">Terlambat (Rp)</label>
              <input className="input" id="potonganTerlambatOverride" name="potonganTerlambatOverride" type="number" min={0} placeholder="Otomatis" defaultValue={entry?.potonganTerlambatOverride ?? ""} />
            </div>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="note">Keterangan</label>
          <input className="input" id="note" name="note" defaultValue={entry?.note ?? ""} placeholder="mis. masuk tanggal merah 31 Mei" />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)" }}>
          {saved && !pending && <span style={{ fontSize: 12, color: "var(--color-accent)" }}>Tersimpan.</span>}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
