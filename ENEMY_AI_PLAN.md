# Enemy AI & Wave System Implementation Plan

## Overview

Transform the game from a sandbox into a strategic wave-based battle where the player (red team) must destroy the enemy's castle (blue team) while defending their own. The enemy AI controls the blue team, spawning units and buildings that become progressively stronger each wave.

---

## Player Representation

### Cursor as Avatar
- Each player (human and AI) is represented by a **white glove hand** cursor in the game world
- The cursor shows where the player is looking/targeting
- In future multiplayer, all players can see each other's cursors
- Team distinction via subtle glow/outline color (red team, blue team)

### Cursor Gestures
- **Pointing** - Default state, index finger pointing
- **Open hand** - Hovering over draggable object
- **Grabbing** - Currently dragging an object
- **Thumbs up** - Placement confirmed (brief animation)

### AI Cursor Behavior
- AI cursor moves smoothly to target locations
- Shows intent before actions (hovers over spawn location before placing)
- Movement speed varies based on AI "skill level"
- Creates immersion - feels like playing against another person

---

## Base Game Loop (PRIORITY - Complete First)

### Current State → Target State

```
CURRENT (Incomplete):
Egg → Bubby → Eats fruit → ???

TARGET (Complete Loop):
Egg → Bubby → Harvests resources → Delivers to HQ → Sells for coins → Buy more units
```

### Complete Resource Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                      RESOURCE GATHERING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FRUIT (Food/Coins)         WOOD (Building)      STONE (Military)│
│  ┌─────────────┐           ┌─────────────┐      ┌─────────────┐ │
│  │ Plant Seed  │           │ Dead Tree   │      │Stone Deposit│ │
│  │     ↓       │           │     ↓       │      │     ↓       │ │
│  │ Grows Tree  │           │ Bubby chops │      │ Bubby mines │ │
│  │     ↓       │           │     ↓       │      │     ↓       │ │
│  │ Drops Fruit │           │ Wood Chunks │      │Stone Pieces │ │
│  │     ↓       │           │     ↓       │      │     ↓       │ │
│  │ Bubby grabs │           │ Bubby grabs │      │ Bubby grabs │ │
│  │     ↓       │           │     ↓       │      │     ↓       │ │
│  │ Deliver HQ  │           │ Deliver HQ  │      │ Deliver HQ  │ │
│  └─────────────┘           └─────────────┘      └─────────────┘ │
│         ↓                         ↓                    ↓         │
│      COINS                  WOOD STORAGE          STONE STORAGE  │
│         ↓                         ↓                    ↓         │
│   Buy Eggs/Seeds           Build Structures      Armory → Soldiers│
└─────────────────────────────────────────────────────────────────┘
```

### Phase 0: Complete Base Loop (Before AI)

**0.1 - Fix/Verify Fruit Loop** ✅ COMPLETE
- [x] Bubby harvests fallen fruit
- [x] Bubby carries fruit to HQ
- [x] Fruit deposited at HQ increases HQ fruit count
- [x] Player sells fruit at HQ for coins
- [x] Coins used to spawn more eggs/seeds

**0.2 - Dead Tree → Wood System** ✅ COMPLETE
- [x] Tree becomes "dead tree" when depleted (trunk only)
- [x] Dead tree is harvestable (bubby attacks it)
- [x] Each attack drops a "wood chunk"
- [x] Wood chunk is collectible like fruit
- [x] Bubby carries wood to HQ
- [x] HQ tracks wood inventory
- [x] Dead tree disappears after fully harvested

**0.3 - Stone Deposit System** ✅ COMPLETE
- [x] Create StoneDeposit entity (large rock formation)
- [x] Stone deposits placed on map (8 predetermined positions)
- [x] Bubby attacks stone deposit
- [x] Each attack drops a "stone piece"
- [x] Stone piece is collectible like fruit
- [x] Bubby carries stone to HQ
- [x] HQ tracks stone inventory
- [x] Stone deposit shrinks/disappears when depleted

**0.4 - HQ Inventory System** ✅ COMPLETE
- [x] Castle tracks: coins, fruit, wood, stone
- [x] HQ menu shows all resources
- [x] Sell fruit button converts fruit → coins

**0.5 - Armory Functionality** ✅ COMPLETE
- [x] Armory building uses wood + stone from HQ
- [x] Creates "Soldier Bubby" unit
- [x] Soldier Bubby prioritizes attacking enemy units/structures
- [x] Recipe: 5 wood + 5 stone = 1 Soldier Bubby

---

## Stage Design

### Predetermined Resource Placement

Each stage has fixed positions for:
- **Stone Deposits** - Strategic locations, limited quantity
- **Starting Trees** - Initial fruit sources (optional)
- **Neutral Zone** - Contested middle area

### Example Stage Layout

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [RED CASTLE]              STONE              [BLUE CASTLE]    │
│       ▣                      ite               ite              │
│                            🪨  🪨                     ▣         │
│   🌳  🌳                                          🌳  🌳        │
│                                                                 │
│         🪨               NEUTRAL ZONE              🪨           │
│                            🪨  🪨                               │
│   🌳                                                  🌳        │
│                                                                 │
│                            🪨  🪨                               │
│                              ite                                │
│                             STONE                               │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

Legend:
▣ = Castle/HQ
🌳 = Starting Tree
🪨 = Stone Deposit
```

