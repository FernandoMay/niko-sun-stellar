import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_U128,
  formatStroopsAsXlm,
  parseTransferAmount,
  parseXlmToStroops,
} from "@/lib/amounts";
import {
  deriveProjectIds,
  deriveTotalMinted,
  readProjectCatalog,
  readUserProjectIds,
  selectPositiveClaimable,
  sumOwnedProjectAmounts,
  sumReferentialValueStroops,
  type ContractProject,
  type PortfolioPosition,
  type ProjectCatalog,
} from "@/lib/contractData";
import { requireSuccessfulTransaction } from "@/lib/transactionFinality";
import { PUBLIC_EVIDENCE } from "@/lib/publicEvidence";

const frontendRoot = process.cwd();
const repoRoot = path.resolve(frontendRoot, "..");

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function completeProject(overrides: Partial<ContractProject> = {}): ContractProject {
  return {
    id: 1,
    name: "Project",
    creator: "GASERVWNLHAWMG6V5NBL5EGYFKOOZDQYSUUW7REMJRET5JNZWWQLQB4G",
    totalSupply: 100000n,
    minted: 4n,
    minPurchase: 1n,
    price: 10000000n,
    createdAt: 1n,
    active: true,
    totalEnergyKwh: 0n,
    totalRevenue: 41000000n,
    rewardPerTokenStored: 0n,
    salesBalance: 40000000n,
    stateComplete: true,
    ...overrides,
  };
}

function readyCatalog(overrides: Partial<ProjectCatalog> = {}): ProjectCatalog {
  return {
    status: "ready",
    nextProjectId: 2n,
    projectIds: [1],
    projects: [completeProject()],
    unavailableProjectIds: [],
    error: null,
    ...overrides,
  };
}

describe("bigint-safe public amount formatting", () => {
  it("converts stroops to exact seven-decimal XLM", () => {
    expect(formatStroopsAsXlm("10000000")).toBe("1.0000000 XLM");
    expect(formatStroopsAsXlm("250000")).toBe("0.0250000 XLM");
    expect(formatStroopsAsXlm(1n)).toBe("0.0000001 XLM");
  });

  it("formats the u128 boundary without Number precision loss", () => {
    expect(formatStroopsAsXlm(MAX_U128)).toBe(
      "34,028,236,692,093,846,346,337,460,743,176.8211455 XLM"
    );
  });

  it("parses XLM and transfer amounts without floating point", () => {
    expect(parseXlmToStroops("1.0000001")).toBe(10000001n);
    expect(parseXlmToStroops("0.2500000")).toBe(2500000n);
    expect(parseXlmToStroops("1.00000001")).toBeNull();
    expect(parseTransferAmount(MAX_U128)).toBeNull();
  });

  it("keeps the full Horizon decimal balance in stroops", () => {
    const stroops = parseXlmToStroops("10000.0000001");
    expect(stroops).toBe(100000000001n);
    expect(formatStroopsAsXlm(stroops, { suffix: false })).toBe(
      "10,000.0000001"
    );
  });
});

describe("transaction finality", () => {
  it("returns a result only for a successful RPC record", () => {
    expect(requireSuccessfulTransaction({ status: "SUCCESS", result: "ok" })).toEqual({
      status: "SUCCESS",
      result: "ok",
    });
  });

  it("fails closed for NOT_FOUND, missing, failed, and unresolved records", () => {
    for (const result of [
      { status: "NOT_FOUND" },
      undefined,
      null,
      { status: "FAILED", result: { secret: "do-not-expose" } },
      { status: "PENDING" },
    ]) {
      expect(() => requireSuccessfulTransaction(result)).toThrow(
        "Transaction finality was not confirmed."
      );
    }
  });
});

