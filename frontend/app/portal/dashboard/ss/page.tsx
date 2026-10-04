"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

type UserInfo = {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
};

type Worker = { name: string; skill: string };
type Phase = { phase: string; completion: number; current: boolean };

// Replace these mock site records with site-scoped API responses later.
// Supervisors have no wage, budget, or financial fields in this view by design.
const workers: Worker[] = [
  { name: "Rene Dela Vega", skill: "Carpenter" },
  { name: "Carlito Mendez", skill: "Mason" },
  { name: "Marielle Ramos", skill: "Surveyor" },
  { name: "Victor Ocampo", skill: "Concrete Crew" },
  { name: "Anya Santos", skill: "Safety Officer" },
];

const phases: Phase[] = [
  { phase: "Phase 1 — Excavation", completion: 100, current: false },
  { phase: "Phase 2 — Foundation Works", completion: 86, current: false },
  {
    phase: "Phase 3 — Structural Reinforcement",
    completion: 68,
    current: true,
  },
  { phase: "Phase 4 — Finishing", completion: 34, current: false },
];

const recentSubmissions = [
  {
    date: "2026-10-03",
    labor: "24 hrs",
    materials: "32 units",
    equipment: "4 hrs",
    status: "Submitted",
  },
  {
    date: "2026-10-02",
    labor: "22 hrs",
    materials: "28 units",
    equipment: "5 hrs",
    status: "Submitted",
  },
  {
    date: "2026-10-01",
    labor: "20 hrs",
    materials: "18 units",
    equipment: "3 hrs",
    status: "Pending Approval",
  },
  {
    date: "2026-09-30",
    labor: "21 hrs",
    materials: "24 units",
    equipment: "4 hrs",
    status: "Submitted",
  },
  {
    date: "2026-09-29",
    labor: "19 hrs",
    materials: "20 units",
    equipment: "3 hrs",
    status: "Submitted",
  },
  {
    date: "2026-09-28",
    labor: "18 hrs",
    materials: "22 units",
    equipment: "4 hrs",
    status: "Submitted",
  },
];

