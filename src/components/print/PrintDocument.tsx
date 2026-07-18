import type { ReactNode } from "react";
import { AutoPrint } from "@/components/print/AutoPrint";

const PRINT_CSS = `
  .print-doc{font-family:Georgia,"Times New Roman",serif;color:#1d1f20;padding:32px 40px;font-size:13px;line-height:1.5;max-width:760px;margin:0 auto;background:#fff}
  .print-doc *{box-sizing:border-box}
  .print-doc .letterhead{display:flex;align-items:center;gap:14px;border-bottom:3px solid #5980a6;padding-bottom:14px;margin-bottom:22px}
  .print-doc .logo-mark{width:46px;height:46px;border-radius:8px;background:linear-gradient(135deg,#5980a6,#2c455d);color:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;font-weight:800;font-size:18px;flex-shrink:0}
  .print-doc .company-name{font-family:system-ui,sans-serif;font-weight:700;font-size:18px;letter-spacing:-0.01em}
  .print-doc .company-addr{font-size:10.5px;opacity:.65;margin-top:2px;font-family:system-ui,sans-serif}
  .print-doc .doc-title{font-family:system-ui,sans-serif;font-size:14px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 4px;color:#416180;font-weight:700}
  .print-doc .doc-meta{font-family:system-ui,sans-serif;font-size:12px;opacity:.75;margin-bottom:18px;line-height:1.6}
  .print-doc table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
  .print-doc th{text-align:left;font-family:system-ui,sans-serif;font-size:10px;letter-spacing:.05em;text-transform:uppercase;opacity:.6;padding:6px 4px;border-bottom:1.5px solid #1d1f20}
  .print-doc td{padding:7px 4px;border-bottom:1px solid #ddd}
  .print-doc td:last-child,.print-doc th:last-child{text-align:right}
  .print-doc tr.total td{font-weight:700;border-top:2px solid #1d1f20;border-bottom:none;padding-top:10px;font-size:14px}
  .print-doc .sign-block{display:flex;justify-content:space-between;margin-top:56px;font-family:system-ui,sans-serif;font-size:12px}
  .print-doc .sign-box{text-align:center;width:210px}
  .print-doc .sign-line{border-top:1px solid #1d1f20;margin-top:56px;padding-top:6px}
  .print-doc .footer-note{margin-top:32px;font-size:10.5px;opacity:.5;font-family:system-ui,sans-serif}
  .no-print{margin:20px 40px}
  @media print{.no-print{display:none}body{background:#fff}@page{margin:14mm}}
`;

export function PrintDocument({
  title,
  docTitle,
  meta,
  signLeftLabel,
  signLeftName,
  signRightLabel = "Hormat kami",
  children,
}: {
  title: string;
  docTitle: string;
  meta: ReactNode;
  signLeftLabel: string;
  signLeftName: string;
  signRightLabel?: string;
  children: ReactNode;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <AutoPrint title={title} />
      <div className="print-doc">
        <div className="letterhead">
          <div className="logo-mark">WSP</div>
          <div>
            <div className="company-name">PT Wana Samudra Persada</div>
            <div className="company-addr">Jl. Kawaluyaan Indah XVII No.33, Jatisari, Kec. Buahbatu, Kota Bandung, Jawa Barat 40286</div>
          </div>
        </div>
        <div className="doc-title">{docTitle}</div>
        <div className="doc-meta">{meta}</div>
        {children}
        <div className="sign-block">
          <div className="sign-box">
            {signLeftLabel}
            <div className="sign-line">{signLeftName}</div>
          </div>
          <div className="sign-box">
            {signRightLabel}
            <div className="sign-line">PT Wana Samudra Persada</div>
          </div>
        </div>
        <div className="footer-note">Dokumen ini dibuat otomatis oleh sistem HR &amp; Payroll PT Wana Samudra Persada.</div>
      </div>
    </>
  );
}
