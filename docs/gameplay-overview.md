## Gameplay Overview: Omega Void

**Core Concept:**
Omega Void is a top-down 2D space simulation game focusing on exploration, trading, and survival within a vast, procedurally generated universe. Players pilot a small spacecraft, navigating by coordinates, engaging in basic combat, docking at space stations, and trading commodities to earn credits. The game features a distinctive minimalist retro vector graphics aesthetic.

**Setting:**
The game takes place in a seemingly infinite expanse of space. The universe is procedurally generated based on a grid system (cells), ensuring endless variety and encouraging exploration. Space is sparsely populated with stars and occasional space stations. The visual style is stark and minimalist, using neon vector lines (cyan, magenta, yellow) against a black void, evoking classic arcade or early computer space games.

**Player Experience:**

1.  **Ship Control & Movement:**
    *   The player controls a single ship (magenta vector shape) from a top-down perspective.
    *   Movement is handled via a virtual touch joystick on the left side of the screen (when playing). The ship moves in the direction indicated by the joystick, and its visual orientation updates to match the direction of travel.
    *   There's no complex physics model; movement is direct based on input.

2.  **Navigation & World Interaction:**
    *   **Coordinates:** The player's absolute position in the vast universe is displayed via X and Y coordinates in the top-left corner.
    *   **HUD Scanner:** The central panel of the Heads-Up Display (HUD) features an elliptical scanner. It shows nearby objects relative to the player:
        *   Stations appear as larger squares (cyan by default).
        *   Enemies appear as smaller squares (cyan).
        *   Projectiles appear as tiny dots (white).
        *   The player is represented by a central blip (magenta).
    *   **Navigation Target:** Players can select a discovered station as a navigation target (from the Station Info or Station Details screens).
        *   When a target is set, its ID appears in the NAV section of the HUD.
        *   A visual indicator (a yellow chevron/triangle) appears below the NAV text, pointing in the direction of the selected station.
        *   The targeted station's blip on the scanner also turns yellow and may appear slightly larger.
    *   **Discovery:** Stations encountered and docked at are added to a persistent "Station Log."

3.  **Exploration:**
    *   Players are free to fly anywhere in the infinite world.
    *   The primary goal of exploration is discovering new space stations, each with unique names, coordinates, economies, and tech levels.
    *   The vastness and procedural nature mean players rely heavily on coordinates and the station log to find their way back or chart new routes.

4.  **Combat & Survival:**
    *   **Enemies:** Players will encounter hostile enemy ships (cyan vector shapes) that move towards and collide with the player.
    *   **Shooting:** Players can fire projectiles (white dots) from the front of their ship by tapping/holding on the right side of the screen (when playing). There's a short cooldown between shots.
    *   **Shields:** The player ship has a shield, represented by a percentage and a bar on the HUD. Collisions with enemies deplete the shield. Reaching 0% shield results in the ship's destruction. Shields can be replenished at stations for a cost.
    *   **Destruction:** When the player ship or an enemy ship is destroyed, a particle explosion animation occurs.
    *   **Respawn:** If the player is destroyed, they respawn after a short delay, typically near the last station they docked at (or the origin if they haven't docked). Cash and discovered stations are retained, but cargo is lost. Enemies and projectiles are cleared upon respawn.

5.  **Stations & Interaction:**
    *   **Docking:** To interact with a station, the player must approach its designated docking entrance (visually implied, likely opposite the main structure) at the correct relative angle. A successful approach triggers a docking animation (expanding/contracting circles).
    *   **Docked Interface:** Once docked, the game view switches from the space view to a series of menu screens:
        *   **Trade Select:** Options to Buy Cargo, Sell Cargo, or Replenish Shields.
        *   **Buy/Sell Cargo:** Market screens listing commodities, prices, station stock (for buying), and player cargo (for selling). Prices and availability vary based on the station's economy type and tech level.
        *   **Station Info:** Displays details about the currently docked station (name, type, coordinates, economy, tech level). Provides options to view the Station Log or set the current station as a Nav Target.
        *   **Station Log:** Lists all previously discovered stations with their names and coordinates. Clicking an entry leads to the Station Details screen.
        *   **Station Details:** Shows detailed information for a station selected from the log. Allows setting that station as a Nav Target.
        *   **Messages:** A screen for potential future communication logs (currently shows placeholder messages).
        *   **Bottom Toolbar:** Provides quick navigation between the main docked screens (Trade, Info, Messages, Undock).
    *   **Undocking:** Selecting "Undock" initiates an undocking animation, after which the player regains control of their ship just outside the station.

**Economy & Progression:**

*   **Trading:** The core economic loop involves buying commodities cheap at one station (e.g., Food at an Agricultural station) and selling them for a profit at another (e.g., Food at an Industrial station).
*   **Commodities:** Various goods (Food, Machinery, Alloys, Luxuries, etc.) exist, each with a base price, unit (tonnes, kg, g), and economic factors affecting local price/quantity. Some require minimum station tech levels to appear.
*   **Cargo Management:** The player ship has a limited cargo capacity (measured in tonnes). Players must manage their cargo hold to maximize profit.
*   **Cash (CR):** Credits are earned by selling commodities and potentially lost by buying goods or replenishing shields. Cash is the primary measure of progression currently. (Ship upgrades are not explicitly implemented in the provided code).

**User Interface (UI):**

*   **Game View:** The main screen showing the player ship, space, stars, stations, enemies, projectiles. Coordinates displayed top-left. Settings icon top-right.
*   **HUD:** A horizontal bar at the bottom of the game view displaying critical information: Cash, Nav Target, Shield Level/Bar, Scanner, Status/Targeting (currently basic).
*   **Docked Screens:** Full-screen text-based interfaces with cyan borders and monospace fonts, themed by color (Magenta for Buy, Green for Sell, Yellow for Info, Blue for Log).
*   **Settings Menu:** Accessed via a '+' icon, providing options like "New Game."

**Persistence:**
The game automatically saves the player's state periodically to the browser's local storage. Saved data includes:
*   Current X, Y coordinates.
*   Current cash (CR).
*   Contents of the cargo hold.
*   ID of the last station docked at.
*   List of discovered station IDs.

Starting a "New Game" resets this progress.

**Overall Tone/Feeling:**
The gameplay evokes a sense of exploration and isolation in a vast, potentially dangerous universe. The minimalist graphics and focus on navigation and resource management create a retro, somewhat hardcore feel. Discovery of new stations and successful trade runs provide moments of reward. Combat is direct and carries the risk of losing cargo and progress.

**Potential Story Hooks (Based on Gameplay):**

*   **The Infinite Expanse:** Why is space seemingly endless? Are there boundaries? What lies far beyond known coordinates?
*   **The Player's Role:** Who is the player? A simple trader trying to make a living? An explorer charting the unknown? Someone escaping their past? What drives them?
*   **The Stations:** Are they independent outposts? Part of a larger, unseen civilization or multiple factions? Why the disparity in tech and economy? Are some older or newer than others?
*   **The Enemies:** Are they pirates, automated defense systems, territorial aliens, or something else? Do they have bases or origins?
*   **Rare Goods:** Where do "Alien Items" or high-tech components originate? Are there specific, hard-to-find locations holding valuable secrets or resources?
*   **The Goal:** Is there an end-game? Reaching a specific legendary station? Uncovering a mystery related to the universe's nature or the origin of the stations/enemies? Amassing a fortune? Simply surviving?
