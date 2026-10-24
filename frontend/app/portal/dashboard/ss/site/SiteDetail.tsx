"use client";

import type { ReactNode } from "react";
import { getSsSiteInfo } from "@/lib/api";
import { SaPanel, money } from "@/app/portal/dashboard/sa/_components/SaPage";
import { useSsResource } from "../_components/useSsResource";
import { useSsSite } from "../_components/siteSelection";
import { ProgressBar } from "../_components/SsReport";
import ssStyles from "../ss.module.css";

function DetailItem({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? ssStyles.detailItemWide : ssStyles.detailItem}>
      <dt className={ssStyles.detailLabel}>{label}</dt>
      <dd className={ssStyles.detailValue}>{value}</dd>
    </div>
  );
}

function usagePercent(spent: number, allocation: number): number {
  if (allocation <= 0) return 0;

  return Math.min(100, Math.max(0, Math.round((spent / allocation) * 100)));
}

/** Read-only detail sheet for the site chosen in the header switcher. */
export function SiteDetail() {
  const { selectedId, loading: sitesLoading } = useSsSite();
  const { data, loading, error } = useSsResource(() => getSsSiteInfo(selectedId), selectedId);

  const site = data?.site ?? null;

  if (sitesLoading || loading) {
    return (
      <SaPanel title="Current Site Details">
        <p className={ssStyles.muted}>Loading site details...</p>
      </SaPanel>
    );
  }

  if (error !== "") {
    return (
      <SaPanel title="Current Site Details">
        <p className={ssStyles.noticeError}>{error}</p>
      </SaPanel>
    );
  }

  if (!site) {
    return (
      <SaPanel title="Current Site Details">
        <p className={ssStyles.muted}>No project details are available for this site yet.</p>
      </SaPanel>
    );
  }

  const materialsRemaining = site.budgets.materials - site.spend.materials;
  const equipmentRemaining = site.budgets.equipment - site.spend.equipment;

  return (
    <>
      <SaPanel title="Project Info">
        <dl className={ssStyles.detailGrid}>
          <DetailItem label="Project Name" value={site.project} />
          <DetailItem label="Project ID" value={site.code} />
          <DetailItem label="Project Description" value={site.description || "-"} wide />
          <DetailItem label="Start Date" value={site.startDate ?? "-"} />
          <DetailItem label="End Date" value={site.endDate ?? "-"} />
        </dl>
      </SaPanel>

      <SaPanel title="People">
        <dl className={ssStyles.detailGrid}>
          <DetailItem
            label="Project Manager"
            value={
              <>
                {site.manager || "-"}
                {site.managerEmail ? (
                  <span className={ssStyles.detailMeta}>{site.managerEmail}</span>
                ) : null}
              </>
            }
          />
          <DetailItem
            label="Site Supervisor"
            value={
              <>
                {site.supervisor || "-"}
                {site.supervisor_id ? (
                  <span className={ssStyles.detailMeta}>{site.supervisor_id}</span>
                ) : null}
              </>
            }
          />
        </dl>
      </SaPanel>

      <SaPanel title="Financials">
        <dl className={ssStyles.detailGrid}>
          <DetailItem label="Total Budget" value={money(site.budgets.total)} />
          <DetailItem label="Materials Budget" value={money(site.budgets.materials)} />
          <DetailItem label="Equipment Budget" value={money(site.budgets.equipment)} />
        </dl>
      </SaPanel>

      <SaPanel title="Expense Breakdown">
        <div className={ssStyles.expenseList}>
          <div className={ssStyles.expenseRow}>
            <div className={ssStyles.expenseHead}>
              <span className={ssStyles.expenseLabel}>Materials Spent</span>
              <strong className={ssStyles.expenseValue}>{money(site.spend.materials)}</strong>
            </div>
            <ProgressBar value={usagePercent(site.spend.materials, site.budgets.materials)} />
            <p className={ssStyles.expenseMeta}>
              Allocation {money(site.budgets.materials)} &middot; Remaining{" "}
              {money(materialsRemaining)}
            </p>
          </div>

          <div className={ssStyles.expenseRow}>
            <div className={ssStyles.expenseHead}>
              <span className={ssStyles.expenseLabel}>Equipment Spent</span>
              <strong className={ssStyles.expenseValue}>{money(site.spend.equipment)}</strong>
            </div>
            <ProgressBar value={usagePercent(site.spend.equipment, site.budgets.equipment)} />
            <p className={ssStyles.expenseMeta}>
              Allocation {money(site.budgets.equipment)} &middot; Remaining{" "}
              {money(equipmentRemaining)}
            </p>
          </div>
        </div>
      </SaPanel>
    </>
  );
}