describe("on-chain project and claim selection", () => {
  it("derives every project ID from next_project_id - 1", () => {
    expect(deriveProjectIds(1n)).toEqual([]);
    expect(deriveProjectIds(2n)).toEqual([1]);
    expect(deriveProjectIds(5n)).toEqual([1, 2, 3, 4]);
  });

  it("keeps live project state and referential values isolated by project ID", async () => {
    const creator =
      "GASERVWNLHAWMG6V5NBL5EGYFKOOZDQYSUUW7REMJRET5JNZWWQLQB4G";
    const names = new Map([
      [1, "Solar Lima Miraflores"],
      [2, "Solar Lima Norte"],
      [3, "Solar Arequipa"],
      [4, "Solar San Martín"],
    ]);
    const prices = new Map([
      [1, 10_000_000n],
      [2, 20_000_000n],
      [3, 30_000_000n],
      [4, 40_000_000n],
    ]);
    const read = vi.fn(
      async (_contractId: string, method: string, args: unknown[] = []) => {
        if (method === "next_project_id") return 5n;
        const projectId = Number(args[0]);
        const name = names.get(projectId);
        if (name === undefined) throw new Error("unknown project");
        if (method === "get_project") {
          return {
            creator,
            total_supply: 100n,
            minted: projectId === 1 ? 4n : 0n,
            min_purchase: 1n,
            price: prices.get(projectId),
            created_at: BigInt(projectId),
            active: true,
            total_energy_kwh: BigInt(projectId * 10),
            total_revenue: projectId === 1 ? 41_000_000n : 0n,
            reward_per_token_stored: 0n,
          };
        }
        if (method === "get_project_name") return name;
        if (method === "get_sales_balance") {
          return projectId === 1 ? 40_000_000n : 0n;
        }
        throw new Error(`unexpected method: ${method}`);
      }
    );

    const catalog = await readProjectCatalog(read, "contract");

    expect(catalog.status).toBe("ready");
    expect(catalog.projectIds).toEqual([1, 2, 3, 4]);
    expect(deriveTotalMinted(catalog)).toBe(4n);
    expect(catalog.projects.map((project) => project.price)).toEqual([
      10_000_000n,
      20_000_000n,
      30_000_000n,
      40_000_000n,
    ]);
    expect(catalog.projects.map((project) => project.salesBalance)).toEqual([
      40_000_000n,
      0n,
      0n,
      0n,
    ]);

    const projectTwoValue = sumReferentialValueStroops(
      [{ projectId: 2, tokenBalance: 1n, contractClaimable: 0n, totalClaimed: 0n }],
      catalog.projects,
      { catalogStatus: catalog.status, portfolioStatus: "ready" }
    );
    expect(projectTwoValue).toBe(20_000_000n);
    expect(
      sumReferentialValueStroops(
        [{ projectId: 999, tokenBalance: 1n, contractClaimable: 0n, totalClaimed: 0n }],
        catalog.projects,
        { catalogStatus: catalog.status, portfolioStatus: "ready" }
      )
    ).toBeNull();
  });

  it("fails closed for invalid or unbounded project counts", () => {
    expect(deriveProjectIds(null)).toEqual([]);
    expect(deriveProjectIds("not-a-number")).toEqual([]);
    expect(deriveProjectIds(4n, 2)).toEqual([]);
  });

  it("treats next_project_id zero as unavailable rather than empty", async () => {
    const read = vi.fn(async (_contractId: string, method: string) => {
      if (method === "next_project_id") return 0n;
      throw new Error(`unexpected read: ${method}`);
    });

    const catalog = await readProjectCatalog(read, "contract");

    expect(catalog.status).toBe("unavailable");
    expect(catalog.nextProjectId).toBe(0n);
    expect(catalog.error).toBe("Project count is invalid.");
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed ownership reads instead of treating them as empty ownership", async () => {
    const read = vi.fn(async () => "not-a-project-list");

    await expect(readUserProjectIds(read, "contract", "wallet")).rejects.toThrow(
      "Project ownership read returned an invalid value."
    );
  });

  it("only derives total minted from complete or explicitly empty reads", () => {
    expect(deriveTotalMinted(readyCatalog())).toBe(4n);
    expect(
      deriveTotalMinted(
        readyCatalog({
          status: "empty",
          nextProjectId: 1n,
          projectIds: [],
          projects: [],
        })
      )
    ).toBe(0n);
    expect(deriveTotalMinted(readyCatalog({ status: "unavailable" }))).toBeNull();
    expect(deriveTotalMinted(readyCatalog({ status: "partial" }))).toBeNull();
  });

  it("does not calculate aggregates from partial or unobserved reads", () => {
    const position: PortfolioPosition = {
      projectId: 1,
      tokenBalance: 1n,
      contractClaimable: 0n,
      totalClaimed: 0n,
    };
    const project = completeProject();

    expect(
      sumReferentialValueStroops([position], [project], {
        catalogStatus: "ready",
        portfolioStatus: "partial",
      })
    ).toBeNull();
    expect(
      sumReferentialValueStroops([position], [project], {
        catalogStatus: "unavailable",
        portfolioStatus: "ready",
      })
    ).toBeNull();
    expect(
      sumReferentialValueStroops([position], [project], {
        catalogStatus: "ready",
        portfolioStatus: "ready",
      })
    ).toBe(10000000n);
    expect(sumOwnedProjectAmounts([project], "salesBalance", false)).toBeNull();
    expect(sumOwnedProjectAmounts([project], "salesBalance", true)).toBe(40000000n);
    expect(sumOwnedProjectAmounts([project], "totalRevenue", true)).toBe(41000000n);
  });

  it("selects only positive claimable positions", () => {
    expect(
      selectPositiveClaimable([
        { projectId: 1, amount: 0n },
        { projectId: 2, amount: 250000n },
        { projectId: 0, amount: 1n },
        { projectId: 3, amount: -1n },
      ])
    ).toEqual([{ projectId: 2, amount: 250000n }]);
  });
});