### Difficulty Tuning via Resources

| Difficulty | Stone Near Base | Neutral Stone | Starting Trees |
|------------|-----------------|---------------|----------------|
| Easy       | 3 deposits      | 4 deposits    | 4 trees        |
| Medium     | 2 deposits      | 4 deposits    | 2 trees        |
| Hard       | 1 deposit       | 4 deposits    | 0 trees        |
| Expert     | 0 deposits      | 4 deposits    | 0 trees        |

---

## Bubby AI Priorities

### Resource Gathering (Automatic by Default)

```javascript
// Bubby decision tree for gathering
1. If has assigned task → Execute assigned task
2. If carrying item → Deliver to HQ
3. If fruit nearby (fallen) → Pick up fruit
4. If wood chunk nearby → Pick up wood
5. If stone piece nearby → Pick up stone
6. If dead tree nearby → Attack for wood
7. If stone deposit nearby → Attack for stone
8. If ripe fruit on tree → Wait/pick from tree
9. Else → Wander
```

### Manual Task Assignment (Drag & Drop)

Player can **drag and drop a bubby onto a target** to assign a specific task:

| Drop Target      | Assigned Task                          |
|------------------|----------------------------------------|
| Dead Tree        | Harvest wood until tree is gone        |
| Stone Deposit    | Mine stone until deposit is gone       |
| Fruit/Tree       | Gather fruit from this tree            |
| Enemy Unit       | Attack this specific enemy             |
| Enemy Building   | Attack this building                   |
| Ground Location  | Move to and guard this position        |

- Assigned task persists until completed or bubby dies
- Visual indicator shows bubby has an assignment (icon above head)
- Player can cancel assignment by dragging bubby to open ground

### Soldier Bubby Priorities

```javascript
// Soldier bubby decision tree (combat-focused, doesn't gather)
1. If has assigned task → Execute assigned task
2. If enemy unit in range → Attack unit
3. If enemy building in range → Attack building
4. If enemy HQ visible → Move toward HQ
5. Else → Patrol near friendly HQ
```

---

## Core Gameplay Loop

1. **Wave Start** - Enemy AI begins spawning units based on wave difficulty
2. **Battle Phase** - Both teams' units fight, gather resources, and attack structures
3. **Wave End** - Triggered when all enemy units are defeated OR player destroys enemy castle
4. **Intermission** - Player receives rewards, can purchase upgrades, prepare for next wave
5. **Next Wave** - Difficulty increases, new enemy types may appear

---

## Win/Lose Conditions

### Victory
- Destroy the blue castle to clear the stage
- Castle has significant HP that scales with wave number
- Bonus rewards for faster clears

### Defeat
- Red castle is destroyed
- Game over screen with stats (waves survived, units spawned, etc.)
- Option to restart or return to menu

---

## Enemy AI System

### AI Controller (`src/systems/EnemyAI.js`)

```
EnemyAI
├── WaveManager - Controls wave timing and difficulty
├── SpawnController - Decides what/when to spawn
├── ResourceManager - Tracks blue team's virtual resources
├── TacticalAI - High-level strategic decisions
└── UnitDirector - Gives orders to spawned units
```

### AI Behaviors

1. **Resource Gathering Phase** (Early wave)
   - Prioritize spawning eggs to create bubbies
   - Plant seeds to establish fruit production
   - Build economy before attacking

2. **Aggression Phase** (Mid wave)
   - Send adult bubbies to attack red plants/units
   - Target player's resource infrastructure
   - Balanced offense/defense

