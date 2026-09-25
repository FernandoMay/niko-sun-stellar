#!/usr/bin/env node

import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { StrKey, xdr, hash } = require("@stellar/stellar-sdk");

const DEFAULT_HORIZON_URL = "https://horizon-testnet.stellar.org";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 2_000;
// Polling is read-only; this helper never submits or retries a transaction.
const ACCOUNT_PAGE_LIMIT = 200;
const OPERATION_PAGE_LIMIT = 200;
const CREATE_CONTRACT_FUNCTIONS = new Set([
  "HostFunctionTypeHostFunctionTypeCreateContract",
  "HostFunctionTypeHostFunctionTypeCreateContractV2",
]);
const INVOKE_CONTRACT_FUNCTION =
  "HostFunctionTypeHostFunctionTypeInvokeContract";

class ResolverError extends Error {}
class HttpError extends Error {
  constructor(status) {
    super("Horizon request failed");
    this.status = status;
  }
}

function usage() {
  return `Usage:
  node scripts/resolve-stellar-transaction.mjs \\
    --kind deploy|invoke \\
    --source-account G... \\
    --baseline-ledger N \\
    --contract-id C... \\
    [--function FUNCTION] [--arg TYPE:VALUE ...] \\
    [--tx HASH] [--timeout-ms N] [--horizon-url URL]

  --tx validates one known transaction directly instead of scanning the account.
  --args-json accepts an array of {"type":"address|string|u64|u128","value":"..."}.
`;
}

function fail(message) {
  throw new ResolverError(message);
}

