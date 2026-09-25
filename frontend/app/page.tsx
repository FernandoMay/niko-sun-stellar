"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import StatsBar from "@/components/StatsBar";
import ProtocolVerification from "@/components/ProtocolVerification";
import HowItWorks from "@/components/HowItWorks";
import FeaturedProjects from "@/components/FeaturedProjects";
import TechArchitecture from "@/components/TechArchitecture";
import Footer from "@/components/Footer";
import { useHolderMetrics } from "@/hooks/useHolderMetrics";
import { useWallet } from "@/lib/WalletContext";
import { CONTRACT_ID } from "@/lib/contract";
import {
  deriveTotalMinted,
  readProjectCatalog,
  type ProjectCatalog,
} from "@/lib/contractData";

const EMPTY_CATALOG: ProjectCatalog = {
  status: "unavailable",
  nextProjectId: null,
  projectIds: [],
  projects: [],
  unavailableProjectIds: [],
  error: null,
};

function LandingVerification() {
  const { metrics } = useHolderMetrics();
  const { readContract } = useWallet();
  const [catalog, setCatalog] = useState<ProjectCatalog>(EMPTY_CATALOG);

  useEffect(() => {
    let cancelled = false;
    void readProjectCatalog(readContract, CONTRACT_ID)
      .then((next) => {
        if (!cancelled) setCatalog(next);
      })
      .catch(() => {
        if (!cancelled) setCatalog(EMPTY_CATALOG);
      });
    return () => {
      cancelled = true;
    };
  }, [readContract]);

  const nextProjectId =
    catalog.nextProjectId !== null &&
    catalog.nextProjectId <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(catalog.nextProjectId)
      : null;
  const totalMinted = deriveTotalMinted(catalog);

  return (
    <ProtocolVerification
      metrics={metrics}
      nextProjectId={nextProjectId}
      totalMinted={totalMinted === null ? null : totalMinted.toString()}
      catalogStatus={catalog.status}
    />
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className="w-full pt-16 bg-surface">
        <div className="flex flex-col w-full overflow-hidden">
          <Hero />
          <StatsBar />
          <LandingVerification />
          <HowItWorks />
          <FeaturedProjects />
          <TechArchitecture />
        </div>
      </main>
      <Footer />
    </div>
  );
}
