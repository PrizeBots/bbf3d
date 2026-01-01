import { SpawnableObject } from './SpawnableObject.js';
import { BubbyAI } from '../systems/BubbyAI.js';
import { GameConstants } from '../config/GameConstants.js';
import { Fruit } from './Fruit.js';

/**
 * AdultBubby - Mature bubby with blob head on capsule body
 *
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @param {Object} config - Configuration object
 * @param {BABYLON.Vector3} config.position - Spawn position
 * @param {string} config.team - Team ('red' or 'blue')
 * @param {BABYLON.ShadowGenerator} config.shadowGenerator - Shadow generator
 * @param {Function} config.getAllPlants - Function to get all plants
 * @param {Function} config.getAllBubbies - Function to get all bubbies
 * @param {number} [config.initialHealth] - Starting health
 * @param {Function} [config.getAllFruits] - Function to get all fruits
 * @param {Function} [config.onCoinEarnedCallback] - Callback when coin is earned
 */
export class AdultBubby extends SpawnableObject {
    constructor(scene, config) {
        super(scene, config.position, config.shadowGenerator, GameConstants.ADULT_BUBBY.MAX_HP);

        this.team = config.team; // 'red' or 'blue'
        this.getAllPlants = config.getAllPlants; // Function to get all plants in the scene
        this.getAllBubbies = config.getAllBubbies; // Function to get all other bubbies
        this.getAllFruits = config.getAllFruits || null; // Function to get all fruits in the scene
        this.onCoinEarnedCallback = config.onCoinEarnedCallback || null; // Callback when coin is earned
        this.idleTime = 0;
        this.squishPhase = 0;
        this.bobPhase = 0;

        // AI helper for shared behavior
        this.ai = new BubbyAI(this, GameConstants.ADULT_BUBBY);

        // AI behavior
        this.state = 'idle'; // 'idle', 'wandering', 'moving_to_target', 'attacking', 'gathering_fruit', 'carrying_fruit', 'returning_to_castle'
        this.target = null;
        this.attackCooldown = 0;

        // Wandering behavior
        this.wanderTarget = null;
        this.wanderTime = 0;

        // Fruit gathering behavior
        this.carriedFruit = null;

        // Growth
        this.baseSize = 1.0;
        this.currentSize = 1.0;
        this.growthAmount = 0;
        this.maxGrowth = 1.8; // Can grow larger as adult
        this.isPaused = false; // For drag system

        this.draggable = true; // Adult bubbies are draggable
        this.groundLevel = 0; // Body is on ground, mesh position is at 0

        // Body parts
        this.body = null;
        this.head = null;

        this.create();
        this.enableShadows();
        this.createHealthBar(1.35); // Consistent padding: 1.125 head radius + 0.2 + 0.025

        // Set initial health
        if (config.initialHealth) {
            this.setHealth(config.initialHealth);
        }

        this.setupIdleBehavior();
    }

    /**
     * Create the adult bubby mesh (blob head on capsule body)
     */
    create() {
        // Create container
        this.mesh = new BABYLON.TransformNode(`adult_bubby_${this.team}_${Date.now()}`, this.scene);
        this.mesh.position = this.position.clone();
        this.mesh.position.y = this.groundLevel; // Set to proper ground level

        // Create capsule body (height includes rounded caps)
        this.body = BABYLON.MeshBuilder.CreateCapsule(
            `adult_bubby_body_${this.team}_${Date.now()}`,
            {
                radius: 0.6,
                height: 1.8,
                tessellation: 16
            },
            this.scene
        );
        this.body.position.y = 0.9; // Half of height (1.8/2 = 0.9) to sit on ground
        this.body.parent = this.mesh;

        // Create blob head (sphere) - same size as fully-grown baby bubby
        this.head = BABYLON.MeshBuilder.CreateSphere(
            `adult_bubby_head_${this.team}_${Date.now()}`,
            {
                diameter: 2.25, // Full-grown baby bubby size (1.5 base * 1.5 max scale)
                segments: 16
            },
            this.scene
        );
        this.head.position.y = 2.925; // On top of body (body top at 1.8 + head radius 1.125 = 2.925)
        this.head.parent = this.mesh;

        // Create material based on team
        const material = new BABYLON.StandardMaterial(`adultBubbyMat_${this.team}_${Date.now()}`, this.scene);

        if (this.team === 'red') {
            material.diffuseColor = new BABYLON.Color3(1.0, 0.3, 0.3); // Bright red
            material.emissiveColor = new BABYLON.Color3(0.4, 0.1, 0.1);
        } else {
            material.diffuseColor = new BABYLON.Color3(0.3, 0.5, 1.0); // Bright blue
            material.emissiveColor = new BABYLON.Color3(0.1, 0.2, 0.4);
        }

        // Removed alpha transparency to enable proper shadow casting
        this.body.material = material;
        this.head.material = material;
    }

