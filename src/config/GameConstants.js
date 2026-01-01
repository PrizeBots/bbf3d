/**
 * GameConstants - Centralized configuration for all game balance values
 *
 * Tweak these values to adjust game balance and pacing.
 */
export const GameConstants = {
    // ==========================================
    // PLANT GROWTH TIMINGS
    // ==========================================

    PLANT: {
        // Seed growth (time to sprout)
        SEED_SINK_TIME: 1.5,              // Seconds for seed to sink and sprout (1.5s)
        SEED_GROWTH_RATE: 1.0,            // HP gained per second while sinking

        // Sprout growth (time to become bush)
        SPROUT_GROWTH_RATE: 4.0,          // HP gained per second (10 HP to 50 HP = 10 seconds)
        SPROUT_START_HP: 3,
        SPROUT_MATURE_HP: 5,

        // Bush growth (time to become tree)
        BUSH_GROWTH_RATE: 4.0,            // HP gained per second (50 HP to 100 HP = 12.5 seconds)
        BUSH_START_HP: 5,
        BUSH_MATURE_HP: 10,

        // Tree growth (time to become fruit-producing)
        TREE_GROWTH_RATE: 4.0,            // HP gained per second (100 HP to 200 HP = 25 seconds)
        TREE_START_HP: 10,
        TREE_MATURE_HP: 15,

        // Tree fruit production
        TREE_FRUIT_SPAWN_INTERVAL: 1.0,   // Seconds between fruit spawns
        TREE_MAX_FRUITS: 6,               // Maximum fruits on tree at once
        TREE_LIFESPAN_FRUITS: 10,         // Total fruits before tree is depleted
        TREE_FOLIAGE_FALL_DURATION: 2.0,  // Seconds for foliage to fall and disappear
    },

    // ==========================================
    // FRUIT PROPERTIES
    // ==========================================

    FRUIT: {
        RIPENING_TIME: 5,               // Seconds to ripen on tree (0 to 100 HP)
        MAX_HP: 50,                      // HP when fully ripe
        DECAY_RATE: 1,                    // HP lost per second on ground (20 seconds total)
    },

    // ==========================================
    // BABY BUBBY (Creature)
    // ==========================================

    BABY_BUBBY: {
        // Health
        START_HP: 50,                    // Starting max HP
        MATURE_HP: 52,                   // Max HP needed to mature into adult

        // Combat
        ATTACK_INTERVAL: 1.0,             // Seconds between attacks
        ATTACK_DAMAGE: 1,                 // Damage per attack
        // Note: Effective attack rate = 1 HP/second

        // Growth
        GROWTH_RATE: 1.0,                 // Max HP gained per HP eaten (1:1 ratio)
        SIZE_GROWTH_INCREMENT: 0.01875,   // Size increase per eat action

        // Movement
        MOVE_SPEED: 0.06,                 // Movement speed
        SENSING_RANGE: 15,                // How far they can detect food
        ATTACK_RANGE: 2,                  // How close to start attacking

        // AI Behavior
        WANDER_DURATION: 3.0,             // Seconds to wander before picking new direction
        AVOIDANCE_RADIUS: 2.5,            // Personal space from other bubbies
    },

    // ==========================================
    // ADULT BUBBY (Mature Creature)
    // ==========================================

    ADULT_BUBBY: {
        // Health
        MAX_HP: 55,                      // Max HP (doesn't grow, only heals)

        // Combat
        ATTACK_INTERVAL: 0.8,             // Seconds between attacks (faster than baby)
        ATTACK_DAMAGE: 2,                 // Damage per attack (more than baby)
        // Note: Effective attack rate = 2.5 HP/second

        // Growth
        SIZE_GROWTH_INCREMENT: 0.015,     // Size increase per eat action

        // Movement
        MOVE_SPEED: 0.075,                // Movement speed (faster than baby)
        SENSING_RANGE: 20,                // How far they can detect food (more than baby)
        ATTACK_RANGE: 2.5,                // How close to start attacking

        // AI Behavior
        WANDER_DURATION: 4.0,             // Seconds to wander before picking new direction
        AVOIDANCE_RADIUS: 3.0,            // Personal space from other bubbies

        // Fruit Gathering
        GATHER_FRUIT: true,               // Enable fruit gathering behavior
        PICKUP_RANGE: 2.5,                // How close to pick up fruit (same as attack range)
        DEPOSIT_RANGE: 10,                // Distance from castle to deposit fruit
        CARRY_CAPACITY: 1,                // Max fruits carried at once

        // Resource Gathering (Wood & Stone)
        GATHER_RESOURCES: true,           // Enable wood/stone gathering
        HARVEST_DAMAGE: 3,                // Damage dealt when harvesting trees/deposits
        HARVEST_INTERVAL: 0.6,            // Seconds between harvest attacks
    },

    // ==========================================
    // SOLDIER BUBBY (Combat Unit)
    // ==========================================

    SOLDIER_BUBBY: {
        // Health
        MAX_HP: 80,                       // More HP than adult bubby

        // Combat
        ATTACK_INTERVAL: 0.6,             // Seconds between attacks (faster than adult)
        ATTACK_DAMAGE: 4,                 // Damage per attack (more than adult)

        // Movement
        MOVE_SPEED: 0.08,                 // Movement speed (faster than adult)
        SENSING_RANGE: 25,                // Detection range (larger than adult)
        ATTACK_RANGE: 3.0,                // Attack range

        // AI Behavior
        WANDER_DURATION: 2.0,             // Shorter wander duration (more aggressive)
        AVOIDANCE_RADIUS: 2.5,            // Personal space

        // Creation cost
        WOOD_COST: 5,                     // Wood required to create
        STONE_COST: 5,                    // Stone required to create
    },

    // ==========================================
    // SWORD (Equippable Weapon)
    // ==========================================

    SWORD: {
        // Creation cost (at Armory)
        WOOD_COST: 1,                     // Wood required to craft
        STONE_COST: 1,                    // Stone required to craft

        // Combat bonus when equipped
        ATTACK_DAMAGE_BONUS: 3,           // Extra damage when attacking
        ATTACK_INTERVAL_BONUS: -0.2,      // Faster attacks (reduction in interval)
        ATTACK_RANGE_BONUS: 0.5,          // Extended reach
    },

    // ==========================================
    // ARMOR (Equippable Defense)
    // ==========================================

    ARMOR: {
        // Creation cost (at Armory)
        WOOD_COST: 1,                     // Wood required to craft
        STONE_COST: 2,                    // Stone required to craft (more stone for metal)

        // Defense bonus when equipped
        DAMAGE_REDUCTION: 0.3,            // 30% damage reduction
    },

    // ==========================================
    // EGG PROPERTIES
    // ==========================================

    EGG: {
        HATCH_TIME: 4.0,                  // Seconds before egg hatches
        MAX_HP: 50,                      // Starting HP for hatched bubby
    },

    // ==========================================
    // PHYSICS
    // ==========================================

    PHYSICS: {
        GRAVITY: 0.015,                   // General gravity for falling objects
        EGG_GRAVITY: 0.01,                // Egg-specific gravity (slower fall)
        SPAWN_DROP_HEIGHT: 30,            // Height from which spawned objects drop
        DRAG_LIFT_HEIGHT: 8,              // Height objects are lifted when dragged
    },

    // ==========================================
    // ARENA
    // ==========================================

    ARENA: {
        WIDTH: 160,                       // Arena width
        DEPTH: 40,                        // Arena depth
        MAX_X: 78,                        // Max X position for objects (slightly inside edge)
        MAX_Z: 18,                        // Max Z position for objects (slightly inside edge)
    },

    // ==========================================
    // CASTLES
    // ==========================================

    CASTLE: {
        RED_POSITION: { x: -65, y: 0, z: 0 },   // Red team castle position
        BLUE_POSITION: { x: 65, y: 0, z: 0 },   // Blue team castle position
        MAX_HEALTH: 500,                         // Castle starting/max health
    },

    // ==========================================
    // ECONOMY
    // ==========================================

    ECONOMY: {
        FRUIT_COIN_VALUE: 1,              // Coins earned per fruit deposited
        STARTING_COINS: 10,               // Coins each player starts with
        COIN_FLIGHT_DURATION: 0.8,        // Seconds for coin animation to UI
        FRUIT_SELL_VALUE: 1,              // Coins earned per fruit sold at HQ
    },

    // ==========================================
    // TURRET (Defensive Building)
    // ==========================================

    TURRET: {
        // Health
        MAX_HP: 150,                      // Turret health

        // Combat (5x sword attack = 5 * 5 = 25)
        ATTACK_DAMAGE: 25,                // Damage per shot
        ATTACK_INTERVAL: 1.5,             // Seconds between shots
        DETECTION_RANGE: 25,              // Range to detect enemies
        ATTACK_RANGE: 22,                 // Range to attack enemies

        // Scanning behavior
        SCAN_SPEED: 0.02,                 // Rotation speed when scanning
        AIM_SPEED: 0.15,                  // Rotation speed when aiming at target

        // Projectile
        PROJECTILE_SPEED: 0.8,            // Speed of fired projectiles
        PROJECTILE_SIZE: 0.4,             // Size of projectile

        // Building cost
        WOOD_COST: 5,
        STONE_COST: 10,
    },
};
