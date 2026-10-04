// Add a link to a section's items, or add a group with a unique id and child routes.
// Add a role by defining its sections below and including it in getSidebarData's role union.

export type IconName =
  | "home"
  | "search"
  | "user"
  | "users"
  | "sparkles"
  | "file-text"
  | "folder"
  | "list"
  | "check-square"
  | "book"
  | "database"
  | "settings"
  | "briefcase"
  | "layers"
  | "user-check"
  | "package"
  | "wrench"
  | "dollar-sign"
  | "bar-chart"
  | "wallet"
  | "map-pin"
  | "calendar"
  | "clock"
  | "flag";

export type SidebarLink = {
  type: "link";
  icon: IconName;
  label: string;
  href: string;
};

export type SidebarGroup = {
  type: "group";
  icon: IconName;
  label: string;
  id: string;
  children: {
    label: string;
    href: string;
  }[];
};

export type SidebarItem = SidebarLink | SidebarGroup;

export type SidebarSection = {
  label: string;
  items: SidebarItem[];
};

const saSidebar: SidebarSection[] = [
  {
    label: "MAIN MENU",
    items: [
      {
        type: "link",
        icon: "home",
        label: "Overview",
        href: "/portal/dashboard/sa",
      },
      {
        type: "link",
        icon: "search",
        label: "Search",
        href: "/portal/dashboard/sa/search",
      },
      {
        type: "group",
        icon: "users",
        label: "Users",
        id: "users",
        children: [
          { label: "All Users", href: "/portal/dashboard/sa/users" },
          { label: "Create User", href: "/portal/dashboard/sa/users/create" },
          { label: "Roles & Access", href: "/portal/dashboard/sa/users/roles" },
        ],
      },
      {
        type: "group",
        icon: "sparkles",
        label: "Skills",
        id: "skills",
        children: [
          { label: "Skill List", href: "/portal/dashboard/sa/skills" },
          {
            label: "Categories",
            href: "/portal/dashboard/sa/skills/categories",
          },
        ],
      },
      {
        type: "group",
        icon: "file-text",
        label: "Audit Logs",
        id: "audit-logs",
        children: [
          { label: "System Events", href: "/portal/dashboard/sa/audit/events" },
          { label: "Login History", href: "/portal/dashboard/sa/audit/logins" },
          { label: "DB Performance", href: "/portal/dashboard/sa/audit/db" },
        ],
      },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      {
        type: "link",
        icon: "folder",
        label: "All Projects",
        href: "/portal/dashboard/sa/projects",
      },
      {
        type: "link",
        icon: "list",
        label: "Phases",
        href: "/portal/dashboard/sa/phases",
      },
      {
        type: "link",
        icon: "check-square",
        label: "Assignments",
        href: "/portal/dashboard/sa/assignments",
      },
      {
        type: "link",
        icon: "book",
        label: "Resources",
        href: "/portal/dashboard/sa/resources",
      },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      {
        type: "link",
        icon: "database",
        label: "Database",
        href: "/portal/dashboard/sa/database",
      },
      {
        type: "link",
        icon: "settings",
        label: "System Configuration",
        href: "/portal/dashboard/sa/settings",
      },
    ],
  },
  {
    label: "MY ACCOUNT",
    items: [
      {
        type: "link",
        icon: "user",
        label: "My Profile",
        href: "/portal/dashboard/profile",
      },
      {
        type: "link",
        icon: "settings",
        label: "Settings",
        href: "/portal/dashboard/settings",
      },
    ],
  },
];

