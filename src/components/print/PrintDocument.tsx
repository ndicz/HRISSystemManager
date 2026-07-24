import type { ReactNode } from "react";
import { AutoPrint } from "@/components/print/AutoPrint";

export const PRINT_CSS = `
  .print-doc{font-family:Georgia,"Times New Roman",serif;color:#1d1f20;padding:32px 40px;font-size:13px;line-height:1.5;max-width:760px;margin:0 auto;background:#fff}
  .print-doc *{box-sizing:border-box}
  .print-doc .letterhead{border-bottom:3px solid #5980a6;padding-bottom:10px;margin-bottom:22px}
  .print-doc .letterhead-img{display:block;width:100%;height:auto;margin-bottom:8px}
  .print-doc .company-addr{font-size:10.5px;opacity:.65;font-family:system-ui,sans-serif}
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
  .print-doc.page-break{page-break-after:always;break-after:page}
  .no-print{margin:20px 40px}
  @media print{.no-print{display:none}body{background:#fff}@page{margin:14mm}}
`;

// The single-document letterhead+body+signature block, with no <style>/
// <AutoPrint> of its own — used both by PrintDocument (one document, one
// print trigger) and batch-print pages (many documents stacked under a
// single shared <style>+<AutoPrint>, one per printed page via pageBreak).
export function PrintDocumentInner({
  docTitle,
  meta,
  signLeftLabel,
  signLeftName,
  signRightLabel = "Hormat kami",
  signRightName,
  pageBreak = false,
  children,
}: {
  docTitle: string;
  meta: ReactNode;
  signLeftLabel: string;
  signLeftName: string;
  signRightLabel?: string;
  signRightName?: string;
  pageBreak?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={"print-doc" + (pageBreak ? " page-break" : "")}>
      <div className="letterhead">
        {/* eslint-disable-next-line @next/next/no-img-element -- print output is server-rendered, plain HTML served straight to the print dialog, not part of Next's client image pipeline */}
        <img className="letterhead-img" src="/kop-surat-wsp.jpg" alt="PT Wana Samudra Persada" />
        <div className="company-addr">Jl. Kawaluyaan Indah XVII No.33, Jatisari, Kec. Buahbatu, Kota Bandung, Jawa Barat 40286</div>
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
          <div className="sign-line">
            PT Wana Samudra Persada
            {signRightName && <div>{signRightName}</div>}
          </div>
        </div>
      </div>
      <div className="footer-note">Dokumen ini dibuat otomatis oleh sistem HR &amp; Payroll PT Wana Samudra Persada.</div>
    </div>
  );
}

export function PrintDocument({
  title,
  ...rest
}: {
  title: string;
  docTitle: string;
  meta: ReactNode;
  signLeftLabel: string;
  signLeftName: string;
  signRightLabel?: string;
  signRightName?: string;
  children: ReactNode;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <AutoPrint title={title} />
      <PrintDocumentInner {...rest} />
    </>
  );
}
