// src/components/StationLogScreen.tsx:
import React, { useCallback, useState, useEffect } from "react";
import { useGameState } from "../hooks/useGameState";
import { IStation } from "../game/types";
import "./Market.css"; // Reuse styles
import { distance } from "../utils/geometry";

const StationLogScreen: React.FC = () => {
  const { gameState, findStationById, setGameView, setViewTargetStationId } =
    useGameState();
  const { discoveredStations, dockingStationId } = gameState;

  const [logEntries, setLogEntries] = useState<
    Array<IStation & { distance: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentStation = findStationById(dockingStationId);

  useEffect(() => {
    setIsLoading(true);
    const entries: Array<IStation & { distance: number }> = [];

    const sourcePosition = currentStation
      ? currentStation.coordinates
      : gameState.player
      ? { x: gameState.player.x, y: gameState.player.y }
      : { x: 0, y: 0 };

    discoveredStations.forEach((id) => {
      const station = findStationById(id);
      if (station) {
        const dist = distance(
          sourcePosition.x,
          sourcePosition.y,
          station.coordinates.x,
          station.coordinates.y
        );
        // If current station is this station, distance is 0
        entries.push({
          ...station,
          distance: station.id === dockingStationId ? 0 : dist,
        });
      } else {
        console.warn(`Could not find station data for logged ID: ${id}`);
      }
    });

    entries.sort((a, b) => a.distance - b.distance);
    setLogEntries(entries);
    setIsLoading(false);
  }, [
    discoveredStations,
    findStationById,
    gameState.player,
    dockingStationId,
    currentStation,
  ]);

  const handleStationClick = useCallback(
    (stationId: string) => {
      setViewTargetStationId(stationId);
      setGameView("station_details");
    },
    [setGameView, setViewTargetStationId]
  );

  return (
    <div className="market-container station-log-screen">
      <div className="market-header">
        <div className="market-title">STATION LOG</div>
        <div className="market-credits">{logEntries.length} discovered</div>
      </div>
      <div className="market-instructions">
        Stations discovered during your travels. Sorted by distance. Click to
        view details.
      </div>

      {isLoading ? (
        <div className="market-loading">Loading log...</div>
      ) : (
        <div className="market-table-container">
          <table className="market-table">
            <thead>
              <tr>
                <th>STATION NAME</th>
                <th>DISTANCE</th>
                <th>COORDS</th>
                {/* Hide other columns */}
                <th style={{ display: "none" }}></th>
              </tr>
            </thead>
            <tbody>
              {logEntries.map((station) => (
                <tr
                  key={station.id}
                  onClick={() => handleStationClick(station.id)}
                >
                  <td>{station.name}</td>
                  <td
                    style={{
                      color: station.distance === 0 ? "#FFFF00" : "#00aaff",
                    }}
                  >
                    {" "}
                    {/* Highlight current station */}
                    {station.distance.toFixed(0)}
                  </td>
                  <td>
                    {`(${Math.floor(station.coordinates.x)}, ${Math.floor(
                      station.coordinates.y
                    )})`}
                  </td>
                  <td style={{ display: "none" }}></td>
                </tr>
              ))}
              {logEntries.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4}>No stations discovered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="market-footer">
        <span>End of log.</span>
      </div>
    </div>
  );
};

export default StationLogScreen;
