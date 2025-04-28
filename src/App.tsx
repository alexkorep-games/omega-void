// src/App.tsx
import React from "react";
import Game from "./components/Game";
import "./index.css"; // Import global styles

function App() {
  return (
    <div className="App">
      {/* App knows very little, just renders the main Game component */}
      <Game />
    </div>
  );
}

export default App;
