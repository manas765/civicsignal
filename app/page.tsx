"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
  Crosshair,
  Info,
  MapPin,
  Mic,
  Plus,
  ShieldCheck,
  Square,
  Waves,
  CircleAlert,
} from "lucide-react";
import IncidentMap from "./components/IncidentMap";

type Category =
  | "Flooding"
  | "Road damage"
  | "Traffic hazard"
  | "Obstruction"
  | "Other";

type Severity = "Low" | "Medium" | "High";
type Status = "Reported" | "Corroborated" | "Officially Confirmed";

type Report = {
  id: string;
  title: string;
  details: string;
  location: string;
  category: Category;
  severity: Severity;
  status: Status;
  time: string;
  lat?: number;
  lon?: number;
};

type IncidentAction = {
  priority: "Now" | "Soon" | "Later";
  audience: "Citizen" | "Civic authority";
  action: string;
};

type IncidentAnalysis = {
  title: string;
  category: Category;
  summary: string;
  severity: Severity;
  severityReason: string;
  immediateDanger: boolean;
  detectedLanguage: string;
  englishTranscript: string;
  photoObservations: string[];
  photoConsistency: "Consistent" | "Inconsistent" | "Unclear" | "No photo";
  actions: IncidentAction[];
  authorityMessage: string;
  missingDetails: string[];
  possibleDuplicateKeywords: string[];
};

type WeatherCheck = {
  checked: boolean;
  verdict:
    | "Supports"
    | "Inconclusive"
    | "Does not support"
    | "Not applicable"
    | "Unavailable";
  rain24hMm?: number;
  rain3hMm?: number;
  note: string;
};

type PhotoAttachment = { data: string; mime: string; preview: string };
type AudioAttachment = { data: string; mime: string; url: string };

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
    lat: 13.0604,
    lon: 80.2496,
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
    lat: 13.0878,
    lon: 80.2785,
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
    lat: 13.05,
    lon: 80.2121,
  },
  {
    id: "demo-4",
    title: "Closed lane after a fallen tree",
    details:
      "Sample of a report that a civic team has officially confirmed. The lane is closed while crews clear it.",
    location: "Riverside road · Sample location",
    category: "Obstruction",
    severity: "Medium",
    status: "Officially Confirmed",
    time: "1 h ago",
    lat: 13.1067,
    lon: 80.2206,
  },
];

// Initial map view. Change this to the area you are demoing.
const DEFAULT_CENTER: [number, number] = [13.0827, 80.2707];

function statusSlug(status: Status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

/* ------------------------- Browser media helpers ------------------------- */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    );
  }
  return btoa(binary);
}

// Resizing through a canvas also strips EXIF data such as GPS coordinates.
async function compressImage(file: File, maxSide = 1024, quality = 0.7) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { data: dataUrl.split(",")[1], mime: "image/jpeg", preview: dataUrl };
}

