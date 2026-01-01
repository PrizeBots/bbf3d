import { SpawnableObject } from './SpawnableObject.js';
import { BubbyAI } from '../systems/BubbyAI.js';
import { GameConstants } from '../config/GameConstants.js';
import { Tree } from './Tree.js';
import { Fruit } from './Fruit.js';

/**
 * Bubby - Baby hatched creature that idles around and attacks plants (sprouts, bushes, trees)
 *
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @param {Object} config - Configuration object
 * @param {BABYLON.Vector3} config.position - Spawn position
 * @param {string} config.team - Team ('red' or 'blue')
 * @param {BABYLON.ShadowGenerator} config.shadowGenerator - Shadow generator
 * @param {Function} config.getAllPlants - Function to get all plants
 * @param {Function} config.getAllBubbies - Function to get all bubbies
 * @param {Function} config.onMatureCallback - Callback when baby matures
 * @param {number} [config.initialHealth] - Starting health
 * @param {Function} [config.getAllFruits] - Function to get all fruits
 */
export class Bubby extends SpawnableObject {
    constructor(scene, config) {
        super(scene, config.position, config.shadowGenerator, GameConstants.BABY_BUBBY.START_HP);

        this.team = config.team; // 'red' or 'blue'
        this.getAllPlants = config.getAllPlants; // Function to get all plants in the scene
        this.getAllBubbies = config.getAllBubbies; // Function to get all other bubbies
        this.getAllFruits = config.getAllFruits || null; // Function to get all fruits in the scene
        this.onMatureCallback = config.onMatureCallback; // Callback when baby matures to adult
        this.idleTime = 0;
        this.squishPhase = 0;

        // AI helper for shared behavior
        this.ai = new BubbyAI(this, GameConstants.BABY_BUBBY);

        // AI behavior
        this.state = 'idle'; // 'idle', 'wandering', 'moving_to_target', 'attacking'
        this.target = null;
        this.attackCooldown = 0;

        // Wandering behavior
        this.wanderTarget = null;
        this.wanderTime = 0;

        // Maturation (baby -> adult)
        this.hasMatured = false;

        // Growth
        this.baseSize = 1.0; // Start smaller as baby
        this.currentSize = 1.0;
        this.growthAmount = 0;
        this.maxGrowth = 1.5; // Baby can only grow so much
        this.isPaused = false; // For drag system

        this.draggable = true; // Bubbies are draggable
        this.groundLevel = 0.75; // Half of sphere diameter (1.5 / 2)

        this.create();
        this.enableShadows();
        this.createHealthBar(0.95); // Consistent padding: 0.75 radius + 0.2 padding

        // Set initial health (transferred from egg)
        if (config.initialHealth) {
            this.setHealth(config.initialHealth);
        }

        this.setupIdleBehavior();
    }

