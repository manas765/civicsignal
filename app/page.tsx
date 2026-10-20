"use client";

import { useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Camera,
  CarFront,
  CheckCircle2,
  Clock3,
  Construction,
  Info,
  MapPin,
  Plus,
  ShieldCheck,
  Waves,
  CircleAlert,
} from "lucide-react";

type Category =
  | "Flooding"
  | "Road damage"
  | "Traffic hazard"
  | "Obstruction"
  | "Other";

type Severity = "Low" | "Medium" | "High";
type Status = "Reported" | "Corroborated";

type Report = {
  id: string;
  title: string;
  details: string;
  location: string;
  category: Category;
  severity: Severity;
  status: Status;
  time: string;
};

type IncidentAnalysis = {
  title: string;
  category: Category;
  summary: string;
  severity: Severity;
  missingDetails: string[];
  suggestedNextSteps: string[];
  possibleDuplicateKeywords: string[];
};

const IncidentAnalysisSchema = {
  parse(value: unknown): IncidentAnalysis {
    if (
      typeof value !== "object" ||
      value === null ||
      !("title" in value) ||
      !("category" in value) ||
      !("summary" in value) ||
      !("severity" in value) ||
      !("missingDetails" in value) ||
      !("suggestedNextSteps" in value) ||
      !("possibleDuplicateKeywords" in value)
    ) {
      throw new Error("Gemini returned an invalid analysis.");
    }

    const item = value as IncidentAnalysis;

    if (
      typeof item.title !== "string" ||
      typeof item.summary !== "string" ||
      !issueCategories.includes(item.category) ||
      !["Low", "Medium", "High"].includes(item.severity) ||
      !Array.isArray(item.missingDetails) ||
      !Array.isArray(item.suggestedNextSteps) ||
      !Array.isArray(item.possibleDuplicateKeywords) ||
      ![
        ...item.missingDetails,
        ...item.suggestedNextSteps,
        ...item.possibleDuplicateKeywords,
      ].every((entry) => typeof entry === "string")
    ) {
      throw new Error("Gemini returned an invalid analysis.");
    }

    return item;
  },
};

const issueCategories: Category[] = [
  "Flooding",
  "Road damage",
  "Traffic hazard",
  "Obstruction",
  "Other",
];

const filters = ["All", ...issueCategories] as const;

type ReportFilter = (typeof filters)[number];

// These are synthetic examples for the initial prototype.
const sampleReports: Report[] = [
  {
    id: "demo-1",
    title: "Water pooling across the service lane",
    details:
      "Water is accumulating across the lane, making it difficult for smaller vehicles to pass.",
    location: "Market service lane · Sample location",
    category: "Flooding",
    severity: "High",
    status: "Reported",
    time: "12 min ago",
  },
  {
    id: "demo-2",
    title: "Damaged road surface near a junction",
    details:
      "A large damaged patch is visible in the road surface. Drivers may need to slow down.",
    location: "Central junction · Sample location",
    category: "Road damage",
    severity: "Medium",
    status: "Corroborated",
    time: "28 min ago",
  },
  {
    id: "demo-3",
    title: "Debris blocking part of the footpath",
    details:
      "Construction debris is obstructing the pedestrian path in this sample report.",
    location: "Residential walkway · Sample location",
    category: "Obstruction",
    severity: "Low",
    status: "Reported",
    time: "46 min ago",
  },
];

function CategoryIcon({ category }: { category: Category }) {
  switch (category) {
    case "Flooding":
      return <Waves size={18} />;

    case "Road damage":
      return <Construction size={18} />;

    case "Traffic hazard":
      return <CarFront size={18} />;

    default:
      return <CircleAlert size={18} />;
  }
}

