"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, EyeOff, ShieldCheck, Undo2 } from "lucide-react";

type ResponderReport = {
  id: string;
  createdAt: string;
  title: string;
  summary: string;
  location: string;
  category: string;
  severity: string;
  status: string;
  evidence: string[];
  responderNote: string | null;
  authorityMessage: string;
};

export default function ResponderPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [reports, setReports] = useState<ResponderReport[]>([]);
  const [passcode, setPasscode] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    const response = await fetch("/api/responder/reports", { cache: "no-store" });

    if (response.status === 401) {
      setSignedIn(false);
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Could not load reports.");
      return;
    }

    setReports(data.reports);
    setSignedIn(true);
  }, []);

  useEffect(() => {
    loadReports().catch(() => setSignedIn(false));
  }, [loadReports]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/responder/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error || "Could not sign in.");
      return;
    }

    setPasscode("");
    await loadReports();
  }

  async function act(id: string, action: "confirm" | "unconfirm" | "hide") {
    setBusyId(id);
    setMessage("");

    try {
      const response = await fetch("/api/responder/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, note: notes[id] ?? "" }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not update the report.");
      }

      await loadReports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="app-shell">
      <div className="page-wrap" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <a href="/" className="muted-copy">
          &larr; Back to CivicSignal
        </a>

        <h1 style={{ marginTop: 16 }}>Responder console</h1>
        <p className="muted-copy">
          Only a human responder can mark a report as Officially Confirmed. AI
          analysis and community reports never do this on their own.
        </p>

        {message && (
          <div className="notice" role="status" style={{ marginTop: 16 }}>
            <span>{message}</span>
          </div>
        )}

        {signedIn === null && <p style={{ marginTop: 24 }}>Loading...</p>}

        {signedIn === false && (
          <form
            onSubmit={handleLogin}
            className="panel"
            style={{ marginTop: 24, padding: 20, maxWidth: 420 }}
          >
            <label className="field">
              <span>Responder passcode</span>
              <input
                type="password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button className="submit-button" type="submit">
              <ShieldCheck size={18} />
              Sign in
            </button>
          </form>
        )}

        {signedIn && (
          <div className="reports-list" style={{ marginTop: 24 }}>
            {reports.length === 0 && (
              <p className="muted-copy">No submitted reports yet.</p>
            )}

            {reports.map((report) => (
              <article className="report-card" key={report.id}>
                <div className="report-main">
                  <div className="report-title-row">
                    <h4>{report.title}</h4>
                    <span
                      className={`severity-tag severity-${report.severity.toLowerCase()}`}
                    >
                      {report.severity}
                    </span>
                  </div>

                  <p className="report-details">{report.summary}</p>

                  <div className="report-meta">
                    <span>{report.location}</span>
                    <span>{new Date(report.createdAt).toLocaleString()}</span>
                  </div>

                  <p style={{ marginTop: 8 }}>
                    <strong>Status:</strong> {report.status} ·{" "}
                    <strong>Category:</strong> {report.category}
                  </p>

                  {report.evidence.length > 0 && (
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
                      {report.evidence.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  )}

                  {report.authorityMessage && (
                    <p style={{ marginTop: 8, fontSize: 13 }}>
                      <strong>Draft message:</strong> {report.authorityMessage}
                    </p>
                  )}

                  {report.status !== "Officially Confirmed" && (
                    <label className="field" style={{ marginTop: 12 }}>
                      <span>Note for the public (optional)</span>
                      <input
                        type="text"
                        maxLength={280}
                        placeholder="For example: crew dispatched, expected clear by evening"
                        value={notes[report.id] ?? ""}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [report.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                    {report.status !== "Officially Confirmed" ? (
                      <button
                        type="button"
                        className="filter-pill"
                        disabled={busyId === report.id}
                        onClick={() => act(report.id, "confirm")}
                      >
                        <BadgeCheck size={15} /> Officially confirm
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="filter-pill"
                        disabled={busyId === report.id}
                        onClick={() => act(report.id, "unconfirm")}
                      >
                        <Undo2 size={15} /> Remove confirmation
                      </button>
                    )}

                    <button
                      type="button"
                      className="filter-pill"
                      disabled={busyId === report.id}
                      onClick={() => act(report.id, "hide")}
                    >
                      <EyeOff size={15} /> Hide from public
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}