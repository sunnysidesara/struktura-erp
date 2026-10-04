"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type UserInfo = {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
};

type Project = {
  name: string;
  location: string;
  phase: string;
  progress: number;
  workers: number;
  budget: string;
  used: number;
  status: "On Track" | "Delayed" | "Completed";
};

type Worker = {
  name: string;
  skill: string;
  project: string;
};

type MaterialItem = {
  item: string;
  type: string;
  quantity: string;
  status: string;
  project: string;
};

// Replace these local fixtures with role-scoped project and finance API calls later.
// Project Managers can view project budgets; user administration and audit data stay in the SA dashboard.
const projects: Project[] = [
  {
    name: "Bridge Rehabilitation — Phase 2",
    location: "Quezon City",
    phase: "Started Sep 15, 2026",
    progress: 60,
    workers: 12,
    budget: "₱1,200,000 / ₱2,000,000",
    used: 68,
    status: "On Track",
  },
  {
    name: "North Tower Residences",
    location: "Cebu City",
    phase: "Started Aug 02, 2026",
    progress: 48,
    workers: 18,
    budget: "₱1,800,000 / ₱3,500,000",
    used: 52,
    status: "Delayed",
  },
  {
    name: "Harbor Logistics Hub",
    location: "Iloilo",
    phase: "Started Jul 12, 2026",
    progress: 82,
    workers: 21,
    budget: "₱2,400,000 / ₱3,000,000",
    used: 79,
    status: "On Track",
  },
];

const availableWorkers: Worker[] = [
  {
    name: "Arnel Flores",
    skill: "Carpenter",
    project: "Bridge Rehabilitation — Phase 2",
  },
  {
    name: "Dianne Cruz",
    skill: "Site Engineer",
    project: "Bridge Rehabilitation — Phase 2",
  },
  {
    name: "Julius Balis",
    skill: "Steel Foreman",
    project: "North Tower Residences",
  },
  {
    name: "Mia Ventura",
    skill: "Concrete Crew",
    project: "Harbor Logistics Hub",
  },
  {
    name: "Rico Duma",
    skill: "Equipment Operator",
    project: "Bridge Rehabilitation — Phase 2",
  },
];

const assignedWorkers: Worker[] = [
  {
    name: "Rene Dela Vega",
    skill: "Mason",
    project: "Bridge Rehabilitation — Phase 2",
  },
  {
    name: "Cesar Mendez",
    skill: "Surveyor",
    project: "Bridge Rehabilitation — Phase 2",
  },
  {
    name: "Rhea Lim",
    skill: "Project Engineer",
    project: "Bridge Rehabilitation — Phase 2",
  },
  { name: "Milo Torres", skill: "Carpenter", project: "Harbor Logistics Hub" },
];

const materials: MaterialItem[] = [
  {
    item: "Cement",
    type: "Material",
    quantity: "120 bags",
    status: "Available",
    project: "Bridge Rehabilitation — Phase 2",
  },
  {
    item: "Steel Bars",
    type: "Material",
    quantity: "540 pcs",
    status: "Low stock",
    project: "North Tower Residences",
  },
  {
    item: "Gravel",
    type: "Material",
    quantity: "16 tons",
    status: "Available",
    project: "Bridge Rehabilitation — Phase 2",
  },
  {
    item: "Plywood",
    type: "Material",
    quantity: "90 sheets",
    status: "Available",
    project: "Harbor Logistics Hub",
  },
  {
    item: "Sand",
    type: "Material",
    quantity: "8 cu.m.",
    status: "Available",
    project: "Bridge Rehabilitation — Phase 2",
  },
  {
    item: "Concrete Mixer",
    type: "Equipment",
    quantity: "2 units",
    status: "In use",
    project: "Harbor Logistics Hub",
  },
];

const recentCosts = [
  {
    item: "Labor Payroll",
    amount: "₱ 180,000",
    date: "2026-10-03",
    project: "Bridge Rehabilitation — Phase 2",
  },
  {
    item: "Steel Delivery",
    amount: "₱ 112,500",
    date: "2026-10-02",
    project: "North Tower Residences",
  },
  {
    item: "Equipment Rental",
    amount: "₱ 68,900",
    date: "2026-10-01",
    project: "Harbor Logistics Hub",
  },
  {
    item: "Cement Supply",
    amount: "₱ 95,200",
    date: "2026-09-30",
    project: "Bridge Rehabilitation — Phase 2",
  },
];

