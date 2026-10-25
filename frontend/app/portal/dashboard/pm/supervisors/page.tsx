"use client";

import { listPmSiteSupervisors, type PmSupervisor } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  useApiData,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";

const columns: SaColumn<PmSupervisor>[] = [
  { key: "name", label: "Name", render: (row) => row.name },
  { key: "id_number", label: "Account ID", render: (row) => row.id_number },
  { key: "email", label: "Email", render: (row) => row.email ?? "-" },
  {
    key: "status",
    label: "Status",
    status: true,
    render: (row) => <StatusBadge status={row.is_active ? "Active" : "Inactive"} />,
  },
];

export default function SiteSupervisorsPage() {
  const { data, loading, error } = useApiData(() => listPmSiteSupervisors(true));
  const supervisors = data ?? [];

  return (
    <SaPage
      kicker="Project Manager"
      title="Site Supervisors"
      subtitle="Read-only directory of Site Supervisor accounts available across your projects."
    >
      <SaPanel title={`Site Supervisors (${supervisors.length})`}>
        <SaTable
          columns={columns}
          rows={supervisors}
          loading={loading}
          error={error}
          emptyText="No Site Supervisor accounts are available."
          rowKey={(row) => row.user_id}
        />
      </SaPanel>
    </SaPage>
  );
}