describe("public evidence schema", () => {
  it("renders the four required public proof sections and status labels", () => {
    const page = readRepoFile("frontend/app/proof/page.tsx");
    for (const heading of [
      "Deployment",
      "Project",
      "Purchases + Contract Inflows/Claims",
      "Indexer Reconciliation",
    ]) {
      expect(page).toContain(heading);
    }
    expect(page).toContain("Network: Stellar Testnet");
    expect(page).toContain("Protocol snapshot");
     expect(page).toContain("Reconciled");
     expect(page).toContain("Total contract inflows (sales + deposits)");
     expect(page).not.toContain("Total revenue");
   });


  it("keeps the typed module and machine-readable snapshot identical", () => {
    const json = JSON.parse(readRepoFile("evidence/contract-state.json"));
    expect(json).toEqual(PUBLIC_EVIDENCE);
  });

  it("pins the verified network, source, contract, and reconciliation state", () => {
    expect(PUBLIC_EVIDENCE.network).toBe("Stellar Testnet");
    expect(PUBLIC_EVIDENCE.sourceCommit).toBe("1400127");
    expect(PUBLIC_EVIDENCE.snapshotLedger).toBe(4856253);
    expect(PUBLIC_EVIDENCE.contract.id).toBe(
      "CAW37S6RDQCRCHUBMFG4KMMZHSNI6AD5AR5MG5OQS76J7FU7JUDR3UAK"
    );
    expect(PUBLIC_EVIDENCE.indexer).toEqual({
      purchaseEvents: "4",
      uniqueHolders: "3",
      indexedTokenTotal: "4",
      contractMinted: "4",
      reconciled: true,
    });
  });

  it("keeps every u128 evidence value in decimal string form", () => {
    const values = [
      PUBLIC_EVIDENCE.project.totalSupply,
      PUBLIC_EVIDENCE.project.priceStroops,
      PUBLIC_EVIDENCE.project.minPurchase,
      PUBLIC_EVIDENCE.project.minted,
      PUBLIC_EVIDENCE.project.salesBalanceStroops,
      PUBLIC_EVIDENCE.project.totalRevenueStroops,
      PUBLIC_EVIDENCE.project.energyKwh,
      PUBLIC_EVIDENCE.project.rewardPerTokenStored,
      ...PUBLIC_EVIDENCE.purchases.flatMap((purchase) => [
        purchase.tokenAmount,
        purchase.priceStroops,
      ]),
      PUBLIC_EVIDENCE.revenue.amountStroops,
      ...PUBLIC_EVIDENCE.claims.flatMap((claim) => [
        claim.paidStroops,
        claim.claimableStroops,
      ]),
      PUBLIC_EVIDENCE.indexer.purchaseEvents,
      PUBLIC_EVIDENCE.indexer.uniqueHolders,
      PUBLIC_EVIDENCE.indexer.indexedTokenTotal,
      PUBLIC_EVIDENCE.indexer.contractMinted,
    ];

    for (const value of values) {
      expect(typeof value).toBe("string");
      expect(value).toMatch(/^\d+$/);
    }
  });

  it("converts the recorded contract inflows and claims with exact XLM units", () => {
    expect(formatStroopsAsXlm(PUBLIC_EVIDENCE.project.priceStroops)).toBe(
      "1.0000000 XLM"
    );
    expect(formatStroopsAsXlm(PUBLIC_EVIDENCE.project.salesBalanceStroops)).toBe(
      "4.0000000 XLM"
    );
    expect(formatStroopsAsXlm(PUBLIC_EVIDENCE.project.totalRevenueStroops)).toBe(
      "4.1000000 XLM"
    );
    expect(formatStroopsAsXlm(PUBLIC_EVIDENCE.revenue.amountStroops)).toBe(
      "0.1000000 XLM"
    );
    expect(
      PUBLIC_EVIDENCE.claims.map((claim) =>
        formatStroopsAsXlm(claim.paidStroops)
      )
    ).toEqual(["0.0500000 XLM", "0.0250000 XLM", "0.0000000 XLM"]);
    expect(
      formatStroopsAsXlm(
        PUBLIC_EVIDENCE.claims.find((claim) => claim.holder === "C")
          ?.claimableStroops
      )
    ).toBe("0.0250000 XLM");
  });

  it("records exact public links and never labels C as claimed", () => {
    expect(PUBLIC_EVIDENCE.contract.explorerUrl).toBe(
      "https://stellar.expert/explorer/testnet/contract/CAW37S6RDQCRCHUBMFG4KMMZHSNI6AD5AR5MG5OQS76J7FU7JUDR3UAK"
    );
    expect(PUBLIC_EVIDENCE.contract.deploymentTxUrl).toContain(
      PUBLIC_EVIDENCE.contract.deploymentTxHash
    );
    expect(PUBLIC_EVIDENCE.ledgerExplorerUrl).toBe(
      "https://stellar.expert/explorer/testnet/ledger/4856253"
    );
    expect(PUBLIC_EVIDENCE.purchases.every((purchase) => purchase.txUrl.includes(purchase.txHash))).toBe(true);
    expect(PUBLIC_EVIDENCE.claims.find((claim) => claim.holder === "C")).toEqual(
      expect.objectContaining({
        status: "claimable",
        paidStroops: "0",
        claimableStroops: "250000",
        txHash: null,
      })
    );
  });
});

