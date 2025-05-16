# Omega Void v0.1

Omega Void is a 2D top-down retro-style space exploration, trading, and combat game. As a contracted AI pilot, your goal in version 0.1 is to earn your freedom by accumulating 100,000 Credits. Navigate the procedurally generated void, dock at space stations, trade commodities, upgrade your ship, and evade or engage hostile entities.

**[➡️ Read the Full Game Walkthrough & Guide](./docs/WALKTHROUGH.md) ⬅️**

## Features

*   **Infinite Procedural World:** Explore a vast universe with unique star systems, stations, and asteroid fields generated on the fly.
*   **Dynamic Trading System:** Buy and sell commodities across stations with prices influenced by local economy types and tech levels.
*   **Ship Upgrades:** Enhance your vessel with:
    *   Increased Cargo Capacity
    *   Stronger Shield Capacitors
    *   Faster Engine Boosters
    *   Weapon Autoloader (faster firing)
    *   Nav Computer (distance to target display)
*   **Real-Time Combat:** Engage hostile ships with your ship's weaponry.
*   **Touch Controls:** Designed for mobile-friendly gameplay with on-screen joystick and fire button.
*   **Docking & Station Services:** Seamless docking animations leading to station interfaces for trade, upgrades, info, and communication.
*   **Persistent State:** Your progress (coordinates, cash, cargo, upgrades, discovered stations, quest progress) is auto-saved to local storage.
*   **Quest System:** A simple quest system tracking your main objective for emancipation.
*   **HUD & Scanner:** In-flight Heads-Up Display showing critical information, including a local scanner for objects and navigation targets.
*   **Win Condition:** Achieve 100,000 Credits to complete the v0.1 objective and attain freedom!

## Tech Stack

*   **Frontend:** React, TypeScript
*   **Rendering:** Konva.js (for 2D canvas graphics)
*   **State Management:** Jotai
*   **Build Tool:** Vite
*   **Styling:** CSS Modules / Plain CSS

## Project Structure

A brief overview of the main directories:

*   `src/components`: Contains all React components for UI elements, game screens (e.g., `Game.tsx`, `MarketScreen.tsx`, `BottomToolbar.tsx`), and canvas rendering components (`KonvaPlayer.tsx`, etc.).
*   `src/game`: Houses the core game logic, entity classes (`Player.ts`, `Enemy.ts`), world generation (`InfiniteWorldManager.ts`), game configuration (`config.ts`), and market logic (`Market.ts`).
*   `src/hooks`: Custom React hooks managing game state (`useGameState.ts`), the game loop (`useGameLoop.ts`), touch input (`useTouchInput.ts`), and trade screen logic (`useTradeCargoLogic.ts`).
*   `src/quests`: Includes quest definitions (`v0.1.ts`), the quest engine (`QuestEngine.ts`), event types, and state management for quests.
*   `src/utils`: Utility functions for geometry calculations, local storage interaction, and messaging.
*   `public/`: Static assets.
*   `src/assets/`: (If used, for images, sounds, etc. - not present in provided files but typical)

## Getting Started

To run this project locally:

1.  **Prerequisites:**
    *   Node.js (v18.x or later recommended)
    *   npm or yarn

2.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-name>
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    This will usually start the game on `http://localhost:5173` (or another port if 5173 is busy).

## Key Components & Logic

*   **`src/App.tsx`**: Main application entry point, renders the `Game` component.
*   **`src/components/Game.tsx`**: Orchestrates the overall game, including rendering the `GameCanvas`, various UI screens (market, info, etc.), and managing the game loop via `useGameLoop` and `useGameState`.
*   **`src/hooks/useGameState.ts`**: The heart of the game's state management. It uses Jotai to manage the global game state, provides actions to modify the state (like purchasing upgrades, setting navigation targets), handles game initialization, saving/loading, and the main game update logic.
*   **`src/game/logic.ts`**: Contains the core rules for updating the game state frame by frame, including player movement, enemy AI, projectile updates, collision detection, and game view transitions.
*   **`src/game/world/InfiniteWorldManager.ts`**: Responsible for procedurally generating the game world (stars, stations, asteroids) as the player explores.
*   **`src/components/GameCanvas.tsx`**: Uses Konva.js to render all game entities (player, enemies, stations, HUD) onto the HTML5 canvas.
*   **`src/game/Market.ts`**: Defines commodities and the logic for generating market data (prices, quantities) at stations based on their economic profiles.
*   **`src/quests/QuestEngine.ts`**: Manages quest progression based on game events and player actions.

## Game Walkthrough

For a detailed guide on how to play, navigate the interface, trade effectively, upgrade your ship, and achieve the game's objective, please refer to the:

**[Omega Void v0.1 - Walkthrough & Guide](./docs/WALKTHROUGH.md)**

This document provides step-by-step instructions and tips to help you succeed.

## Future Enhancements (Potential Ideas)

*   More complex enemy AI and combat mechanics.
*   Deeper quest lines and story elements.
*   Additional ship types and more diverse upgrades.
*   Faction systems and reputation.
*   Sound effects and music.
*   Expanded universe with more unique locations and events.
*   More detailed comms system and interactions.

## License

MIT.