3. **All-Out Attack** (Late wave / Low HP)
   - Concentrate forces for castle assault
   - Spawn offensive buildings (turrets)
   - Desperate pushes when castle HP is low

### AI Difficulty Scaling Per Wave

| Wave | Spawn Rate | Unit HP Bonus | AI Aggression | Special |
|------|------------|---------------|---------------|---------|
| 1-3  | Slow       | +0%           | Low           | Tutorial waves |
| 4-6  | Medium     | +10%          | Medium        | Turrets unlock |
| 7-9  | Fast       | +25%          | High          | Armories unlock |
| 10+  | Very Fast  | +50%+         | Maximum       | Boss waves |

---

## Wave System

### Wave Configuration (`src/config/WaveConfig.js`)

```javascript
WAVE: {
    INTERMISSION_DURATION: 10,    // Seconds between waves
    BASE_SPAWN_BUDGET: 100,       // Starting spawn points
    BUDGET_INCREASE_PER_WAVE: 50, // Additional points per wave

    SPAWN_COSTS: {
        egg: 20,
        seed: 10,
        turret: 50,
        armory: 40,
    },

    CASTLE_HP_PER_WAVE: 50,       // Additional castle HP per wave
}
```

### Wave Events

1. **Wave Announcement** - UI displays "Wave X" with enemy preview
2. **Spawn Phase** - AI spawns units over time (not all at once)
3. **Combat Phase** - Active fighting
4. **Victory Check** - Continuous check for win/lose conditions
5. **Wave Complete** - Rewards, upgrade screen

---

## Player Progression System

### Unlock Tree

```
WAVE 1 (Start)
├── Egg (basic bubby spawner)
├── Seed (basic plant)
└── 10 starting coins

WAVE 3 (First Unlock)
├── Turret (defensive building)
└── Faster bubby growth upgrade available

WAVE 5
├── Armory (unit buffs building)
└── Plant HP upgrade available

WAVE 7
├── Super Seed (grows faster, more fruit)
└── Adult bubby damage upgrade

WAVE 10 (Boss Wave)
├── Elite Egg (spawns stronger bubbies)
└── Castle repair ability

WAVE 15+
├── Advanced buildings
└── Ultimate abilities
```

### Upgrade Shop (Between Waves)

**Passive Upgrades** (Permanent)
- `Thick Bark` - Plants have +20% HP
- `Fertile Soil` - Plants grow 15% faster
- `Strong Shells` - Eggs have +30% HP
- `Warrior Training` - Adult bubbies deal +25% damage
- `Swift Feet` - All units move 10% faster
- `Bountiful Harvest` - Trees produce +1 max fruit

**Consumable Power-ups** (Single use, per wave)
- `Healing Rain` - Restore 25% HP to all friendly units
- `Speed Boost` - Double movement speed for 10 seconds
- `Spawn Frenzy` - Next 3 spawns are free
- `Castle Shield` - Castle is invulnerable for 15 seconds

### Currency System

- **Coins** - Earned from depositing fruit (existing system)
- **Wave Bonus** - Coins awarded for completing waves
- **Kill Bonus** - Small coin reward for destroying enemy units
- **Speed Bonus** - Extra coins for fast wave clears

---

## New Units & Buildings

### Wave-Locked Units

**Elite Bubby** (Unlocks Wave 10)
- 2x HP of adult bubby
- 1.5x damage
- Larger size, distinct appearance
- Costs 2 eggs to spawn

**Siege Bubby** (Unlocks Wave 15)
- Slow but very high damage to structures
- Bonus damage vs castles
- Ignores smaller units

### New Buildings

**Healing Shrine** (Unlocks Wave 7)
- Slowly heals nearby friendly units
- Radius: 15 units
- Heal rate: 2 HP/second

**Rally Flag** (Unlocks Wave 12)
- Units near flag gain attack speed buff
- Can be repositioned

**Wall Segment** (Unlocks Wave 5)
- Blocks enemy movement
- High HP, no attack
- Can be placed to create chokepoints

---

## UI Additions

### Wave HUD (Top of screen)
```
┌─────────────────────────────────────────┐
│  WAVE 5    Enemies: 12    Time: 1:45    │
│  ████████░░░░░░░░  Castle HP: 80%       │
└─────────────────────────────────────────┘
```

