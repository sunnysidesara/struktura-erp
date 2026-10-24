"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listUsers,
  setUserActive,
  roleCodeFromName,
  type ApiUserRow,
} from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { CreateUserModal } from "./CreateUserModal";
import styles from "../page.module.css";

type Row = ApiUserRow & { roleLabel: string; roleCode: string };
type Notice = { type: "success" | "error"; message: string } | null;

const ROLE_LABELS: Record<string, string> = {
  Admin: "System Administrator",
  "Project Manager": "Project Manager",
  "Site Supervisor": "Site Supervisor",
};

export default function UsersPage() {
  const [users, setUsers] = useState<ApiUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listUsers()
      .then((data) => {
        setUsers(data);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load users."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Deep links such as /sa/users/create and /sa/users?create=1 open the modal.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") !== "1") {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreateOpen(true);

    const nextParams = new URLSearchParams(window.location.search);
    nextParams.delete("create");
    const query = nextParams.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, []);

  const rows = useMemo<Row[]>(
    () =>
      users.map((user) => ({
        ...user,
        roleLabel: ROLE_LABELS[user.role_name ?? ""] ?? (user.role_name ?? "-"),
        roleCode: roleCodeFromName(user.role_name) ?? "SA",
      })),
    [users],
  );

  const filtered = rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      row.full_name.toLowerCase().includes(term) ||
      row.id_number.toLowerCase().includes(term) ||
      row.email.toLowerCase().includes(term);
    const matchesRole = roleFilter === "all" || row.roleCode === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreated = (user: ApiUserRow) => {
    setCreateOpen(false);
    setNotice({
      type: "success",
      message: `${user.id_number} (${user.full_name}) was created successfully.`,
    });
    load();
  };

  const toggle = async (row: Row) => {
    if (
      row.is_active &&
      !window.confirm(
        `Deactivate ${row.full_name} (${row.id_number})? They will be signed out and unable to log in.`,
      )
    ) {
      return;
    }

    setBusyId(row.user_id);
    setNotice(null);
    try {
      await setUserActive(row.user_id, !row.is_active);
      setNotice({
        type: "success",
        message: `${row.id_number} ${row.is_active ? "deactivated" : "activated"}.`,
      });
      load();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Action failed.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const columns: SaColumn<Row>[] = [
    {
      key: "name",
      label: "User",
      render: (row) => (
        <span>
          {row.full_name}
          <span style={{ display: "block", color: "#94a3b8", fontSize: "0.7rem" }}>{row.id_number}</span>
        </span>
      ),
    },
    { key: "email", label: "Email", render: (row) => row.email },
    { key: "role", label: "Role", render: (row) => row.roleLabel },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => (
        <StatusBadge status={row.is_active ? "Active" : "Inactive"} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => toggle(row)}
            disabled={busyId === row.user_id}
          >
            {row.is_active ? "Disable" : "Enable"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <SaPage
      kicker="User Management"
      title="Users"
      subtitle="Every account in the system"
      actions={
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setCreateOpen(true)}
        >
          + Create User
        </button>
      }
    >
      {notice ? (
        <p className={notice.type === "error" ? styles.alert : styles.success}>
          {notice.message}
        </p>
      ) : null}

      <SaPanel
        title="User Directory"
        filters={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
            />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="SA">System Administrator</option>
              <option value="PM">Project Manager</option>
              <option value="SS">Site Supervisor</option>
            </select>
          </>
        }
      >
        <SaTable
          columns={columns}
          rows={filtered}
          loading={loading}
          error={error}
          emptyText={
            users.length === 0
              ? "No user accounts yet. Use + Create User to add one."
              : "No users match your search or filter."
          }
          rowKey={(row) => row.user_id}
        />
      </SaPanel>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </SaPage>
  );
}
