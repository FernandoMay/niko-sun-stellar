import { scValToNative, xdr } from "@stellar/stellar-sdk";
import {
  parseStroops,
  parseUnsignedBigInt,
  sumBigints,
} from "@/lib/amounts";

export const MAX_DASHBOARD_PROJECT_READS = 64;

export type ContractRead = (
  contractId: string,
  method: string,
  args?: unknown[]
) => Promise<unknown>;

export type ContractProject = {
  id: number;
  name: string | null;
  creator: string | null;
  totalSupply: bigint | null;
  minted: bigint | null;
  minPurchase: bigint | null;
  price: bigint | null;
  createdAt: bigint | null;
  active: boolean | null;
  totalEnergyKwh: bigint | null;
  totalRevenue: bigint | null;
  rewardPerTokenStored: bigint | null;
  salesBalance: bigint | null;
  stateComplete: boolean;
};

export type ProjectCatalog = {
  status: "ready" | "partial" | "unavailable" | "empty";
  nextProjectId: bigint | null;
  projectIds: number[];
  projects: ContractProject[];
  unavailableProjectIds: number[];
  error: string | null;
};

export type PortfolioPosition = {
  projectId: number;
  tokenBalance: bigint;
  contractClaimable: bigint;
  totalClaimed: bigint;
};

export type InvestorPortfolio = {
  status: "ready" | "partial" | "unavailable" | "empty";
  positions: PortfolioPosition[];
  claimables: Record<number, bigint>;
  unavailableProjectIds: number[];
  error: string | null;
};

export type ClaimablePosition = {
  projectId: number;
  amount: bigint;
};

export function decodeContractValue(value: unknown): unknown {
  if (!(value instanceof xdr.ScVal)) return value;
  try {
    return scValToNative(value as unknown as xdr.ScVal);
  } catch {
    return value;
  }
}

export function deriveProjectIds(
  nextProjectId: unknown,
  maxProjects = MAX_DASHBOARD_PROJECT_READS
): number[] {
  const parsed = parseUnsignedBigInt(decodeContractValue(nextProjectId));
  if (parsed === null || parsed < 1n || maxProjects < 1) return [];
  if (parsed > BigInt(maxProjects) + 1n) return [];

  const count = Number(parsed - 1n);
  return Array.from({ length: count }, (_, index) => index + 1);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries(), ([key, entry]) => [String(key), entry])
    );
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  const decoded = decodeContractValue(value);
  return typeof decoded === "string" && decoded.length > 0 ? decoded : null;
}

function asBoolean(value: unknown): boolean | null {
  const decoded = decodeContractValue(value);
  return typeof decoded === "boolean" ? decoded : null;
}