export default function SiteSupervisorDashboard() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("struktura_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser) as UserInfo);
    }
  }, []);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.heroRow}>
          <div>
            <h1 className={styles.title}>Site Dashboard</h1>
            <p className={styles.subtitle}>Record and submit daily site data</p>
          </div>
        </header>

        <aside className={styles.siteBanner} id="my-site">
          <div>
            <div className={styles.bannerLabel}>Assigned Site</div>
            <div className={styles.bannerTitle}>
              Bridge Rehabilitation — Phase 2
            </div>
            <div className={styles.bannerMeta}>
              Quezon City · Phase 2 of 4 · Supervisor: SS101
            </div>
          </div>
        </aside>

        <section className={styles.metricGrid} id="overview">
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>My Workers Today</span>
            <strong className={styles.metricValue}>12</strong>
            <small className={styles.metricNote}>Assigned to this site</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Hours Logged Today</span>
            <strong className={styles.metricValue}>21.5</strong>
            <small className={styles.metricNote}>Across 3 workers</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Materials Used Today</span>
            <strong className={styles.metricValue}>32</strong>
            <small className={styles.metricNote}>Recorded units</small>
          </article>
        </section>

        <section className={styles.panel} id="daily-record">
          <div className={styles.panelHeader}>
            <span>Record Today&apos;s Data</span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Date</label>
            <input
              type="date"
              defaultValue={today}
              className={styles.dateInput}
              max={today}
            />
          </div>

          <div className={styles.sectionBlock}>
            <h3>Labor Hours</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Worker Name</th>
                    <th>Hours</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Rene Dela Vega</td>
                    <td>
                      <input defaultValue="8" />
                    </td>
                    <td>
                      <button type="button" className={styles.removeButton}>
                        Remove
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>Carlito Mendez</td>
                    <td>
                      <input defaultValue="7.5" />
                    </td>
                    <td>
                      <button type="button" className={styles.removeButton}>
                        Remove
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>Marielle Ramos</td>
                    <td>
                      <input defaultValue="6" />
                    </td>
                    <td>
                      <button type="button" className={styles.removeButton}>
                        Remove
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" className={styles.linkButton}>
              + Add Worker
            </button>
            <div className={styles.grandTotal}>
              Total hours logged: 21.5 hrs
            </div>
          </div>

          <div className={styles.sectionBlock}>
            <h3>Materials Used</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Notes</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <select defaultValue="cement">
                        <option value="cement">Cement</option>
                        <option value="steel">Steel Bars</option>
                        <option value="sand">Sand</option>
                      </select>
                    </td>
                    <td>
                      <input defaultValue="20" />
                    </td>
                    <td>
                      <input defaultValue="bags" />
                    </td>
                    <td>
                      <input defaultValue="Used for slab" />
                    </td>
                    <td>
                      <button type="button" className={styles.removeButton}>
                        Remove
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <select defaultValue="gravel">
                        <option value="gravel">Gravel</option>
                        <option value="cement">Cement</option>
                        <option value="steel">Steel Bars</option>
                      </select>
                    </td>
                    <td>
                      <input defaultValue="12" />
                    </td>
                    <td>
                      <input defaultValue="tons" />
                    </td>
                    <td>
                      <input defaultValue="Backfill" />
                    </td>
                    <td>
                      <button type="button" className={styles.removeButton}>
                        Remove
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" className={styles.linkButton}>
              + Add Material
            </button>
          </div>

          <div className={styles.sectionBlock}>
            <h3>Equipment Used</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Equipment</th>
                    <th>Hours Used</th>
                    <th>Notes</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <select defaultValue="excavator">
                        <option value="excavator">Excavator</option>
                        <option value="bulldozer">Bulldozer</option>
                        <option value="loader">Loader</option>
                      </select>
                    </td>
                    <td>
                      <input defaultValue="4" />
                    </td>
                    <td>
                      <input defaultValue="Used trenching" />
                    </td>
                    <td>
                      <button type="button" className={styles.removeButton}>
                        Remove
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" className={styles.linkButton}>
              + Add Equipment
            </button>
          </div>

          <button
            type="button"
            className={styles.submitButton}
            onClick={() => setSubmitted(true)}
          >
            Submit Daily Record
          </button>
          {submitted ? (
            <div className={styles.successPanel}>
              ✓ Record submitted successfully at{" "}
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          ) : null}
        </section>

        <section className={styles.twoCol}>
          <div className={styles.panel} id="my-workers">
            <div className={styles.panelHeader}>
              <span>My Assigned Workers</span>
            </div>
            <div className={styles.workerGrid}>
              {workers.map((worker) => (
                <div className={styles.workerCard} key={worker.name}>
                  <div className={styles.avatar}>{worker.name.charAt(0)}</div>
                  <div className={styles.workerText}>
                    <strong>{worker.name}</strong>
                    <span>{worker.skill}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.panel} id="current-phases">
            <div className={styles.panelHeader}>
              <span>Current Project Phases</span>
            </div>
            <ul className={styles.phaseList}>
              {phases.map((phase) => (
                <li
                  key={phase.phase}
                  className={
                    phase.current ? styles.phaseCurrent : styles.phaseItem
                  }
                >
                  <div className={styles.phaseMeta}>
                    <strong>{phase.phase}</strong>
                    <span>{phase.completion}%</span>
                  </div>
                  <div className={styles.phaseTrack}>
                    <span style={{ width: `${phase.completion}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.panel} id="submission-history">
          <div className={styles.panelHeader}>
            <span>My Recent Submissions</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Labor Hours</th>
                  <th>Materials Qty</th>
                  <th>Equipment Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSubmissions.map((row) => (
                  <tr key={`${row.date}-${row.status}`}>
                    <td>{row.date}</td>
                    <td>{row.labor}</td>
                    <td>{row.materials}</td>
                    <td>{row.equipment}</td>
                    <td>{row.status}</td>
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
