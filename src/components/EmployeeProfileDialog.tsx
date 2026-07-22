"use client";

import { useState, useTransition } from "react";
import { updateEmployeeProfile, fetchCertificates, addCertificate, removeCertificate } from "@/app/(app)/karyawan/actions";

type Emp = {
  id: string;
  name: string;
  ktpNumber: string | null;
  phone: string | null;
  contractNumber: string | null;
  education: string | null;
  bankName: string | null;
  bankAccount: string | null;
  birthPlace: string | null;
  birthDate: Date | null;
  address: string | null;
  gender: string | null;
  religion: string | null;
};

type Cert = { id: string; name: string; validFrom: Date | null; validUntil: Date | null };

function toDateInputValue(d: Date | null) {
  if (!d) return "";
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

const RELIGIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"];

export function EmployeeProfileDialog({ employee }: { employee: Emp }) {
  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState(employee.gender ?? "");
  const [pending, setPending] = useState(false);

  const [certs, setCerts] = useState<Cert[] | null>(null);
  const [certName, setCertName] = useState("");
  const [certFrom, setCertFrom] = useState("");
  const [certUntil, setCertUntil] = useState("");
  const [certError, setCertError] = useState("");
  const [certPending, startCertTransition] = useTransition();

  function openDialog() {
    setOpen(true);
    setCertError("");
    startCertTransition(async () => {
      const data = await fetchCertificates(employee.id);
      setCerts(data);
    });
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await updateEmployeeProfile(formData);
    } finally {
      setPending(false);
    }
  }

  function handleAddCert() {
    if (!certName.trim()) return;
    setCertError("");
    startCertTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("employeeId", employee.id);
        fd.set("name", certName.trim());
        fd.set("validFrom", certFrom);
        fd.set("validUntil", certUntil);
        const data = await addCertificate(fd);
        setCerts(data);
        setCertName("");
        setCertFrom("");
        setCertUntil("");
      } catch (err) {
        setCertError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleRemoveCert(certificateId: string) {
    setCertError("");
    startCertTransition(async () => {
      try {
        const data = await removeCertificate(certificateId);
        setCerts(data);
      } catch (err) {
        setCertError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={openDialog}>
        Profil
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ maxWidth: 680, width: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Profil Karyawan &mdash; {employee.name}</div>
            <div className="dialog-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
                <input type="hidden" name="employeeId" value={employee.id} />

                <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="ktpNumber">No. KTP</label>
                    <input className="input" id="ktpNumber" name="ktpNumber" defaultValue={employee.ktpNumber ?? ""} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="phone">No. Telepon</label>
                    <input className="input" id="phone" name="phone" defaultValue={employee.phone ?? ""} />
                  </div>
                </div>

                <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="birthPlace">Tempat lahir</label>
                    <input className="input" id="birthPlace" name="birthPlace" defaultValue={employee.birthPlace ?? ""} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="birthDate">Tanggal lahir</label>
                    <input className="input" id="birthDate" name="birthDate" type="date" defaultValue={toDateInputValue(employee.birthDate)} />
                  </div>
                </div>

                <div className="field">
                  <label>Jenis kelamin</label>
                  <div className="seg" role="radiogroup">
                    <label className="seg-opt">
                      <input type="radio" name="gender" value="Pria" checked={gender === "Pria"} onChange={() => setGender("Pria")} />
                      Pria
                    </label>
                    <label className="seg-opt">
                      <input type="radio" name="gender" value="Wanita" checked={gender === "Wanita"} onChange={() => setGender("Wanita")} />
                      Wanita
                    </label>
                  </div>
                </div>

                <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="religion">Agama</label>
                    <select className="input" id="religion" name="religion" defaultValue={employee.religion ?? ""}>
                      <option value="">-</option>
                      {RELIGIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="education">Pendidikan</label>
                    <input className="input" id="education" name="education" defaultValue={employee.education ?? ""} placeholder="mis. SMA, S1" />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="address">Alamat</label>
                  <input className="input" id="address" name="address" defaultValue={employee.address ?? ""} />
                </div>

                <div className="field">
                  <label htmlFor="contractNumber">No PKWT (nomor kontrak)</label>
                  <input className="input" id="contractNumber" name="contractNumber" defaultValue={employee.contractNumber ?? ""} />
                </div>

                <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="bankName">Bank</label>
                    <input className="input" id="bankName" name="bankName" defaultValue={employee.bankName ?? ""} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="bankAccount">No. Rekening</label>
                    <input className="input" id="bankAccount" name="bankAccount" defaultValue={employee.bankAccount ?? ""} />
                  </div>
                </div>

                <div className="dialog-actions" style={{ paddingTop: 0 }}>
                  <button type="submit" className="btn btn-primary" disabled={pending}>
                    {pending ? "Menyimpan…" : "Simpan profil"}
                  </button>
                </div>
              </form>

              <hr style={{ margin: "var(--space-4) 0", border: "none", borderTop: "1px solid var(--color-divider)" }} />

              <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Sertifikat</div>
              {certs === null ? (
                <p>Memuat&hellip;</p>
              ) : (
                <>
                  {certs.length > 0 && (
                    <table className="table" style={{ marginBottom: "var(--space-3)" }}>
                      <thead>
                        <tr>
                          <th>Nama sertifikat</th>
                          <th>Berlaku</th>
                          <th>Kedaluwarsa</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {certs.map((c) => (
                          <tr key={c.id}>
                            <td>{c.name}</td>
                            <td className="text-muted">{c.validFrom ? c.validFrom.toLocaleDateString("id-ID") : "-"}</td>
                            <td className="text-muted">{c.validUntil ? c.validUntil.toLocaleDateString("id-ID") : "-"}</td>
                            <td>
                              <button type="button" className="btn btn-ghost" disabled={certPending} onClick={() => handleRemoveCert(c.id)}>
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {certError && <p style={{ color: "var(--color-accent-800)", fontSize: 13 }}>{certError}</p>}

                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                      <label htmlFor="cert-name">Nama sertifikat baru</label>
                      <input className="input" id="cert-name" value={certName} onChange={(e) => setCertName(e.target.value)} placeholder="mis. Sertifikat K3" />
                    </div>
                    <div className="field" style={{ marginBottom: 0, width: 150 }}>
                      <label htmlFor="cert-from">Berlaku</label>
                      <input className="input" id="cert-from" type="date" value={certFrom} onChange={(e) => setCertFrom(e.target.value)} />
                    </div>
                    <div className="field" style={{ marginBottom: 0, width: 150 }}>
                      <label htmlFor="cert-until">Kedaluwarsa</label>
                      <input className="input" id="cert-until" type="date" value={certUntil} onChange={(e) => setCertUntil(e.target.value)} />
                    </div>
                    <button type="button" className="btn btn-primary" disabled={certPending || !certName.trim()} onClick={handleAddCert}>
                      Tambah
                    </button>
                  </div>
                </>
              )}
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
