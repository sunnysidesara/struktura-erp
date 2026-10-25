// Sidebar navigation data. Search and account links live in the dashboard header,
// so each role only lists its workspace sections here.
//
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
        type: "group",
        icon: "users",
        label: "Users",
        id: "users",
        children: [
          { label: "Directory", href: "/portal/dashboard/sa/users" },
          { label: "Roles", href: "/portal/dashboard/sa/users/roles" },
        ],
      },
      {
        type: "link",
        icon: "sparkles",
        label: "Skills",
        href: "/portal/dashboard/sa/skills",
      },
      {
        type: "link",
        icon: "file-text",
        label: "Audit Logs",
        href: "/portal/dashboard/sa/audit",
      },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      {
        type: "link",
        icon: "folder",
        label: "Projects",
        href: "/portal/dashboard/sa/projects",
      },
      {
        type: "link",
        icon: "dollar-sign",
        label: "Finance",
        href: "/portal/dashboard/sa/finance",
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
      {
        type: "link",
        icon: "bar-chart",
        label: "Usage",
        href: "/portal/dashboard/sa/usage",
      },
      {
        type: "link",
        icon: "clock",
        label: "Labor Logs",
        href: "/portal/dashboard/sa/labor-logs",
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
        icon: "folder",
        label: "Project",
        href: "/portal/dashboard/pm/projects",
      },
      {
        type: "link",
        icon: "list",
        label: "Phases",
        href: "/portal/dashboard/pm/phases",
      },
      {
        type: "link",
        icon: "users",
        label: "Workforce",
        href: "/portal/dashboard/pm/workforce",
      },
      {
        type: "link",
        icon: "user-check",
        label: "Supervisors",
        href: "/portal/dashboard/pm/supervisors",
      },
      {
        type: "link",
        icon: "dollar-sign",
        label: "Finance",
        href: "/portal/dashboard/pm/finance",
      },
      {
        type: "link",
        icon: "check-square",
        label: "Assignments",
        href: "/portal/dashboard/pm/assignments",
      },
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
        icon: "map-pin",
        label: "Current Site Details",
        href: "/portal/dashboard/ss/site",
      },
      {
        type: "link",
        icon: "users",
        label: "Workers",
        href: "/portal/dashboard/ss/workers",
      },
      {
        type: "link",
        icon: "calendar",
        label: "Schedule",
        href: "/portal/dashboard/ss/schedule",
      },
      {
        type: "link",
        icon: "flag",
        label: "Phases",
        href: "/portal/dashboard/ss/phases",
      },
      {
        type: "group",
        icon: "clock",
        label: "Logs",
        id: "ss-logs",
        children: [
          { label: "Workers Log", href: "/portal/dashboard/ss/logs/workers" },
          { label: "Materials Log", href: "/portal/dashboard/ss/logs/materials" },
          { label: "Equipment Log", href: "/portal/dashboard/ss/logs/equipment" },
        ],
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