const pmSidebar: SidebarSection[] = [
  {
    label: "MAIN MENU",
    items: [
      {
        type: "link",
        icon: "home",
        label: "Overview",
        href: "/portal/dashboard/pm",
      },
      {
        type: "link",
        icon: "search",
        label: "Search",
        href: "/portal/dashboard/pm/search",
      },
      {
        type: "group",
        icon: "folder",
        label: "My Projects",
        id: "my-projects",
        children: [
          { label: "Active", href: "/portal/dashboard/pm/projects/active" },
          {
            label: "Completed",
            href: "/portal/dashboard/pm/projects/completed",
          },
          { label: "All Projects", href: "/portal/dashboard/pm/projects" },
        ],
      },
      {
        type: "group",
        icon: "list",
        label: "Project Phases",
        id: "phases",
        children: [
          { label: "Define Phase", href: "/portal/dashboard/pm/phases/define" },
          { label: "Timelines", href: "/portal/dashboard/pm/phases/timelines" },
          { label: "All Phases", href: "/portal/dashboard/pm/phases" },
        ],
      },
      {
        type: "group",
        icon: "user-check",
        label: "Workforce",
        id: "workforce",
        children: [
          {
            label: "Available",
            href: "/portal/dashboard/pm/workforce/available",
          },
          {
            label: "Assigned",
            href: "/portal/dashboard/pm/workforce/assigned",
          },
          {
            label: "Skill Match",
            href: "/portal/dashboard/pm/workforce/skill-match",
          },
        ],
      },
    ],
  },
  {
    label: "RESOURCES",
    items: [
      {
        type: "link",
        icon: "package",
        label: "Materials",
        href: "/portal/dashboard/pm/materials",
      },
      {
        type: "link",
        icon: "wrench",
        label: "Equipment",
        href: "/portal/dashboard/pm/equipment",
      },
      {
        type: "link",
        icon: "check-square",
        label: "Assignments",
        href: "/portal/dashboard/pm/assignments",
      },
    ],
  },
  {
    label: "FINANCE",
    items: [
      {
        type: "link",
        icon: "dollar-sign",
        label: "Budgets",
        href: "/portal/dashboard/pm/budgets",
      },
      {
        type: "link",
        icon: "bar-chart",
        label: "Cost Reports",
        href: "/portal/dashboard/pm/cost-reports",
      },
      {
        type: "link",
        icon: "wallet",
        label: "Remaining Balance",
        href: "/portal/dashboard/pm/balance",
      },
    ],
  },
  {
    label: "MY ACCOUNT",
    items: [
      {
        type: "link",
        icon: "user",
        label: "My Profile",
        href: "/portal/dashboard/profile",
      },
      {
        type: "link",
        icon: "settings",
        label: "Settings",
        href: "/portal/dashboard/settings",
      },
    ],
  },
];

const ssSidebar: SidebarSection[] = [
  {
    label: "MAIN MENU",
    items: [
      {
        type: "link",
        icon: "home",
        label: "Overview",
        href: "/portal/dashboard/ss",
      },
      {
        type: "link",
        icon: "search",
        label: "Search",
        href: "/portal/dashboard/ss/search",
      },
      {
        type: "group",
        icon: "map-pin",
        label: "My Site",
        id: "my-site",
        children: [
          { label: "Overview", href: "/portal/dashboard/ss/site" },
          { label: "Site Info", href: "/portal/dashboard/ss/site/info" },
          { label: "Map", href: "/portal/dashboard/ss/site/map" },
        ],
      },
      {
        type: "group",
        icon: "calendar",
        label: "Schedule",
        id: "schedule",
        children: [
          { label: "Today", href: "/portal/dashboard/ss/schedule/today" },
          { label: "This Week", href: "/portal/dashboard/ss/schedule/week" },
          { label: "All Tasks", href: "/portal/dashboard/ss/schedule/all" },
        ],
      },
    ],
  },
  {
    label: "DAILY LOGS",
    items: [
      {
        type: "link",
        icon: "clock",
        label: "Log Labor Hours",
        href: "/portal/dashboard/ss/log-hours",
      },
      {
        type: "link",
        icon: "package",
        label: "Materials Used",
        href: "/portal/dashboard/ss/materials",
      },
      {
        type: "link",
        icon: "wrench",
        label: "Equipment Used",
        href: "/portal/dashboard/ss/equipment",
      },
    ],
  },
  {
    label: "VIEW ONLY",
    items: [
      {
        type: "link",
        icon: "users",
        label: "Worker Roster",
        href: "/portal/dashboard/ss/workers",
      },
      {
        type: "link",
        icon: "flag",
        label: "Active Phases",
        href: "/portal/dashboard/ss/phases",
      },
    ],
  },
  {
    label: "MY ACCOUNT",
    items: [
      {
        type: "link",
        icon: "user",
        label: "My Profile",
        href: "/portal/dashboard/profile",
      },
      {
        type: "link",
        icon: "settings",
        label: "Settings",
        href: "/portal/dashboard/settings",
      },
    ],
  },
];

export function getSidebarData(role: "SA" | "PM" | "SS"): SidebarSection[] {
  switch (role) {
    case "SA":
      return saSidebar;
    case "PM":
      return pmSidebar;
    case "SS":
      return ssSidebar;
    default:
      return [];
  }
}
