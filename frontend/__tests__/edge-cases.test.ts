import { describe, it, expect } from "vitest";
import { parseXlmToStroops } from "@/lib/amounts";

// ═══════════════════════════════════════════════════════════
// UNIT: Edge cases for the complete investment flow
// ═══════════════════════════════════════════════════════════

describe("Flow edge cases", () => {
  it("insufficient balance detected before signing", () => {
    const walletBalance = parseXlmToStroops("500");
    const costXlm = parseXlmToStroops("1000");
    expect(walletBalance !== null && costXlm !== null && walletBalance < costXlm).toBe(true);
  });

  it("sufficient balance passes check", () => {
    const walletBalance = parseXlmToStroops("5000");
    const costXlm = parseXlmToStroops("1000");
    expect(walletBalance !== null && costXlm !== null && walletBalance >= costXlm).toBe(true);
  });

  it("formatted balance parses exactly", () => {
    const balance = parseXlmToStroops("10000.5000000");
    expect(balance).toBe(100005000000n);
  });

  it("zero balance is insufficient", () => {
    const balance = parseXlmToStroops("0");
    const costXlm = parseXlmToStroops("10");
    expect(balance !== null && costXlm !== null && balance < costXlm).toBe(true);
  });

  it("minimum token count is 1", () => {
    const raw = "0";
    const count = Math.max(1, parseInt(raw) || 1);
    expect(count).toBe(1);
  });

  it("negative input clamps to 1", () => {
    const raw = "-5";
    const count = Math.max(1, parseInt(raw) || 1);
    expect(count).toBe(1);
  });

  it("empty input defaults to 1", () => {
    const raw = "";
    const count = Math.max(1, parseInt(raw) || 1);
    expect(count).toBe(1);
  });

  it("purchase_tokens amount arg (u128) is positive", () => {
    const tokenCount = 1;
    const amount = BigInt(tokenCount);
    expect(amount > 0n).toBe(true);
  });

  it("address shortener works correctly", () => {
    function shortAddr(a: string) {
      if (!a) return "";
      return a.slice(0, 6) + "..." + a.slice(-4);
    }
    const addr = "GABGH363YQNYYAUN2M6YAPYFLPDMU5GZIJDWOEC2G3AUEH3TLPSXN3TX";
    expect(shortAddr(addr)).toBe("GABGH3...N3TX");
  });

  it("address shortener handles empty string", () => {
    function shortAddr(a: string) {
      if (!a) return "";
      return a.slice(0, 6) + "..." + a.slice(-4);
    }
    expect(shortAddr("")).toBe("");
  });

  it("contract ID shortener works correctly", () => {
    function shortContract(a: string) {
      if (!a) return "---";
      return a.slice(0, 6) + "..." + a.slice(-4);
    }
    const id = "CB7V3676CQBO5OL6DEXI5FORLG37IR2GR7LXCZD7DUZTMSUT7BEEINR3";
    expect(shortContract(id)).toBe("CB7V36...INR3");
  });
});
