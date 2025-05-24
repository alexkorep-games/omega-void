import React, { useEffect, useState, useMemo } from "react";
import { useGameState } from "../hooks/useGameState";
import { IStation } from "../game/types";
import "./Market.css";
import "./MapScreen.css";

const MAP_RANGE = 10000;
const MAP_DIAMETER = MAP_RANGE * 2;
const DOT_R = 200;
const PLAYER_R = 250;
const GRID_SPACING = 2000;

const MapScreen: React.FC = () => {
  const {
    gameState: {
      player,
      dockingStationId,
      discoveredStations,
      navTargetStationId,
      cash,
      previousGameView,
    },
    findStationById,
    getObjectsInRegion,
    setGameView,
  } = useGameState();

  const [stations, setStations] = useState<IStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const center = useMemo(() => {
    if (dockingStationId) {
      const dock = findStationById(dockingStationId);
      if (dock) return dock.coordinates;
    }
    return player ? { x: player.x, y: player.y } : { x: 0, y: 0 };
  }, [player, dockingStationId, findStationById]);

  useEffect(() => {
    setLoading(true);
    const x0 = center.x - MAP_RANGE,
      y0 = center.y - MAP_RANGE;
    const objs = getObjectsInRegion(x0, y0, MAP_DIAMETER, MAP_DIAMETER).filter(
      (o) => o.type === "station"
    ) as IStation[];
    setStations(objs);
    setLoading(false);
  }, [center, getObjectsInRegion]);

  const viewBox = `${center.x - MAP_RANGE} ${
    center.y - MAP_RANGE
  } ${MAP_DIAMETER} ${MAP_DIAMETER}`;
  const handleBack = () =>
    setGameView(
      previousGameView ?? (dockingStationId ? "station_info" : "playing")
    );

  const gridLines = useMemo(() => {
    const lines: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      axis: boolean;
    }> = [];
    const minX =
      Math.floor((center.x - MAP_RANGE) / GRID_SPACING) * GRID_SPACING;
    const maxX =
      Math.ceil((center.x + MAP_RANGE) / GRID_SPACING) * GRID_SPACING;
    const minY =
      Math.floor((center.y - MAP_RANGE) / GRID_SPACING) * GRID_SPACING;
    const maxY =
      Math.ceil((center.y + MAP_RANGE) / GRID_SPACING) * GRID_SPACING;
    for (let x = minX; x <= maxX; x += GRID_SPACING)
      lines.push({ x1: x, y1: minY, x2: x, y2: maxY, axis: x === 0 });
    for (let y = minY; y <= maxY; y += GRID_SPACING)
      lines.push({ x1: minX, y1: y, x2: maxX, y2: y, axis: y === 0 });
    return lines;
  }, [center]);

  return (
    <div className="market-container map-screen">
      <div className="market-header">
        <div className="market-title">SYSTEM MAP</div>
        <div className="market-credits">{cash.toFixed(1)} CR</div>
      </div>
      <div className="map-svg-container">
        {loading ? (
          <div className="market-loading">Loading map...</div>
        ) : (
          <svg
            className="map-svg"
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
          >
            {gridLines.map((ln, i) => (
              <line
                key={i}
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2}
                y2={ln.y2}
                className={ln.axis ? "map-axis-line" : "map-grid-line"}
              />
            ))}
            {stations.map((st) => {
              const disc = discoveredStations.includes(st.id);
              const nav = st.id === navTargetStationId;
              const cls = nav
                ? "map-station-dot nav-target"
                : disc
                ? "map-station-dot discovered"
                : "map-station-dot undiscovered";
              const isSelected = st.id === selectedStationId;
              return (
                <g key={st.id}>
                  <circle
                    cx={st.coordinates.x}
                    cy={st.coordinates.y}
                    r={DOT_R}
                    className={cls}
                    style={{ cursor: disc ? "pointer" : "default" }}
                    onClick={() => {
                      if (disc) setSelectedStationId(st.id);
                    }}
                  />
                  {disc && isSelected && (
                    <text
                      x={st.coordinates.x}
                      y={st.coordinates.y - DOT_R - 400}
                      className="map-station-name"
                    >
                      {st.name}
                    </text>
                  )}
                </g>
              );
            })}
            <circle
              cx={center.x}
              cy={center.y}
              r={PLAYER_R}
              className="map-player-marker"
            />
          </svg>
        )}
      </div>
      <div className="map-legend">{/* …legend items… */}</div>
      <div className="market-footer">
        <button className="station-info-button" onClick={handleBack}>
          BACK
        </button>
        <span>
          Center: {center.x.toFixed(0)}, {center.y.toFixed(0)}
        </span>
      </div>
    </div>
  );
};

export default MapScreen;
