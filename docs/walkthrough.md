## Omega Void v0.1: The Road to Freedom - Walkthrough & Guide

Welcome, Commander, to the vast expanse of Omega Void! Strapped into your cockpit with little more than a basic ship and a handful of credits, your goal is clear: **achieve emancipation**. In this v0.1 release, that means completing a specific set of objectives tracked by your **Emancipation Progress** percentage, visible in the "CONTRACT STATUS" screen (Quest Panel).

This guide will walk you through the necessary steps to hit 100% and break free!

**The Core Objectives (Your Freedom Checklist):**

Your path to 100% Emancipation requires completing these five key tasks:

1.  **Accumulate 100,000 Credits:** Show you've got the financial independence.
2.  **Acquire Contract Fragment Alpha:** Find a piece of your legal puzzle.
3.  **Acquire Contract Fragment Beta:** Recover another crucial segment.
4.  **Acquire Contract Fragment Charlie:** Secure the final contract piece.
5.  **Collect 4 Beacon Access Keys:** Prove you can navigate and access restricted systems.

Let's break down how to tackle each one.

### Phase 1: Getting Started & Building Your Bankroll

You start with minimal cash and cargo space. Your first priority is survival and making money.

1.  **Learn to Trade:** This is your primary income source.
    *   **Dock:** Fly close to a station (like the starting "Point Alpha" at 0,0) and use the docking maneuver (fly towards the 'opening' opposite the station's rotation direction).
    *   **Check Market:** Once docked, go to "Market" > "BUY CARGO" or "SELL CARGO".
    *   **Buy Low, Sell High:** The classic formula. Pay attention to station economies (shown in Station Info).
        *   *General Tip:* Agricultural stations often produce Food/Textiles cheaply and need Machinery/Computers. Industrial stations are the reverse. High Tech stations produce Computers/Luxuries and might pay well for basic goods or Furs.
    *   **Use the Station Log:** As you discover stations, they appear in the "Info" > "STATION LOG". Click a station to view "STATION DETAILS". This screen shows known commodity prices (if you've visited or manually entered them) and allows you to compare prices ("Diff") against your current docked station's market. This is CRUCIAL for planning profitable routes.
    *   **Manual Price Logging:** In "STATION DETAILS", you can manually input prices you've observed. Keep your intel up-to-date!

2.  **Early Upgrades (Recommended):**
    *   **Cargo Pods:** Your absolute FIRST priority. You start with very limited space (around 10t). Each upgrade level adds 5t. You'll need at least 20t capacity later for a quest objective. Find the "SHIP UPGRADES" option in the "TRADE & SERVICES" menu when docked. Costs start at 1000 CR.
    *   **Nav Computer:** Cheap (500 CR) and very useful. When you set a "NAVIGATE" target in Station Info/Details, this upgrade shows the distance to the target on your HUD.

### Phase 2: Tackling the Emancipation Objectives

Once you have a decent cash flow (a few thousand CR) and maybe the first Cargo Pod upgrade, start hunting down the specific objectives.

**Objective 1: Accumulate 100,000 Credits**

*   **How:** Keep trading! Find profitable routes using the Station Log/Details. Don't be afraid to travel further for better margins. Avoid losing your ship, as respawning likely resets your cargo and potentially costs time/money.
*   **Tips:**
    *   Higher tech stations often have more valuable goods like Computers or Luxuries.
    *   Exploit price differences shown in the "Diff" column in Station Details.
    *   Keep upgrading Cargo Pods to maximize profit per trip.

**Objective 2: Acquire Contract Fragment Alpha**

*   **Location:** **Orion Citadel (Corp HQ)** - This is a fixed station at coordinates **(-3500, 1400)**. Its ID is `station_-10_4_fixA`.
*   **Requirement:** **15,000 Credits**.
*   **How:**
    1.  Fly to the coordinates (-3500, 1400). Use the Station Log/Details to set it as a Nav Target if you've found another station first to log it. Otherwise, fly manually using the coordinates display.
    2.  Dock at Orion Citadel.
    3.  Go to the "Info" screen (Station Info).
    4.  Look for a "Special Actions" section with a button like "Buy Fragment Alpha (15000 CR)".
    5.  Click the button (if you have enough cash). The item `contract_frag_a` will be added to your Quest Inventory (not cargo).
*   **Tips:** Make sure you have the 15k CR *before* you make the trip!

**Objective 3: Acquire Contract Fragment Beta**

*   **Location:** **Zeta Relay (Abandoned)** - Fixed station at coordinates **(1750, -2800)**. ID: `station_5_-8_fixB`.
*   **Requirement:** **20t of Machinery** in your cargo hold.
*   **How:**
    1.  **Get Cargo Space:** Ensure you have **at least 20t** of cargo capacity (requires Cargo Pod upgrades).
    2.  **Buy Machinery:** Find an Industrial station (check Station Log/Details for economy type) and buy 20 units (tonnes) of Machinery.
    3.  **Travel:** Fly to Zeta Relay (1750, -2800).
    4.  **Dock:** Dock at the station.
    5.  **Barter:** Go to the "Info" screen. Find the "Special Actions" button like "Barter Fragment Beta (20t Machinery)".
    6.  Click the button. If you have the Machinery, it will be removed from your cargo, and `contract_frag_b` added to your Quest Inventory.
*   **Tips:** Plan your route! Buy the Machinery *before* heading to Zeta Relay.

**Objective 4: Acquire Contract Fragment Charlie**

*   **Location:** **Point Alpha (Pirate Hub)** - Fixed station at **(0, 0)**. ID: `station_0_0_fixC`. (Likely your starting station!)
*   **Requirement:** None apparent besides being docked.
*   **How:**
    1.  Fly to (0, 0) if you're not already there.
    2.  Dock at Point Alpha.
    3.  Go to the "Info" screen.
    4.  Find the "Special Actions" button like "Retrieve Fragment Charlie".
    5.  Click it. `contract_frag_c` will be added to your Quest Inventory.
*   **Tips:** This is the easiest fragment to get. You can grab it early on.

**Objective 5: Collect 4 Beacon Access Keys**

*   **Location:** Four specific **Beacons** scattered in deep space. Their IDs (and likely coordinates based on `InfiniteWorldManager._generateBeacons`) are:
    *   `beacon_nw_key1`: Around **(-4500, 4800)**
    *   `beacon_ne_key2`: Around **(4800, 4700)**
    *   `beacon_sw_key3`: Around **(-4800, -4600)**
    *   `beacon_se_key4`: Around **(4700, -4800)**
*   **Requirement:** Fly close to each beacon.
*   **How:**
    1.  **Navigate:** Fly towards the approximate coordinates of each beacon. These are far out, so Engine Boosters might be helpful. You cannot set beacons as Nav Targets, so watch your coordinates display!
    2.  **Interact:** As you get close to a beacon (visually, it's a flashing 4-pointed star), it should change color (from Yellow to Orange) indicating activation. You don't need to dock.
    3.  **Collect Key:** Upon activation, a `beacon_key` item is automatically added to your Quest Inventory. The Quest Panel ("CONTRACT STATUS") should update showing progress (e.g., "[1 / 4] Collect 4 Beacon Access Keys").
    4.  **Repeat:** Visit all four beacon locations.
*   **Tips:** These require long-distance travel. Ensure your ship is reasonably upgraded (shields, engine) to survive potential enemy encounters en route.

### Phase 3: Reaching 100% Emancipation

*   **Track Progress:** Regularly check the "CONTRACT STATUS" screen (accessed via the "CONTRACT" button in Station Info, or potentially its own main view button). It shows your Emancipation percentage and which objectives are complete ([✔]).
*   **Complete All Five:** Once you have:
    *   100,000+ CR
    *   Fragment Alpha
    *   Fragment Beta
    *   Fragment Charlie
    *   4 Beacon Keys
*   **Freedom!** The game state should automatically transition to the "won" screen, displaying your final Emancipation Score (which should be 100%)!

**Recommended Upgrades Recap:**

*   **Cargo Pods:** Essential for trading and Fragment Beta. Max it out if you can afford it.
*   **Nav Computer:** Highly recommended for navigating to specific coordinates for stations and beacons.
*   **Shield Capacitor / Engine Booster:** Improve survivability and travel speed, especially important for reaching the distant beacons and escaping pirates.
*   **Autoloader:** If combat is tough, halving your weapon cooldown can make a difference.