function parseInteger(value, name, minimum, maximum) {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    fail(`${name} must be a non-negative integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    fail(`${name} is outside the supported range`);
  }
  return parsed;
}

function parseHash(value, name) {
  if (!/^[0-9a-f]{64}$/.test(value)) fail(`${name} must be a lowercase SHA-256 hash`);
  return value;
}

function parseAddress(value, name) {
  if (!/^[GC][A-Z2-7]{55}$/.test(value)) fail(`${name} is not a Stellar address`);
  return value;
}

function parseKind(value) {
  if (value === "deploy" || value === "deployment" || value === "create") {
    return "deploy";
  }
  if (value === "invoke" || value === "invoke-contract") return "invoke";
  fail("kind must be deploy or invoke");
}

function normalizeArgType(value) {
  const aliases = {
    address: "address",
    string: "string",
    str: "string",
    symbol: "symbol",
    sym: "symbol",
    u32: "u32",
    u64: "u64",
    u128: "u128",
  };
  const normalized = aliases[value];
  if (!normalized) fail("argument type must be address, string, symbol, u32, u64, or u128");
  return normalized;
}

function normalizeExpectedArg(argument) {
  if (!argument || typeof argument !== "object" || Array.isArray(argument)) {
    fail("each expected argument must be an object");
  }
  const type = normalizeArgType(String(argument.type ?? ""));
  const value = String(argument.value ?? "");
  if (type === "address") parseAddress(value, "expected address argument");
  if (type === "string" || type === "symbol") {
    if (value.length === 0 || value.length > 256) {
      fail("expected text argument has an invalid length");
    }
  }
  if (["u32", "u64", "u128"].includes(type)) {
    if (!/^\d+$/.test(value)) fail("expected integer argument must be a decimal integer");
    const numeric = BigInt(value);
    const maximum = type === "u32" ? 0xffffffffn : type === "u64" ? 0xffffffffffffffffn : (1n << 128n) - 1n;
    if (numeric > maximum) fail("expected integer argument is outside its ScVal range");
  }
  return { type, value };
}

function parseInlineArg(value) {
  const colonIndex = value.indexOf(":");
  const equalsIndex = value.indexOf("=");
  const separator = colonIndex >= 0 ? colonIndex : equalsIndex;
  if (separator <= 0) fail("each --arg must use TYPE:VALUE or TYPE=VALUE");
  return normalizeExpectedArg({
    type: value.slice(0, separator),
    value: value.slice(separator + 1),
  });
}

function parseArgsJson(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail("args JSON is not valid JSON");
  }
  if (!Array.isArray(parsed)) fail("args JSON must be an array");
  return parsed.map(normalizeExpectedArg);
}

function parseOptions(argv) {
  const options = {
    kind: null,
    sourceAccount: null,
    baselineLedger: null,
    contractId: null,
    functionName: null,
    expectedArgs: [],
    txHash: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    horizonUrl: DEFAULT_HORIZON_URL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) fail(`${argument} requires a value`);
      return argv[index];
    };

    switch (argument) {
      case "--help":
      case "-h":
        process.stdout.write(usage());
        process.exit(0);
        break;
      case "--kind":
      case "--operation-type":
        options.kind = parseKind(next());
        break;
      case "--source-account":
        options.sourceAccount = parseAddress(next(), "source account");
        break;
      case "--baseline-ledger":
        options.baselineLedger = parseInteger(next(), "baseline ledger", 0, Number.MAX_SAFE_INTEGER);
        break;
      case "--contract-id":
        options.contractId = parseAddress(next(), "contract ID");
        break;
      case "--function":
      case "--function-name":
        options.functionName = next();
        break;
      case "--arg":
        options.expectedArgs.push(parseInlineArg(next()));
        break;
      case "--args-json":
      case "--expected-args-json":
        options.expectedArgs.push(...parseArgsJson(next()));
        break;
      case "--tx":
      case "--transaction":
        options.txHash = parseHash(next(), "transaction hash");
        break;
      case "--timeout-ms":
        options.timeoutMs = parseInteger(next(), "timeout", 1_000, MAX_TIMEOUT_MS);
        break;
      case "--horizon-url":
        options.horizonUrl = next();
        break;
      default:
        fail(`unknown option: ${argument}`);
    }
  }

  if (!options.kind) fail("kind is required");
  if (!options.sourceAccount) fail("source account is required");
  if (options.baselineLedger === null) fail("baseline ledger is required");
  if (!options.contractId) fail("contract ID is required");
  if (options.kind === "invoke" && !options.functionName) {
    fail("function is required for invoke resolution");
  }
  if (options.kind === "invoke" && options.functionName.length > 32) {
    fail("function name is too long for a Soroban symbol");
  }
  if (options.kind === "deploy" && options.expectedArgs.length > 0) {
    fail("deployment resolution does not accept invoke arguments");
  }

  let horizon;
  try {
    horizon = new URL(options.horizonUrl);
  } catch {
    fail("Horizon URL is invalid");
  }
  if (horizon.protocol !== "https:" || horizon.username || horizon.password || horizon.search || horizon.hash) {
    fail("Horizon URL must be an HTTPS origin without credentials or query data");
  }
  options.horizonUrl = horizon.origin;

  return options;
}

function endpoint(base, path, query) {
  const url = new URL(path, `${base}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function fetchJson(url, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) fail("transaction resolution timed out");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, remaining));
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new HttpError(response.status);
    let payload;
    try {
      payload = await response.json();
    } catch {
      fail("Horizon returned invalid JSON");
    }
    if (!payload || typeof payload !== "object") fail("Horizon returned an invalid response");
    return payload;
  } catch (cause) {
    if (cause instanceof ResolverError) throw cause;
    if (cause instanceof HttpError) throw cause;
    if (cause?.name === "AbortError") fail("Horizon read timed out");
    fail("Horizon read failed");
  } finally {
    clearTimeout(timer);
  }
}

function recordsFrom(payload) {
  const records = payload?._embedded?.records;
  if (!Array.isArray(records)) fail("Horizon returned an invalid record page");
  return records;
}

