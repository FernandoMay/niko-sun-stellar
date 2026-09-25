"use client";

import { useCallback } from "react";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { TX_EXPLORER } from "@/lib/contract";

interface ReceiptData {
  projectName: string;
  tokenAmount: string;
  amountPaid: string;
  walletAddress: string;
  txHash: string;
  date?: string;
}

/**
 * Generates a technical transaction receipt. It is not a legal, financial,
 * physical-asset, audit, or custody certificate.
 */
export default function PdfCertificate({ data }: { data: ReceiptData }) {
  const generate = useCallback(async () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const date = data.date ?? new Date().toISOString();
    const truncatedAddress =
      data.walletAddress.length > 16
        ? `${data.walletAddress.slice(0, 8)}...${data.walletAddress.slice(-4)}`
        : data.walletAddress;

    const emerald = [5, 150, 105] as const;
    const amber = [217, 119, 6] as const;
    const slate900 = [15, 23, 42] as const;
    const slate700 = [51, 65, 85] as const;
    const slate500 = [100, 116, 139] as const;
    const slate200 = [226, 232, 240] as const;
    const slate50 = [248, 250, 252] as const;
    const white = [255, 255, 255] as const;

    doc.setFillColor(...slate50);
    doc.rect(0, 0, width, height, "F");
    doc.setFillColor(...emerald);
    doc.rect(0, 0, width, 4, "F");
    doc.setFillColor(...amber);
    doc.rect(0, 4, width, 1, "F");

    let y = 17;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...slate900);
    doc.text("NIKO SUN", 20, y);
    doc.setFontSize(8);
    doc.setTextColor(...slate500);
    doc.text("Powered by Stellar Soroban", 20, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...emerald);
    doc.text("STELLAR TESTNET", width - 20, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...slate500);
    doc.text("TECHNICAL TRANSACTION RECEIPT", width - 20, y + 6, { align: "right" });

    y += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...slate900);
    doc.text("Transaction Receipt", width / 2, y, { align: "center" });

    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...slate500);
    doc.text("Technical confirmation only — not a legal or financial certificate", width / 2, y, {
      align: "center",
    });

    y += 14;
    const fields = [
      ["PROJECT", data.projectName],
      ["TOKEN AMOUNT", data.tokenAmount],
      ["NATIVE XLM AMOUNT", data.amountPaid],
      ["SIGNING WALLET", truncatedAddress],
      ["GENERATED AT", date],
      ["TRANSACTION HASH", data.txHash],
    ];

    for (const [label, value] of fields) {
      doc.setFillColor(...white);
      doc.setDrawColor(...slate200);
      doc.roundedRect(20, y - 5, width - 40, 17, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...slate500);
      doc.text(label, 26, y);
      doc.setFont(value === data.txHash ? "courier" : "helvetica", "normal");
      doc.setFontSize(value === data.txHash ? 7 : 10);
      doc.setTextColor(...slate900);
      doc.text(value, 26, y + 6, { maxWidth: width - 52 });
      y += 21;
    }

    const explorerUrl = TX_EXPLORER(data.txHash);
    try {
      const qrDataUrl = await QRCode.toDataURL(explorerUrl, {
        width: 260,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      doc.addImage(qrDataUrl, "PNG", width / 2 - 17, y, 34, 34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...slate700);
      doc.text("Verify transaction", width / 2, y + 40, { align: "center" });
    } catch {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...slate500);
      doc.text("Use the transaction hash in Stellar Expert.", width / 2, y + 18, {
        align: "center",
      });
    }

    const footerY = height - 18;
    doc.setFillColor(...emerald);
    doc.rect(0, footerY, width, 18, "F");
    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Observed technical receipt", width / 2, footerY + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("No audit, title, custody, yield, telemetry, or fiat-value claim", width / 2, footerY + 13, {
      align: "center",
    });

    const fileName = `NikoSun_Receipt_${data.projectName.replace(/\s+/g, "_")}_${data.txHash.slice(0, 8)}.pdf`;
    doc.save(fileName);
  }, [data]);

  return (
    <button
      type="button"
      onClick={() => void generate()}
      className="inline-flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
    >
      <span className="material-symbols-outlined text-[18px]">download</span>
      Download technical receipt
    </button>
  );
}
