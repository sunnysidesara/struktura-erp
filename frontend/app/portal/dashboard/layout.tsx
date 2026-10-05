"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import styles from "./layout.module.css";
import {
  getSidebarData,
  type IconName,
  type SidebarGroup,
  type SidebarSection,
} from "./sidebarData";

type UserRole = "SA" | "PM" | "SS";

type LoggedUser = {
  user_id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
};

const roleLabels: Record<UserRole, string> = {
  SA: "System Administrator",
  PM: "Project Manager",
  SS: "Site Supervisor",
};

type UtilityIcon = "bell" | "chevron" | "menu" | "close";

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

const rolePath: Record<UserRole, string> = {
  SA: "/portal/dashboard/sa",
  PM: "/portal/dashboard/pm",
  SS: "/portal/dashboard/ss",
};

const previewUsers: Record<UserRole, LoggedUser> = {
  SA: {
    user_id: "SA101",
    first_name: "Juan",
    last_name: "Dela Cruz",
    role: "SA",
  },
  PM: {
    user_id: "PM101",
    first_name: "Maria",
    last_name: "Santos",
    role: "PM",
  },
  SS: {
    user_id: "SS101",
    first_name: "Pedro",
    last_name: "Reyes",
    role: "SS",
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const previewRole = (Object.keys(rolePath) as UserRole[]).find(
        (role) =>
          pathname === rolePath[role] ||
          pathname.startsWith(`${rolePath[role]}/`),
      );

      if (previewRole) {
        const previewUser = previewUsers[previewRole];
        localStorage.setItem(
          "struktura_token",
          `preview-token-${previewUser.user_id}`,
        );
        localStorage.setItem(
          "struktura_user",
          JSON.stringify(previewUser),
        );
        setUser(previewUser);
        return;
      }
    }

    const token = localStorage.getItem("struktura_token");
    const storedUser = localStorage.getItem("struktura_user");

    if (!token || !storedUser) {
      router.replace("/portal");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as LoggedUser;
      if (!(parsedUser.role in rolePath)) {
        throw new Error("Invalid role");
      }

      const isAccountRoute =
        pathname === "/portal/dashboard/profile" ||
        pathname === "/portal/dashboard/settings";
      const roleBase = rolePath[parsedUser.role];
      const isRoleRoute =
        pathname === roleBase || pathname.startsWith(`${roleBase}/`);

      if (!isAccountRoute && !isRoleRoute) {
        router.replace(rolePath[parsedUser.role]);
        return;
      }

      setUser(parsedUser);
    } catch {
      localStorage.removeItem("struktura_token");
      localStorage.removeItem("struktura_user");
      router.replace("/portal");
    }
  }, [pathname, router]);

  const sidebarData = useMemo(
    () => (user ? getSidebarData(user.role) : []),
    [user],
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    const groups = sidebarData.flatMap((section: SidebarSection) =>
      section.items.filter(
        (item): item is SidebarGroup => item.type === "group",
      ),
    );
    const activeGroupIds = groups
      .filter((group) =>
        group.children.some(
          (child) =>
            pathname === child.href || pathname.startsWith(`${child.href}/`),
        ),
      )
      .map((group) => group.id);

    setExpandedGroups((current) => {
      const next = new Set(current);
      activeGroupIds.forEach((id) => next.add(id));
      return next;
    });
  }, [pathname, sidebarData, user]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("struktura_token");
    localStorage.removeItem("struktura_user");
    router.push("/portal");
  };

  if (!user) {
    return null;
  }

  const userName = `${user.first_name} ${user.last_name}`.trim();
  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`;

  return (
    <div className={styles.pageShell}>
      <header className={styles.header}>
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

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.notificationButton}
            aria-label="Notifications"
          >
            <Icon name="bell" />
            <span className={styles.notificationDot} />
          </button>
          <div className={styles.userBadge}>
            <Link
              href="/portal/dashboard/profile"
              className={styles.avatarLink}
              aria-label={`View profile for ${userName || user.user_id}`}
            >
              <span className={styles.avatar}>{initials}</span>
            </Link>
            <span className={styles.userText}>
              <strong>{userName || user.user_id}</strong>
              <small>{roleLabels[user.role]}</small>
            </span>
            <Icon name="chevron" className={styles.chevron} />
          </div>
          <button
            type="button"
            className={styles.logoutButton}
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <aside
        className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`}
      >
        <nav className={styles.nav} aria-label="Dashboard navigation">
          {sidebarData.map((section) => (
            <section className={styles.navSectionGroup} key={section.label}>
              <p className={styles.navSection}>{section.label}</p>
              {section.items.map((item) =>
                item.type === "link" ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={
                      pathname === item.href
                        ? `${styles.navItem} ${styles.navItemActive}`
                        : styles.navItem
                    }
                  >
                    <Icon name={item.icon} className={styles.navIcon} />
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <div className={styles.navGroup} key={item.id}>
                    <button
                      type="button"
                      className={`${styles.navItem} ${styles.groupToggle}`}
                      onClick={() => toggleGroup(item.id)}
                      aria-expanded={expandedGroups.has(item.id)}
                      aria-controls={`sidebar-group-${item.id}`}
                    >
                      <Icon name={item.icon} className={styles.navIcon} />
                      <span>{item.label}</span>
                      <Icon
                        name="chevron"
                        className={
                          expandedGroups.has(item.id)
                            ? `${styles.groupChevron} ${styles.groupChevronOpen}`
                            : styles.groupChevron
                        }
                      />
                    </button>
                    {expandedGroups.has(item.id) ? (
                      <div
                        className={styles.navChildren}
                        id={`sidebar-group-${item.id}`}
                      >
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setDrawerOpen(false)}
                            className={
                              pathname === child.href
                                ? `${styles.navChild} ${styles.navChildActive}`
                                : styles.navChild
                            }
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ),
              )}
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
    </div>
  );
}
