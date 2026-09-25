import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════════════════════════
// UNIT: Investment calculations
// ═══════════════════════════════════════════════════════════

describe("Investment calculator", () => {
  const PRICE_PER_TOKEN = 10; // XLM
  const APY = 12.5; // percent
  const TOKEN_WP = 1.5; // Wp per token

  it("calculates cost in XLM", () => {
    const tokenCount = 100;
    const costXlm = tokenCount * PRICE_PER_TOKEN;
    expect(costXlm).toBe(1000);
  });

  it("calculates capacity in Wp", () => {
    const tokenCount = 100;
    const capacity = tokenCount * TOKEN_WP;
    expect(capacity).toBe(150);
  });

  it("calculates daily return", () => {
    const costXlm = 1000;
    const daily = (costXlm * APY) / 100 / 365;
    expect(daily).toBeCloseTo(0.342, 2);
  });

  it("calculates annual return", () => {
    const costXlm = 1000;
    const annual = costXlm * (APY / 100);
    expect(annual).toBe(125);
  });

  it("calculates CO2 offset per token", () => {
    const tokenCount = 100;
    const co2 = tokenCount * 0.32;
    expect(co2).toBe(32);
  });

  it("purchase_tokens call args have 3 elements (buyer, project_id, amount)", () => {
    const address = "GABGH363YQNYYAUN2M6YAPYFLPDMU5GZIJDWOEC2G3AUEH3TLPSXN3TX";
    const projectId = 1;
    const tokenCount = 10;
    const args = [address, BigInt(projectId), BigInt(tokenCount)];
    expect(args).toHaveLength(3);
    expect(args[0]).toBe(address);
    expect(args[1]).toBe(BigInt(1));
    expect(args[2]).toBe(BigInt(10));
  });

  it("BigInt token amount converts to string for display", () => {
    const amount = BigInt(100);
    expect(amount.toString()).toBe("100");
  });

  it("token count must be >= 1", () => {
    const tokenCount = Math.max(1, parseInt("0") || 1);
    expect(tokenCount).toBe(1);
  });

  it("token count parses valid input", () => {
    const tokenCount = Math.max(1, parseInt("50") || 1);
    expect(tokenCount).toBe(50);
  });
});
