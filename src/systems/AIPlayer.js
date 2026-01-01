import { GameConstants } from '../config/GameConstants.js';
import { AICursor } from '../ui/AICursor.js';

/**
 * AIPlayer - Controls the blue team's AI behavior
 *
 * Goal: Destroy the enemy (red) castle
 * Strategy:
 * 1. Early game: Build economy (eggs + seeds for food)
 * 2. Mid game: Build armory, craft swords & armor
 * 3. Late game: Mass soldiers and attack enemy castle
 */
export class AIPlayer {
    constructor(scene, camera, config = {}) {
        this.scene = scene;
        this.camera = camera;
        this.team = 'blue';

        // Callbacks for game actions
        this.spawnEgg = config.spawnEgg || null;
        this.spawnSeed = config.spawnSeed || null;
        this.spawnArmory = config.spawnArmory || null;
        this.spawnTurret = config.spawnTurret || null;
        this.getCastle = config.getCastle || null;
        this.getEnemyCastle = config.getEnemyCastle || null;
        this.getAllBubbies = config.getAllBubbies || null;
        this.getAllPlants = config.getAllPlants || null;
        this.getAllArmories = config.getAllArmories || null;

        // AI cursor
        this.cursor = new AICursor(scene, camera, 'blue');

        // AI state
        this.state = 'idle'; // 'idle', 'thinking', 'moving', 'spawning', 'waiting'
        this.actionQueue = [];
        this.currentAction = null;

        // Game phase tracking
        this.gamePhase = 'early'; // 'early', 'mid', 'late', 'assault'
        this.phaseTimer = 0;

        // Timing
        this.thinkInterval = 1.5; // Faster decisions
        this.thinkTimer = 0;
        this.actionDelay = 0.3; // Quicker actions
        this.actionTimer = 0;

        // Economy tracking
        this.eggsSpawned = 0;
        this.seedsSpawned = 0;
        this.armoriesSpawned = 0;
        this.turretsSpawned = 0;
        this.swordsCrafted = 0;
        this.armorsCrafted = 0;

        // Attack wave tracking
        this.lastAttackWaveTime = 0;
        this.attackWaveInterval = 30; // Seconds between attack waves
        this.soldiersInWave = 0;
        this.targetSoldiersPerWave = 3; // How many soldiers to send per wave

        // AI personality/difficulty
        this.aggression = 0.6; // Higher = more aggressive
        this.reactionSpeed = 0.1; // Cursor movement speed

        // Spawn zone (blue side of arena)
        this.spawnZone = {
            minX: 20,
            maxX: 55,
            minZ: -15,
            maxZ: 15
        };

        // Active state
        this.isActive = true;
        this.isPaused = false;

        // Apply cursor speed based on difficulty
        this.cursor.setSpeed(this.reactionSpeed);
    }

    /**
     * Update AI each frame
     */
    update(deltaTime) {
        if (!this.isActive || this.isPaused) return;

        // Update game phase
        this.updateGamePhase(deltaTime);

        switch (this.state) {
            case 'idle':
                this.updateIdle(deltaTime);
                break;
            case 'thinking':
                this.updateThinking(deltaTime);
                break;
            case 'moving':
                this.updateMoving(deltaTime);
                break;
            case 'spawning':
                this.updateSpawning(deltaTime);
                break;
            case 'waiting':
                this.updateWaiting(deltaTime);
                break;
        }
    }

    /**
     * Update game phase based on progress
     */
    updateGamePhase(deltaTime) {
        this.phaseTimer += deltaTime;

        const myBubbies = this.countMyBubbies();
        const mySoldiers = this.countMySoldiers();
        const myArmories = this.armoriesSpawned;

        // Phase transitions based on game state
        if (this.gamePhase === 'early') {
            // Move to mid game after initial economy
            if (myBubbies >= 4 || this.phaseTimer > 30) {
                this.gamePhase = 'mid';
                console.log('AI entering mid game phase');
            }
        } else if (this.gamePhase === 'mid') {
            // Move to late game after armory and some soldiers
            if (myArmories >= 1 && (mySoldiers >= 2 || this.phaseTimer > 60)) {
                this.gamePhase = 'late';
                console.log('AI entering late game phase');
            }
        } else if (this.gamePhase === 'late') {
            // Move to assault when we have enough soldiers
            if (mySoldiers >= 4 || this.phaseTimer > 90) {
                this.gamePhase = 'assault';
                console.log('AI entering assault phase!');
            }
        }
    }