export default function ProjectManagerDashboard() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"materials" | "equipment">(
    "materials",
  );

  useEffect(() => {
    const storedUser = localStorage.getItem("struktura_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser) as UserInfo);
    }
  }, []);

  const materialRows = useMemo(
    () => materials.filter((row) => row.type === "Material"),
    [],
  );

  const equipmentRows = useMemo(
    () => materials.filter((row) => row.type === "Equipment"),
    [],
  );

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.heroRow}>
          <div>
            <p className={styles.kicker}>Project Workspace</p>
            <h1 className={styles.title}>Project Overview</h1>
            <p className={styles.subtitle}>
              Manage your projects and workforce
            </p>
          </div>
          <button type="button" className={styles.primaryButton}>
            + New Project
          </button>
        </header>

        <section className={styles.metricGrid} id="overview">
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>My Projects</span>
            <strong className={styles.metricValue}>3</strong>
            <small className={styles.metricNote}>2 on track</small>
          </article>

          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Assigned Workers</span>
            <strong className={styles.metricValue}>28</strong>
            <small className={styles.metricNote}>Across active sites</small>
          </article>

          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Total Budget</span>
            <strong className={styles.metricValue}>₱ 7.4M</strong>
            <small className={styles.metricNote}>68% utilized</small>
          </article>

          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Open Tasks</span>
            <strong className={styles.metricValue}>12</strong>
            <small className={styles.metricNote}>Needs action</small>
          </article>
        </section>

        <section className={styles.analyticsGrid} id="project-progress">
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>Project Progress (By Month)</span>
            </div>
            <div
              className={styles.monthChart}
              role="img"
              aria-label="Mock project progress by month"
            >
              {[42, 57, 49, 68, 61, 78, 71, 88, 76, 95, 82, 100].map(
                (height, index) => (
                  <div key={index}>
                    <span style={{ height: `${height}%` }} />
                    <small>
                      {
                        [
                          "Nov",
                          "Dec",
                          "Jan",
                          "Feb",
                          "Mar",
                          "Apr",
                          "May",
                          "Jun",
                          "Jul",
                          "Aug",
                          "Sep",
                          "Oct",
                        ][index]
                      }
                    </small>
                  </div>
                ),
              )}
            </div>
          </article>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>Budget Allocation</span>
            </div>
            <div className={styles.allocationSummary}>
              <span>Total Project Budget</span>
              <strong>₱7.4M</strong>
            </div>
            <div
              className={styles.allocationChart}
              role="img"
              aria-label="Mock budget allocation across three projects"
            >
              <span className={styles.allocationOne} style={{ width: "27%" }} />
              <span className={styles.allocationTwo} style={{ width: "47%" }} />
              <span
                className={styles.allocationThree}
                style={{ width: "26%" }}
              />
            </div>
            <ul className={styles.allocationLegend}>
              <li>
                <i className={styles.allocationOne} /> Bridge Rehabilitation{" "}
                <strong>27%</strong>
              </li>
              <li>
                <i className={styles.allocationTwo} /> North Tower{" "}
                <strong>47%</strong>
              </li>
              <li>
                <i className={styles.allocationThree} /> Harbor Logistics{" "}
                <strong>26%</strong>
              </li>
            </ul>
          </article>
        </section>

        <section className={styles.panel} id="my-projects">
          <div className={styles.panelHeader}>
            <span>My Projects</span>
          </div>
          <div className={styles.projectList}>
            {projects.map((project) => (
              <article className={styles.projectCard} key={project.name}>
                <div className={styles.projectInfo}>
                  <h3>{project.name}</h3>
                  <span>
                    {project.location} · {project.phase}
                  </span>
                </div>

                <div className={styles.progressCol}>
                  <div className={styles.progressBar}>
                    <span style={{ width: `${project.progress}%` }} />
                  </div>
                  <small>{project.progress}%</small>
                </div>

                <div className={styles.metaCol}>
                  <span>
                    Workers: {project.workers} · Budget: {project.budget}
                  </span>
                  <span
                    className={
                      project.status === "On Track"
                        ? styles.statusOnTrack
                        : project.status === "Delayed"
                          ? styles.statusWarning
                          : styles.statusCompleted
                    }
                  >
                    {project.status}
                  </span>
                </div>
                <div className={styles.projectActions}>
                  <button type="button">View Details</button>
                  <button type="button">Assign Workers</button>
                  <button type="button">Edit</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.twoCol} id="workforce">
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>Workforce Assignment</span>
            </div>
            <ul className={styles.list}>
              {availableWorkers.map((worker) => (
                <li key={worker.name} className={styles.listRow}>
                  <div>
                    <strong>{worker.name}</strong>
                    <small>{worker.skill}</small>
                  </div>
                  <button type="button" className={styles.assignButton}>
                    Assign
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>Assigned Workers</span>
            </div>
            <ul className={styles.list}>
              {assignedWorkers.map((worker) => (
                <li key={worker.name} className={styles.listRow}>
                  <div>
                    <strong>{worker.name}</strong>
                    <small>{worker.skill}</small>
                  </div>
                  <span className={styles.tag}>{worker.project}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.panel} id="resources">
          <div className={styles.panelHeader}>
            <span>Materials & Equipment</span>
            <div className={styles.tabGroup}>
              <button
                type="button"
                className={
                  activeTab === "materials"
                    ? styles.tabActive
                    : styles.tabButton
                }
                onClick={() => setActiveTab("materials")}
              >
                Materials
              </button>
              <button
                type="button"
                className={
                  activeTab === "equipment"
                    ? styles.tabActive
                    : styles.tabButton
                }
                onClick={() => setActiveTab("equipment")}
              >
                Equipment
              </button>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Project</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === "materials" ? materialRows : equipmentRows).map(
                  (row) => (
                    <tr key={`${row.item}-${row.project}`}>
                      <td>{row.item}</td>
                      <td>{row.type}</td>
                      <td>{row.quantity}</td>
                      <td>
                        <span
                          className={
                            row.status === "Available"
                              ? styles.statusOnTrack
                              : styles.statusWarning
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{row.project}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel} id="cost-tracking">
          <div className={styles.panelHeader}>
            <span>Cost Tracking</span>
          </div>
          <div className={styles.utilizationList}>
            {projects.map((project) => (
              <div key={project.name} className={styles.utilRow}>
                <div className={styles.utilMeta}>
                  <strong>{project.name}</strong>
                  <span>{project.used}% used</span>
                </div>
                <div className={styles.utilTrack}>
                  <span
                    className={
                      project.used >= 90
                        ? styles.utilHigh
                        : project.used >= 60
                          ? styles.utilMedium
                          : styles.utilLow
                    }
                    style={{ width: `${project.used}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Project</th>
                </tr>
              </thead>
              <tbody>
                {recentCosts.map((row) => (
                  <tr key={`${row.item}-${row.date}`}>
                    <td>{row.item}</td>
                    <td>{row.amount}</td>
                    <td>{row.date}</td>
                    <td>{row.project}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
