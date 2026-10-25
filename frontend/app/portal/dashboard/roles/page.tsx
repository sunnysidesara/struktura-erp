"use client";

import { listRoles } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  useApiData,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "../sa/page.module.css";

export default function RolesPage() {
  const { data: roles, loading, error } = useApiData(listRoles);

  return (
    <SaPage
      kicker="User Management"
      title="Roles & Access"
      subtitle="The three system roles and what each can do"
    >
      <SaPanel title="System Roles">
        <p className={styles.muted}>
          Role definitions are managed by the System Administrator.
        </p>

        {loading ? (
          <p className={styles.muted}>Loading roles...</p>
        ) : error ? (
          <p className={styles.alert}>{error}</p>
        ) : (roles ?? []).length === 0 ? (
          <p className={styles.muted}>No roles defined in the database.</p>
        ) : (
          <div className={styles.roleGrid}>
            {(roles ?? []).map((role) => (
              <article className={styles.roleCard} key={role.role_id}>
                <h3>{role.role_name.toUpperCase()}</h3>
                <p>{role.description ?? "No description recorded."}</p>
              </article>
            ))}
          </div>
        )}
      </SaPanel>
    </SaPage>
  );
}