function validLedger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function transactionIsCandidate(transaction, options) {
  return (
    transaction &&
    typeof transaction === "object" &&
    transaction.successful === true &&
    transaction.source_account === options.sourceAccount &&
    validLedger(transaction.ledger) &&
    transaction.ledger > options.baselineLedger &&
    typeof transaction.hash === "string" &&
    /^[0-9a-f]{64}$/.test(transaction.hash) &&
    transaction.operation_count === 1
  );
}

function decodeScVal(parameter) {
  if (!parameter || typeof parameter.value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(parameter.value)) {
    return null;
  }
  try {
    const bytes = Buffer.from(parameter.value, "base64");
    if (bytes.toString("base64") !== parameter.value) return null;
    return xdr.ScVal.fromXDR(bytes);
  } catch {
    return null;
  }
}

function addressFromScVal(value) {
  const address = value?.address;
  if (!address) return null;
  try {
    if (address.type === "scAddressTypeContract") {
      const bytes = address.contractId?.value;
      return bytes?.length === 32 ? StrKey.encodeContract(bytes) : null;
    }
    if (address.type === "scAddressTypeAccount") {
      const bytes = address.accountId?.ed25519?.value;
      return bytes?.length === 32 ? StrKey.encodeEd25519PublicKey(bytes) : null;
    }
  } catch {
    return null;
  }
  return null;
}

function integerFromScVal(value) {
  if (!value) return null;
  if (value.type === "scvU32") return { type: "u32", value: BigInt(value.u32) };
  if (value.type === "scvU64") return { type: "u64", value: BigInt(value.u64) };
  if (value.type === "scvU128") {
    const parts = value.u128;
    if (!parts || parts.hi === undefined || parts.lo === undefined) return null;
    return { type: "u128", value: (BigInt(parts.hi) << 64n) | BigInt(parts.lo) };
  }
  return null;
}

function comparableScVal(value) {
  if (!value) return null;
  if (value.type === "scvAddress") {
    const address = addressFromScVal(value);
    return address ? { type: "address", value: address } : null;
  }
  if (value.type === "scvString") return { type: "string", value: value.value };
  if (value.type === "scvSymbol") return { type: "symbol", value: value.value };
  return integerFromScVal(value);
}

function comparableArgument(argument) {
  if (argument.type === "address") return { type: "address", value: argument.value };
  if (argument.type === "string" || argument.type === "symbol") return argument;
  return { type: argument.type, value: BigInt(argument.value) };
}

function argumentsMatch(actual, expected) {
  if (actual.length !== expected.length) return false;
  return actual.every((argument, index) => {
    const wanted = comparableArgument(expected[index]);
    return (
      actual[index] &&
      actual[index].type === wanted.type &&
      actual[index].value === wanted.value
    );
  });
}

function deploymentContractId(operation, resultXdr) {
  if (operation?.function === "HostFunctionTypeHostFunctionTypeCreateContractV2") {
    try {
      const addressParameter = operation.parameters?.[0];
      if (!addressParameter?.value) return null;
      const addressValue = decodeScVal(addressParameter);
      const address = addressValue?.address;
      const salt = operation.salt;
      if (!address || !/^\d+$/.test(String(salt))) return null;
      const saltBytes = Buffer.from(BigInt(salt).toString(16).padStart(64, "0"), "hex");
      if (saltBytes.length !== 32) return null;
      const networkId = hash(new TextEncoder().encode("Test SDF Network ; September 2015"));
      const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
        new xdr.HashIdPreimageContractId({
          networkId,
          contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
            new xdr.ContractIdPreimageFromAddress({ address, salt: saltBytes })
          ),
        })
      );
      return StrKey.encodeContract(hash(preimage.toXDR()));
    } catch {
      return null;
    }
  }

  if (typeof resultXdr !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(resultXdr)) return null;
  try {
    const bytes = Buffer.from(resultXdr, "base64");
    if (bytes.toString("base64") !== resultXdr) return null;
    const result = xdr.TransactionResult.fromXDR(bytes);
    const operationResult = result.result?.results?.[0];
    const hostResult = operationResult?.tr?.invokeHostFunctionResult;
    const contractHash = hostResult?.success?.value;
    const contractBytes =
      typeof contractHash === "string" && /^[0-9a-f]{64}$/.test(contractHash)
        ? Buffer.from(contractHash, "hex")
        : contractHash;
    if (!(contractBytes instanceof Uint8Array) || contractBytes.length !== 32) return null;
    return StrKey.encodeContract(contractBytes);
  } catch {
    return null;
  }
}

