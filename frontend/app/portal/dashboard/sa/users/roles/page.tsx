"use client";

import { listRoles, listUsers } from "@/lib/api";
import { SaPage, SaPanel, useApiData } from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "../../page.module.css";

export default function RolesPage() {
  const { data: roles, loading, error } = useApiData(listRoles);
  const { data: users } = useApiData(listUsers);

  const countFor = (roleName: string) =>
    (users ?? []).filter((user) => user.role_name === roleName).length;

  return (
    <SaPage
      kicker="User Management"
      title="Roles & Access"
      subtitle="The three system roles and what each can do"
    >
      <SaPanel title="System Roles">
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
                <div className={styles.roleMeta}>
                  <span>Users: {countFor(role.role_name)}</span>
                  <span>Role ID: {role.role_id}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </SaPanel>
    </SaPage>
  );
}