describe("user-facing truthfulness guardrails", () => {
  const frontendSource = [
    ...sourceFiles(path.join(frontendRoot, "app")),
    ...sourceFiles(path.join(frontendRoot, "components")),
    ...sourceFiles(path.join(frontendRoot, "lib")),
  ]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  it("uses all required contract views without fixed project fallbacks", () => {
    const contractData = readRepoFile("frontend/lib/contractData.ts");
    for (const method of [
      "next_project_id",
      "get_project",
      "get_project_name",
      "get_sales_balance",
      "get_portfolio",
      "get_claimable",
      "get_user_projects",
    ]) {
      expect(contractData).toContain(`\"${method}\"`);
    }
    expect(frontendSource).not.toMatch(/\[1,\s*2,\s*3\]/);
    expect(frontendSource).not.toContain("fallbackProjects");
  });

  it("documents live mutations, snapshot boundaries, and project isolation", () => {
    const readme = readRepoFile("README.md");
    expect(readme).toContain("## Live state semantics");
    expect(readme).toContain("Successful `purchase_tokens`");
    expect(readme).toContain("Successful `deposit_revenue`");
    expect(readme).toContain("## Project isolation and route matrix");
    expect(readme).toContain("/project/999");
    expect(readme).toContain("## Snapshot versus live state");
    expect(readme).toContain("evidence/transactions.md");
  });

  it("removes legacy metrics, fake activity payments, and unsupported certificate claims", () => {
    const forbidden = [
      /\b847\b/,
      /\$2\.4M\+/,
      /23\.4 XLM/,
      /450 XLM/,
      /340 XLM/,
      /Hace 2h/,
      /Hace 1d/,
      /Hace 3d/,
      /\+1,420\.50 USDC/,
      /2,500 XLM/,
      /NFT #/,
      /I-REC/,
      /SEP-41 Non-Fungible/,
      /La Fiduciaria/,
      /SUNARP/,
      /Inembargable y auditado/,
      /~24h/,
      /QR READY/,
    ];

    for (const pattern of forbidden) {
      expect(frontendSource).not.toMatch(pattern);
    }
  });

  it("does not coerce contract u128 values through Number", () => {
    expect(frontendSource).not.toMatch(
      /Number\([^)]*(?:price|minted|supply|claimable|stroop|balance|revenue|tokenAmount)/i
    );
  });

  it("keeps wallet balances exact and removes unsupported fiat conversion", () => {
    const walletContext = readRepoFile("frontend/lib/WalletContext.tsx");
    expect(walletContext).toContain("parseXlmToStroops(native.balance)");
    expect(walletContext).not.toContain("parseFloat");
    expect(walletContext).not.toContain("XLM_TO_USD");
    expect(walletContext).not.toContain("balanceUsd");
    expect(readRepoFile("frontend/components/PdfCertificate.tsx")).toContain(
      '["GENERATED AT", date]'
    );
  });

  it("uses an explicit 404 redirect instead of routing unknown paths home", () => {
    const netlify = readRepoFile("netlify.toml");
    expect(netlify).toContain('to = "/404.html"');
    expect(netlify).toContain("status = 404");
    expect(netlify).not.toContain('to = "/index.html"');
  });

  it("generates the deployed project routes without opening unknown IDs", () => {
    const projectPage = readRepoFile("frontend/app/project/[id]/page.tsx");
    expect(projectPage).toContain("export const dynamicParams = false");
    expect(projectPage).toContain('const STATIC_PROJECT_IDS = ["1", "2", "3", "4"]');
  });

  it("wires proof navigation and contains no placeholder hash links", () => {
    expect(readRepoFile("frontend/components/Header.tsx")).toContain('href="/proof"');
    expect(readRepoFile("frontend/components/Footer.tsx")).toContain('href="/proof"');
    expect(frontendSource).not.toMatch(/href=["']#["']/);
  });
});