    /**
     * Override createHealthBar to use head mesh as parent
     */
    createHealthBar(offsetY = 1.35) {
        if (!this.head) {
            console.warn("Cannot create healthbar without head mesh");
            return;
        }
        this.healthBar = new HealthBar(this.scene, this.head, this.maxHealth, offsetY);
    }

    /**
     * Override enableShadows for multiple meshes
     */
    enableShadows() {
        if (this.shadowGenerator) {
            if (this.body) this.shadowGenerator.addShadowCaster(this.body);
            if (this.head) this.shadowGenerator.addShadowCaster(this.head);
        }
    }

    /**
     * Setup idle behavior
     */
    setupIdleBehavior() {
        // No longer needed - game loop calls update directly
    }

    /**
     * Update adult bubby state (AI behavior and animations)
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
            case 'gathering_fruit':
                this.updateGatheringFruit();
                break;
            case 'carrying_fruit':
                this.updateCarryingFruit();
                break;
            case 'returning_to_castle':
                this.updateReturningToCastle();
                break;
        }

        // Constrain to arena bounds (only if not falling after drop)
        if (!this.isFallingAfterDrop) {
            this.constrainToArena();

            // Ensure adult bubby stays at proper ground level
            if (this.mesh) {
                this.mesh.position.y = this.groundLevel;
            }
        }

        // Apply animations based on current size (only if not falling)
        if (!this.isFallingAfterDrop) {
            this.squishPhase += 0.04;
            this.bobPhase += 0.03;

            // Body squish animation
            const squishY = 1 + Math.sin(this.squishPhase) * 0.08;
            const squishXZ = 1 / Math.sqrt(squishY);
            if (this.body) {
                this.body.scaling = new BABYLON.Vector3(
                    squishXZ * this.currentSize,
                    squishY * this.currentSize,
                    squishXZ * this.currentSize
                );
            }

            // Head bob and squish
            if (this.head) {
                const headSquish = 1 + Math.sin(this.squishPhase * 1.3) * 0.1;
                this.head.scaling = new BABYLON.Vector3(
                    this.currentSize / headSquish,
                    this.currentSize * headSquish,
                    this.currentSize / headSquish
                );

                // Bob up and down slightly
                this.head.position.y = 2.925 + Math.sin(this.bobPhase) * 0.05;
            }

            // Gentle rocking motion
            if (this.mesh) {
                this.mesh.rotation.z = Math.sin(this.squishPhase * 0.5) * 0.08;
            }
        }
    }

    /**
     * Update idle state - sense for nearby fruits or plants, or start wandering
     */
    updateIdle() {
        // If at full HP and gathering enabled, look for fruits to gather for coins
        if (this.getHealth() >= this.maxHealth && GameConstants.ADULT_BUBBY.GATHER_FRUIT) {
            const nearestFruitToGather = this.findNearestFruitForGathering();
            if (nearestFruitToGather) {
                this.target = nearestFruitToGather;
                this.state = 'gathering_fruit';
                return;
            }
        }

        // Only hunt if not at full HP (adult bubbies only eat to heal)
        if (this.getHealth() < this.maxHealth) {
            // Prioritize fruits over plants for healing
            const nearestFruit = this.findNearestFruitForEating();
            if (nearestFruit) {
                this.target = nearestFruit;
                this.state = 'moving_to_target';
                return;
            }

            const nearestPlant = this.findNearestPlant();
            if (nearestPlant) {
                this.target = nearestPlant;
                this.state = 'moving_to_target';
                return;
            }
        }

        // Otherwise just wander
        if (this.idleTime > 0.3) {
            this.state = 'wandering';
            this.idleTime = 0;
            this.wanderTime = 0;
            this.pickWanderTarget();
        }
    }