    /**
     * Update idle state - wait for think timer
     */
    updateIdle(deltaTime) {
        this.thinkTimer += deltaTime;

        if (this.thinkTimer >= this.thinkInterval) {
            this.thinkTimer = 0;
            this.state = 'thinking';
        }
    }

    /**
     * Update thinking state - decide what to do
     */
    updateThinking(deltaTime) {
        const action = this.decideNextAction();

        if (action) {
            this.currentAction = action;
            this.state = 'moving';

            // Move cursor to action position
            this.cursor.setGesture('pointing');
            this.cursor.moveTo(action.position, () => {
                // Arrived at position
                this.state = 'spawning';
                this.actionTimer = 0;
            });
        } else {
            // Nothing to do, go back to idle
            this.state = 'idle';
        }
    }

    /**
     * Update moving state - cursor is moving to target
     */
    updateMoving(deltaTime) {
        // Cursor movement is handled by AICursor.update()
        // This state just waits for arrival callback
    }

    /**
     * Update spawning state - execute the action
     */
    updateSpawning(deltaTime) {
        this.actionTimer += deltaTime;

        // Wait a moment at the spawn location (show intent)
        if (this.actionTimer >= this.actionDelay) {
            this.executeAction(this.currentAction);
            this.cursor.flashThumbsUp(300);
            this.currentAction = null;
            this.state = 'waiting';
            this.actionTimer = 0;
        }
    }

    /**
     * Update waiting state - brief pause after spawning
     */
    updateWaiting(deltaTime) {
        this.actionTimer += deltaTime;

        if (this.actionTimer >= 0.3) {
            this.state = 'idle';
        }
    }

    /**
     * Decide what action to take next based on game phase
     */
    decideNextAction() {
        switch (this.gamePhase) {
            case 'early':
                return this.decideEarlyGame();
            case 'mid':
                return this.decideMidGame();
            case 'late':
            case 'assault':
                return this.decideLateGame();
            default:
                return this.decideEarlyGame();
        }
    }

    /**
     * Early game decisions - focus on economy
     */
    decideEarlyGame() {
        const myBubbies = this.countMyBubbies();
        const myPlants = this.countMyPlants();

        // Prioritize eggs first for workers
        if (this.eggsSpawned < 4 && myBubbies < 5) {
            return this.planEggSpawn();
        }

        // Then some seeds for food production
        if (this.seedsSpawned < 2 && myPlants < 3) {
            return this.planSeedSpawn();
        }

        // Balance eggs and seeds
        if (myBubbies < 6) {
            return this.planEggSpawn();
        }

        if (myPlants < 3) {
            return this.planSeedSpawn();
        }

        return this.planEggSpawn(); // Default to more eggs
    }

    /**
     * Mid game decisions - build armory and start militarizing
     */
    decideMidGame() {
        const myBubbies = this.countMyBubbies();
        const myPlants = this.countMyPlants();
        const mySoldiers = this.countMySoldiers();

        // Priority 1: Build armory if we don't have one
        if (this.armoriesSpawned < 1) {
            return this.planArmorySpawn();
        }

        // Priority 2: Craft swords to create soldiers
        const swordAction = this.planSwordCraft();
        if (swordAction && mySoldiers < 4) {
            return swordAction;
        }

        // Priority 3: Craft armor for soldiers
        const armorAction = this.planArmorCraft();
        if (armorAction && mySoldiers > 0) {
            return armorAction;
        }

        // Priority 4: Keep economy growing
        if (myBubbies < 8) {
            return this.planEggSpawn();
        }

        if (myPlants < 4) {
            return this.planSeedSpawn();
        }

        // Build second armory for faster production
        if (this.armoriesSpawned < 2 && myBubbies >= 6) {
            return this.planArmorySpawn();
        }

        // Keep crafting swords
        return swordAction || this.planEggSpawn();
    }