### Intermission Screen
```
┌─────────────────────────────────────────┐
│         WAVE 5 COMPLETE!                │
│                                         │
│  Enemies Defeated: 15                   │
│  Time: 2:30                             │
│  Bonus: +5 coins                        │
│                                         │
│  ┌─────────┐  ┌─────────┐              │
│  │ UPGRADE │  │  SHOP   │              │
│  └─────────┘  └─────────┘              │
│                                         │
│     [ START WAVE 6 ]                    │
│                                         │
│  Next Wave Preview:                     │
│  - 8 Eggs, 4 Seeds, 2 Turrets          │
└─────────────────────────────────────────┘
```

### Upgrade Shop Panel
```
┌─────────────────────────────────────────┐
│  UPGRADES           Coins: 47           │
│                                         │
│  PASSIVE (Permanent)                    │
│  ┌──────────────────────┐              │
│  │ Thick Bark     25c   │ [BUY]        │
│  │ Plants +20% HP       │              │
│  └──────────────────────┘              │
│                                         │
│  POWER-UPS (This wave only)            │
│  ┌──────────────────────┐              │
│  │ Healing Rain   15c   │ [BUY]        │
│  │ Heal all units 25%   │              │
│  └──────────────────────┘              │
│                                         │
│  [ CLOSE ]                              │
└─────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 0: Complete Base Game Loop (PRIORITY)

**0.1 - Player Cursor System** ✅ COMPLETE
- [x] Create visible cursor mesh for human player (white glove hand)
- [x] Cursor follows mouse position projected onto ground
- [x] Cursor gestures: pointing, open, grabbing, thumbsUp
- [x] Cursor visible to all players (future multiplayer ready)

**0.2 - Verify/Fix Fruit Delivery** ✅ COMPLETE
- [x] Adult bubby picks up fallen fruit
- [x] Bubby pathfinds to team's HQ
- [x] Fruit deposited increases HQ fruit inventory
- [x] HQ menu shows fruit count
- [x] Sell fruit button → coins

**0.3 - Dead Tree Harvesting** ✅ COMPLETE
- [x] Create WoodChunk collectible entity
- [x] Depleted tree (isDepleted=true) becomes harvestable
- [x] Bubby can target and attack dead tree trunk
- [x] Each attack spawns WoodChunk nearby
- [x] Track trunk HP, dispose when fully harvested
- [x] Bubby picks up and delivers WoodChunk to HQ

**0.4 - Stone Deposit System** ✅ COMPLETE
- [x] Create StoneDeposit entity (large rock mesh)
- [x] Create StonePiece collectible entity
- [x] Bubby can target and attack stone deposits
- [x] Each attack spawns StonePiece nearby
- [x] Stone deposit shrinks/depletes over time
- [x] Bubby picks up and delivers StonePiece to HQ

**0.5 - HQ Inventory Expansion** ✅ COMPLETE
- [x] Castle tracks: coins, fruit, wood, stone
- [x] Update HQ billboard menu to show all resources
- [x] Sell buttons for each resource type

**0.6 - Bubby AI Resource Gathering** ✅ COMPLETE
- [x] Priority system: heal → fruit → wood → stone
- [x] Automatic gathering when idle/wandering
- [x] Drag-drop task assignment (drop bubby on target)
- [x] Manual task overrides automatic behavior

**0.7 - Armory Creates Soldiers** ✅ COMPLETE
- [x] Armory checks HQ inventory for resources
- [x] Recipe: 5 wood + 5 stone = 1 Soldier Bubby
- [x] Click on armory to trigger creation
- [x] Visual feedback (green flash on success, red on insufficient)
- [x] Soldier Bubby spawns near armory

**0.8 - Soldier Bubby Unit** ✅ COMPLETE
- [x] Create SoldierBubby class
- [x] Different appearance (helmet + weapon visual)
- [x] Combat-focused AI (doesn't gather resources)
- [x] Attacks enemy units, buildings, and castle
- [x] Priority: enemy units → enemy buildings → enemy castle

### Phase 1: AI Player & Cursor ✅ COMPLETE

**1.1 - AI Cursor Representation** ✅ COMPLETE
- [x] Create AICursor class (src/ui/AICursor.js)
- [x] Blue team colored cursor mesh (white glove with blue glow)
- [x] Smooth movement interpolation (configurable speed)
- [x] Visible to human player
- [x] Arrival callbacks for action sequencing

**1.2 - AI Player Controller** ✅ COMPLETE
- [x] Create AIPlayer class (src/systems/AIPlayer.js)
- [x] State machine: idle → thinking → moving → spawning → waiting
- [x] Decision-making loop (eggs, seeds, armories)
- [x] Cursor moves to target before actions
- [x] Difficulty settings (easy/medium/hard)

**1.3 - AI Spawn Actions** ✅ COMPLETE
- [x] AI places eggs (cursor moves, pauses, places)
- [x] AI places seeds
- [x] AI places armories
- [x] Realistic timing with configurable think interval
- [x] Thumbs up gesture on successful placement

### Phase 2: Wave System
- [ ] Create WaveManager class
- [ ] Add wave start/end logic
- [ ] Implement intermission timer
- [ ] Add wave UI (wave number, enemy count)
- [ ] Castle HP system with destruction detection
- [ ] Stage configuration (stone/tree placement)

### Phase 3: Win/Lose Conditions
- [ ] Castle destruction detection
- [ ] Victory screen with stats
- [ ] Defeat screen with retry option
- [ ] Wave completion rewards

### Phase 4: Upgrade System
- [ ] Create UpgradeManager class
- [ ] Define upgrade tree in config
- [ ] Implement upgrade shop UI
- [ ] Apply upgrade effects to units/buildings
- [ ] Persistence of purchased upgrades

### Phase 5: Power-ups
- [ ] Create PowerUpManager class
- [ ] Implement consumable effects
- [ ] Add power-up activation UI
- [ ] Cooldown/usage tracking

### Phase 6: Advanced Units & Buildings
- [ ] Elite Bubby implementation
- [ ] Siege Bubby implementation
- [ ] Healing Shrine building
- [ ] Rally Flag building
- [ ] Wall Segment building

### Phase 7: Polish & Balance
- [ ] Wave difficulty tuning
- [ ] AI behavior refinement
- [ ] Upgrade cost balancing
- [ ] Performance optimization
- [ ] Sound effects and visual feedback

---

## File Structure

```
src/
├── systems/
│   ├── BubbyAI.js           # (existing) Shared bubby behaviors
│   ├── AIPlayer.js          # AI player controller (blue team)
│   ├── AICursor.js          # Visual cursor for AI player
│   ├── WaveManager.js       # Wave progression logic
│   ├── UpgradeManager.js    # Player upgrades
│   └── PowerUpManager.js    # Consumable abilities
├── config/
│   ├── GameConstants.js     # (existing, extended)
│   ├── StageConfig.js       # Stage layouts (stone/tree positions)
│   ├── WaveConfig.js        # Wave definitions
│   └── UpgradeConfig.js     # Upgrade definitions
├── ui/
│   ├── UIManager.js         # (existing, extended)
│   ├── PlayerCursor.js      # Visible player cursor mesh
│   ├── WaveHUD.js           # Wave progress display
│   ├── UpgradeShop.js       # Upgrade purchase UI
│   └── VictoryScreen.js     # Win/lose screens
├── entities/
│   ├── Castle.js            # (existing, add inventory system)
│   ├── StoneDeposit.js      # Mineable stone formation
│   ├── EliteBubby.js        # Upgraded unit type
│   └── HealingShrine.js     # Healing building
├── objects/
│   ├── SpawnableObject.js   # (existing) Base class
│   ├── Bubby.js             # (existing) Baby bubby
│   ├── AdultBubby.js        # (existing, extend for resource priority)
│   ├── SoldierBubby.js      # Combat-focused bubby unit
│   ├── Tree.js              # (existing, add harvestable dead state)
│   ├── Fruit.js             # (existing) Collectible
│   ├── WoodChunk.js         # Collectible wood resource
│   ├── StonePiece.js        # Collectible stone resource
│   ├── Turret.js            # (existing)
│   └── Armory.js            # (existing, add soldier creation)
└── components/
    └── HealthBar.js         # (existing)
```

---

## Balance Considerations

1. **Early Game** - Player should feel challenged but not overwhelmed
2. **Mid Game** - Strategic choices matter, multiple viable strategies
3. **Late Game** - Requires good economy and smart upgrades to survive
4. **Rubber Banding** - If player is struggling, slightly reduce difficulty
5. **Skill Ceiling** - Expert players can optimize for speed/efficiency

---

## Future Expansion Ideas

- Multiple stages with different layouts
- Boss enemies with unique mechanics
- Multiplayer PvP mode
- Daily challenges with modifiers
- Achievement system
- Unit skin unlocks
