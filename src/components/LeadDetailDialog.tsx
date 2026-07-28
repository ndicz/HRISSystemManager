"use client";

import { useState, useTransition } from "react";
import { setLeadStage, markLeadLost, reopenLead, convertLeadToClient, addLeadActivity, updateLead } from "@/app/(app)/crm/actions";
import { formatRp } from "@/lib/payroll";
import { RupiahInput } from "@/components/RupiahInput";
import { STAGE_TAG, STAGE_LABEL, type LeadRow } from "@/components/CrmTables";

const ACTIVE_STAGES = ["kontak_awal", "penawaran", "negosiasi", "deal"];

export function LeadDetailDialog({ lead, onChanged }: { lead: LeadRow; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const [stagePending, startStage] = useTransition();
  const [convertPending, startConvert] = useTransition();
  const [reopenPending, startReopen] = useTransition();

  const [losing, setLosing] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [losePending, startLose] = useTransition();

  const [note, setNote] = useState("");
  const [notePending, startNote] = useTransition();

  const [editing, setEditing] = useState(false);
  const [editPending, setEditPending] = useState(false);

  const converted = !!lead.clientId;
  const isLost = lead.stage === "batal";

  function run(action: () => Promise<void>, start: typeof startStage) {
    setError("");
    start(async () => {
      try {
        await action();
        onChanged?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function submitNote() {
    if (!note.trim()) return;
    setError("");
    startNote(async () => {
      try {
        await addLeadActivity(lead.id, note);
        setNote("");
        onChanged?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function handleEditSubmit(formData: FormData) {
    setEditPending(true);
    setError("");
    try {
      await updateLead(lead.id, formData);
      setEditing(false);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Detail</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(560px, 100%)", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">{lead.companyName}</div>

            <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <div className="card" style={{ padding: "var(--space-3)" }}>
                <div className="card-kicker">Estimasi Nilai</div>
                <div style={{ fontWeight: 600 }}>{formatRp(lead.estimatedValue)}</div>
              </div>
              <div className="card" style={{ padding: "var(--space-3)" }}>
                <div className="card-kicker">Tahap</div>
                <div>
                  <span className={STAGE_TAG[lead.stage]}>{STAGE_LABEL[lead.stage]}</span>
                  {converted && <span className="tag tag-accent" style={{ marginLeft: 6 }}>Sudah Klien</span>}
                </div>
              </div>
            </div>

            {editing ? (
              <form
                action={handleEditSubmit}
                style={{ display: "grid", gap: "var(--space-2)", padding: "var(--space-3)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-3)" }}
              >
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="edit-companyName">Nama perusahaan</label>
                  <input className="input" id="edit-companyName" name="companyName" required defaultValue={lead.companyName} />
                </div>
                <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="edit-picName">Nama PIC</label>
                    <input className="input" id="edit-picName" name="picName" defaultValue={lead.picName ?? ""} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="edit-picPhone">Telepon PIC</label>
                    <input className="input" id="edit-picPhone" name="picPhone" defaultValue={lead.picPhone ?? ""} />
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="edit-picEmail">Email PIC</label>
                  <input className="input" id="edit-picEmail" name="picEmail" type="email" defaultValue={lead.picEmail ?? ""} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="edit-address">Alamat</label>
                  <input className="input" id="edit-address" name="address" defaultValue={lead.address ?? ""} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="edit-estimatedValue">Estimasi nilai deal (Rp)</label>
                  <RupiahInput id="edit-estimatedValue" name="estimatedValue" defaultValue={lead.estimatedValue} />
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary" disabled={editPending}>{editPending ? "Menyimpan…" : "Simpan"}</button>
                </div>
              </form>
            ) : (
              <div style={{ fontSize: 13, display: "grid", gap: 4, marginBottom: "var(--space-3)" }}>
                <div><span className="text-muted">PIC:</span> {lead.picName || "-"}{lead.picPhone ? ` · ${lead.picPhone}` : ""}</div>
                {lead.picEmail && <div><span className="text-muted">Email:</span> {lead.picEmail}</div>}
                {lead.address && <div><span className="text-muted">Alamat:</span> {lead.address}</div>}
                {lead.lostReason && <div><span className="text-muted">Alasan batal:</span> &ldquo;{lead.lostReason}&rdquo;</div>}
                {!converted && (
                  <button type="button" className="btn btn-ghost" style={{ width: "fit-content", padding: "2px 8px", fontSize: 12 }} onClick={() => setEditing(true)}>
                    Edit info
                  </button>
                )}
              </div>
            )}

            {!converted && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-3)" }}>
                {!isLost && (
                  <select
                    className="input"
                    style={{ width: "auto" }}
                    value={lead.stage}
                    disabled={stagePending}
                    onChange={(e) => run(() => setLeadStage(lead.id, e.target.value), startStage)}
                  >
                    {ACTIVE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                  </select>
                )}
                {lead.stage === "deal" && (
                  <button type="button" className="btn btn-primary" disabled={convertPending} onClick={() => run(() => convertLeadToClient(lead.id), startConvert)}>
                    {convertPending ? "Memproses…" : "Jadikan Klien"}
                  </button>
                )}
                {isLost ? (
                  <button type="button" className="btn btn-secondary" disabled={reopenPending} onClick={() => run(() => reopenLead(lead.id), startReopen)}>
                    {reopenPending ? "…" : "Buka Lagi"}
                  </button>
                ) : losing ? (
                  <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input className="input" style={{ width: 220 }} placeholder="Alasan batal (opsional)" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={losePending}
                      onClick={() => run(async () => { await markLeadLost(lead.id, lostReason); setLosing(false); setLostReason(""); }, startLose)}
                    >
                      {losePending ? "…" : "Konfirmasi"}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setLosing(false)}>Batal</button>
                  </span>
                ) : (
                  <button type="button" className="btn btn-ghost" onClick={() => setLosing(true)}>Tandai Batal</button>
                )}
              </div>
            )}

            {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: "0 0 var(--space-3)" }}>{error}</p>}

            <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Riwayat Follow-up</div>
            <div style={{ display: "flex", gap: 6, marginBottom: "var(--space-3)" }}>
              <input className="input" placeholder="Catatan follow-up baru…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitNote(); }} />
              <button type="button" className="btn btn-secondary" disabled={notePending || !note.trim()} onClick={submitNote}>
                {notePending ? "…" : "Tambah"}
              </button>
            </div>
            {lead.activities.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada catatan follow-up.</p>
            ) : (
              <div style={{ display: "grid", gap: 8, marginBottom: "var(--space-3)" }}>
                {lead.activities.map((a) => (
                  <div key={a.id} style={{ fontSize: 13, borderLeft: "2px solid var(--color-divider)", paddingLeft: 10 }}>
                    <div className="text-muted" style={{ fontSize: 11 }}>{a.createdAt.toLocaleString("id-ID")}</div>
                    {a.note}
                  </div>
                ))}
              </div>
            )}

            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