// Gemini accepts WAV reliably, so convert whatever the browser recorded.
async function blobToWavBase64(blob: Blob): Promise<string> {
  const audioContext = new AudioContext();
  const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
  await audioContext.close();

  const targetRate = 16000;
  const offline = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(decoded.duration * targetRate)),
    targetRate
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return bytesToBase64(new Uint8Array(buffer));
}

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
  const [weather, setWeather] = useState<WeatherCheck | null>(null);
  const [resultStatus, setResultStatus] = useState<Status>("Reported");

  const [photo, setPhoto] = useState<PhotoAttachment | null>(null);
  const [audio, setAudio] = useState<AudioAttachment | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [isRecording, setIsRecording] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const visibleReports =
    filter === "All"
      ? reports
      : reports.filter((report) => report.category === filter);

  const mappedReports = visibleReports.filter(
    (report): report is Report & { lat: number; lon: number } =>
      report.lat !== undefined && report.lon !== undefined
  );
  const unmappedCount = visibleReports.length - mappedReports.length;

  const reviewCount = reports.filter(
    (report) => report.status === "Reported"
  ).length;

  const highSeverityCount = reports.filter(
    (report) => report.severity === "High"
  ).length;

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setNotice("Please choose an image file.");
      return;
    }

    try {
      setPhoto(await compressImage(file));
      setNotice("");
    } catch (error) {
      console.error("Photo processing failed:", error);
      setNotice("Could not read that photo. Please try another one.");
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);

        try {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          const data = await blobToWavBase64(blob);
          setAudio({ data, mime: "audio/wav", url: URL.createObjectURL(blob) });
          setNotice("");
        } catch (error) {
          console.error("Audio processing failed:", error);
          setNotice("Could not process that recording. Please try again.");
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);

      // Keep voice notes short so the upload stays small.
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 30000);
    } catch (error) {
      console.error("Microphone unavailable:", error);
      setNotice("Microphone access was blocked. Allow it in your browser to record a voice note.");
    }
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setNotice("This browser does not support location access.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setLocation((current) => current || "My current location");
        setNotice("");
      },
      () => setNotice("Location permission was denied. You can still type a landmark."),
      { timeout: 8000 }
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanDetails = details.trim();
    const cleanLocation = location.trim();

    if (!cleanLocation || (!cleanDetails && !photo && !audio)) {
      setNotice(
        "Please add a location and at least a description, a photo, or a voice note."
      );
      return;
    }

    setIsAnalyzing(true);
    setNotice("");
    setAnalysis(null);
    setWeather(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: cleanLocation,
          details: cleanDetails,
          reporterCategory: category,
          reporterSeverity: severity,
          // Rounded to about 100 m so we never send a precise home address.
          lat: coords ? Number(coords.lat.toFixed(3)) : undefined,
          lon: coords ? Number(coords.lon.toFixed(3)) : undefined,
          imageBase64: photo?.data,
          imageMime: photo?.mime,
          audioBase64: audio?.data,
          audioMime: audio?.mime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not analyze this report. Please try again."
        );
      }

      // The server already validates the shape with zod.
      const result = data.analysis as IncidentAnalysis;
      const weatherResult = data.weather as WeatherCheck;
      const coordinates = data.coordinates as { lat: number; lon: number } | null;

      // Only independent evidence can raise the status. Gemini alone never does.
      const status: Status =
        weatherResult.verdict === "Supports" ? "Corroborated" : "Reported";

      setAnalysis(result);
      setWeather(weatherResult);
      setResultStatus(status);

      const newReport: Report = {
        id: `${Date.now()}-${Math.random()}`,
        title: result.title,
        details: result.summary,
        location: `${cleanLocation} · User submitted`,
        category: result.category,
        severity: result.severity,
        status,
        time: "Just now",
        lat: coordinates?.lat,
        lon: coordinates?.lon,
      };

      setReports((currentReports) => [newReport, ...currentReports]);
      setSelectedId(newReport.id);
      setFilter("All");
      setDetails("");
      setLocation("");
      setPhoto(null);
      setAudio(null);
      setCoords(null);
      const mapNote = coordinates
        ? ""
        : " Its location could not be pinned down, so it is not shown on the map.";

      setNotice(
        (status === "Corroborated"
          ? "Report added as Corroborated because independent weather data supports it. It is not officially confirmed."
          : "Report added as Reported. AI analysis is preliminary and the report remains unverified.") +
          mapNote
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
            <h2>Today&apos;s signals</h2>
            <p className="muted-copy">
              Explore reports and submit a new local issue.
            </p>
          </div>

          <div className="updated-indicator">
            <Clock3 size={16} />
            <span>Updates as you report</span>
          </div>
        </section>

        <section className="panel" style={{ padding: 20, marginBottom: 24 }}>
          <div className="panel-heading">
            <div className="panel-icon blue-icon">
              <MapPin size={20} />
            </div>

            <div>
              <h3>Live incident map</h3>
              <p>Fill shows severity. Ring shows verification status.</p>
            </div>
          </div>

          <IncidentMap
            reports={mappedReports}
            selectedId={selectedId}
            onSelect={setSelectedId}
            defaultCenter={DEFAULT_CENTER}
          />

          {unmappedCount > 0 && (
            <p className="muted-copy" style={{ marginTop: 10 }}>
              {unmappedCount} {unmappedCount === 1 ? "report is" : "reports are"}{" "}
              not on the map because the location could not be pinned down.
            </p>
          )}
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
                  <p>Type it, snap it, or say it in any language.</p>
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
                    placeholder="Describe what you noticed, in any language. You can also add a photo or voice note below."
                    rows={4}
                    value={details}
                    onChange={(event) =>
                      setDetails(event.target.value)
                    }
                    maxLength={1200}
                  />

                  <span className="character-count">
                    {details.length}/1200
                  </span>
                </label>

                <div className="field">
                  <span>Add evidence (optional)</span>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <label className="filter-pill" style={{ cursor: "pointer" }}>
                      <Camera size={15} />{" "}
                      {photo ? "Change photo" : "Add photo"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhoto}
                        style={{ display: "none" }}
                      />
                    </label>

                    <button
                      type="button"
                      className="filter-pill"
                      onClick={toggleRecording}
                      aria-pressed={isRecording}
                    >
                      {isRecording ? (
                        <>
                          <Square size={15} /> Stop recording
                        </>
                      ) : (
                        <>
                          <Mic size={15} />{" "}
                          {audio ? "Re-record voice note" : "Record voice note"}
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="filter-pill"
                      onClick={captureLocation}
                    >
                      <Crosshair size={15} />{" "}
                      {coords ? "Location attached" : "Use my location"}
                    </button>
                  </div>

                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.preview}
                      alt="Preview of the attached photo"
                      style={{
                        maxWidth: 220,
                        width: "100%",
                        borderRadius: 12,
                        marginTop: 12,
                      }}
                    />
                  )}

                  {audio && (
                    <audio
                      controls
                      src={audio.url}
                      style={{ marginTop: 12, width: "100%" }}
                    />
                  )}

                  <span className="character-count">
                    Voice notes work in any language (30 s max). Photos are
                    resized in your browser and location metadata is removed.
                  </span>
                </div>

                <div className="form-footnote">
                  <Info size={15} />
                  <span>
                    Reports begin as unverified submissions.
                    Avoid faces, number plates, or private information in photos and voice notes.
                  </span>
                </div>

                <button
                  className="submit-button"
                  type="submit"
                  disabled={isAnalyzing || isRecording}
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
                    {analysis.immediateDanger && (
                      <div
                        className="notice"
                        role="alert"
                        style={{ marginBottom: 16 }}
                      >
                        <CircleAlert size={17} />
                        <span>
                          <strong>Possible immediate danger.</strong> Move to
                          safety and call 112 (India&apos;s emergency number).
                          CivicSignal does not contact authorities for you.
                        </span>
                      </div>
                    )}

                    <div className="panel-heading">
                      <div className="panel-icon blue-icon">
                        <Activity size={20} />
                      </div>
                      <div>
                        <h3>Gemini incident analysis</h3>
                        <p>
                          AI-assisted assessment · Status: {resultStatus} · Not
                          officially confirmed
                        </p>
                      </div>
                    </div>

                    <h4>{analysis.title}</h4>
                    <p>{analysis.summary}</p>

                    <p style={{ marginTop: 12 }}>
                      <strong>Category:</strong> {analysis.category}
                      {" · "}
                      <strong>Preliminary severity:</strong> {analysis.severity}
                    </p>
                    <p>{analysis.severityReason}</p>

                    {(analysis.detectedLanguage ||
                      analysis.englishTranscript) && (
                      <>
                        <h4 style={{ marginTop: 16 }}>
                          Understood input ({analysis.detectedLanguage})
                        </h4>
                        {analysis.englishTranscript && (
                          <p>{analysis.englishTranscript}</p>
                        )}
                      </>
                    )}

                    {analysis.photoObservations.length > 0 && (
                      <>
                        <h4 style={{ marginTop: 16 }}>
                          What the photo shows ({analysis.photoConsistency})
                        </h4>
                        <ul>
                          {analysis.photoObservations.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    {weather && (
                      <>
                        <h4 style={{ marginTop: 16 }}>
                          Independent check: {weather.verdict}
                        </h4>
                        <p>{weather.note}</p>
                      </>
                    )}

                    <h4 style={{ marginTop: 16 }}>What to do</h4>
                    {(["Now", "Soon", "Later"] as const).map((priority) => {
                      const items = analysis.actions.filter(
                        (item) => item.priority === priority
                      );
                      if (items.length === 0) return null;

                      return (
                        <div key={priority} style={{ marginTop: 8 }}>
                          <strong>{priority}</strong>
                          <ul>
                            {items.map((item, index) => (
                              <li key={index}>
                                <em>{item.audience}:</em> {item.action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}

                    <h4 style={{ marginTop: 16 }}>
                      Draft message to the civic helpline
                    </h4>
                    <p>{analysis.authorityMessage}</p>
                    <button
                      type="button"
                      className="filter-pill"
                      style={{ marginTop: 8 }}
                      onClick={() =>
                        navigator.clipboard.writeText(analysis.authorityMessage)
                      }
                    >
                      Copy message
                    </button>

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

                    {analysis.possibleDuplicateKeywords.length > 0 && (
                      <>
                        <h4 style={{ marginTop: 16 }}>
                          Similar-report keywords
                        </h4>
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
                  <article
                    className="report-card"
                    key={report.id}
                    tabIndex={0}
                    onClick={() => setSelectedId(report.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setSelectedId(report.id);
                    }}
                    style={{
                      cursor: "pointer",
                      outline:
                        selectedId === report.id ? "2px solid #2e90fa" : undefined,
                    }}
                  >
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
                            className={`status-tag status-${statusSlug(report.status)}`}
                          >
                            {report.status === "Reported" ? (
                              <Clock3 size={14} />
                            ) : (
                              <BadgeCheck size={14} />
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
                  <span>Corroborated reports</span>
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
                    Cross-check claims against independent data, such as
                    recent rainfall, before treating an incident as
                    corroborated.
                  </p>
                </div>
              </div>

              <div className="trust-step">
                <span className="step-number">03</span>
                <div>
                  <h4>Support action</h4>
                  <p>
                    Give citizens safe next steps and give civic teams a
                    clear, ready-to-send summary.
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
                  in page memory and disappear on refresh. Photos and
                  voice notes are sent to Gemini for analysis and are
                  not stored by CivicSignal. Nothing is sent to
                  authorities in this version.
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