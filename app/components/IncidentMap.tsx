"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { CircleMarker, LayerGroup, Map as LeafletMap } from "leaflet";

type LeafletModule = typeof import("leaflet");

export type MapReport = {
  id: string;
  title: string;
  location: string;
  category: string;
  severity: "Low" | "Medium" | "High";
  status: string;
  time: string;
  lat: number;
  lon: number;
  faded?: boolean;
};

type Props = {
  reports: MapReport[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  defaultCenter: [number, number];
};

// Fill colour = severity, ring colour = verification status.
const SEVERITY_COLOR: Record<MapReport["severity"], string> = {
  High: "#d92d20",
  Medium: "#f79009",
  Low: "#2e90fa",
};

const STATUS_COLOR: Record<string, string> = {
  Reported: "#667085",
  Corroborated: "#12b76a",
  "Officially Confirmed": "#6938ef",
};

// Built with DOM nodes and textContent so report text can never inject HTML.
function buildPopup(report: MapReport): HTMLElement {
  const root = document.createElement("div");
  root.style.minWidth = "180px";

  const title = document.createElement("strong");
  title.textContent = report.title;

  const meta = document.createElement("div");
  meta.style.marginTop = "4px";
  meta.textContent = `${report.category} · ${report.severity} severity`;

  const status = document.createElement("div");
  status.textContent = `Status: ${report.status}`;

  const place = document.createElement("div");
  place.style.opacity = "0.75";
  place.textContent = `${report.location} · ${report.time}`;

  root.append(title, meta, status, place);
  return root;
}

export default function IncidentMap({
  reports,
  selectedId,
  onSelect,
  defaultCenter,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const lastFitKeyRef = useRef("");
  const [ready, setReady] = useState(false);

  // Create the map once, in the browser only.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const mod = await import("leaflet");
      const L: LeafletModule =
        (mod as unknown as { default?: LeafletModule }).default ?? mod;

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
      }).setView(defaultCenter, 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      leafletRef.current = L;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      setReady(false);
    };
    // The map is created once; the centre is only an initial value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers when reports or the selection change.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    const points: [number, number][] = [];

    reports.forEach((report) => {
      const selected = report.id === selectedId;

      const marker: CircleMarker = L.circleMarker([report.lat, report.lon], {
        radius: selected ? 15 : 10,
        fillColor: SEVERITY_COLOR[report.severity],
        fillOpacity: report.faded ? 0.3 : 0.85,
        opacity: report.faded ? 0.5 : 1,
        color: STATUS_COLOR[report.status] ?? "#667085",
        weight: selected ? 6 : report.faded ? 2 : 4,
      });

      marker.bindPopup(buildPopup(report));
      marker.on("click", () => onSelect(report.id));
      marker.addTo(layer);

      if (selected) marker.openPopup();
      points.push([report.lat, report.lon]);
    });

    // Re-fit the view only when the set of reports changes, not on selection.
    const fitKey = reports.map((report) => report.id).join("|");
    if (fitKey !== lastFitKeyRef.current) {
      lastFitKeyRef.current = fitKey;
      if (points.length > 0) {
        map.fitBounds(points, { padding: [40, 40], maxZoom: 15, animate: false });
      }
    }
  }, [reports, selectedId, ready, onSelect]);

  // Move to a report when it is selected from the list.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedId) return;

    const report = reports.find((item) => item.id === selectedId);
    if (!report) return;

    map.flyTo([report.lat, report.lon], Math.max(map.getZoom(), 14), {
      duration: 0.6,
    });
    // Only react to a new selection, not to every report change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  return (
    <div>
      <div
        ref={containerRef}
        role="region"
        aria-label="Map of reported incidents"
        style={{
          height: "min(380px, 55vh)",
          borderRadius: 16,
          overflow: "hidden",
          isolation: "isolate",
          position: "relative",
          zIndex: 0,
        }}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginTop: 12,
          fontSize: 13,
        }}
      >
        <span>
          <strong>Fill:</strong>{" "}
          {(["High", "Medium", "Low"] as const).map((level) => (
            <span key={level} style={{ marginRight: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: SEVERITY_COLOR[level],
                  marginRight: 4,
                }}
              />
              {level}
            </span>
          ))}
        </span>

        <span>
          <strong>Ring:</strong>{" "}
          {Object.entries(STATUS_COLOR).map(([label, color]) => (
            <span key={label} style={{ marginRight: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: `3px solid ${color}`,
                  marginRight: 4,
                  boxSizing: "border-box",
                }}
              />
              {label}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}