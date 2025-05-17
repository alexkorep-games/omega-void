/* src/components/StationLogScreen.tsx */
// src/components/StationLogScreen.tsx
import React, { useCallback, useState, useEffect } from "react";
import { useGameState } from "../hooks/useGameState";
import { IStation } from "../game/types";
import "./Market.css"; // Reuse styles
import { distance } from "../utils/geometry"; // Import utility for distance calculation

const StationLogScreen: React.FC = () => {
  const { gameState, findStationById, setGameView, setViewTargetStationId } =
    useGameState();
  const { discoveredStations } = gameState.cold;

  // Local state to hold station details fetched for the log
  const [logEntries, setLogEntries] = useState<
    Array<IStation & { discoveredIndex: number; distance: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const entries: Array<
      IStation & { discoveredIndex: number; distance: number }
    > = [];
    const playerPosition = {
      x: gameState.hot.player?.x || 0,
      y: gameState.hot.player?.y || 0,
    }; // Default to origin if player position is unavailable

    discoveredStations.forEach((id, index) => {
      const station = findStationById(id);
      if (station) {
        const dist = distance(
          playerPosition.x,
          playerPosition.y,
          station.coordinates.x,
          station.coordinates.y
        );
        entries.push({
          ...station,
          discoveredIndex: index,
          distance: dist < 50 ? 0 : dist,
        }); // Set distance to 0 if within 50 units
      } else {
        console.warn(`Could not find station data for logged ID: ${id}`);
      }
    });

    // Sort entries by distance
    entries.sort((a, b) => a.distance - b.distance);

    setLogEntries(entries);
    setIsLoading(false);
  }, [discoveredStations, findStationById, gameState.hot.player]);

  const handleStationClick = useCallback(
    (stationId: string) => {
      setViewTargetStationId(stationId); // Set the target ID for the details view
      setGameView("station_details"); // Switch to the details view
    },
    [setGameView, setViewTargetStationId]
  );

  return (
    <div className="market-container station-log-screen">
      <div className="market-header">
        <div className="market-title">STATION LOG</div>
        {/* Optional: Display total count */}
        <div className="market-credits">{logEntries.length} discovered</div>
      </div>
      <div className="market-instructions">
        Stations discovered during your travels. Click to view details.
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
                {/* Hide other columns */}
                <th style={{ display: "none" }}></th>
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
                  <td>{`${station.distance.toFixed(0)} (${Math.floor(
                    station.coordinates.x
                  )}, ${Math.floor(station.coordinates.y)})`}</td>
                  {/* Hide other columns */}
                  <td style={{ display: "none" }}></td>
                  <td style={{ display: "none" }}></td>
                </tr>
              ))}
              {logEntries.length === 0 && !isLoading && (
                <tr>
                  <td
                    colSpan={4} // Match original table structure even if columns hidden
                    style={{ textAlign: "center", color: "#888" }}
                  >
                    No stations discovered yet. Dock at a station to add it to
                    the log.
                  </td>
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