function asProjectId(value: unknown): number | null {
  const parsed = parseUnsignedBigInt(decodeContractValue(value));
  if (parsed === null || parsed < 1n || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return Number(parsed);
}

function asAmount(value: unknown): bigint | null {
  return parseStroops(decodeContractValue(value));
}

function parseProject(
  id: number,
  rawProject: unknown,
  rawName: unknown,
  rawSalesBalance: unknown
): ContractProject {
  const project = asRecord(decodeContractValue(rawProject)) ?? {};
  const name = asString(rawName);
  const creator = asString(project.creator);
  const totalSupply = asAmount(project.total_supply ?? project.totalSupply);
  const minted = asAmount(project.minted);
  const minPurchase = asAmount(project.min_purchase ?? project.minPurchase);
  const price = asAmount(project.price);
  const createdAt = parseUnsignedBigInt(
    decodeContractValue(project.created_at ?? project.createdAt)
  );
  const active = asBoolean(project.active);
  const totalEnergyKwh = asAmount(
    project.total_energy_kwh ?? project.totalEnergyKwh
  );
  const totalRevenue = asAmount(project.total_revenue ?? project.totalRevenue);
  const rewardPerTokenStored = asAmount(
    project.reward_per_token_stored ?? project.rewardPerTokenStored
  );
  const salesBalance = asAmount(rawSalesBalance);

  return {
    id,
    name,
    creator,
    totalSupply,
    minted,
    minPurchase,
    price,
    createdAt,
    active,
    totalEnergyKwh,
    totalRevenue,
    rewardPerTokenStored,
    salesBalance,
    stateComplete:
      name !== null &&
      creator !== null &&
      totalSupply !== null &&
      minted !== null &&
      minPurchase !== null &&
      price !== null &&
      createdAt !== null &&
      active !== null &&
      totalEnergyKwh !== null &&
      totalRevenue !== null &&
      rewardPerTokenStored !== null &&
      salesBalance !== null,
  };
}

export async function readProjectCatalog(
  readContract: ContractRead,
  contractId: string
): Promise<ProjectCatalog> {
  let nextProjectId: bigint | null = null;
  try {
    nextProjectId = parseUnsignedBigInt(
      decodeContractValue(
        await readContract(contractId, "next_project_id", [])
      )
    );
  } catch {
    return {
      status: "unavailable",
      nextProjectId: null,
      projectIds: [],
      projects: [],
      unavailableProjectIds: [],
      error: "Project count is unavailable.",
    };
  }

  if (nextProjectId === null || nextProjectId < 1n) {
    return {
      status: "unavailable",
      nextProjectId,
      projectIds: [],
      projects: [],
      unavailableProjectIds: [],
      error: "Project count is invalid.",
    };
  }

  const projectIds = deriveProjectIds(nextProjectId);
  if (nextProjectId > 1n && projectIds.length === 0) {
    return {
      status: "unavailable",
      nextProjectId,
      projectIds: [],
      projects: [],
      unavailableProjectIds: [],
      error: "Project count exceeds the dashboard read limit.",
    };
  }

  if (projectIds.length === 0) {
    return {
      status: "empty",
      nextProjectId,
      projectIds: [],
      projects: [],
      unavailableProjectIds: [],
      error: null,
    };
  }

  const results = await Promise.all(
    projectIds.map(async (id) => {
      const [projectResult, nameResult, salesResult] = await Promise.allSettled([
        readContract(contractId, "get_project", [id]),
        readContract(contractId, "get_project_name", [id]),
        readContract(contractId, "get_sales_balance", [id]),
      ]);

      if (projectResult.status === "rejected" || nameResult.status === "rejected") {
        return { id, project: null };
      }

      return {
        id,
        project: parseProject(
          id,
          projectResult.value,
          nameResult.value,
          salesResult.status === "fulfilled" ? salesResult.value : null
        ),
      };
    })
  );

  const projects = results.flatMap((result) =>
    result.project ? [result.project] : []
  );
  const unavailableProjectIds = results.flatMap((result) =>
    result.project ? [] : [result.id]
  );
  const partial = projects.length !== projectIds.length || projects.some((project) => !project.stateComplete);

  return {
    status: projects.length === 0 ? "unavailable" : partial ? "partial" : "ready",
    nextProjectId,
    projectIds,
    projects,
    unavailableProjectIds,
    error: partial ? "Some project fields are unavailable." : null,
  };
}

export function deriveTotalMinted(catalog: ProjectCatalog): bigint | null {
  if (catalog.status === "empty") {
    return catalog.nextProjectId === 1n ? 0n : null;
  }
  if (
    catalog.status !== "ready" ||
    catalog.projects.length !== catalog.projectIds.length ||
    catalog.projects.some((project) => !project.stateComplete || project.minted === null)
  ) {
    return null;
  }

  return sumBigints(catalog.projects.map((project) => project.minted as bigint));
}

function parsePortfolioPosition(value: unknown): PortfolioPosition | null {
  const record = asRecord(decodeContractValue(value));
  if (!record) return null;

  const projectId = asProjectId(record.project_id ?? record.projectId);
  const tokenBalance = asAmount(record.token_balance ?? record.tokenBalance);
  const contractClaimable = asAmount(
    record.claimable_amount ?? record.claimableAmount
  );
  const totalClaimed = asAmount(record.total_claimed ?? record.totalClaimed);

  if (
    projectId === null ||
    tokenBalance === null ||
    contractClaimable === null ||
    totalClaimed === null
  ) {
    return null;
  }

  return { projectId, tokenBalance, contractClaimable, totalClaimed };
}

export async function readInvestorPortfolio(
  readContract: ContractRead,
  contractId: string,
  investor: string,
  projectIds: readonly number[]
): Promise<InvestorPortfolio> {
  if (projectIds.length === 0) {
    return {
      status: "empty",
      positions: [],
      claimables: {},
      unavailableProjectIds: [],
      error: null,
    };
  }

  const portfolioPromise = Promise.allSettled([
    readContract(contractId, "get_portfolio", [investor, [...projectIds]]),
  ]).then(([result]) => result);
  const claimablePromise = Promise.all(
    projectIds.map(async (projectId) => ({
      projectId,
      result: await Promise.allSettled([
        readContract(contractId, "get_claimable", [investor, projectId]),
      ]).then(([result]) => result),
    }))
  );
  const [portfolioResult, claimResults] = await Promise.all([
    portfolioPromise,
    claimablePromise,
  ]);

  const positions: PortfolioPosition[] = [];
  let portfolioComplete = false;
  if (portfolioResult.status === "fulfilled") {
    const decoded = decodeContractValue(portfolioResult.value);
    if (Array.isArray(decoded)) {
      const parsed = decoded.map(parsePortfolioPosition);
      if (parsed.every((position) => position !== null)) {
        positions.push(...(parsed as PortfolioPosition[]));
        portfolioComplete = true;
      }
    }
  }

  const claimables: Record<number, bigint> = {};
  const unavailableProjectIds: number[] = [];
  for (const entry of claimResults) {
    if (entry.result.status === "rejected") {
      unavailableProjectIds.push(entry.projectId);
      continue;
    }
    const amount = asAmount(entry.result.value);
    if (amount === null) {
      unavailableProjectIds.push(entry.projectId);
    } else {
      claimables[entry.projectId] = amount;
    }
  }

  const claimableComplete = unavailableProjectIds.length === 0;
  const status =
    portfolioComplete && claimableComplete
      ? "ready"
      : positions.length > 0 || Object.keys(claimables).length > 0
        ? "partial"
        : "unavailable";

  return {
    status,
    positions,
    claimables,
    unavailableProjectIds,
    error:
      status === "ready"
        ? null
        : "Some portfolio or claimable reads are unavailable.",
  };
}

export function selectPositiveClaimable(
  positions: readonly ClaimablePosition[]
): ClaimablePosition[] {
  return positions.filter(
    (position) =>
      Number.isSafeInteger(position.projectId) &&
      position.projectId > 0 &&
      position.amount > 0n
  );
}

export function sumPortfolioTokens(
  positions: readonly PortfolioPosition[]
): bigint {
  return sumBigints(positions.map((position) => position.tokenBalance));
}

export function sumReferentialValueStroops(
  positions: readonly PortfolioPosition[],
  projects: readonly ContractProject[],
  readiness: {
    catalogStatus: ProjectCatalog["status"];
    portfolioStatus: InvestorPortfolio["status"];
  }
): bigint | null {
  if (
    readiness.catalogStatus !== "ready" ||
    readiness.portfolioStatus !== "ready" ||
    projects.some((project) => !project.stateComplete)
  ) {
    return null;
  }

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const values: bigint[] = [];

  for (const position of positions) {
    const project = projectById.get(position.projectId);
    if (!project || project.price === null) return null;
    values.push(position.tokenBalance * project.price);
  }

  return sumBigints(values);
}

export function sumOwnedProjectAmounts(
  projects: readonly ContractProject[],
  field: "salesBalance" | "totalRevenue",
  ownershipVerified: boolean
): bigint | null {
  if (!ownershipVerified) return null;

  const amounts: bigint[] = [];
  for (const project of projects) {
    const amount = project[field];
    if (!project.stateComplete || amount === null) return null;
    amounts.push(amount);
  }

  return sumBigints(amounts);
}

export async function readUserProjectIds(
  readContract: ContractRead,
  contractId: string,
  investor: string
): Promise<number[]> {
  const decoded = decodeContractValue(
    await readContract(contractId, "get_user_projects", [investor])
  );
  if (!Array.isArray(decoded)) {
    throw new Error("Project ownership read returned an invalid value.");
  }

  const ids: number[] = [];
  for (const value of decoded) {
    const projectId = asProjectId(value);
    if (projectId === null) {
      throw new Error("Project ownership read returned an invalid project ID.");
    }
    ids.push(projectId);
  }

  return Array.from(new Set(ids)).sort((left, right) => left - right);
}
