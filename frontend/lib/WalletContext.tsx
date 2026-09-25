"use client";

/* ── BigInt guard: MUST be first import. Patches JSON.stringify globally so
   the Stellar SDK's internal calls don't crash on BigInt values. ── */
import "./bigint-guard";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getAddress,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import { formatStroopsAsXlm, parseXlmToStroops } from "@/lib/amounts";
import { requireSuccessfulTransaction } from "@/lib/transactionFinality";

const SERVER_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
  "https://soroban-testnet.stellar.org";
const PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";
const HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ||
  "https://horizon-testnet.stellar.org";

interface WalletState {
  address: string | null;
  balance: string;
  network: string;
  connected: boolean;
  connecting: boolean;
}

/** A single Soroban contract call descriptor for batch transactions. */
export interface ContractCall {
  contractId: string;
  method: string;
  args: unknown[];
}

type SorobanScValType = "address" | "string" | "u64" | "u128";

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  signAndSend: (
    contractId: string,
    method: string,
    args: unknown[],
    signWith?: string
  ) => Promise<{ txHash: string; result?: unknown }>;
  /** Build one transaction with multiple Soroban contract calls and sign+send it. */
  signAndSendBatch: (
    calls: ContractCall[],
    signWith?: string
  ) => Promise<{ txHash: string; result?: unknown }>;
  /** Read-only contract call (simulates, doesn't submit). */
  readContract: (
    contractId: string,
    method: string,
    args?: unknown[]
  ) => Promise<unknown>;
  fetchBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<WalletState>({
    address: null,
    balance: "Unavailable",
    network: "",
    connected: false,
    connecting: false,
  });

  // Mark as mounted on client only
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!state.address) return;
    try {
      const res = await fetch(`${HORIZON_URL}/accounts/${state.address}`);
      if (!res.ok) {
        setState((s) => ({ ...s, balance: "Unavailable" }));
        return;
      }
      const data = await res.json();
      const native = data.balances?.find(
        (b: { asset_type: string }) => b.asset_type === "native"
      );
      if (!native || typeof native.balance !== "string") {
        setState((s) => ({ ...s, balance: "Unavailable" }));
        return;
      }
      const balanceStroops = parseXlmToStroops(native.balance);
      if (balanceStroops === null) {
        setState((s) => ({ ...s, balance: "Unavailable" }));
        return;
      }

      setState((s) => ({
        ...s,
        balance: formatStroopsAsXlm(balanceStroops, { suffix: false }),
      }));
    } catch (err) {
      setState((s) => ({ ...s, balance: "Unavailable" }));
      console.error("Failed to fetch balance:", err);
    }
  }, [state.address]);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true }));
    try {
      const connected = await isConnected();
      if (!connected) {
        throw new Error(
          "Freighter no está instalado. Instálalo desde https://freighter.app"
        );
      }
      const access = await requestAccess();
      if (access.address) {
        setState((s) => ({
          ...s,
          address: access.address,
          connected: true,
          network: "testnet",
          connecting: false,
        }));
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
      setState((s) => ({ ...s, connecting: false }));
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      balance: "Unavailable",
      network: "",
      connected: false,
      connecting: false,
    });
  }, []);

  // Project IDs are u64, but their argument position depends on the method.
  const projectIdArgIndexes = new Map<string, number>([
    ["purchase_tokens", 1],
    ["deposit_revenue", 1],
    ["claim_revenue", 1],
    ["withdraw_sales", 1],
    ["update_energy", 1],
    ["get_claimable", 1],
    ["get_project", 0],
    ["get_project_name", 0],
    ["get_sales_balance", 0],
    ["set_project_status", 1],
    ["transfer_ownership", 1],
  ]);

  const toScVals = useCallback(
    async (args: unknown[], method?: string) => {
      const sdk = await import("@stellar/stellar-sdk");
      return args.map((a: unknown, index: number) => {
        if (Array.isArray(a)) {
          const isU64Vec = method === "get_portfolio" && index === 1;
          const innerVals = (a as unknown[]).map((item: unknown) => {
            if (
              typeof item === "string" &&
              /^[GC][A-Z0-9]{55}$/.test(item as string)
            ) {
              return sdk.Address.fromString(item as string).toScVal();
            }
            if (typeof item === "boolean") {
              return sdk.nativeToScVal(item, { type: "bool" });
            }
            if (typeof item === "bigint" || typeof item === "number") {
              const t = isU64Vec ? "u64" : "u128";
              return sdk.nativeToScVal(
                BigInt((item as number | bigint).toString()),
                { type: t as "u64" | "u128" }
              );
            }
            if (typeof item === "string") {
              return sdk.nativeToScVal(item as string, { type: "string" });
            }
            return sdk.nativeToScVal(item as unknown);
          });
          return sdk.xdr.ScVal.scvVec(innerVals);
        }
        if (typeof a === "boolean") {
          return sdk.nativeToScVal(a, { type: "bool" });
        }
        if (typeof a === "string" && /^[GC][A-Z0-9]{55}$/.test(a)) {
          return sdk.Address.fromString(a).toScVal();
        }

        if (typeof a === "bigint" || typeof a === "number") {
          const projectIdIndex = method
            ? projectIdArgIndexes.get(method)
            : undefined;
          if (projectIdIndex === index) {
            return sdk.nativeToScVal(BigInt(a.toString()), { type: "u64" });
          }

          return sdk.nativeToScVal(BigInt(a.toString()), { type: "u128" });
        }

        if (typeof a === "string") {
          return sdk.nativeToScVal(a, { type: "string" });
        }
        return a;
      });
    },
    []
  );

  // ── Shared helper: build, sign, send, poll ──
  const buildSignSendPoll = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (operations: any[], signWith?: string) => {
      const sdk = await import("@stellar/stellar-sdk");

      const server = new sdk.rpc.Server(SERVER_URL);
      const account = await server.getAccount(state.address!);

      const tx = new sdk.TransactionBuilder(account, {
        fee: String(operations.length * 100000),
        networkPassphrase: PASSPHRASE,
      });
      for (const op of operations) {
        tx.addOperation(op);
      }
      const builtTx = tx.setTimeout(180).build();

      const preparedTx = await server.prepareTransaction(builtTx);
      const txXdr = preparedTx.toXDR();

      const signed = await signTransaction(txXdr, {
        networkPassphrase: PASSPHRASE,
        address: signWith || state.address!,
      });

      const signedTx = sdk.TransactionBuilder.fromXDR(
        signed.signedTxXdr,
        PASSPHRASE
      );
      const response = await server.sendTransaction(signedTx);

      if (response.status === "ERROR") {
        throw new Error("Transaction submission was rejected.");
      }
      if (typeof response.hash !== "string" || response.hash.length === 0) {
        throw new Error("Transaction submission did not return a transaction hash.");
      }

      // Poll for a closed-ledger result. A submitted hash is not a receipt.
      let result: unknown;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          result = await server.getTransaction(response.hash);
          const status =
            result && typeof result === "object"
              ? (result as { status?: unknown }).status
              : undefined;
          if (status !== "NOT_FOUND") break;
        } catch {
          // Continue polling transient RPC errors until the deadline.
        }
      }

      const successfulResult = requireSuccessfulTransaction(result);
      return { txHash: response.hash, result: successfulResult.result };
    },
    [state.address]
  );

  const signAndSend = useCallback(
    async (
      contractId: string,
      method: string,
      args: unknown[],
      signWith?: string
    ) => {
      if (!state.address) throw new Error("Wallet not connected");

      const sdk = await import("@stellar/stellar-sdk");
      const contract = new sdk.Contract(contractId);
      const sorobanArgs = await toScVals(args, method);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const op = contract.call(method, ...(sorobanArgs as any[]));
      return buildSignSendPoll([op], signWith);
    },
    [state.address, toScVals, buildSignSendPoll]
  );

  const signAndSendBatch = useCallback(
    async (calls: ContractCall[], signWith?: string) => {
      if (!state.address) throw new Error("Wallet not connected");

      const sdk = await import("@stellar/stellar-sdk");

      // Build one operation per call, all in the same transaction
      const ops = [];
      for (const call of calls) {
        const contract = new sdk.Contract(call.contractId);
        const sorobanArgs = await toScVals(call.args, call.method);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ops.push(contract.call(call.method, ...(sorobanArgs as any[])));
      }

      return buildSignSendPoll(ops, signWith);
    },
    [state.address, toScVals, buildSignSendPoll]
  );

  // Read-only contract call — simulates the transaction without submitting
  const readContract = useCallback(
    async (contractId: string, method: string, args: unknown[] = []) => {
      const sdk = await import("@stellar/stellar-sdk");
      const server = new sdk.rpc.Server(SERVER_URL);
      const contract = new sdk.Contract(contractId);
      const sorobanArgs = await toScVals(args, method);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const op = contract.call(method, ...(sorobanArgs as any[]));
      const source = new sdk.Account(
        state.address || "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        "0"
      );
      const tx = new sdk.TransactionBuilder(source, {
        fee: "100",
        networkPassphrase: PASSPHRASE,
      })
        .addOperation(op)
        .setTimeout(30)
        .build();

      const result = await server.simulateTransaction(tx);
      if (sdk.rpc.Api.isSimulationError(result)) {
        throw new Error(`Simulation failed: ${result.error}`);
      }
      const retval = result.result?.retval;
      if (!retval) throw new Error("Contract read returned no value");
      return sdk.scValToNative(retval);
    },
    [state.address, toScVals]
  );

  // Auto-reconnect on mount (client-only)
  useEffect(() => {
    if (!mounted) return;
    (async () => {
      try {
        const connected = await isConnected();
        if (connected) {
          const access = await getAddress();
          if (access.address) {
            setState((s) => ({
              ...s,
              address: access.address,
              connected: true,
              network: "testnet",
            }));
          }
        }
      } catch {
        // Freighter not available
      }
    })();
  }, [mounted]);

  // Fetch balance when address changes (client-only)
  useEffect(() => {
    if (mounted && state.address) fetchBalance();
  }, [mounted, state.address, fetchBalance]);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        signAndSend,
        signAndSendBatch,
        readContract,
        fetchBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