    /**
     * Create the bubby mesh (round slime squish)
     */
    create() {
        this.mesh = BABYLON.MeshBuilder.CreateSphere(
            `bubby_${this.team}_${Date.now()}`,
            {
                diameter: 1.5,
                segments: 16
            },
            this.scene
        );

        // Set position at proper ground level (sphere center at radius height)
        this.mesh.position = this.position.clone();
        this.mesh.position.y = this.groundLevel;

        // Create bubby material based on team
        const bubbyMaterial = new BABYLON.StandardMaterial(`bubbyMat_${this.team}_${Date.now()}`, this.scene);

        if (this.team === 'red') {
            bubbyMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.2); // Red
            bubbyMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.05, 0.05);
        } else {
            bubbyMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.9); // Blue
            bubbyMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.3);
        }

        // Removed alpha transparency to enable proper shadow casting
        this.mesh.material = bubbyMaterial;
    }

    /**
     * Setup idle behavior
     */
    setupIdleBehavior() {
        // No longer needed - game loop calls update directly
    }

    /**
     * Update bubby state (AI behavior and animations)
     */
    update() {
        if (!this.mesh || !this.isActive) {
            return;
        }

        // Call parent update for healthbar
        super.update();

        // Skip AI updates if paused (being dragged)
        if (this.isPaused) {
            return;
        }

        const deltaTime = this.deltaTime || 0.016; // Use game loop deltaTime
        this.idleTime += deltaTime;

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // AI behavior based on state
        switch (this.state) {
            case 'idle':
                this.updateIdle();
                break;
            case 'wandering':
                this.updateWandering(deltaTime);
                break;
            case 'moving_to_target':
                this.updateMovingToTarget();
                break;
            case 'attacking':
                this.updateAttacking(deltaTime);
                break;
        }

        // Constrain to arena bounds (only if not falling after drop)
        if (!this.isFallingAfterDrop) {
            this.constrainToArena();

            // Ensure bubby stays at proper ground level
            if (this.mesh) {
                this.mesh.position.y = this.groundLevel;
            }
        }

        // Apply squish animation based on current size (only if not falling)
        if (!this.isFallingAfterDrop) {
            this.squishPhase += 0.05;
            const squishY = 1 + Math.sin(this.squishPhase) * 0.1;
            const squishXZ = 1 / Math.sqrt(squishY);

            if (this.mesh) {
                this.mesh.scaling = new BABYLON.Vector3(
                    squishXZ * this.currentSize,
                    squishY * this.currentSize,
                    squishXZ * this.currentSize
                );

                // Gentle rocking motion
                this.mesh.rotation.z = Math.sin(this.squishPhase * 0.7) * 0.1;
            }
        }
    }

    /**
     * Update idle state - sense for nearby fruits or plants, or start wandering
     */
    updateIdle() {
        // Baby bubbies LOVE fruits - always prioritize them!
        const nearestFruit = this.findNearestFruit();
        if (nearestFruit) {
            this.target = nearestFruit;
            this.state = 'moving_to_target';
            return;
        }

        // Only look for plants if no fruits available
        const nearestPlant = this.findNearestPlant();

        if (nearestPlant) {
            this.target = nearestPlant;
            this.state = 'moving_to_target';
        } else {
            // Start wandering after a moment
            this.idleTime += 0.016;
            if (this.idleTime > 0.5) { // Idle for 0.5 seconds before wandering
                this.state = 'wandering';
                this.idleTime = 0;
                this.wanderTime = 0;
                this.pickWanderTarget();
            }
        }
    }

    /**
     * Pick a random wander target within the arena
     */
    pickWanderTarget() {
        this.wanderTarget = this.ai.pickWanderTarget(10, 30);
    }

    /**
     * Update wandering state - meander around the arena
     */
    updateWandering(deltaTime) {
        this.wanderTime += deltaTime;

        // Baby bubbies LOVE fruits - always check for them first!
        const nearestFruit = this.findNearestFruit();
        if (nearestFruit) {
            this.target = nearestFruit;
            this.state = 'moving_to_target';
            this.wanderTarget = null;
            return;
        }

        // Only check for plants if no fruits available
        const nearestPlant = this.findNearestPlant();
        if (nearestPlant) {
            this.target = nearestPlant;
            this.state = 'moving_to_target';
            this.wanderTarget = null;
            return;
        }

        // Pick new wander target after duration or if reached current target
        if (this.wanderTime >= GameConstants.BABY_BUBBY.WANDER_DURATION || !this.wanderTarget) {
            this.pickWanderTarget();
            this.wanderTime = 0;
        }

        // Move toward wander target
        if (this.wanderTarget) {
            const distance = this.ai.moveToward(this.wanderTarget, this.getAllBubbies, 0.4);

            // Check if reached wander target
            if (distance < 2) {
                this.state = 'idle';
                this.wanderTarget = null;
            }
        }
    }

    /**
     * Update moving to target state
     */
    updateMovingToTarget() {
        if (!this.target || !this.target.isActive) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Check if in attack range
        if (this.ai.isInAttackRange(this.target)) {
            this.state = 'attacking';
            return;
        }

        // Check if target is out of sensing range
        if (!this.ai.isInSensingRange(this.target)) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Move toward target with collision avoidance
        this.ai.moveToward(this.target.mesh.position, this.getAllBubbies, 0.5);
    }

    /**
     * Update attacking state
     */
    updateAttacking(deltaTime) {
        if (!this.target || !this.target.isActive) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // If target moved out of attack range, chase it
        if (!this.ai.isInAttackRange(this.target)) {
            this.state = 'moving_to_target';
            return;
        }

        // Attack at intervals
        if (this.attackCooldown <= 0) {
            this.attackTarget();
            this.attackCooldown = GameConstants.BABY_BUBBY.ATTACK_INTERVAL;
        }
    }

    /**
     * Attack the current target
     */
    attackTarget() {
        if (!this.target) {
            return;
        }

        // Check if target is a fruit
        if (this.target instanceof Fruit) {
            this.eatFruit();
            return;
        }

        const attackDamage = GameConstants.BABY_BUBBY.ATTACK_DAMAGE;
        const growthRate = GameConstants.BABY_BUBBY.GROWTH_RATE;
        const matureThreshold = GameConstants.BABY_BUBBY.MATURE_HP;

        // Deal damage to target (plant)
        this.target.takeDamage(attackDamage);

        // Grow max HP when eating (both current and max HP grow together)
        const hpGrowth = attackDamage * growthRate;
        const newMaxHealth = this.maxHealth + hpGrowth;
        const newHealth = this.getHealth() + hpGrowth;

        // Check for maturation BEFORE updating
        if (!this.hasMatured && newMaxHealth >= matureThreshold) {
            // Cap at threshold and mature
            this.healthBar.setMaxHealth(matureThreshold);
            this.maxHealth = matureThreshold;
            this.setHealth(matureThreshold);
            this.mature();
            return; // Stop processing after maturation
        } else {
            // Continue growing
            this.healthBar.setMaxHealth(newMaxHealth);
            this.maxHealth = newMaxHealth;
            this.setHealth(newHealth);
        }

        // Grow size when dealing damage
        this.grow();

        // Check if target is dead
        if (!this.target.isActive) {
            this.target = null;
            this.state = 'idle';
        }
    }

    /**
     * Eat a fruit to grow max HP (same as eating plants)
     */
    eatFruit() {
        if (!this.target || !this.target.canBeEaten || !this.target.canBeEaten()) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        const attackDamage = GameConstants.BABY_BUBBY.ATTACK_DAMAGE;
        const growthRate = GameConstants.BABY_BUBBY.GROWTH_RATE;
        const matureThreshold = GameConstants.BABY_BUBBY.MATURE_HP;

        // Eat fruit (get HP from it)
        const hpRestored = this.target.getEaten(attackDamage);
        if (hpRestored > 0) {
            // Grow max HP when eating (both current and max HP grow together)
            const hpGrowth = hpRestored * growthRate;
            const newMaxHealth = this.maxHealth + hpGrowth;
            const newHealth = this.getHealth() + hpGrowth;

            // Check for maturation BEFORE updating
            if (!this.hasMatured && newMaxHealth >= matureThreshold) {
                // Cap at threshold and mature
                this.healthBar.setMaxHealth(matureThreshold);
                this.maxHealth = matureThreshold;
                this.setHealth(matureThreshold);
                this.mature();
                return; // Stop processing after maturation
            } else {
                // Continue growing
                this.healthBar.setMaxHealth(newMaxHealth);
                this.maxHealth = newMaxHealth;
                this.setHealth(newHealth);
            }

            // Grow size when eating
            this.grow();
        }

        // Check if fruit is depleted
        if (!this.target.isActive) {
            this.target = null;
            this.state = 'idle';
        }
    }

    /**
     * Find the nearest fruit within sensing range
     */
    findNearestFruit() {
        return this.ai.findNearest(
            this.getAllFruits,
            (fruit) => fruit.canBeEaten && fruit.canBeEaten()
        );
    }

    /**
     * Find the nearest plant (sprout or bush only - trees are too tall) within sensing range
     */
    findNearestPlant() {
        return this.ai.findNearest(
            this.getAllPlants,
            (plant) => !(plant instanceof Tree) // Skip trees - too tall for baby bubbies
        );
    }

    /**
     * Mature from baby bubby to adult bubby
     */
    mature() {
        this.hasMatured = true;

        if (this.onMatureCallback) {
            // Spawn adult bubby at current position with current health
            this.onMatureCallback(this.mesh.position.clone(), this.team, this.getHealth());
        }

        // Dispose baby bubby
        this.dispose();
    }

    /**
     * Constrain position to arena bounds
     */
    constrainToArena() {
        const hitBoundary = this.ai.constrainToArena(this);
        if (hitBoundary) {
            this.state = 'idle';
        }
    }

    /**
     * Grow the bubby when it eats
     */
    grow() {
        const growthIncrement = GameConstants.BABY_BUBBY.SIZE_GROWTH_INCREMENT;
        this.growthAmount += growthIncrement;

        // Cap growth at max
        this.growthAmount = Math.min(this.growthAmount, this.maxGrowth - this.baseSize);

        // Update current size
        this.currentSize = this.baseSize + this.growthAmount;
    }

    /**
     * Get team
     */
    getTeam() {
        return this.team;
    }

    /**
     * Called when bubby lands after being dropped
     */
    onLanded() {
        // Reset rotation after landing
        if (this.mesh) {
            this.mesh.rotation.x = 0;
            this.mesh.rotation.z = 0;
        }
    }

    /**
     * Pause AI/physics for dragging
     */
    pauseAI() {
        this.isPaused = true;
    }

    /**
     * Resume AI/physics after dragging
     */
    resumeAI() {
        this.isPaused = false;
    }

    /**
     * Dispose bubby and clean up
     */
    dispose() {
        // updateObserver no longer used
        super.dispose();
    }
}