    /**
     * Pick a random wander target within the arena
     */
    pickWanderTarget() {
        this.wanderTarget = this.ai.pickWanderTarget(15, 40);
    }

    /**
     * Update wandering state - meander around the arena
     */
    updateWandering(deltaTime) {
        this.wanderTime += deltaTime;

        // If at full HP and gathering enabled, look for fruits to gather
        if (this.getHealth() >= this.maxHealth && GameConstants.ADULT_BUBBY.GATHER_FRUIT) {
            const nearestFruitToGather = this.findNearestFruitForGathering();
            if (nearestFruitToGather) {
                this.target = nearestFruitToGather;
                this.state = 'gathering_fruit';
                this.wanderTarget = null;
                return;
            }
        }

        // Check if we sense food while wandering (only if not at full HP)
        if (this.getHealth() < this.maxHealth) {
            // Prioritize fruits
            const nearestFruit = this.findNearestFruitForEating();
            if (nearestFruit) {
                this.target = nearestFruit;
                this.state = 'moving_to_target';
                this.wanderTarget = null;
                return;
            }

            const nearestPlant = this.findNearestPlant();
            if (nearestPlant) {
                this.target = nearestPlant;
                this.state = 'moving_to_target';
                this.wanderTarget = null;
                return;
            }
        }

        // Pick new wander target after duration
        if (this.wanderTime >= GameConstants.ADULT_BUBBY.WANDER_DURATION || !this.wanderTarget) {
            this.pickWanderTarget();
            this.wanderTime = 0;
        }

        // Move toward wander target
        if (this.wanderTarget) {
            const distance = this.ai.moveToward(this.wanderTarget, this.getAllBubbies, 0.4);

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
            this.attackCooldown = GameConstants.ADULT_BUBBY.ATTACK_INTERVAL;
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

        const attackDamage = GameConstants.ADULT_BUBBY.ATTACK_DAMAGE;

        // Attack plant
        this.target.takeDamage(attackDamage);

        // Heal when eating plants (adult bubbies don't grow max HP)
        const newHealth = Math.min(this.maxHealth, this.getHealth() + attackDamage);
        this.setHealth(newHealth);

        this.grow();

        if (!this.target.isActive) {
            this.target = null;
            this.state = 'idle';
        }
    }

    /**
     * Eat a fruit to restore HP
     */
    eatFruit() {
        if (!this.target || !this.target.canBeEaten || !this.target.canBeEaten()) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Calculate how much HP we need
        const hpNeeded = this.maxHealth - this.getHealth();
        if (hpNeeded <= 0) {
            // Already at full HP, stop eating
            this.target = null;
            this.state = 'idle';
            return;
        }

        const attackDamage = GameConstants.ADULT_BUBBY.ATTACK_DAMAGE;

        // Eat fruit (get HP from it)
        const hpRestored = this.target.getEaten(attackDamage);
        if (hpRestored > 0) {
            // Restore HP (but don't exceed max)
            const newHealth = Math.min(this.maxHealth, this.getHealth() + hpRestored);
            this.setHealth(newHealth);
        }

        // Check if fruit is depleted or we're full
        if (!this.target.isActive || this.getHealth() >= this.maxHealth) {
            this.target = null;
            this.state = 'idle';
        }
    }

    /**
     * Update gathering fruit state - move toward fruit to pick it up
     */
    updateGatheringFruit() {
        if (!this.target || !this.target.isActive) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        const distance = this.ai.getDistanceTo(this.target);

        // Check if in pickup range
        if (distance <= GameConstants.ADULT_BUBBY.PICKUP_RANGE) {
            this.pickupFruit();
            return;
        }

        // Check if target is out of sensing range
        if (!this.ai.isInSensingRange(this.target)) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Move toward fruit with collision avoidance
        this.ai.moveToward(this.target.mesh.position, this.getAllBubbies, 0.5);
    }

    /**
     * Pick up the target fruit
     */
    pickupFruit() {
        if (!this.target || !this.target.isActive) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Carry the fruit (parent it to bubby's head)
        this.carriedFruit = this.target;
        this.carriedFruit.mesh.parent = this.head;
        this.carriedFruit.mesh.position = new BABYLON.Vector3(0, 1.5, 0); // Above head
        this.carriedFruit.isPaused = true; // Pause fruit decay/ripening while carried

        this.target = null;
        this.state = 'returning_to_castle';
    }

    /**
     * Update returning to castle state - navigate to castle and deposit
     */
    updateReturningToCastle() {
        if (!this.carriedFruit || !this.carriedFruit.isActive) {
            // Fruit was destroyed somehow
            this.carriedFruit = null;
            this.state = 'idle';
            return;
        }

        // Get castle position for this team
        const castlePos = this.getCastlePosition();
        const distance = this.ai.moveToward(castlePos, this.getAllBubbies, 0.5);

        // Check if in deposit range
        if (distance <= GameConstants.ADULT_BUBBY.DEPOSIT_RANGE) {
            this.depositFruit();
        }
    }

    /**
     * Deposit fruit at castle and earn coin
     */
    depositFruit() {
        if (!this.carriedFruit) {
            this.state = 'idle';
            return;
        }

        // Get deposit position (current position)
        const depositPosition = this.mesh.position.clone();

        // Trigger coin earning callback
        if (this.onCoinEarnedCallback) {
            this.onCoinEarnedCallback(depositPosition, this.team, GameConstants.ECONOMY.FRUIT_COIN_VALUE);
        }

        // Dispose the fruit
        this.carriedFruit.dispose();
        this.carriedFruit = null;

        // Return to idle state
        this.state = 'idle';
    }

    /**
     * Get castle position for this bubby's team
     */
    getCastlePosition() {
        const castleData = this.team === 'red'
            ? GameConstants.CASTLE.RED_POSITION
            : GameConstants.CASTLE.BLUE_POSITION;
        return new BABYLON.Vector3(castleData.x, castleData.y, castleData.z);
    }

    /**
     * Find the nearest fruit for eating (must be eatable)
     */
    findNearestFruitForEating() {
        return this.ai.findNearest(
            this.getAllFruits,
            (fruit) => fruit.canBeEaten && fruit.canBeEaten()
        );
    }

    /**
     * Find the nearest fruit for gathering (any fruit, regardless of HP)
     */
    findNearestFruitForGathering() {
        return this.ai.findNearest(this.getAllFruits);
    }

    /**
     * Find the nearest plant within sensing range
     */
    findNearestPlant() {
        return this.ai.findNearest(this.getAllPlants);
    }

    /**
     * Constrain position to arena bounds
     */
    constrainToArena() {
        this.ai.constrainToArena(this);
    }

    /**
     * Grow the adult bubby when it eats
     */
    grow() {
        const growthIncrement = GameConstants.ADULT_BUBBY.SIZE_GROWTH_INCREMENT;
        this.growthAmount += growthIncrement;

        this.growthAmount = Math.min(this.growthAmount, this.maxGrowth - this.baseSize);
        this.currentSize = this.baseSize + this.growthAmount;
    }

    /**
     * Get team
     */
    getTeam() {
        return this.team;
    }

    /**
     * Called when adult bubby lands after being dropped
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

        // Drop carried fruit if being dragged
        if (this.carriedFruit) {
            this.dropCarriedFruit();
        }
    }

    /**
     * Resume AI/physics after dragging
     */
    resumeAI() {
        this.isPaused = false;
    }

    /**
     * Drop carried fruit (when dragged or disposed)
     */
    dropCarriedFruit() {
        if (!this.carriedFruit) {
            return;
        }

        // Unparent the fruit
        this.carriedFruit.mesh.parent = null;
        this.carriedFruit.mesh.position = this.mesh.position.clone();
        this.carriedFruit.mesh.position.y = 0.3; // Ground level for fruit
        this.carriedFruit.isPaused = false; // Resume fruit decay/ripening

        this.carriedFruit = null;
        this.state = 'idle';
    }

    /**
     * Dispose adult bubby and clean up
     */
    dispose() {
        // Drop carried fruit before disposing
        if (this.carriedFruit) {
            this.dropCarriedFruit();
        }

        // updateObserver no longer used
        if (this.body) {
            this.body.dispose();
            this.body = null;
        }
        if (this.head) {
            this.head.dispose();
            this.head = null;
        }
        super.dispose();
    }
}
