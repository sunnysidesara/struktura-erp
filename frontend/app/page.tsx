import Link from "next/link";

const partners = [
  "TechCorp Inc.",
  "MetroBank",
  "State University",
  "HealthPlus",
  "ShopSmart",
  "SkyLogistics",
  "Apex Builders",
  "Vertex Engineering",
];

const team = [
  {
    name: "Jenny Lood",
    role: "Lead Database Administrator & Cloud Infrastructure Engineer",
    image: "/assets/jl.jpg",
  },
  {
    name: "Christian Angoy",
    role: "Lead Database Programmer & Query Optimization Engineer",
    image: "/assets/christian.jpg",
  },
  {
    name: "Sara Hinayon",
    role: "Frontend / UI Connector & Git Workflow Administrator",
    image: "/assets/sara.png",
  },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="site-shell">
      <header className="header">
        <a className="brand" href="#top" aria-label="Struktura home">
          <span>
            <i />
            <i />
            <i />
          </span>
        </a>

        <nav className="nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="#organizations">Clients</a>
          <a href="#contact">Contact</a>
        </nav>

        <Link className="portal-link" href="/portal">
          Portal <ArrowIcon />
        </Link>
      </header>

      <main>
        <section className="hero" id="top">
          <img
            className="hero-banner"
            src="/assets/struktura-banner.png"
            alt="Struktura — Construction Resource and Cost Management System"
          />
          <h1></h1>
        </section>

        <section className="features" id="features">
          <div className="feature-image">
            <img
              src="/assets/man-up.png"
              alt="Construction worker giving a thumbs up"
            />
          </div>
          <div className="feature-copy">
            <p className="eyebrow">Why Struktura</p>
            <h2>
              Built for Real Construction
              <br />
              Work
            </h2>
            <p className="feature-intro">
              Struktura was designed with construction teams in mind. No
              complicated setup, no unnecessary screens — just the tools your
              people need to keep projects moving.
            </p>
            <ul className="feature-list">
              <li>
                <CheckIcon />
                Built-in cost tracking and deductions
              </li>
              <li>
                <CheckIcon />
                Skill-based worker assignment
              </li>
              <li>
                <CheckIcon />
                Secure role-based access for every team
              </li>
              <li>
                <CheckIcon />
                Live dashboards for project managers
              </li>
            </ul>
          </div>
        </section>

        <section className="about section-dark" id="about">
          <div className="section-index">About us</div>
          <div className="about-content">
            <p className="eyebrow light">Who we are</p>
            <h2>
              A stronger foundation
              <br />
              for every <strong>project.</strong>
            </h2>
            <div className="about-body">
              <p>
                Struktura is a construction resource and cost management system
                built to help companies take control of their projects.
              </p>
              <p>
                We bring workforce planning, cost tracking, and project data
                together in one platform—so teams can work smarter, reduce
                errors, and deliver on time.
              </p>
            </div>
          </div>
          <div className="about-stat"></div>
        </section>

        <section className="organizations" id="organizations">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Trusted by</p>
              <h2>Organizations that build the future</h2>
            </div>
            <p>
              From growing contractors to established enterprises, teams rely on
              Struktura to keep their operations connected.
            </p>
          </div>
          <div className="partner-grid">
            {partners.map((partner, index) => (
              <div className="partner" key={partner}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {partner}
              </div>
            ))}
          </div>
        </section>

        <section className="contact" id="contact">
          <p className="eyebrow">Start a conversation</p>
          <h2>
            Let&apos;s build better,
            <br />
            <strong>together.</strong>
          </h2>
          <Link className="primary-button dark-button" href="/portal">
            Get started <ArrowIcon />
          </Link>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#top"></a>
        <p>Construction resource &amp; cost management</p>
        <small>
          © {new Date().getFullYear()} Struktura. All rights reserved.
        </small>
      </footer>
    </div>
  );
}
