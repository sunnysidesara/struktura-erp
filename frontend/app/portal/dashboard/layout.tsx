"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./layout.module.css";
import { PmProjectSwitcher } from "./pm/_components/PmProjectSwitcher";
import { usePmProject } from "./pm/_components/projectSelection";
import { SsSiteSwitcher } from "./ss/_components/SsSiteSwitcher";
import { useSsSite } from "./ss/_components/siteSelection";
import {
  getSidebarData,
  type IconName,
  type SidebarGroup,
  type SidebarSection,
} from "./sidebarData";
import {
  ApiError,
  clearSession,
  getMyNotifications,
  getStoredUser,
  getToken,
  logout as apiLogout,
  me,
  toSessionUser,
  type ApiNotification,
  type SessionUser,
} from "@/lib/api";

type UserRole = "SA" | "PM" | "SS";

const roleLabels: Record<UserRole, string> = {
  SA: "System Administrator",
  PM: "Project Manager",
  SS: "Site Supervisor",
};

// The header search box jumps to the search screen that belongs to the
// signed-in role. Site Supervisors have no search box (they use My Sites).
const roleSearchPath: Record<Exclude<UserRole, "SS">, string> = {
  SA: "/portal/dashboard/sa/search",
  PM: "/portal/dashboard/pm/search",
};

type UtilityIcon =
  | "bell"
  | "chevron"
  | "menu"
  | "close"
  | "logout"
  | "check"
  | "spark";

const iconPaths: Record<IconName | UtilityIcon, string> = {
  home: "M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6",
  search: "m20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.5a4 4 0 0 1 0 7.75M20 21v-2a4 4 0 0 0-3-3.87",
  sparkles:
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 11 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z",
  "file-text":
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h8",
  folder:
    "M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z",
  list: "M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01",
  "check-square": "m8 12 3 3 5-6M4 4h16v16H4z",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5Zm0 0v13M8 7h8m-8 4h8",
  database:
    "M4 5c0-1.1 3.58-2 8-2s8 .9 8 2-3.58 2-8 2-8-.9-8-2Zm0 0v14c0 1.1 3.58 2 8 2s8-.9 8-2V5M4 12c0 1.1 3.58 2 8 2s8-.9 8-2",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64",
  briefcase: "M3 8h18v12H3zM8 8V5h8v3m-13 5h18m-10 0v2",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5",
  "user-check":
    "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 0 2 2 4-4",
  package: "m12 3 9 5v8l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5m-9 5v8m-4-13 9 5",
  wrench:
    "m14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L15 12l-3-3 2.7-2.7Z",
  "dollar-sign": "M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  "bar-chart": "M4 19V5m0 14h17M8 16v-4m5 4V8m5 8V4",
  wallet: "M3 6h18v14H3zM3 10h18m-5 5h2M7 6V4h10v2",
  "map-pin":
    "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  calendar: "M4 5h16v16H4zM8 3v4m8-4v4M4 10h16m-12 4h2m3 0h2m-7 4h2",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2",
  flag: "M5 21V4m0 1h14l-3 4 3 4H5",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4",
  chevron: "m7 10 5 5 5-5",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M18 6 6 18",
  logout: "M15 12H3m4-4-4 4 4 4m5-13h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5",
  check: "m5 13 4 4L19 7",
  spark: "M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z",
};

