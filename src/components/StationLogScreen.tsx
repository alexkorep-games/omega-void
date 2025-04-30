/* src/components/StationLogScreen.tsx */
// src/components/StationLogScreen.tsx
import React, { useCallback, useState, useEffect } from "react";
import { useGameState } from "../hooks/useGameState";
import { IStation } from "../game/types";
import "./Market.css"; // Reuse styles

const StationLogScreen: React.FC = () => {
  const { gameState, findStationById, setGameView, setViewTargetStationId } =
    useGameState();
  const { discoveredStations } = gameState;

  // Local state to hold station details fetched for the log
  const [logEntries, setLogEntries] = useState<
    Array<IStation & { discoveredIndex: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const entries: Array<IStation & { discoveredIndex: number }> = [];
    // Fetch details for each discovered station ID
    // Note: This assumes findStationById is reasonably fast or stations are cached.
    // For very large logs, pagination or virtual scrolling might be needed.
    discoveredStations.forEach((id, index) => {
      const station = findStationById(id);
      if (station) {
        entries.push({ ...station, discoveredIndex: index });
      } else {
        // Handle case where station data might not be available (should be rare)
        console.warn(`Could not find station data for logged ID: ${id}`);
      }
    });
    // Set entries based on the order in discoveredStations array
    setLogEntries(entries);
    setIsLoading(false);
  }, [discoveredStations, findStationById]);

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
                <th>COORDINATES</th>
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
                  <td>{`(${Math.floor(station.coordinates.x)}, ${Math.floor(
                    station.coordinates.y
                  )})`}</td>
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
