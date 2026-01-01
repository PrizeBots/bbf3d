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
    },

    // ==========================================
    // ECONOMY
    // ==========================================

    ECONOMY: {
        FRUIT_COIN_VALUE: 1,              // Coins earned per fruit deposited
        STARTING_COINS: 10,               // Coins each player starts with
        COIN_FLIGHT_DURATION: 0.8,        // Seconds for coin animation to UI
    },
};
