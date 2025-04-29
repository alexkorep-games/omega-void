import React, { useState } from "react";
import BuyCargoScreen from "./BuyCargoScreen";
import SellCargoScreen from "./SellCargoScreen";

const TradeScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");

  return (
    <div className="trade-screen">
      <div className="trade-tabs">
        <button
          className={activeTab === "buy" ? "active" : ""}
          onClick={() => setActiveTab("buy")}
        >
          Buy
        </button>
        <button
          className={activeTab === "sell" ? "active" : ""}
          onClick={() => setActiveTab("sell")}
        >
          Sell
        </button>
      </div>
      <div className="trade-content">
        {activeTab === "buy" ? <BuyCargoScreen /> : <SellCargoScreen />}
      </div>
    </div>
  );
};

export default TradeScreen;