import Image from "next/image";
import styles from "../page.module.css";

export default function HomePage() {
  return (
    <main className={styles["landing-container"]}>
      <div className={styles["top-bar"]}>
        <nav className={styles.navbar}>
          <a href="#services" className={styles["nav-link"]}>
            Services
          </a>
          <a href="#projects" className={styles["nav-link"]}>
            Projects
          </a>
          <a href="#contact" className={styles["nav-link"]}>
            Contact
          </a>
        </nav>

        <div className={styles["auth-group"]}>
          <button className={styles["btn-login"]}>Log In</button>
          <button className={styles["btn-signup"]}>Sign Up</button>
        </div>
      </div>

      <div className={styles["banner-wrapper"]}>
        <Image
          src="/assets/struktura-banner.png"
          alt="Struktura Banner"
          width={1200}
          height={400}
          priority
          className={styles["banner-image"]}
        />
      </div>

      <p className={styles["hero-text"]}>
        A connected operating layer for modern construction teams—bringing
        workforce intelligence, cost visibility, and project execution into one
        secure, data-driven platform.
      </p>

      <div className={styles["cta-group"]}>
        <a href="#services" className={styles["btn-white"]}>
          What We Can Offer
        </a>
        <a href="#projects" className={styles["btn-black"]}>
          Our Projects
        </a>
      </div>

      <section
        id="services"
        className={`${styles.section} ${styles["section-light"]}`}
      >
        <p className={styles["section-label"]}>Our Services</p>
        <h2 className={styles["section-title"]}>What Our Company Can Offer</h2>
        <p className={styles["section-subtitle"]}>
          Purpose-built systems for construction resource planning, operational
          forecasting, and cost intelligence—designed to create sharper control
          across every phase of delivery.
        </p>

        <div className={styles["services-grid"]}>
          <div className={styles["service-card"]}>
            <p className={styles["service-number"]}>01</p>
            <h3>Automated Cost Deduction</h3>
            <p>
              Eliminate manual reconciliation. Intelligent automation processes
              deductions with full traceability and zero margin for error.
            </p>
          </div>

          <div className={styles["service-card"]}>
            <p className={styles["service-number"]}>02</p>
            <h3>Skill &amp; Resource Mapping</h3>
            <p>
              Align the right people with the right tasks. Precision allocation
              ensures maximum utilization across every project phase.
            </p>
          </div>

          <div className={styles["service-card"]}>
            <p className={styles["service-number"]}>03</p>
            <h3>Data Integrity &amp; Access Control</h3>
            <p>
              Enterprise-grade security with role-based permissions, audit
              trails, and encrypted data at every layer.
            </p>
          </div>
        </div>
      </section>

      <section
        id="projects"
        className={`${styles.section} ${styles["section-light"]}`}
      >
        <p className={styles["section-label"]}>Trusted By</p>
        <h2 className={styles["section-title"]}>Organizations We Work With</h2>
        <p className={styles["section-subtitle"]}>
          Trusted by organizations that value operational precision, scalable
          coordination, and resilient project execution across complex
          environments.
        </p>

        <div className={styles["partners-grid"]}>
          <div className={styles["partner-card"]}>TechCorp Inc.</div>
          <div className={styles["partner-card"]}>MetroBank</div>
          <div className={styles["partner-card"]}>State University</div>
          <div className={styles["partner-card"]}>HealthPlus</div>
          <div className={styles["partner-card"]}>ShopSmart</div>
          <div className={styles["partner-card"]}>SkyLogistics</div>
          <div className={styles["partner-card"]}>Apex Builders</div>
          <div className={styles["partner-card"]}>Vertex Engineering</div>
        </div>
      </section>

      <section
        id="contact"
        className={`${styles.section} ${styles["section-dark"]}`}
      >
        <p className={styles["section-label"]}>The Team</p>
        <h2 className={styles["section-title"]}>Meet the Developers</h2>
        <p className={styles["section-subtitle"]}>
          The multidisciplinary team behind Struktura—combining engineering
          logic, product thinking, and digital execution to shape the future of
          construction operations.
        </p>

        <div className={styles["team-grid"]}>
          <div className={styles["team-card"]}>
            <div className={styles["team-avatar"]}>
              <Image
                src="/assets/jl.jpg"
                alt="Jenny Lood"
                width={120}
                height={120}
                className={styles["team-photo"]}
              />
            </div>
            <h3>Jenny Lood</h3>
            <p className={styles.role}>
              Lead Database Administrator
              <br />
              &amp; Cloud Infrastructure Engineer
            </p>
          </div>

          <div className={styles["team-card"]}>
            <div className={styles["team-avatar"]}>
              <Image
                src="/assets/angoy.jpg"
                alt="Christian Angoy"
                width={120}
                height={120}
                className={styles["team-photo"]}
              />
            </div>
            <h3>Christian Angoy</h3>
            <p className={styles.role}>
              Lead Database Programmer
              <br />
              &amp; Query Optimization Engineer
            </p>
          </div>

          <div className={styles["team-card"]}>
            <div className={styles["team-avatar"]}>
              <Image
                src="/assets/sara.jpg"
                alt="Sara Hinayon"
                width={120}
                height={120}
                className={styles["team-photo"]}
              />
            </div>
            <h3>Sara Hinayon</h3>
            <p className={styles.role}>
              Frontend / UI Connector
              <br />
              &amp; Git Workflow Administrator
            </p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        © {new Date().getFullYear()} Struktura — All Rights Reserved
      </footer>
    </main>
  );
}