    /**
     * Late game decisions - mass soldiers and attack
     */
    decideLateGame() {
        const myBubbies = this.countMyBubbies();
        const mySoldiers = this.countMySoldiers();

        // Priority 1: Keep crafting swords for more soldiers
        const swordAction = this.planSwordCraft();
        if (swordAction) {
            return swordAction;
        }

        // Priority 2: Craft armor for protection
        const armorAction = this.planArmorCraft();
        if (armorAction) {
            return armorAction;
        }

        // Priority 3: Build turrets for defense
        if (this.turretsSpawned < 2 && this.canAffordTurret()) {
            return this.planTurretSpawn();
        }

        // Priority 4: Keep spawning eggs for more soldiers
        if (myBubbies < 12) {
            return this.planEggSpawn();
        }

        // Priority 5: Build more armories for faster production
        if (this.armoriesSpawned < 3) {
            return this.planArmorySpawn();
        }

        return this.planEggSpawn();
    }

    /**
     * Check if we can afford a turret
     */
    canAffordTurret() {
        if (!this.getCastle) return false;
        const castle = this.getCastle();
        if (!castle) return false;

        const woodCost = GameConstants.TURRET.WOOD_COST;
        const stoneCost = GameConstants.TURRET.STONE_COST;

        return castle.getWoodCount() >= woodCost && castle.getStoneCount() >= stoneCost;
    }

    /**
     * Plan an egg spawn action
     */
    planEggSpawn() {
        if (!this.spawnEgg) return null;

        const position = this.getRandomSpawnPosition();
        return {
            type: 'egg',
            position: position,
            execute: () => {
                this.spawnEgg(new BABYLON.Vector3(
                    position.x,
                    GameConstants.PHYSICS.SPAWN_DROP_HEIGHT,
                    position.z
                ));
                this.eggsSpawned++;
            }
        };
    }

    /**
     * Plan a seed spawn action
     */
    planSeedSpawn() {
        if (!this.spawnSeed) return null;

        const position = this.getRandomSpawnPosition();
        return {
            type: 'seed',
            position: position,
            execute: () => {
                this.spawnSeed(new BABYLON.Vector3(
                    position.x,
                    GameConstants.PHYSICS.SPAWN_DROP_HEIGHT,
                    position.z
                ));
                this.seedsSpawned++;
            }
        };
    }

    /**
     * Plan an armory spawn action
     */
    planArmorySpawn() {
        if (!this.spawnArmory) return null;

        // Place armory strategically - closer to front line for offense
        const position = new BABYLON.Vector3(
            35 + Math.random() * 15, // Closer to middle for aggressive positioning
            0,
            (Math.random() - 0.5) * 20
        );

        return {
            type: 'armory',
            position: position,
            execute: () => {
                this.spawnArmory(new BABYLON.Vector3(
                    position.x,
                    GameConstants.PHYSICS.SPAWN_DROP_HEIGHT,
                    position.z
                ));
                this.armoriesSpawned++;
                console.log(`AI built armory #${this.armoriesSpawned}`);
            }
        };
    }

    /**
     * Plan a turret spawn action
     */
    planTurretSpawn() {
        if (!this.spawnTurret) return null;

        // Place turrets defensively near castle
        const position = new BABYLON.Vector3(
            50 + Math.random() * 10,
            0,
            (Math.random() - 0.5) * 25
        );

        return {
            type: 'turret',
            position: position,
            execute: () => {
                this.spawnTurret(new BABYLON.Vector3(
                    position.x,
                    GameConstants.PHYSICS.SPAWN_DROP_HEIGHT,
                    position.z
                ));
                this.turretsSpawned++;
                console.log(`AI built turret #${this.turretsSpawned}`);
            }
        };
    }

    /**
     * Plan a sword craft action at an armory
     */
    planSwordCraft() {
        if (!this.getAllArmories || !this.getCastle) return null;

        const armories = this.getAllArmories();
        if (armories.length === 0) return null;

        const castle = this.getCastle();
        if (!castle) return null;

        // Check if we have resources
        const woodCost = GameConstants.SWORD.WOOD_COST;
        const stoneCost = GameConstants.SWORD.STONE_COST;

        if (castle.getWoodCount() < woodCost || castle.getStoneCount() < stoneCost) {
            return null;
        }

        // Find armory with fewest swords (balance production)
        let bestArmory = null;
        let minSwords = Infinity;

        for (const armory of armories) {
            const swordCount = armory.getSwordCount();
            if (swordCount < minSwords) {
                minSwords = swordCount;
                bestArmory = armory;
            }
        }

        if (!bestArmory) return null;

        const position = bestArmory.getPosition();

        return {
            type: 'craft_sword',
            position: position,
            execute: () => {
                if (bestArmory.craftSword()) {
                    this.swordsCrafted++;
                    console.log(`AI crafted sword #${this.swordsCrafted}`);
                }
            }
        };
    }