export default function Home() {
  const [reports, setReports] = useState<Report[]>(sampleReports);
  const [filter, setFilter] = useState<ReportFilter>("All");

  const [category, setCategory] = useState<Category>("Flooding");
  const [severity, setSeverity] = useState<Severity>("Medium");
  const [details, setDetails] = useState("");
  const [location, setLocation] = useState("");
  const [notice, setNotice] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<IncidentAnalysis | null>(null);

  const visibleReports =
    filter === "All"
      ? reports
      : reports.filter((report) => report.category === filter);

  const reviewCount = reports.filter(
    (report) => report.status === "Reported"
  ).length;

  const highSeverityCount = reports.filter(
    (report) => report.severity === "High"
  ).length;

  
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const cleanDetails = details.trim();
  const cleanLocation = location.trim();

  if (!cleanDetails || !cleanLocation) {
    setNotice("Please provide the incident details and location.");
    return;
  }

  setIsAnalyzing(true);
  setNotice("");
  setAnalysis(null);

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        location: cleanLocation,
        details: cleanDetails,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Could not analyze this report. Please try again."
      );
    }

    const result = IncidentAnalysisSchema.parse(data.analysis);

    setAnalysis(result);

    const newReport: Report = {
      id: `${Date.now()}-${Math.random()}`,
      title: result.title,
      details: result.summary,
      location: `${cleanLocation} · User submitted`,
      category: result.category,
      severity: result.severity,
      status: "Reported",
      time: "Just now",
    };

    setReports((currentReports) => [newReport, ...currentReports]);
    setFilter("All");
    setDetails("");
    setLocation("");
    setNotice(
      "Report added successfully. AI analysis is preliminary and the report remains unverified."
    );
  } catch (error) {
    console.error("Report submission failed:", error);

    setNotice(
      error instanceof Error
        ? error.message
        : "Something went wrong. Please try again."
    );
  } finally {
    setIsAnalyzing(false);
  }
}


  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="CivicSignal home">
          <span className="brand-mark">
            <Activity size={21} strokeWidth={2.5} />
          </span>
          <span>
            Civic<span className="brand-accent">Signal</span>
          </span>
        </a>

        <div className="topbar-meta">
          <span className="live-dot" />
          <span>Societal Benefit · Hackathon build</span>
          <span className="topbar-divider" />
          <span className="demo-avatar">CS</span>
        </div>
      </header>

      <div className="page-wrap">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              CIVIC INTELLIGENCE FOR EVERYONE
            </div>

            <h1>
              See the signal.
              <br />
              <span>Make streets safer.</span>
            </h1>

            <p className="hero-description">
              Everyday reports. Clearer information.
              Better-informed civic action.
            </p>

            <div className="hero-actions">
              <a href="#report-form" className="primary-link">
                <Plus size={18} />
                Report an issue
                <ArrowUpRight size={17} />
              </a>

              <span className="privacy-note">
                <ShieldCheck size={16} />
                Public-interest technology
              </span>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-top">
              <span className="eyebrow">COMMUNITY SNAPSHOT</span>
              <span className="demo-tag">DEMO MODE</span>
            </div>

            <div className="hero-number">
              {String(reports.length).padStart(2, "0")}
              <span> signals</span>
            </div>

            <p className="muted-copy">
              Reports in this local demo session
            </p>

            <div className="hero-divider" />

            <div className="hero-card-bottom">
              <div>
                <span className="mini-label">Awaiting review</span>
                <strong>{reviewCount}</strong>
              </div>

              <div>
                <span className="mini-label">High reported severity</span>
                <strong>{highSeverityCount}</strong>
              </div>

              <div className="snapshot-icon">
                <Activity size={23} />
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-heading">
          <div>
            <p className="section-overline">COMMUNITY OVERVIEW</p>
            <h2>Today's signals</h2>
            <p className="muted-copy">
              Explore reports and submit a new local issue.
            </p>
          </div>

          <div className="updated-indicator">
            <Clock3 size={16} />
            <span>Updates as you report</span>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="main-column">
            <section className="panel report-panel" id="report-form">
              <div className="panel-heading">
                <div className="panel-icon blue-icon">
                  <Plus size={20} />
                </div>

                <div>
                  <h3>Report an issue</h3>
                  <p>Give your community a clearer picture.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <label className="field">
                    <span>Issue type</span>

                    <select
                      value={category}
                      onChange={(event) =>
                        setCategory(event.target.value as Category)
                      }
                    >
                      {issueCategories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Perceived severity</span>

                    <select
                      value={severity}
                      onChange={(event) =>
                        setSeverity(event.target.value as Severity)
                      }
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>Where is it happening?</span>

                  <div className="input-with-icon">
                    <MapPin size={17} />
                    <input
                      type="text"
                      placeholder="Enter a landmark or area"
                      value={location}
                      onChange={(event) =>
                        setLocation(event.target.value)
                      }
                      maxLength={120}
                      required
                    />
                  </div>
                </label>

                <label className="field">
                  <span>What happened?</span>

                  <textarea
                    placeholder="Describe what you noticed, who may be affected, and any useful details..."
                    rows={4}
                    value={details}
                    onChange={(event) =>
                      setDetails(event.target.value)
                    }
                    maxLength={1200}
                    required
                  />

                  <span className="character-count">
                    {details.length}/1200
                  </span>
                </label>

                <div className="form-footnote">
                  <Info size={15} />
                  <span>
                    Reports begin as unverified submissions.
                    Do not include private or sensitive information.
                  </span>
                </div>

                <button
                 className="submit-button"
                 type="submit"
                   disabled={isAnalyzing}
                     >
                    {isAnalyzing ? (
                            <>
                     <Activity size={18} />
                     Analyzing with Gemini...
                               </>
                               ) : (
                                   <>
                           <Plus size={18} />
                       Analyze & submit report
                        <ArrowRight size={17} />
                                  </>
                                 )}
                             </button>

                {notice && (
                  <div className="notice" role="status">
                    <CheckCircle2 size={17} />
                    <span>{notice}</span>
                  </div>
                )}
                
{analysis && (
  <section
    className="panel"
    aria-live="polite"
    style={{ marginTop: 20, padding: 20 }}
  >
    <div className="panel-heading">
      <div className="panel-icon blue-icon">
        <Activity size={20} />
      </div>
      <div>
        <h3>Gemini incident analysis</h3>
        <p>AI-assisted assessment · Not independently verified</p>
      </div>
    </div>

    <h4>{analysis.title}</h4>
    <p>{analysis.summary}</p>

    <p style={{ marginTop: 12 }}>
      <strong>Category:</strong> {analysis.category}
      {" · "}
      <strong>Preliminary severity:</strong> {analysis.severity}
    </p>

    <h4 style={{ marginTop: 16 }}>Details to clarify</h4>
    {analysis.missingDetails.length ? (
      <ul>
        {analysis.missingDetails.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    ) : (
      <p>No additional details were flagged by the AI.</p>
    )}

    <h4 style={{ marginTop: 16 }}>Suggested next steps</h4>
    <ul>
      {analysis.suggestedNextSteps.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>

    {analysis.possibleDuplicateKeywords.length > 0 && (
      <>
        <h4 style={{ marginTop: 16 }}>Similar-report keywords</h4>
        <p>{analysis.possibleDuplicateKeywords.join(", ")}</p>
      </>
    )}
  </section>
)}

              </form>
            </section>

            <section className="reports-section">
              <div className="reports-heading">
                <div>
                  <h3>Recent reports</h3>
                  <p className="muted-copy">
                    {visibleReports.length}{" "}
                    {visibleReports.length === 1 ? "report" : "reports"}
                    {" "}shown
                  </p>
                </div>

                <span className="demo-tag">SAMPLE DATA</span>
              </div>

              <div className="filter-list" aria-label="Filter reports">
                {filters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`filter-pill ${
                      filter === item ? "active" : ""
                    }`}
                    onClick={() => setFilter(item)}
                    aria-pressed={filter === item}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="reports-list">
                {visibleReports.length === 0 && (
                  <div className="empty-state">
                    <Camera size={25} />
                    <h4>No reports in this category yet</h4>
                    <p>Submit an issue to get the feed started.</p>
                  </div>
                )}

                {visibleReports.map((report) => (
                  <article className="report-card" key={report.id}>
                    <div className="report-card-top">
                      <div className="report-category-icon">
                        <CategoryIcon category={report.category} />
                      </div>

                      <div className="report-main">
                        <div className="report-title-row">
                          <h4>{report.title}</h4>
                          <span
                            className={`severity-tag severity-${report.severity.toLowerCase()}`}
                          >
                            {report.severity}
                          </span>
                        </div>

                        <p className="report-details">
                          {report.details}
                        </p>

                        <div className="report-meta">
                          <span>
                            <MapPin size={14} />
                            {report.location}
                          </span>

                          <span>
                            <Clock3 size={14} />
                            {report.time}
                          </span>
                        </div>

                        <div className="report-bottom">
                          <span
                            className={`status-tag status-${report.status.toLowerCase()}`}
                          >
                            {report.status === "Corroborated" ? (
                              <BadgeCheck size={14} />
                            ) : (
                              <Clock3 size={14} />
                            )}
                            {report.status}
                          </span>

                          <span className="category-label">
                            {report.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="side-column">
            <section className="panel overview-panel">
              <div className="side-panel-heading">
                <div>
                  <p className="section-overline">AT A GLANCE</p>
                  <h3>Signal overview</h3>
                </div>
                <Activity size={20} />
              </div>

              <div className="overview-stat">
                <div className="overview-stat-icon amber">
                  <CircleAlert size={19} />
                </div>

                <div className="overview-stat-content">
                  <span>High reported severity</span>
                  <strong>{highSeverityCount} reports</strong>
                </div>
              </div>

              <div className="overview-stat">
                <div className="overview-stat-icon blue">
                  <Clock3 size={19} />
                </div>

                <div className="overview-stat-content">
                  <span>Awaiting review</span>
                  <strong>{reviewCount} reports</strong>
                </div>
              </div>

              <div className="overview-stat">
                <div className="overview-stat-icon green">
                  <CheckCircle2 size={19} />
                </div>

                <div className="overview-stat-content">
                  <span>Corroborated examples</span>
                  <strong>
                    {
                      reports.filter(
                        (report) => report.status === "Corroborated"
                      ).length
                    }{" "}
                    reports
                  </strong>
                </div>
              </div>
            </section>

            <section className="panel trust-panel">
              <div className="side-panel-heading">
                <div>
                  <p className="section-overline">OUR APPROACH</p>
                  <h3>Trust is built in.</h3>
                </div>

                <ShieldCheck size={22} />
              </div>

              <div className="trust-step">
                <span className="step-number">01</span>
                <div>
                  <h4>Structure the signal</h4>
                  <p>
                    Turn messy text, photos, and voice into useful,
                    organized incident details.
                  </p>
                </div>
              </div>

              <div className="trust-step">
                <span className="step-number">02</span>
                <div>
                  <h4>Check the evidence</h4>
                  <p>
                    Compare reports and their sources before treating
                    an incident as corroborated.
                  </p>
                </div>
              </div>

              <div className="trust-step">
                <span className="step-number">03</span>
                <div>
                  <h4>Support action</h4>
                  <p>
                    Present clearer information to help communities
                    and civic teams decide what to do next.
                  </p>
                </div>
              </div>

              <div className="trust-footer">
                <ShieldCheck size={16} />
                Reported does not mean verified.
              </div>
            </section>

            <section className="safety-note">
              <Info size={18} />
              <div>
                <h4>Prototype disclosure</h4>
                <p>
                  Sample reports are synthetic. New submissions remain
                  in page memory and disappear on refresh. Nothing is
                  sent to authorities in this version.
                </p>
              </div>
            </section>
          </aside>
        </section>

        <footer className="page-footer">
          <a className="footer-brand" href="#">
            <Activity size={17} />
            CivicSignal
          </a>

          <span>Built for the Societal Benefit challenge.</span>

          <span className="footer-disclaimer">
            Community reports · Evidence-aware by design
          </span>
        </footer>
      </div>
    </main>
  );
}