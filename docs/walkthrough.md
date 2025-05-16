# Omega Void v0.1 - Walkthrough & Guide

Welcome, Commander, to the Omega Void! This guide will help you navigate the vastness of space, master the art of trading, upgrade your ship, and ultimately, achieve emancipation.

**Current Objective (Omega Void v0.1):** Accumulate 100,000 Credits to secure your freedom.

## Table of Contents

1.  [Introduction](#introduction)
2.  [Getting Started](#getting-started)
    - [Starting a New Game / Loading](#starting-a-new-game--loading)
    - [Settings Menu](#settings-menu)
3.  [Interface Overview](#interface-overview)
    - [Flight View (Playing)](#flight-view-playing)
    - [Docked View](#docked-view)
    - [Touch Controls](#touch-controls)
4.  [Navigating the Void](#navigating-the-void)
    - [Your First Steps in Space](#your-first-steps-in-space)
    - [Coordinates & The Scanner](#coordinates--the-scanner)
    - [Discovering Stations & The Station Log](#discovering-stations--the-station-log)
    - [Setting a Navigation Target](#setting-a-navigation-target)
5.  [Docking Procedures](#docking-procedures)
6.  [Station Services: Your Lifeline](#station-services-your-lifeline)
    - [The Market (Trading)](#the-market-trading)
    - [Shipyard (Upgrades)](#shipyard-upgrades)
    - [Other Services](#other-services)
    - [Station Information & Logs](#station-information--logs)
    - [Undocking](#undocking)
7.  [The Path to 100,000 Credits](#the-path-to-100000-credits)
    - [Trading Strategy](#trading-strategy)
    - [Recommended Upgrades](#recommended-upgrades)
8.  [Combat & Survival](#combat--survival)
    - [Engaging Enemies](#engaging-enemies)
    - [Ship Destruction & Respawning](#ship-destruction--respawning)
9.  [Contract Status (Quests)](#contract-status-quests)
10. [Winning the Game](#winning-the-game)
11. [Tips for New Commanders](#tips-for-new-commanders)

---

## 1. Introduction

Omega Void is a space exploration, trading, and combat game. You start as a contracted pilot, and your primary goal in version 0.1 is to earn your freedom by accumulating **100,000 Credits**. This will involve exploring star systems, docking at various space stations, trading commodities, and upgrading your ship to become more efficient and resilient.

## 2. Getting Started

### Starting a New Game / Loading

- **Loading:** When you first launch the game, it will automatically attempt to load any previously saved progress.
- **New Game:** If no save data is found, or if you choose to start fresh, a new game will begin with default starting conditions:
  - Player at coordinates (0,0).
  - Starting Cash: 100.0 CR.
  - Basic ship with default cargo capacity and 100% shields.

### Settings Menu

- Located at the top-right of the screen, represented by a **+** icon.
- **New Game:** Click this button to start a new game. **Warning:** This will erase your current progress (coordinates, cash, cargo, upgrades, discovered stations, and quest progress). You will be asked for confirmation.
- **Close:** Closes the settings popup.

The game auto-saves your progress at regular intervals (every 5 seconds).

## 3. Interface Overview

The game has two main interface states: Flight View (when you're flying in space) and Docked View (when you're at a station).

### Flight View (Playing)

This is where you'll spend your time exploring, traveling, and engaging in combat.

- **Main Screen:** Shows your ship, surrounding stars, stations, asteroids, and any enemies or projectiles.
- **Coordinates Display (Top-Left):** Shows your current X and Y coordinates in the galaxy.
- **HUD (Bottom of the Screen):**
  - **Left Panel:**
    - **CASH:** Your current credits.
    - **NAV:** Your current navigation target's name (or "LOCAL" if none).
    - **DIST:** Distance to your NAV target (requires the "Nav Computer" upgrade).
    - **SHIELD:** A bar representing your current shield level, along with a numeric display (e.g., 100/100).
  - **Center Panel (Scanner):**
    - An elliptical display showing objects around your ship.
    - **Your Ship:** Small magenta blip at the center.
    - **Stations:** Larger cyan blips (or yellow if it's your NAV target).
    - **Enemies:** Cyan blips.
    - **Projectiles:** Small white blips.
    - **Nav Target Indicator:** If your NAV target is off-scanner, a yellow dot will appear on the edge of the scanner indicating its direction.
  - **Right Panel:**
    - **STATUS:** General status information.
    - **Target:** (Targeting system not fully implemented in v0.1).

### Docked View

When docked at a station, the flight view is replaced by a station interface screen, and a bottom toolbar appears.

- **Main Content Panel:** This area displays different screens based on your selection from the bottom toolbar (e.g., Market, Station Info).
- **Bottom Toolbar:**
  - **Market:** Accesses the "Trade & Services" screen, where you can buy/sell cargo, upgrade your ship, and replenish shields. Active when viewing Market, Buy, Sell, or Upgrade screens.
  - **Info:** Displays information about the current station, and provides access to the "Contract Log" and "Station Log". Active when viewing Station Info or Station Details screens.
  - **Comms:** Shows the "Communications Log" (currently informational).
  - **Undock:** Allows you to leave the station and return to flight view.

### Touch Controls (During Flight)

- **Movement (Left side of the screen, below HUD):**
  - Touch and hold on the left half of the game view area. A joystick visual will appear.
  - Drag your finger from the initial touch point to move your ship. The further you drag (up to a limit), the faster you'll move in that direction. Your ship will orient itself in the direction of movement.
- **Shooting (Right side of the screen, below HUD):**
  - Tap or hold on the right half of the game view area to fire projectiles in the direction your ship is currently facing. A visual indicator will appear at your touch point.

## 4. Navigating the Void

Space is vast, but with the right tools and knowledge, you can master it.

### Your First Steps in Space

You'll start at or near the origin station, **`station_0_0`**. Your initial goal is to find other stations to trade with. Fly around using the movement controls. As you explore, new cells of the universe will be generated procedurally around you, revealing stars, other stations, and asteroid fields.

### Coordinates & The Scanner

- **Coordinates (Top-Left):** Keep an eye on your X and Y coordinates to get a sense of your location.
- **Scanner (HUD Center):** Your primary tool for local awareness.
  - Stations appear as larger blips. Your current navigation target station will be highlighted in yellow.
  - Other objects like enemies and asteroids will also appear.

### Discovering Stations & The Station Log

- When you first dock at a station, it's added to your **Station Log**.
- To access the Station Log:
  1.  Dock at any station.
  2.  Tap the **Info** button on the bottom toolbar.
  3.  On the Station Info screen, tap the **STATION LOG** button.
- The **Station Log screen** lists all stations you've discovered.
  - It shows the station name and its distance from your current location, along with its coordinates.
  - **Clicking a station in the log** will take you to the **Station Details screen**.

### Setting a Navigation Target

To make travel easier, you can set a station as your navigation target.

- **From Station Details Screen:**
  1.  Access the Station Log and click on a station to view its details.
  2.  On the **Station Details screen**, click the **NAVIGATE** button. If it's already your target, it will say **NAV ON**; clicking it again will turn navigation off for this target.
- **From Station Info Screen (for the currently docked station):**
  1.  When docked, click the **Info** button.
  2.  Click the **NAVIGATE** button to set the current station as your target (useful if you undock and want to return).

Once a NAV target is set:

- Its name appears in the HUD's NAV field.
- It's highlighted in yellow on the scanner and in the main view.
- A yellow dot on the edge of your scanner will point towards it if it's off-screen.
- If you have the **Nav Computer** upgrade, the HUD will also display the **DIST** (distance) to the target.

## 5. Docking Procedures

Docking allows you to access station services.

1.  **Approach the Station:** Fly towards the station.
2.  **Align with an Entrance:** Stations are octagonal. They rotate. You need to approach an "opening" or flat edge. The correct approach angle is generally from the "rear" of the station relative to its rotation and drawn docking arms/ports. If you are approaching from an incorrect angle relative to the station's facing (its `angle` property, visualized by its structure), you might bounce off.
3.  **Proximity:** Get very close to the station's surface at a valid entry point.
4.  **Automatic Docking:** If your angle and proximity are correct, your ship will automatically be pulled in, and a docking animation will play. Your ship's velocity will be zeroed out.

After the animation, you'll be in the Docked View.

## 6. Station Services: Your Lifeline

Once docked, the Bottom Toolbar gives you access to various services.

### The Market (Trading)

This is your primary way to earn credits.

1.  Click **Market** on the bottom toolbar. This opens the **TRADE & SERVICES** screen.
2.  From here, you can choose:
    - **BUY CARGO:**
      - Displays commodities available for purchase at the current station.
      - Shows **PRODUCT** (name), **UNIT** (t, kg, g), **PRICE** (per unit), and **QTY** (quantity available at station).
      - Click an item to buy 1 unit.
      - Pay attention to your **Cargo Space** (bottom-left) and **Credits** (top-right).
      - Status messages at the bottom will indicate success or errors (e.g., "Insufficient credits," "Insufficient cargo space").
    - **SELL CARGO:**
      - Displays commodities currently in your ship's cargo hold that the station is willing to buy.
      - Shows **PRODUCT**, **UNIT**, **SELL PRICE**, and **IN HOLD** (quantity you possess).
      - Click an item to sell _all_ units of that commodity you are holding.
      - If a station doesn't buy a particular item, its sell price will be "-" or very low.
      - Status messages will appear at the bottom.

### Shipyard (Upgrades)

1.  Click **Market** on the bottom toolbar, then **SHIP UPGRADES** on the Trade & Services screen.
2.  The **Upgrade Screen** lists available ship enhancements:
    - **Cargo Pods:** Increases your ship's cargo capacity by 5 tonnes per level (Max Level 4). Essential for maximizing trading profits.
    - **Shield Capacitor:** Increases your maximum shield strength by 25% per level (Max Level 3). Improves survivability.
    - **Engine Booster:** Increases your ship's top speed by 20% per level (Max Level 3). Allows faster travel and better combat maneuvering.
    - **Autoloader:** Halves your weapon's firing cooldown (Max Level 1). Doubles your rate of fire.
    - **Nav Computer:** Enables the "DIST" (distance) display to your NAV target on the HUD (Max Level 1). Highly recommended for efficient navigation.
3.  Each upgrade shows its **Name**, **Effect**, current **Level/Status**, **Cost** for the next level/purchase, and a **PURCHASE/UPGRADE** button.
    - The button will be disabled if you can't afford it or it's at max level.
    - Hovering over the button (or its title attribute) provides more information.
    - Status messages at the bottom confirm purchase or indicate errors.

### Other Services

From the **Trade & Services** screen (accessed via **Market** button):

- **REPLENISH SHIELDS:**
  - Restores your ship's shields to their maximum capacity.
  - The cost is displayed on the button (1 CR per 1% of _max_ shield needing replenishment).
  - Disabled if shields are full or you cannot afford it.

### Station Information & Logs

1.  Click **Info** on the bottom toolbar to open the **Station Info Screen** for the currently docked station.
    - Displays the station's **Name**, **Type**, **Coordinates**, **Economy Type**, and **Technology Level**.
    - From here, you can:
      - **CONTRACT:** Opens the **Contract Status** screen (see [Contract Status (Quests)](#contract-status-quests)).
      - **STATION LOG:** Opens the **Station Log screen**, listing all discovered stations. You can click a station here to view its details or set it as a NAV target.
      - **NAVIGATE / NAV ON:** Toggles navigation to the current station.
2.  From the **Station Log screen**, clicking any station name takes you to the **Station Details Screen** for that specific station.
    - Shows detailed information like on the Station Info screen.
    - **Commodity Data (Live):** This crucial section lists commodities, their current **Price** and **Quantity (Qty)** at _that selected station_. It also shows a **Diff** column, which compares the price of each commodity at the selected station to its price at your _currently docked station_ (if you are docked elsewhere).
      - Positive green "Diff": The item is more expensive at the selected station (good for selling there).
      - Negative red "Diff": The item is cheaper at the selected station (good for buying there).
    - You can **NAVIGATE** to this station or go **BACK TO LOG**.

### Undocking

- Click the **Undock** button on the bottom toolbar.
- An undocking animation will play, and you'll be returned to the Flight View just outside the station.

## 7. The Path to 100,000 Credits

Your main objective is to earn 100,000 Credits. The most effective way to do this is through trading.

### Trading Strategy

1.  **Discover Stations:** Fly around and dock at new stations to add them to your Station Log. The more stations you know, the more trading opportunities you'll find.
2.  **Scout Prices:**
    - When docked, go to **Info** -> **STATION LOG**.
    - Click on a discovered station to open its **Station Details Screen**.
    - Examine the **Commodity Data (Live)** table, paying close attention to the **Diff** column. This tells you if a commodity is cheaper or more expensive at the remote station compared to where you are currently docked.
    - Look for items with a significant negative "Diff" (buy opportunities at the remote station) or positive "Diff" (sell opportunities). Also check the "Qty" to ensure there's stock to buy or demand to sell.
3.  **Establish Trade Routes:**
    - Find a commodity that is cheap at Station A (e.g., "Alloys" produced by an Industrial station) and expensive at Station B (e.g., an Agricultural station that needs Alloys).
    - Fly to Station A, use the **Market** -> **BUY CARGO** screen to buy the cheap commodity.
    - Fly to Station B, use the **Market** -> **SELL CARGO** screen to sell it for a profit.
4.  **Maximize Cargo:** The more you can carry, the more profit you make per trip. Prioritize **Cargo Pod** upgrades.
5.  **Repeat and Re-invest:** Use your profits to buy more cargo and better ship upgrades, which will accelerate your earnings.

**Example:**

- You are docked at "Gateway Prime" (Agricultural).
- You check your Station Log and view details for "Orbital Hub" (Rich Industrial).
- On Orbital Hub's details, you see "Food" has a Price of 8.0 and a "Diff" of +3.0 (meaning it's 3 CR more expensive there than at Gateway Prime). "Machinery" has a Price of 100.0 and a "Diff" of -25.0 (meaning it's 25 CR cheaper there).
- **Plan:**
  1.  At Gateway Prime, **BUY CARGO**: Buy "Food" (cheap here).
  2.  Fly to Orbital Hub.
  3.  At Orbital Hub, **SELL CARGO**: Sell "Food" (for a profit).
  4.  At Orbital Hub, **BUY CARGO**: Buy "Machinery" (cheap here).
  5.  Fly back to Gateway Prime (or another station that needs Machinery).
  6.  At Gateway Prime, **SELL CARGO**: Sell "Machinery" (for a profit).

### Recommended Upgrades

- **Cargo Pods:** Your top priority. More cargo = more profit.
- **Nav Computer:** Makes finding your NAV target much easier by showing its distance. Invaluable for efficient trading.
- **Engine Booster:** Faster travel times mean more trades per hour. Also helps in escaping enemies.
- **Shield Capacitor:** Increases your survivability if you get into fights.
- **Autoloader:** If you find yourself fighting often, this significantly boosts your damage output.

## 8. Combat & Survival

While trading is key, you may encounter hostile ships.

### Engaging Enemies

- Enemies appear as cyan blips on your scanner and as cyan, angular ships in the main view.
- They will typically move towards you.
- To fight back, orient your ship towards the enemy (by initiating movement in their direction) and tap/hold the right side of the screen to fire.
- Destroyed enemies explode.

### Ship Destruction & Respawning

- If your shields (displayed on the HUD) are depleted by enemy fire or collisions (e.g., with asteroids), your ship will be destroyed.
- A large explosion animation will play.
- **Consequences:**
  - You will lose any cargo you were carrying.
  - Your cash, upgrades, discovered stations, and quest progress are **kept**.
- **Respawning:** After a short delay (3 seconds), you will respawn:
  - At the last station you were docked at.
  - If you haven't docked anywhere yet, you'll respawn near the origin station (`station_0_0`).
  - Your shields will be fully restored to their current maximum capacity.

It's often wise to flee from combat if outmatched or low on shields, especially if carrying valuable cargo. Dock at a station to replenish shields.

## 9. Contract Status (Quests)

Your progress towards the main goal is tracked in the **Contract Status** panel.

1.  Dock at a station.
2.  Click **Info** on the bottom toolbar.
3.  Click the **CONTRACT** button.

This will open the **QuestPanel**, showing:

- **Quest Title:** Omega Void v0.1: First Steps
- **Description:** Achieve basic emancipation by fulfilling the initial requirements: secure funds.
- **Emancipation Progress:** A percentage showing how close you are to 100,000 Credits. (e.g., if you have 50,000 CR, it will show 50%).
- **Objectives:**
  - `[ ] [YourCurrentCR / 100000] Accumulate 100,000 Credits`
  - The `[ ]` will become `[✔]` when the objective is complete.

## 10. Winning the Game (v0.1)

Once your **CASH** reaches **100,000 Credits**:

- The "Emancipation Progress" in your Contract Status will reach 100%.
- The game will transition to a win screen:
  - Title: **CONTRACT VOID**
  - Message: **YOU ARE FREE**
  - Emancipation Score: 100.0%
- This marks the completion of Omega Void v0.1! Further objectives are pending future system updates.

## 11. Tips for New Commanders

- **Save & Load:** The game auto-saves. If you want a completely fresh start, use the "New Game" option in Settings, but be aware it erases everything.
- **Prioritize Upgrades:** Cargo Pods and Nav Computer are excellent early investments for traders.
- **Study the Markets:** Use the Station Details screen to understand what commodities are in demand or surplus at different stations based on their economy types.
- **Don't Get Stranded:** Keep track of your coordinates. If you fly too far without finding stations, it can be a long trip back. Use the Station Log and Nav Target features.
- **Shields Are Life:** Replenish shields at stations if they get low. Running from a fight is better than losing your cargo.
- **Asteroids Hurt:** Avoid colliding with asteroids; they can destroy your ship quickly.

Good luck out there, Commander. The void is challenging, but freedom awaits!