    /**
     * Plan an armor craft action at an armory
     */
    planArmorCraft() {
        if (!this.getAllArmories || !this.getCastle) return null;

        const armories = this.getAllArmories();
        if (armories.length === 0) return null;

        const castle = this.getCastle();
        if (!castle) return null;

        // Check if armor constants exist
        if (!GameConstants.ARMOR) return null;

        const woodCost = GameConstants.ARMOR.WOOD_COST || 2;
        const stoneCost = GameConstants.ARMOR.STONE_COST || 2;

        if (castle.getWoodCount() < woodCost || castle.getStoneCount() < stoneCost) {
            return null;
        }

        // Find armory with fewest armors
        let bestArmory = null;
        let minArmors = Infinity;

        for (const armory of armories) {
            if (armory.getArmorCount) {
                const armorCount = armory.getArmorCount();
                if (armorCount < minArmors) {
                    minArmors = armorCount;
                    bestArmory = armory;
                }
            }
        }

        if (!bestArmory || !bestArmory.craftArmor) return null;

        const position = bestArmory.getPosition();

        return {
            type: 'craft_armor',
            position: position,
            execute: () => {
                if (bestArmory.craftArmor()) {
                    this.armorsCrafted++;
                    console.log(`AI crafted armor #${this.armorsCrafted}`);
                }
            }
        };
    }

    /**
     * Execute an action
     */
    executeAction(action) {
        if (action && action.execute) {
            action.execute();
        }
    }

    /**
     * Get random position in AI spawn zone
     */
    getRandomSpawnPosition() {
        return new BABYLON.Vector3(
            this.spawnZone.minX + Math.random() * (this.spawnZone.maxX - this.spawnZone.minX),
            0,
            this.spawnZone.minZ + Math.random() * (this.spawnZone.maxZ - this.spawnZone.minZ)
        );
    }

    /**
     * Count bubbies belonging to this AI
     */
    countMyBubbies() {
        if (!this.getAllBubbies) return 0;

        const bubbies = this.getAllBubbies();
        return bubbies.filter(b => b.team === this.team && b.isActive).length;
    }

    /**
     * Count plants belonging to this AI
     */
    countMyPlants() {
        if (!this.getAllPlants) return 0;

        const plants = this.getAllPlants();
        return plants.filter(p => p.team === this.team && p.isActive).length;
    }

    /**
     * Count soldiers (armed bubbies) belonging to this AI
     */
    countMySoldiers() {
        if (!this.getAllBubbies) return 0;

        const bubbies = this.getAllBubbies();
        return bubbies.filter(b => b.team === this.team && b.isActive && b.isSoldier).length;
    }

    /**
     * Count armored soldiers
     */
    countMyArmoredSoldiers() {
        if (!this.getAllBubbies) return 0;

        const bubbies = this.getAllBubbies();
        return bubbies.filter(b => b.team === this.team && b.isActive && b.isSoldier && b.hasArmor).length;
    }

    /**
     * Set AI difficulty
     * @param {string} difficulty - 'easy', 'medium', 'hard'
     */
    setDifficulty(difficulty) {
        switch (difficulty) {
            case 'easy':
                this.thinkInterval = 2.5;
                this.reactionSpeed = 0.05;
                this.aggression = 0.4;
                break;
            case 'medium':
                this.thinkInterval = 1.5;
                this.reactionSpeed = 0.1;
                this.aggression = 0.6;
                break;
            case 'hard':
                this.thinkInterval = 0.8;
                this.reactionSpeed = 0.15;
                this.aggression = 0.8;
                break;
        }

        this.cursor.setSpeed(this.reactionSpeed);
    }

    /**
     * Pause AI
     */
    pause() {
        this.isPaused = true;
    }

    /**
     * Resume AI
     */
    resume() {
        this.isPaused = false;
    }

    /**
     * Set active state
     */
    setActive(active) {
        this.isActive = active;
        this.cursor.setVisible(active);
    }

    /**
     * Get cursor
     */
    getCursor() {
        return this.cursor;
    }

    /**
     * Dispose AI player
     */
    dispose() {
        if (this.cursor) {
            this.cursor.dispose();
            this.cursor = null;
        }
    }
}
