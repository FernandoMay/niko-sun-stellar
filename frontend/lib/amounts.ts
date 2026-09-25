export const STROOPS_PER_XLM = 10_000_000n;
export const XLM_DECIMALS = 7;
export const MAX_U128 = (1n << 128n) - 1n;
export const MAX_I128 = (1n << 127n) - 1n;

export type UnsignedIntegerInput = bigint | number | string;

export function parseUnsignedBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value >= 0n ? value : null;
  }

  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    try {
      return BigInt(value.trim());
    } catch {
      return null;
    }
  }

  return null;
}

export function parseU128(value: unknown): bigint | null {
  const parsed = parseUnsignedBigInt(value);
  return parsed !== null && parsed <= MAX_U128 ? parsed : null;
}

export function parseStroops(value: unknown): bigint | null {
  return parseU128(value);
}

export function parseTransferAmount(value: unknown): bigint | null {
  const parsed = parseU128(value);
  return parsed !== null && parsed <= MAX_I128 ? parsed : null;
}

export function parseXlmToStroops(value: string): bigint | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{0,7})?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  const stroops =
    BigInt(whole) * STROOPS_PER_XLM +
    BigInt(fraction.padEnd(XLM_DECIMALS, "0") || "0");

  return stroops <= MAX_I128 ? stroops : null;
}

function groupIntegerDigits(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return sign + absolute.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatIntegerAmount(value: unknown): string {
  const parsed = parseUnsignedBigInt(value);
  return parsed === null ? "—" : groupIntegerDigits(parsed);
}

export function formatStroopsAsXlm(
  value: unknown,
  options: {
    decimals?: number;
    suffix?: boolean;
    trimFraction?: boolean;
  } = {}
): string {
  const parsed = parseStroops(value);
  if (parsed === null) return "—";

  const requestedDecimals = options.decimals ?? XLM_DECIMALS;
  const decimals = Math.max(0, Math.min(XLM_DECIMALS, requestedDecimals));
  const whole = parsed / STROOPS_PER_XLM;
  const rawFraction = (parsed % STROOPS_PER_XLM)
    .toString()
    .padStart(XLM_DECIMALS, "0")
    .slice(0, decimals);
  const fraction = options.trimFraction
    ? rawFraction.replace(/0+$/, "")
    : rawFraction;
  const amount = fraction
    ? `${groupIntegerDigits(whole)}.${fraction}`
    : groupIntegerDigits(whole);

  return options.suffix === false ? amount : `${amount} XLM`;
}

export function sumBigints(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}

export function boundedPercent(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) return 0;
  const percent = (numerator * 100n) / denominator;
  return Number(percent < 0n ? 0n : percent > 100n ? 100n : percent);
}
