# Castle Battle Arena - Game Design Document

## Overview
Castle Battle Arena is a 3D browser-based strategy game where two teams (Red and Blue) compete by growing plants, raising creatures (Bubbies), and gathering resources to earn coins.

---

## Core Game Loop

### Plant Growth Cycle
1. **Seed** → Sinks into ground (1.5s)
2. **Sprout** → Young plant (grows to 5 HP)
3. **Bush** → Mature plant (grows to 10 HP)
4. **Tree** → Fruit-producing plant (grows to 15 HP)

### Fruit Production
- Mature trees spawn fruits on their foliage spheres
- Fruits ripen from 0 → 50 HP over time
- When ripe, fruits fall to the ground
- Fruits decay on ground at configurable rate

### Creature Life Cycle
1. **Egg** → Hatches after 4 seconds
2. **Baby Bubby** → Starts at 50 HP, matures at 52 HP
3. **Adult Bubby** → Fully grown creature at 55 HP max

---

## Economy System

### Coin System
The primary currency used for purchasing items, upgrades, and managing your team.

#### Earning Coins

##### Adult Bubby Fruit Gathering (Primary)
Adult Bubbies have a resource-gathering behavior:

1. **Detect Fruit** - Adult Bubby scans for ripe fruits on the ground within sensing range
2. **Pick Up Fruit** - Bubby moves to fruit and picks it up (fruit becomes parented to bubby)
3. **Return to Castle** - Bubby navigates back to their team's castle
4. **Deposit Fruit** - Upon reaching castle, fruit is deposited and destroyed
5. **Earn Coin** - Player receives 1 coin per fruit deposited

**Visual Feedback:**
- Coin sprite appears at deposit location
- Coin animates/flies toward the player's coin counter UI
- Coin counter increments with satisfying effect
- Particle effects or sparkle on deposit

**Behavior Priority:**
- Adult Bubbies prioritize fruit gathering over attacking (unless threatened)
- If carrying fruit, Bubby will continue to castle even if other fruits appear
- After depositing, Bubby returns to normal behavior (searching for more fruit)

##### Future Coin-Earning Activities
- Destroying enemy structures
- Winning battles/skirmishes
- Completing objectives
- Timed bonuses
- Achievement rewards

#### Spending Coins

##### Planned Shop/Upgrade System
- Purchase new Bubby eggs
- Upgrade Bubby stats (speed, damage, health)
- Purchase seeds/plants
- Unlock special abilities
- Defensive structures
- Passive income upgrades

---

## AI Behavior States

### Baby Bubby States
1. **Idle** - Standing still, sensing environment
2. **Wandering** - Moving randomly around arena
3. **Moving to Target** - Approaching fruit or plant
4. **Attacking** - Eating fruit/plant to grow

**Target Priority:**
- Fruits (highest priority - for healing/growth)
- Sprouts and Bushes (can reach these)
- ~~Trees~~ (too tall to attack)

### Adult Bubby States (Enhanced)
1. **Idle** - Standing still, sensing environment
2. **Wandering** - Patrolling around territory
3. **Gathering Fruit** - Moving toward fruit to pick up
4. **Carrying Fruit** - Returning to castle with fruit
5. **Depositing** - At castle, depositing fruit for coins
6. **Attacking** - Combat with enemy plants/creatures

**Target Priority:**
- Ripe fruits on ground (for coin gathering)
- Enemy plants (Trees, Bushes, Sprouts)
- Enemy Bubbies (combat)

---

## UI System

### Current UI Elements
- Health bars above all entities
- Team indicators (Red/Blue colors)

### Planned UI Elements

#### Coin Counter
- **Location:** Top-right corner per team
- **Display:** Coin icon + number count
- **Animation:** Increment with bounce/scale effect when coins added
- **Particle Trail:** Visual feedback showing coin flying from deposit point to counter

#### Resource Display
- Active Bubbies count
- Plant count
- Fruit production rate

#### Shop/Upgrade Panel
- Purchasable items grid
- Cost display
- Purchase confirmation
- Insufficient funds feedback

---

## Visual Effects

### Coin Deposit Effect
```
1. Fruit deposited at castle
2. Gold coin sprite spawns at deposit location
3. Coin scales up slightly (pop effect)
4. Coin follows bezier curve path toward coin counter UI
5. Sparkle particle trail follows coin
6. On arrival: coin counter increments with bounce
7. Sound effect: "cha-ching" or coin clink
```

### Future Effects
- Plant growth sparkles
- Bubby evolution glow
- Attack impact particles
- Castle damage effects

---

## Game Constants (Configurable)

### Coin Economy
```javascript
ECONOMY: {
    FRUIT_COIN_VALUE: 1,        // Coins per fruit deposited
    STARTING_COINS: 10,         // Coins each player starts with
    COIN_FLIGHT_DURATION: 0.8,  // Seconds for coin to fly to UI
}
```

### Adult Bubby Gathering
```javascript
ADULT_BUBBY: {
    GATHER_FRUIT: true,         // Enable fruit gathering behavior
    CARRY_CAPACITY: 1,          // Fruits carried at once (future: upgrade to 2+)
    DEPOSIT_RANGE: 5,           // Distance from castle to deposit
}
```

---

## Technical Implementation Notes

### Coin Animation System
- Use BABYLON GUI for 2D coin sprite overlay
- Bezier curve path calculation for smooth flight
- Easing function: ease-out for natural deceleration
- Particle system for sparkle trail

### State Machine Enhancement
- Add "gathering" and "carrying" states to AdultBubby.js
- Implement fruit pickup logic (parent fruit mesh to bubby)
- Castle detection and deposit trigger
- Coin event system (emit event on deposit → UI catches event → animates coin)

### UI Manager Enhancement
- CoinCounter component
- Event listener for coin-earned events
- Animation queue for multiple simultaneous coins
- Persistent coin storage (per team)

---

## Future Features

### Expanded Economy
- Multiple resource types (wood, stone, food)
- Trade system between resources
- Passive income from structures
- Resource decay/consumption

### Bubby Job System
- Assign roles: Gatherer, Fighter, Builder
- Specialized Bubby types with different stats
- Job-specific upgrades

### Base Building
- Defensive towers
- Resource storage buildings
- Bubby training grounds
- Economy boosting structures

### Multiplayer
- PvP battles
- Cooperative mode
- Leaderboards
- Shared economy challenges

---

## Notes
- All timings and values configurable via `GameConstants.js`
- Balance testing required for coin earning rate vs. upgrade costs
- Consider fruit respawn rate to ensure sustainable coin economy
- Adult Bubby AI should feel responsive and purposeful, not robotic