async function matchTransaction(transaction, options, deadline) {
  if (options.txHash && transaction?.hash !== options.txHash) return false;
  if (!transactionIsCandidate(transaction, options)) return false;
  const operationsPayload = await fetchJson(
    endpoint(options.horizonUrl, `/transactions/${transaction.hash}/operations`, {
      limit: OPERATION_PAGE_LIMIT,
    }),
    deadline
  );
  const operations = recordsFrom(operationsPayload);
  if (operations.length !== 1) return false;
  const operation = operations[0];
  if (
    operation?.type !== "invoke_host_function" ||
    (operation.type_i !== undefined && operation.type_i !== 24) ||
    operation.source_account !== options.sourceAccount
  ) {
    return false;
  }

  if (options.kind === "deploy") {
    if (!CREATE_CONTRACT_FUNCTIONS.has(operation.function)) return false;
    if (operation.parameters !== null && operation.parameters !== undefined) {
      if (!Array.isArray(operation.parameters) || operation.parameters.length < 2) return false;
    }
    return deploymentContractId(operation, transaction.result_xdr) === options.contractId;
  }

  if (operation.function !== INVOKE_CONTRACT_FUNCTION) return false;
  if (!Array.isArray(operation.parameters) || operation.parameters.length < 2) return false;
  const contractValue = comparableScVal(decodeScVal(operation.parameters[0]));
  const functionValue = comparableScVal(decodeScVal(operation.parameters[1]));
  if (contractValue?.type !== "address" || !contractValue.value.startsWith("C")) return false;
  if (functionValue?.type !== "symbol" || functionValue.value !== options.functionName) return false;
  if (contractValue.value !== options.contractId) return false;

  const actualArguments = [];
  for (const parameter of operation.parameters.slice(2)) {
    const decoded = comparableScVal(decodeScVal(parameter));
    if (!decoded) return false;
    actualArguments.push(decoded);
  }
  return argumentsMatch(actualArguments, options.expectedArgs);
}

async function resolveTransaction(options) {
  const deadline = Date.now() + options.timeoutMs;
  if (options.txHash) {
    const transaction = await fetchJson(
      endpoint(options.horizonUrl, `/transactions/${options.txHash}`),
      deadline
    );
    if (!(await matchTransaction(transaction, options, deadline))) {
      fail("direct transaction did not match all required criteria");
    }
    return { hash: transaction.hash, ledger: transaction.ledger };
  }

  while (Date.now() < deadline) {
    const payload = await fetchJson(
      endpoint(options.horizonUrl, `/accounts/${options.sourceAccount}/transactions`, {
        order: "desc",
        cursor: "now",
        limit: ACCOUNT_PAGE_LIMIT,
        include_failed: "true",
      }),
      deadline
    );
    for (const transaction of recordsFrom(payload)) {
      if (!transactionIsCandidate(transaction, options)) continue;
      try {
        if (await matchTransaction(transaction, options, deadline)) {
          return { hash: transaction.hash, ledger: transaction.ledger };
        }
      } catch (cause) {
        if (cause instanceof HttpError && cause.status === 404) continue;
        throw cause;
      }
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(POLL_INTERVAL_MS, remaining));
  }

  fail("no exact transaction match appeared before the bounded timeout");
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const result = await resolveTransaction(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((cause) => {
  const message = cause instanceof ResolverError ? cause.message : "transaction resolution failed";
  process.stderr.write(`resolve-stellar-transaction: ${message}\n`);
  process.exitCode = 1;
});