function Icon({
  name,
  className,
}: {
  name: IconName | UtilityIcon;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

const NOTIFICATIONS_READ_KEY = "struktura_notifications_read";
const NOTIFICATIONS_POLL_MS = 30_000;

/** Human title for an audit event, e.g. INSERT on users -> "New user created". */
function notificationTitle(item: ApiNotification): string {
  const action = item.action.toLowerCase();
  const table = item.table_name;
  const fields = item.changed_fields.map((field) => field.toLowerCase());

  if (table === "users") {
    if (action === "insert") return "New user created";
    if (action === "update") return "User account updated";
    return "User account deleted";
  }

  if (table === "skill") {
    if (action === "insert") return "New skill added";
    if (action === "update") return "Skill updated";
    return "Skill removed";
  }

  if (table === "projects") {
    if (action === "insert") return "New project created";
    if (action === "delete") return "Project deleted";
    if (fields.some((field) => field.includes("budget"))) {
      return "Project budget updated";
    }
    if (fields.includes("status")) return "Project status updated";
    return "Project updated";
  }

  if (table === "project_phases") {
    if (action === "insert") return "New phase created";
    if (action === "delete") return "Phase removed";
    if (fields.includes("status")) return "Phase status updated";
    return "Phase updated";
  }

  if (table === "labor_hour_log") {
    if (action === "insert") return "Labor hours logged";
    if (action === "delete") return "Labor log voided";
    return "Labor log corrected";
  }

  if (table === "material_usage") {
    if (action === "insert") return "Material usage recorded";
    if (action === "delete") return "Material log voided";
    return "Material log corrected";
  }

  if (table === "equipment_usage") {
    if (action === "insert") return "Equipment usage recorded";
    if (action === "delete") return "Equipment log voided";
    return "Equipment log corrected";
  }

  if (table === "materials") {
    return "Material stock updated";
  }

  if (table === "workforce_assignment") {
    if (action === "insert") return "Worker assigned to a phase";
    if (action === "delete") return "Worker removed from a phase";
    return "Worker assignment updated";
  }

  const label = table.replace(/_/g, " ").replace(/s$/, "");

  if (action === "insert") return `New ${label} added`;
  if (action === "update") return `${label} updated`;
  return `${label} removed`;
}

/** "North Tower Residences · SYS010001 - Jane Cruz" */
function notificationDetail(item: ApiNotification): string {
  return (
    [item.project_name, item.actor].filter(Boolean).join(" \u00b7 ") ||
    item.table_name
  );
}

function timeAgo(value: string | null): string {
  if (!value) return "";

  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.floor((Date.now() - then) / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return new Date(then).toLocaleDateString("en-PH", {
    month: "short",
    day: "2-digit",
  });
}

/** Ids the user has already dismissed ("Mark all as read"). */
function readStoredNotificationIds(): number[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_READ_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((value): value is number => typeof value === "number")
      : [];
  } catch {
    return [];
  }
}

const rolePath: Record<UserRole, string> = {
  SA: "/portal/dashboard/sa",
  PM: "/portal/dashboard/pm",
  SS: "/portal/dashboard/ss",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Manual accordion override: an override is only honoured while the route is
  // unchanged, so the group that owns the current page is always the open one.
  const [groupOverride, setGroupOverride] = useState<{
    id: string | null;
    path: string;
  } | null>(null);
  const [openMenu, setOpenMenu] = useState<"notifications" | "profile" | null>(
    null,
  );
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [notificationsError, setNotificationsError] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<number[]>(
    readStoredNotificationIds,
  );
  const [notificationsRefresh, setNotificationsRefresh] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const token = getToken();
    const storedUser = getStoredUser();

    if (!token || !storedUser || !(storedUser.role in rolePath)) {
      clearSession();
      router.replace("/portal");
      return;
    }

    const roleBase = rolePath[storedUser.role];
    const isAccountRoute =
      pathname === "/portal/dashboard/profile" ||
      pathname === "/portal/dashboard/settings";
    const isRoleRoute =
      pathname === roleBase || pathname.startsWith(`${roleBase}/`);

    if (!isAccountRoute && !isRoleRoute) {
      router.replace(roleBase);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(storedUser);

    // Confirm the token is still valid with the backend; sign out if not.
    let active = true;
    me()
      .then((fresh) => {
        if (!active) return;
        const sessionUser = toSessionUser(fresh);
        if (sessionUser) {
          setUser(sessionUser);
        }
      })
      .catch((err) => {
        if (!active) return;
        // A failed /me only means "signed out" when the server explicitly
        // rejects the token. Network errors (status 0) or 5xx responses are
        // transient and must not wipe a valid session, otherwise a slow or
        // restarting backend bounces the user straight back to the login page.
        console.error("[dashboard] auth check failed", err);
        const rejected =
          err instanceof ApiError && (err.status === 401 || err.status === 403);
        if (rejected) {
          clearSession();
          router.replace("/portal");
        }
      });

    return () => {
      active = false;
    };
  }, [pathname, router]);

  const sidebarData = useMemo(
    () => (user ? getSidebarData(user.role) : []),
    [user],
  );

  // Project scope: the header switcher and the sidebar lock share one store per
  // role. Passing `enabled` keeps the other role's endpoint from being called.
  const ssScope = useSsSite(user?.role === "SS");
  const pmScope = usePmProject(user?.role === "PM");
  const activeProjectId =
    user?.role === "SS" ? ssScope.selectedId : user?.role === "PM" ? pmScope.selectedId : null;
  // Overview stays reachable; every project-scoped page waits for a selection.
  const navLocked =
    (user?.role === "PM" || user?.role === "SS") && activeProjectId === null;

  // Accordion behaviour: only the section that owns the current route is open.
  // Clicking a group stores an override for this path; navigating resets it.
  const activeGroupId = useMemo(() => {
    const groups = sidebarData.flatMap((section: SidebarSection) =>
      section.items.filter(
        (item): item is SidebarGroup => item.type === "group",
      ),
    );
    const activeGroup = groups.find((group) =>
      group.children.some(
        (child) =>
          pathname === child.href || pathname.startsWith(`${child.href}/`),
      ),
    );

    return activeGroup ? activeGroup.id : null;
  }, [pathname, sidebarData]);

  const openGroup =
    groupOverride && groupOverride.path === pathname
      ? groupOverride.id
      : activeGroupId;

  // Close both header dropdowns and the mobile drawer on navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenMenu(null);
    setDrawerOpen(false);
  }, [pathname]);

  // Live notifications (audit_logs): refresh on navigation, whenever the bell is
  // opened, and every 30s while the dashboard stays open.
  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    const load = () => {
      getMyNotifications()
        .then((items) => {
          if (!active) return;

          setNotifications(items);
          setNotificationsError(false);
        })
        .catch(() => {
          if (active) setNotificationsError(true);
        });
    };

    load();
    const timer = window.setInterval(load, NOTIFICATIONS_POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user, pathname, notificationsRefresh]);

  // Dismiss an open dropdown with Escape or a click outside the header.
  useEffect(() => {
    if (!openMenu) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (headerRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  const toggleMenu = (menu: "notifications" | "profile") => {
    setOpenMenu((current) => (current === menu ? null : menu));

    if (menu === "notifications") {
      // Pull fresh entries the moment the panel opens.
      setNotificationsRefresh((current) => current + 1);
    }
  };

  const markAllNotificationsRead = () => {
    const ids = Array.from(
      new Set([...readNotificationIds, ...notifications.map((item) => item.id)]),
    ).slice(-50);

    setReadNotificationIds(ids);
    setOpenMenu(null);

    try {
      window.localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(ids));
    } catch {
      // Storage may be unavailable (private mode); the badge just returns later.
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || user.role === "SS") {
      return;
    }

    const term = searchTerm.trim();
    if (!term) {
      return;
    }

    setDrawerOpen(false);
    router.push(`${roleSearchPath[user.role]}?q=${encodeURIComponent(term)}`);
  };

  const handleLogout = () => {
    // Optimistic sign-out: revoke the token in the background and leave at once
    // so the user never waits on the network.
    setLoggingOut(true);
    clearSession();
    apiLogout().catch(() => undefined);
    router.replace("/portal");
  };

  if (!user) {
    return null;
  }

  const userName = `${user.first_name} ${user.last_name}`.trim();
  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`;

  const isGroupActive = (group: SidebarGroup) =>
    group.children.some(
      (child) =>
        pathname === child.href || pathname.startsWith(`${child.href}/`),
    );

  const unreadCount = notifications.filter(
    (item) => !readNotificationIds.includes(item.id),
  ).length;

  return (
    <div className={styles.pageShell}>
      <header className={styles.header} ref={headerRef}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setDrawerOpen((open) => !open)}
            aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={drawerOpen}
          >
            <Icon name={drawerOpen ? "close" : "menu"} />
          </button>

          <div className={styles.brandWrap}>
            <Image
              src="/assets/banner-white.png?v=2"
              alt="Struktura"
              width={180}
              height={50}
              className={styles.logo}
              unoptimized
              priority
            />
          </div>

          {user.role === "SS" ? (
            /* Supervisors swap sites instead of searching: the switcher drives
               every SS screen. */
            <SsSiteSwitcher />
          ) : user.role === "PM" ? (
            /* Managers swap the active project from the same place. */
            <PmProjectSwitcher />
          ) : (
            <form
              className={styles.searchForm}
              role="search"
              onSubmit={handleSearch}
            >
              <Icon name="search" className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search..."
                aria-label="Search the workspace"
              />
            </form>
          )}
        </div>

        <div className={styles.headerRight}>
          <div className={styles.menuAnchor}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => toggleMenu("notifications")}
              aria-label={
                unreadCount > 0
                  ? `Notifications (${unreadCount} new)`
                  : "Notifications"
              }
              aria-haspopup="menu"
              aria-expanded={openMenu === "notifications"}
            >
              <Icon name="bell" />
              {unreadCount > 0 ? (
                <span className={styles.notificationDot} />
              ) : null}
            </button>

            {openMenu === "notifications" ? (
              <div
                className={`${styles.dropdown} ${styles.notificationPanel}`}
                role="menu"
                aria-label="Notifications"
              >
                <div className={styles.dropdownHead}>
                  <span>Notifications</span>
                  <span className={styles.dropdownCount}>
                    {unreadCount > 0 ? `${unreadCount} new` : "Up to date"}
                  </span>
                </div>

                {notificationsError ? (
                  <p className={styles.notificationEmpty}>
                    Could not load notifications.
                  </p>
                ) : notifications.length === 0 ? (
                  <p className={styles.notificationEmpty}>
                    You&apos;re all caught up!
                  </p>
                ) : (
                  <ul className={styles.notificationList}>
                    {notifications.map((item) => (
                      <li
                        key={item.id}
                        className={
                          readNotificationIds.includes(item.id)
                            ? undefined
                            : styles.notificationUnread
                        }
                      >
                        <span className={styles.notificationIcon}>
                          <Icon name="spark" />
                        </span>
                        <div>
                          <strong>{notificationTitle(item)}</strong>
                          <p>{notificationDetail(item)}</p>
                          <small>{timeAgo(item.created_at)}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  className={styles.dropdownFooter}
                  onClick={markAllNotificationsRead}
                  disabled={unreadCount === 0}
                >
                  {unreadCount > 0 ? "Mark all as read" : "All caught up"}
                </button>
              </div>
            ) : null}
          </div>

          <div className={styles.menuAnchor}>
            <button
              type="button"
              className={styles.profileTrigger}
              onClick={() => toggleMenu("profile")}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={openMenu === "profile"}
            >
              <span className={styles.avatar}>{initials}</span>
              <span className={styles.userText}>
                <strong>{userName || user.user_id}</strong>
                <small>{roleLabels[user.role]}</small>
              </span>
              <Icon name="chevron" className={styles.chevron} />
            </button>

            {openMenu === "profile" ? (
              <div
                className={`${styles.dropdown} ${styles.profilePanel}`}
                role="menu"
                aria-label="Account"
              >
                <div className={styles.profileHead}>
                  <span className={styles.avatarLarge}>{initials}</span>
                  <div>
                    <strong>{userName || user.user_id}</strong>
                    <small>{user.email}</small>
                    <small className={styles.profileMeta}>
                      {roleLabels[user.role]} &middot; {user.user_id}
                    </small>
                  </div>
                </div>
                <div className={styles.dropdownDivider} />
                <Link
                  href="/portal/dashboard/profile"
                  className={styles.dropdownItem}
                  role="menuitem"
                >
                  <Icon name="user" />
                  <span>My Profile</span>
                </Link>
                <Link
                  href="/portal/dashboard/settings"
                  className={styles.dropdownItem}
                  role="menuitem"
                >
                  <Icon name="settings" />
                  <span>Settings</span>
                </Link>
                <div className={styles.dropdownDivider} />
                <button
                  type="button"
                  className={`${styles.dropdownItem} ${styles.dropdownDanger}`}
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <Icon name="logout" />
                  <span>Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <aside
        className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`}
      >
        <nav className={styles.nav} aria-label="Dashboard navigation">
          {sidebarData.map((section) => (
            <section className={styles.navSectionGroup} key={section.label}>
              <p className={styles.navSection}>{section.label}</p>
              {section.items.map((item) => {
                if (item.type === "link") {
                  const isActive = pathname === item.href;
                  const isLocked = navLocked && item.href !== rolePath[user.role];

                  if (isLocked) {
                    return (
                      <span
                        key={item.href}
                        className={`${styles.navItem} ${styles.navItemLocked}`}
                        aria-disabled="true"
                        tabIndex={-1}
                        data-tooltip="Select a project first"
                      >
                        <Icon name={item.icon} className={styles.navIcon} />
                        <span>{item.label}</span>
                      </span>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={
                        isActive
                          ? `${styles.navItem} ${styles.navItemActive}`
                          : styles.navItem
                      }
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon name={item.icon} className={styles.navIcon} />
                      <span>{item.label}</span>
                    </Link>
                  );
                }

                const expanded = openGroup === item.id;
                const groupActive = isGroupActive(item);

                if (navLocked) {
                  return (
                    <div className={styles.navGroup} key={item.id}>
                      <span
                        className={`${styles.navItem} ${styles.navItemLocked}`}
                        aria-disabled="true"
                        tabIndex={-1}
                        data-tooltip="Select a project first"
                      >
                        <Icon name={item.icon} className={styles.navIcon} />
                        <span>{item.label}</span>
                        <Icon name="chevron" className={styles.groupChevron} />
                      </span>
                    </div>
                  );
                }

                return (
                  <div className={styles.navGroup} key={item.id}>
                    <button
                      type="button"
                      className={`${styles.navItem} ${styles.groupToggle}${
                        groupActive ? ` ${styles.groupToggleActive}` : ""
                      }`}
                      onClick={() =>
                        setGroupOverride((current) => ({
                          id:
                            current?.id === item.id && current.path === pathname
                              ? null
                              : item.id,
                          path: pathname,
                        }))
                      }
                      aria-expanded={expanded}
                      aria-controls={`sidebar-group-${item.id}`}
                    >
                      <Icon name={item.icon} className={styles.navIcon} />
                      <span>{item.label}</span>
                      <Icon
                        name="chevron"
                        className={
                          expanded
                            ? `${styles.groupChevron} ${styles.groupChevronOpen}`
                            : styles.groupChevron
                        }
                      />
                    </button>

                    {expanded ? (
                      <div
                        className={styles.navChildren}
                        id={`sidebar-group-${item.id}`}
                      >
                        {item.children.map((child) => {
                          const childActive = pathname === child.href;

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setDrawerOpen(false)}
                              className={
                                childActive
                                  ? `${styles.navChild} ${styles.navChildActive}`
                                  : styles.navChild
                              }
                              aria-current={childActive ? "page" : undefined}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>

      {drawerOpen ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <main className={styles.mainContent}>{children}</main>

      {loggingOut ? (
        <div className={styles.logoutOverlay} role="status" aria-live="assertive">
          <div className={styles.logoutCard}>
            <span className={styles.logoutSpinner} aria-hidden="true" />
            <p className={styles.logoutText}>Logging you out...</p>
            <p className={styles.logoutHint}>Ending your session safely.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}



