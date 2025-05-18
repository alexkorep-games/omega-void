import React, { useEffect, useState, useCallback } from "react";
import { useGameState } from "../hooks/useGameState";
import { IStation } from "../game/types";
import { COMMODITIES } from "../game/Market";
import { distance } from "../utils/geometry";
import "./Market.css"; // Reuse styles

interface CommodityStationsScreenProps {
  commodityKey: string | null;
}

interface StationCommodityInfo extends IStation {
  price: number;
  distanceFromCurrent: number;
}

const CommodityStationsScreen: React.FC<CommodityStationsScreenProps> = ({
  commodityKey,
}) => {
  const {
    gameState,
    findStationById,
    getOrInitializeStationMarketData,
    setGameView,
    setViewTargetStationId,
  } = useGameState();
  const { discoveredStations, dockingStationId, cash } = gameState;

  const [stationList, setStationList] = useState<StationCommodityInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const commodity = COMMODITIES.find((c) => c.key === commodityKey);
  const currentStation = findStationById(dockingStationId);

  useEffect(() => {
    if (!commodityKey || !currentStation) {
      setIsLoading(false);
      setStationList([]);
      return;
    }
    setIsLoading(true);
    const populatedList: StationCommodityInfo[] = [];

    discoveredStations.forEach((stationId) => {
      const station = findStationById(stationId);
      if (station && station.id !== currentStation.id) {
        // Exclude current station from list
        const marketData = getOrInitializeStationMarketData(station.id);
        const commodityInfo = marketData?.table[commodityKey];

        if (commodityInfo && commodityInfo.price > 0) {
          const dist = distance(
            currentStation.coordinates.x,
            currentStation.coordinates.y,
            station.coordinates.x,
            station.coordinates.y
          );
          populatedList.push({
            ...station,
            price: commodityInfo.price,
            distanceFromCurrent: dist,
          });
        }
      }
    });

    populatedList.sort((a, b) => a.distanceFromCurrent - b.distanceFromCurrent);
    setStationList(populatedList);
    setIsLoading(false);
  }, [
    commodityKey,
    discoveredStations,
    currentStation,
    findStationById,
    getOrInitializeStationMarketData,
  ]);

  const handleStationClick = useCallback(
    (stationId: string) => {
      setViewTargetStationId(stationId);
      setGameView("station_details");
    },
    [setGameView, setViewTargetStationId]
  );

  const handleBack = () => {
    // Go back to buy or sell screen, ideally based on where user came from.
    // For now, let's assume they came from buy_cargo or trade_select
    if (gameState.market) {
      // If market data exists, means they are docked.
      setGameView("buy_cargo"); // Or sell_cargo, but buy_cargo is a safe default
    } else {
      setGameView("station_log"); // Fallback if not docked (shouldn't happen from buy/sell)
    }
  };

  if (!commodityKey || !commodity) {
    return (
      <div className="market-container commodity-stations-screen">
        <div className="market-header">
          <div className="market-title">COMMODITY LOCATOR</div>
        </div>
        <div className="market-loading">No commodity selected...</div>
        <div className="market-footer">
          <button
            className="station-info-button"
            onClick={handleBack}
            style={{ borderColor: "#FFF", color: "#FFF" }}
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="market-container commodity-stations-screen">
      <div className="market-header">
        <div className="market-title">
          {commodity.key.toUpperCase()} LOCATOR
        </div>
        <div className="market-credits">{cash.toFixed(1)} CR</div>
      </div>
      <div className="market-instructions">
        Stations known to trade {commodity.key}. Sorted by distance from{" "}
        {currentStation?.name || "current location"}.
      </div>

      {isLoading ? (
        <div className="market-loading">Searching galactic network...</div>
      ) : (
        <div className="market-table-container">
          <table className="market-table">
            <thead>
              <tr>
                <th>STATION NAME</th>
                <th>PRICE</th>
                <th>DISTANCE (COORDS)</th>
                <th style={{ display: "none" }}></th>
              </tr>
            </thead>
            <tbody>
              {stationList.map((station) => (
                <tr
                  key={station.id}
                  onClick={() => handleStationClick(station.id)}
                >
                  <td>{station.name}</td>
                  <td>{station.price.toFixed(1)}</td>
                  <td>
                    {`${station.distanceFromCurrent.toFixed(0)} (${Math.floor(
                      station.coordinates.x
                    )}, ${Math.floor(station.coordinates.y)})`}
                  </td>
                  <td style={{ display: "none" }}></td>
                </tr>
              ))}
              {stationList.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4}>
                    No other known stations trade {commodity.key}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="market-footer">
        <button
          className="station-info-button"
          onClick={handleBack}
          style={{ borderColor: "#FFF", color: "#FFF" }}
        >
          BACK
        </button>
        <span>Data as of last visit.</span>
      </div>
    </div>
  );
};

export default CommodityStationsScreen;
