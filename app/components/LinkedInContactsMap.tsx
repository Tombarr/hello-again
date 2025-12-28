"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoiYmhhdGFuZXJvaGFuIiwiYSI6ImNtZTllbnh5azBrb3oyam9jd2QzNXpwMngifQ.3UtCGh7Y1_1AUYrs0CJ7pg";

type Person = {
  name: string;
  url: string;
  city: string;
};

type CityCoords = {
  lng: number;
  lat: number;
};

type CityGroup = {
  city: string;
  people: Person[];
  coords?: CityCoords;
};

type StatusType = "success" | "loading" | "error" | "";

type Status = {
  message: string;
  type: StatusType;
};

type CityGroups = Record<string, CityGroup>;

export default function LinkedInContactsMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const geocodeCacheRef = useRef<Record<string, CityCoords>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [cityGroups, setCityGroups] = useState<CityGroups>({});
  const [selectedCity, setSelectedCity] = useState<CityGroup | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ message: "", type: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    if (!MAPBOX_TOKEN) {
      setStatus({
        message: "Missing Mapbox token. Set NEXT_PUBLIC_MAPBOX_TOKEN.",
        type: "error",
      });
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-98.5795, 39.8283],
      zoom: 3.5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setIsMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    renderMarkers();
  }, [cityGroups, isMapLoaded]);

  const showStatus = (message: string, type: StatusType) => {
    setStatus({ message, type });
    if (type === "success") {
      setTimeout(() => setStatus({ message: "", type: "" }), 4000);
    }
  };

  const geocodeCity = async (cityName: string) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      cityName,
    )}.json?access_token=${mapboxgl.accessToken}&limit=1`;

    try {
      const response = await fetch(url);
      const data = (await response.json()) as {
        features?: Array<{ center: [number, number] }>;
      };

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        return { lng, lat };
      }
    } catch (error) {
      console.error("Geocoding error for", cityName, error);
    }
    return null;
  };

  const handleCSVUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingText("Parsing CSV...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          await processCSVData(results.data as Array<Record<string, string>>);
        } catch (error) {
          setIsLoading(false);
          showStatus("Error: " + (error as Error).message, "error");
        }
      },
      error: () => {
        setIsLoading(false);
        showStatus("CSV parsing error", "error");
      },
    });
  };

  const processCSVData = async (data: Array<Record<string, string>>) => {
    const processed = data
      .map((row) => {
        const name =
          row.Name ??
          row.name ??
          row.NAME ??
          row.FullName ??
          row.From ??
          row.To ??
          "";
        const url =
          row.ProfileURL ??
          row.profileURL ??
          row.URL ??
          row.url ??
          row.LinkedInURL ??
          row.inviterProfileUrl ??
          row.inviteeProfileUrl ??
          "";
        const city =
          row.City ?? row.city ?? row.CITY ?? row.Location ?? row.location ?? "";

        return { name: name.trim(), url: url.trim(), city: city.trim() };
      })
      .filter((person) => person.name && person.city);

    if (processed.length === 0) {
      setIsLoading(false);
      showStatus("No valid data found. Need Name and City columns.", "error");
      return;
    }

    const groups: CityGroups = {};
    processed.forEach((person) => {
      const cityKey = person.city.toLowerCase();
      if (!groups[cityKey]) {
        groups[cityKey] = {
          city: person.city,
          people: [],
        };
      }
      groups[cityKey].people.push(person);
    });

    const uniqueCities = Object.keys(groups);
    let geocoded = 0;

    for (const cityKey of uniqueCities) {
      const cityName = groups[cityKey].city;

      if (!geocodeCacheRef.current[cityKey]) {
        const coords = await geocodeCity(cityName);
        if (coords) {
          geocodeCacheRef.current[cityKey] = coords;
        }
      }

      if (geocodeCacheRef.current[cityKey]) {
        groups[cityKey].coords = geocodeCacheRef.current[cityKey];
      }

      geocoded += 1;
      setLoadingText(`Geocoding ${geocoded}/${uniqueCities.length} cities...`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setCityGroups(groups);
    setHasData(true);
    setIsLoading(false);
    showStatus(
      `Loaded ${processed.length} contacts in ${uniqueCities.length} cities`,
      "success",
    );
  };

  const renderMarkers = () => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasMarkers = false;

    Object.values(cityGroups).forEach((group) => {
      if (!group.coords || !map.current) return;

      hasMarkers = true;
      const count = group.people.length;

      const el = document.createElement("div");
      el.className = "cluster-marker";

      if (count < 20) {
        el.classList.add("small");
      } else if (count < 50) {
        el.classList.add("medium");
      } else {
        el.classList.add("large");
      }

      el.textContent = count > 999 ? "999+" : String(count);
      el.title = `${group.city}: ${count} contacts`;

      el.addEventListener("click", () => {
        setSelectedCity(group);
        setIsPanelOpen(true);

        map.current?.flyTo({
          center: [group.coords.lng, group.coords.lat],
          zoom: 10,
          duration: 1500,
        });
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([group.coords.lng, group.coords.lat])
        .addTo(map.current);

      markersRef.current.push(marker);
      bounds.extend([group.coords.lng, group.coords.lat]);
    });

    if (hasMarkers && map.current) {
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 12 });
    }
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedCity(null);
  };

  return (
    <div className="linkedin-map">
      <style>{`
        .linkedin-map {
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid rgba(29, 28, 26, 0.1);
          background: #ffffff;
          box-shadow: 0 28px 60px -40px rgba(0, 0, 0, 0.45);
        }

        .linkedin-map * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .linkedin-map .app-container {
          display: flex;
          flex-direction: column;
          height: clamp(520px, 70vh, 760px);
          width: 100%;
          font-family: "Work Sans", -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .linkedin-map .header {
          background: linear-gradient(135deg, #0077b5 0%, #005885 100%);
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
          z-index: 100;
        }

        .linkedin-map .header h1 {
          color: white;
          font-size: 1.4rem;
          font-weight: 600;
          margin-right: auto;
        }

        .linkedin-map .upload-btn {
          background: white;
          color: #0077b5;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.95rem;
        }

        .linkedin-map .upload-btn:hover {
          background: #f0f9ff;
          transform: translateY(-1px);
        }

        .linkedin-map .status-badge {
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
          color: white;
        }

        .linkedin-map .status-badge.success {
          background: #00b894;
        }
        .linkedin-map .status-badge.loading {
          background: #fdcb6e;
          color: #2d3436;
        }
        .linkedin-map .status-badge.error {
          background: #e74c3c;
        }

        .linkedin-map .main-content {
          display: flex;
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .linkedin-map .side-panel {
          width: 340px;
          background: #f8fafc;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          z-index: 50;
          box-shadow: 4px 0 20px rgba(0, 0, 0, 0.1);
        }

        .linkedin-map .side-panel.open {
          transform: translateX(0);
        }

        .linkedin-map .panel-header {
          background: white;
          padding: 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .linkedin-map .panel-header h2 {
          font-size: 1.1rem;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .linkedin-map .panel-header .count {
          background: #0077b5;
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .linkedin-map .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #64748b;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .linkedin-map .close-btn:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .linkedin-map .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .linkedin-map .person-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          transition: all 0.2s;
          border: 1px solid #e2e8f0;
        }

        .linkedin-map .person-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
          transform: translateY(-2px);
        }

        .linkedin-map .person-name {
          font-weight: 600;
          color: #1e293b;
          font-size: 1rem;
          margin-bottom: 8px;
        }

        .linkedin-map .person-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #0077b5;
          text-decoration: none;
          font-size: 0.85rem;
          padding: 6px 12px;
          background: #f0f9ff;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .linkedin-map .person-link:hover {
          background: #0077b5;
          color: white;
        }

        .linkedin-map .no-url {
          color: #94a3b8;
          font-size: 0.85rem;
        }

        .linkedin-map .map-container {
          flex: 1;
          position: relative;
        }

        .linkedin-map .map-container > div:first-child {
          width: 100%;
          height: 100%;
        }

        .linkedin-map .cluster-marker {
          background: linear-gradient(135deg, #0077b5 0%, #005885 100%);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          box-shadow: 0 4px 15px rgba(0, 119, 181, 0.4);
          cursor: pointer;
          transition: all 0.2s;
          border: 3px solid white;
        }

        .linkedin-map .cluster-marker:hover {
          transform: scale(1.15);
          box-shadow: 0 6px 20px rgba(0, 119, 181, 0.5);
        }

        .linkedin-map .cluster-marker.small {
          width: 45px;
          height: 45px;
          font-size: 13px;
        }
        .linkedin-map .cluster-marker.medium {
          width: 55px;
          height: 55px;
          font-size: 15px;
        }
        .linkedin-map .cluster-marker.large {
          width: 70px;
          height: 70px;
          font-size: 17px;
        }

        .linkedin-map .hint-card {
          position: absolute;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 16px 24px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 10;
          animation: fadeInUp 0.5s ease;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .linkedin-map .hint-card .hint-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #0077b5 0%, #005885 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .linkedin-map .hint-card .hint-icon svg {
          width: 22px;
          height: 22px;
          color: white;
        }

        .linkedin-map .hint-card .hint-text h4 {
          font-size: 0.95rem;
          color: #1e293b;
          margin-bottom: 2px;
        }

        .linkedin-map .hint-card .hint-text p {
          font-size: 0.8rem;
          color: #64748b;
        }

        .linkedin-map .hint-card .hint-text code {
          background: #f1f5f9;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .linkedin-map .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.85);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 200;
        }

        .linkedin-map .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #e2e8f0;
          border-top-color: #0077b5;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .linkedin-map .loading-overlay p {
          margin-top: 16px;
          color: #64748b;
          font-size: 0.95rem;
        }

        @media (max-width: 900px) {
          .linkedin-map .app-container {
            height: clamp(640px, 80vh, 900px);
          }

          .linkedin-map .side-panel {
            width: 100%;
          }
        }
      `}</style>

      <div className="app-container">
        <header className="header">
          <h1>📍 LinkedIn Contacts Map</h1>

          <input
            ref={fileInputRef}
            type="file"
            id="csv-input"
            accept=".csv"
            onChange={handleCSVUpload}
            style={{ display: "none" }}
          />
          <button
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              width="18"
              height="18"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Upload CSV
          </button>

          {status.message && (
            <span className={`status-badge ${status.type}`}>
              {status.message}
            </span>
          )}
        </header>

        <div className="main-content">
          <aside className={`side-panel ${isPanelOpen ? "open" : ""}`}>
            <div className="panel-header">
              <h2>
                <span>{selectedCity?.city || "City"}</span>
                <span className="count">{selectedCity?.people?.length || 0}</span>
              </h2>
              <button className="close-btn" onClick={closePanel}>
                ×
              </button>
            </div>
            <div className="panel-content">
              {selectedCity?.people?.map((person, idx) => (
                <div key={`${person.name}-${idx}`} className="person-card">
                  <div className="person-name">{person.name}</div>
                  {person.url ? (
                    <a
                      href={person.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="person-link"
                    >
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      View Profile
                    </a>
                  ) : (
                    <span className="no-url">No profile URL</span>
                  )}
                </div>
              ))}
            </div>
          </aside>

          <div className="map-container">
            <div ref={mapContainer} />

            {!hasData && !isLoading && (
              <div className="hint-card">
                <div className="hint-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </div>
                <div className="hint-text">
                  <h4>Upload your CSV to get started</h4>
                  <p>
                    Expected columns: <code>Name</code>, <code>ProfileURL</code>,{" "}
                    <code>City</code>
                  </p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="loading-overlay">
                <div className="spinner" />
                <p>{loadingText}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
