import { SpawnableObject } from './SpawnableObject.js';
import { BubbyAI } from '../systems/BubbyAI.js';
import { GameConstants } from '../config/GameConstants.js';
import { Fruit } from './Fruit.js';
import { WoodChunk } from './WoodChunk.js';
import { StonePiece } from './StonePiece.js';
import { HealthBar } from '../components/HealthBar.js';

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
 * @param {Function} [config.getAllWoodChunks] - Function to get all pickable wood chunks
 * @param {Function} [config.getAllHarvestableTrees] - Function to get all harvestable trees
 * @param {Function} [config.getAllStonePieces] - Function to get all pickable stone pieces
 * @param {Function} [config.getAllStoneDeposits] - Function to get all mineable stone deposits
 * @param {Function} [config.getAllArmories] - Function to get team's armories
 * @param {Function} [config.getEnemyUnits] - Function to get enemy units (for soldier combat)
 * @param {Function} [config.getEnemyBuildings] - Function to get enemy buildings (for soldier combat)
 * @param {Function} [config.getEnemyCastle] - Function to get enemy castle (for soldier combat)
 * @param {Function} [config.onCoinEarnedCallback] - Callback when coin is earned (legacy)
 * @param {Function} [config.getCastle] - Function to get this bubby's team castle
 */
export class AdultBubby extends SpawnableObject {
    constructor(scene, config) {
        super(scene, config.position, config.shadowGenerator, GameConstants.ADULT_BUBBY.MAX_HP);

        this.team = config.team; // 'red' or 'blue'
        this.getAllPlants = config.getAllPlants; // Function to get all plants in the scene
        this.getAllBubbies = config.getAllBubbies; // Function to get all other bubbies
        this.getAllFruits = config.getAllFruits || null; // Function to get all fruits in the scene
        this.getAllWoodChunks = config.getAllWoodChunks || null; // Function to get pickable wood chunks
        this.getAllHarvestableTrees = config.getAllHarvestableTrees || null; // Function to get harvestable trees
        this.getAllStonePieces = config.getAllStonePieces || null; // Function to get pickable stone pieces
        this.getAllStoneDeposits = config.getAllStoneDeposits || null; // Function to get mineable deposits
        this.getAllArmories = config.getAllArmories || null; // Function to get team's armories
        this.getEnemyUnits = config.getEnemyUnits || null; // Function to get enemy units
        this.getEnemyBuildings = config.getEnemyBuildings || null; // Function to get enemy buildings
        this.getEnemyCastle = config.getEnemyCastle || null; // Function to get enemy castle
        this.onCoinEarnedCallback = config.onCoinEarnedCallback || null; // Callback when coin is earned (legacy)
        this.getCastle = config.getCastle || null; // Function to get team's castle
        this.attackEffects = config.attackEffects || null; // Attack visual effects
        this.soundManager = config.soundManager || null; // Sound manager
        this.idleTime = 0;
        this.squishPhase = 0;
        this.bobPhase = 0;

        // AI helper for shared behavior
        this.ai = new BubbyAI(this, GameConstants.ADULT_BUBBY);

        // AI behavior states:
        // 'idle', 'wandering', 'moving_to_target', 'attacking',
        // 'gathering_fruit', 'carrying_fruit', 'returning_to_castle',
        // 'moving_to_tree', 'harvesting_tree', 'gathering_wood', 'carrying_wood',
        // 'moving_to_deposit', 'mining_deposit', 'gathering_stone', 'carrying_stone',
        // 'moving_to_armory' (to become soldier), 'moving_to_armory_for_armor' (to get armor)
        // 'stalking_enemy', 'attacking_enemy' (soldier combat)
        this.state = 'idle';

        // Soldier status - when equipped with sword from armory
        this.isSoldier = false;
        this.combatTarget = null; // Current enemy target for soldiers
        this.target = null;
        this.attackCooldown = 0;
        this.harvestCooldown = 0; // Cooldown for harvesting trees/deposits

        // Equipment - sword gives combat bonuses
        this.equippedSword = null; // Reference to equipped Sword object
        this.swordMesh = null; // Visual sword mesh attached to bubby

        // Equipment - armor gives defense bonus
        this.hasArmor = false; // Whether bubby has armor equipped
        this.armorMesh = null; // Visual armor mesh attached to bubby

        // Wandering behavior
        this.wanderTarget = null;
        this.wanderTime = 0;

        // Resource carrying - generalized for fruit, wood, stone
        this.carriedFruit = null; // Legacy for fruit
        this.carriedResource = null; // The resource object being carried
        this.carriedResourceType = null; // 'fruit', 'wood', 'stone'

        // Growth
        this.baseSize = 1.0;
        this.currentSize = 1.0;
        this.growthAmount = 0;
        this.maxGrowth = 1.8; // Can grow larger as adult
        this.isPaused = false; // For drag system

        // Cooperative behavior - some bubbies prefer harvesting, others collecting
        // This creates natural division of labor
        this.prefersHarvesting = Math.random() < 0.4; // 40% prefer to be harvesters

        this.draggable = true; // Adult bubbies are draggable
        this.groundLevel = 0; // Body is on ground, mesh position is at 0

        // Body parts
        this.body = null;
        this.head = null;
        this.leftArm = null;
        this.rightArm = null;
        this.leftArmPivot = null;
        this.rightArmPivot = null;

        // Arm animation state
        this.isSwingingArms = false;
        this.armSwingPhase = 0;
        this.armSwingSpeed = 0;
        this.armSwingCallback = null;

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

        // Create arms
        this.createArms(material);
    }

    /**
     * Create the bubby's arms
     */
    createArms(material) {
        const armLength = 0.8;
        const armRadius = 0.15;
        const shoulderY = 1.4; // Height on body where arms attach
        const shoulderOffset = 0.5; // Distance from center

        // Left arm pivot (for rotation)
        this.leftArmPivot = new BABYLON.TransformNode(`leftArmPivot_${Date.now()}`, this.scene);
        this.leftArmPivot.parent = this.body;
        this.leftArmPivot.position = new BABYLON.Vector3(-shoulderOffset, shoulderY - 0.9, 0); // Relative to body center

        // Left arm mesh
        this.leftArm = BABYLON.MeshBuilder.CreateCapsule(
            `leftArm_${Date.now()}`,
            { radius: armRadius, height: armLength, tessellation: 8 },
            this.scene
        );
        this.leftArm.parent = this.leftArmPivot;
        this.leftArm.position = new BABYLON.Vector3(-armLength / 2, 0, 0); // Offset so pivot is at shoulder
        this.leftArm.rotation.z = Math.PI / 2; // Point arm outward
        this.leftArm.material = material;

        // Right arm pivot (for rotation)
        this.rightArmPivot = new BABYLON.TransformNode(`rightArmPivot_${Date.now()}`, this.scene);
        this.rightArmPivot.parent = this.body;
        this.rightArmPivot.position = new BABYLON.Vector3(shoulderOffset, shoulderY - 0.9, 0);

        // Right arm mesh
        this.rightArm = BABYLON.MeshBuilder.CreateCapsule(
            `rightArm_${Date.now()}`,
            { radius: armRadius, height: armLength, tessellation: 8 },
            this.scene
        );
        this.rightArm.parent = this.rightArmPivot;
        this.rightArm.position = new BABYLON.Vector3(armLength / 2, 0, 0);
        this.rightArm.rotation.z = -Math.PI / 2; // Point arm outward
        this.rightArm.material = material;

        // Arms hang down at rest (slight angle)
        this.leftArmPivot.rotation.z = Math.PI / 6; // Slight outward angle
        this.rightArmPivot.rotation.z = -Math.PI / 6;
    }

    /**
     * Start arm swing animation for attacks
     * @param {number} attackInterval - Time between attacks in seconds
     * @param {Function} onSwingComplete - Callback when swing hits (for damage timing)
     */
    startArmSwing(attackInterval, onSwingComplete = null) {
        this.isSwingingArms = true;
        this.armSwingPhase = 0;
        // Speed calculated so one full swing cycle = attackInterval
        // Phase goes 0 -> 1 (wind up) -> 2 (swing down) -> pause -> repeat
        this.armSwingSpeed = 2.0 / attackInterval; // Complete cycle in attackInterval
        this.armSwingCallback = onSwingComplete;
    }

    /**
     * Stop arm swing animation
     */
    stopArmSwing() {
        this.isSwingingArms = false;
        this.armSwingPhase = 0;
        // Reset arms to rest position
        if (this.leftArmPivot) this.leftArmPivot.rotation.z = Math.PI / 6;
        if (this.rightArmPivot) this.rightArmPivot.rotation.z = -Math.PI / 6;
    }

    /**
     * Update arm swing animation
     */
    updateArmSwing(deltaTime) {
        if (!this.isSwingingArms || !this.leftArmPivot || !this.rightArmPivot) return;

        this.armSwingPhase += this.armSwingSpeed * deltaTime;

        // Animation phases:
        // 0.0 - 0.3: Wind up (arms go to 9 o'clock position)
        // 0.3 - 0.4: Pause at top
        // 0.4 - 0.7: Swing down (attack)
        // 0.7 - 1.0: Brief pause before next swing

        let leftAngle, rightAngle;
        const restAngle = Math.PI / 6; // Arms slightly out
        const windUpAngle = Math.PI / 2; // 9 o'clock (horizontal)
        const swingDownAngle = -Math.PI / 4; // Past vertical

        if (this.armSwingPhase < 0.3) {
            // Wind up phase
            const t = this.armSwingPhase / 0.3;
            const eased = t * t; // Ease in
            leftAngle = restAngle + (windUpAngle - restAngle) * eased;
            rightAngle = -restAngle + (-windUpAngle + restAngle) * eased;
        } else if (this.armSwingPhase < 0.4) {
            // Pause at top
            leftAngle = windUpAngle;
            rightAngle = -windUpAngle;
        } else if (this.armSwingPhase < 0.7) {
            // Swing down
            const t = (this.armSwingPhase - 0.4) / 0.3;
            const eased = 1 - (1 - t) * (1 - t); // Ease out (accelerate)
            leftAngle = windUpAngle + (swingDownAngle - windUpAngle) * eased;
            rightAngle = -windUpAngle + (-swingDownAngle + windUpAngle) * eased;

            // Trigger callback at impact (t = 0.5 of swing)
            if (t >= 0.5 && t < 0.6 && this.armSwingCallback) {
                this.armSwingCallback();
                this.armSwingCallback = null; // Only call once per swing
            }
        } else if (this.armSwingPhase < 1.0) {
            // Return to rest
            const t = (this.armSwingPhase - 0.7) / 0.3;
            leftAngle = swingDownAngle + (restAngle - swingDownAngle) * t;
            rightAngle = -swingDownAngle + (-restAngle + swingDownAngle) * t;
        } else {
            // Reset for next cycle
            this.armSwingPhase = 0;
            leftAngle = restAngle;
            rightAngle = -restAngle;
        }

        this.leftArmPivot.rotation.z = leftAngle;
        this.rightArmPivot.rotation.z = rightAngle;
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
            if (this.leftArm) this.shadowGenerator.addShadowCaster(this.leftArm);
            if (this.rightArm) this.shadowGenerator.addShadowCaster(this.rightArm);
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

        // Update harvest cooldown
        if (this.harvestCooldown > 0) {
            this.harvestCooldown -= deltaTime;
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
            // Wood gathering states
            case 'moving_to_tree':
                this.updateMovingToTree();
                break;
            case 'harvesting_tree':
                this.updateHarvestingTree();
                break;
            case 'gathering_wood':
                this.updateGatheringWood();
                break;
            case 'carrying_wood':
                this.updateCarryingResource('wood');
                break;
            // Stone gathering states
            case 'moving_to_deposit':
                this.updateMovingToDeposit();
                break;
            case 'mining_deposit':
                this.updateMiningDeposit();
                break;
            case 'gathering_stone':
                this.updateGatheringStone();
                break;
            case 'carrying_stone':
                this.updateCarryingResource('stone');
                break;
            // Soldier conversion
            case 'moving_to_armory':
                this.updateMovingToArmory();
                break;
            // Armor equipping
            case 'moving_to_armory_for_armor':
                this.updateMovingToArmoryForArmor();
                break;
            // Soldier combat
            case 'stalking_enemy':
                this.updateStalkingEnemy(deltaTime);
                break;
            case 'attacking_enemy':
                this.updateAttackingEnemy(deltaTime);
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

            // Update arm swing animation
            this.updateArmSwing(deltaTime);
        }
    }

    /**
     * Update idle state - sense for nearby resources or start wandering
     * Priority: soldier combat → heal if hurt → become soldier → gather fruit → wood/stone work → wander
     * Cooperative behavior: some bubbies prefer harvesting while others prefer collecting
     */
    updateIdle() {
        // Priority 0: Soldiers detect and attack enemies
        if (this.isSoldier) {
            const enemy = this.findNearestEnemy();
            if (enemy) {
                this.combatTarget = enemy;
                this.state = 'stalking_enemy';
                return;
            }
        }

        // Priority 1: Only hunt if not at full HP (adult bubbies only eat to heal)
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

        // Priority 1.5: Consider becoming a soldier if not already one
        // Only if there are more farmers than soldiers and armory has swords
        if (!this.isSoldier && this.getAllArmories && this.shouldBecomeSoldier()) {
            const armoryWithSword = this.findArmoryWithSword();
            if (armoryWithSword) {
                this.target = armoryWithSword;
                this.state = 'moving_to_armory';
                return;
            }
        }

        // Priority 1.6: Get armor if not already wearing it
        if (!this.hasArmor && this.getAllArmories) {
            const armoryWithArmor = this.findArmoryWithArmor();
            if (armoryWithArmor) {
                this.target = armoryWithArmor;
                this.state = 'moving_to_armory_for_armor';
                return;
            }
        }

        // Priority 2: If at full HP and gathering enabled, look for fruits to gather
        if (this.getHealth() >= this.maxHealth && GameConstants.ADULT_BUBBY.GATHER_FRUIT) {
            const nearestFruitToGather = this.findNearestFruitForGathering();
            if (nearestFruitToGather) {
                this.target = nearestFruitToGather;
                this.state = 'gathering_fruit';
                return;
            }
        }

        // Priority 3: Wood gathering with cooperative behavior
        // Harvesters prioritize chopping trees, collectors prioritize picking up wood
        if (GameConstants.ADULT_BUBBY.GATHER_RESOURCES && this.getAllWoodChunks) {
            const nearestWood = this.findNearestWoodChunk();
            const nearestTree = this.getAllHarvestableTrees ? this.findNearestHarvestablTree() : null;

            // Cooperative behavior: harvesters go to trees even if loose wood exists
            if (this.prefersHarvesting && nearestTree) {
                // Harvester role: prioritize chopping trees
                this.target = nearestTree;
                this.state = 'moving_to_tree';
                return;
            } else if (nearestWood) {
                // Collector role: pick up loose wood
                this.target = nearestWood;
                this.state = 'gathering_wood';
                return;
            } else if (nearestTree) {
                // No loose wood, everyone can harvest
                this.target = nearestTree;
                this.state = 'moving_to_tree';
                return;
            }
        }

        // Priority 4: Stone gathering with cooperative behavior
        // Miners prioritize mining deposits, collectors prioritize picking up stone
        if (GameConstants.ADULT_BUBBY.GATHER_RESOURCES) {
            const nearestStone = this.getAllStonePieces ? this.findNearestStonePiece() : null;
            const nearestDeposit = this.getAllStoneDeposits ? this.findNearestStoneDeposit() : null;

            // Cooperative behavior: miners go to deposits even if loose stone exists
            if (this.prefersHarvesting && nearestDeposit) {
                // Miner role: prioritize mining deposits
                this.target = nearestDeposit;
                this.state = 'moving_to_deposit';
                return;
            } else if (nearestStone) {
                // Collector role: pick up loose stone
                this.target = nearestStone;
                this.state = 'gathering_stone';
                return;
            } else if (nearestDeposit) {
                // No loose stone, everyone can mine
                this.target = nearestDeposit;
                this.state = 'moving_to_deposit';
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
     * Update wandering state - meander around the arena while sensing resources
     */
    updateWandering(deltaTime) {
        this.wanderTime += deltaTime;

        // Priority 0: Soldiers detect and attack enemies
        if (this.isSoldier) {
            const enemy = this.findNearestEnemy();
            if (enemy) {
                this.combatTarget = enemy;
                this.state = 'stalking_enemy';
                this.wanderTarget = null;
                return;
            }
        }

        // Check for resources while wandering (same priority as idle)
        // Priority 1: Heal if hurt
        if (this.getHealth() < this.maxHealth) {
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

        // Priority 1.5: Consider becoming a soldier if not already one
        if (!this.isSoldier && this.getAllArmories && this.shouldBecomeSoldier()) {
            const armoryWithSword = this.findArmoryWithSword();
            if (armoryWithSword) {
                this.target = armoryWithSword;
                this.state = 'moving_to_armory';
                this.wanderTarget = null;
                return;
            }
        }

        // Priority 1.6: Get armor if not already wearing it
        if (!this.hasArmor && this.getAllArmories) {
            const armoryWithArmor = this.findArmoryWithArmor();
            if (armoryWithArmor) {
                this.target = armoryWithArmor;
                this.state = 'moving_to_armory_for_armor';
                this.wanderTarget = null;
                return;
            }
        }

        // Priority 2: Gather fruit for coins
        if (this.getHealth() >= this.maxHealth && GameConstants.ADULT_BUBBY.GATHER_FRUIT) {
            const nearestFruitToGather = this.findNearestFruitForGathering();
            if (nearestFruitToGather) {
                this.target = nearestFruitToGather;
                this.state = 'gathering_fruit';
                this.wanderTarget = null;
                return;
            }
        }

        // Priority 3: Wood gathering with cooperative behavior
        if (GameConstants.ADULT_BUBBY.GATHER_RESOURCES && this.getAllWoodChunks) {
            const nearestWood = this.findNearestWoodChunk();
            const nearestTree = this.getAllHarvestableTrees ? this.findNearestHarvestablTree() : null;

            if (this.prefersHarvesting && nearestTree) {
                this.target = nearestTree;
                this.state = 'moving_to_tree';
                this.wanderTarget = null;
                return;
            } else if (nearestWood) {
                this.target = nearestWood;
                this.state = 'gathering_wood';
                this.wanderTarget = null;
                return;
            } else if (nearestTree) {
                this.target = nearestTree;
                this.state = 'moving_to_tree';
                this.wanderTarget = null;
                return;
            }
        }

        // Priority 4: Stone gathering with cooperative behavior
        if (GameConstants.ADULT_BUBBY.GATHER_RESOURCES) {
            const nearestStone = this.getAllStonePieces ? this.findNearestStonePiece() : null;
            const nearestDeposit = this.getAllStoneDeposits ? this.findNearestStoneDeposit() : null;

            if (this.prefersHarvesting && nearestDeposit) {
                this.target = nearestDeposit;
                this.state = 'moving_to_deposit';
                this.wanderTarget = null;
                return;
            } else if (nearestStone) {
                this.target = nearestStone;
                this.state = 'gathering_stone';
                this.wanderTarget = null;
                return;
            } else if (nearestDeposit) {
                this.target = nearestDeposit;
                this.state = 'moving_to_deposit';
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
            this.stopArmSwing();
            return;
        }

        // Start arm swing if not already swinging
        if (!this.isSwingingArms) {
            this.startArmSwing(this.getAttackInterval());
        }

        // If target moved out of attack range (use dynamic range for sword bonus)
        const attackRange = this.getAttackRange();
        const distance = this.ai.getDistanceTo(this.target);
        if (distance > attackRange) {
            this.state = 'moving_to_target';
            this.stopArmSwing();
            return;
        }

        // Attack at intervals (use dynamic interval for sword bonus)
        if (this.attackCooldown <= 0) {
            this.attackTarget();
            this.attackCooldown = this.getAttackInterval();
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

        // Get target position for effects
        const targetPos = this.target.getPosition ? this.target.getPosition() :
            (this.target.mesh ? this.target.mesh.position : this.mesh.position);

        // Play attack animation and effects
        if (this.attackEffects) {
            this.attackEffects.createBounceAnimation(this);
            this.attackEffects.createImpactEffect(targetPos, 'hit');
        }
        if (this.soundManager) {
            this.soundManager.playEatSound();
        }

        // Use dynamic attack damage (includes sword bonus)
        const attackDamage = this.getAttackDamage();

        // Attack plant
        this.target.takeDamage(attackDamage);

        // Heal when eating plants (adult bubbies don't grow max HP)
        // Use base damage for healing, not sword damage
        const healAmount = GameConstants.ADULT_BUBBY.ATTACK_DAMAGE;
        const newHealth = Math.min(this.maxHealth, this.getHealth() + healAmount);
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
     * Deposit fruit at castle inventory
     */
    depositFruit() {
        if (!this.carriedFruit) {
            this.state = 'idle';
            return;
        }

        // Add fruit to castle inventory
        if (this.getCastle) {
            const castle = this.getCastle();
            if (castle) {
                castle.addFruit(1);
            }
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

    // ==========================================
    // WOOD GATHERING
    // ==========================================

    /**
     * Find nearest wood chunk that can be picked up
     */
    findNearestWoodChunk() {
        return this.ai.findNearest(
            this.getAllWoodChunks,
            (chunk) => chunk.canBePickedUp && chunk.canBePickedUp()
        );
    }

    /**
     * Find nearest harvestable tree (dead trunk)
     */
    findNearestHarvestablTree() {
        return this.ai.findNearest(
            this.getAllHarvestableTrees,
            (tree) => tree.canBeHarvested && tree.canBeHarvested()
        );
    }

    /**
     * Update moving to tree state
     */
    updateMovingToTree() {
        if (!this.target || !this.target.isActive || !this.target.canBeHarvested()) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        const distance = this.ai.getDistanceTo(this.target);

        // Check if in attack range to start harvesting
        if (distance <= GameConstants.ADULT_BUBBY.ATTACK_RANGE) {
            this.state = 'harvesting_tree';
            return;
        }

        // Move toward tree
        this.ai.moveToward(this.target.mesh.position, this.getAllBubbies, 0.5);
    }

    /**
     * Update harvesting tree state - attack trunk to produce wood chunks
     */
    updateHarvestingTree() {
        if (!this.target || !this.target.isActive || !this.target.canBeHarvested()) {
            this.target = null;
            this.state = 'idle';
            this.stopArmSwing();
            return;
        }

        // If target moved out of range, chase it
        const distance = this.ai.getDistanceTo(this.target);
        if (distance > GameConstants.ADULT_BUBBY.ATTACK_RANGE) {
            this.state = 'moving_to_tree';
            this.stopArmSwing();
            return;
        }

        // Start arm swing if not already swinging
        if (!this.isSwingingArms) {
            this.startArmSwing(GameConstants.ADULT_BUBBY.HARVEST_INTERVAL);
        }

        // Harvest at intervals
        if (this.harvestCooldown <= 0) {
            const damage = GameConstants.ADULT_BUBBY.HARVEST_DAMAGE;

            // Get target position for effects
            const targetPos = this.target.getPosition ? this.target.getPosition() :
                this.target.mesh.position.clone();

            // Play harvest animation and effects
            if (this.attackEffects) {
                this.attackEffects.createBounceAnimation(this);
                this.attackEffects.createImpactEffect(targetPos, 'harvest');
            }
            if (this.soundManager) {
                this.soundManager.playHarvestSound();
            }

            this.target.harvestTrunk(damage);
            this.harvestCooldown = GameConstants.ADULT_BUBBY.HARVEST_INTERVAL;

            // Check if tree is depleted
            if (!this.target.canBeHarvested()) {
                this.target = null;
                this.state = 'idle';
                this.stopArmSwing();
            }
        }
    }

    /**
     * Update gathering wood state - move toward wood chunk to pick it up
     */
    updateGatheringWood() {
        if (!this.target || !this.target.isActive) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        const distance = this.ai.getDistanceTo(this.target);

        // Check if in pickup range
        if (distance <= GameConstants.ADULT_BUBBY.PICKUP_RANGE) {
            this.pickupResource(this.target, 'wood');
            return;
        }

        // Check if target is out of sensing range
        if (!this.ai.isInSensingRange(this.target)) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Move toward wood chunk
        this.ai.moveToward(this.target.mesh.position, this.getAllBubbies, 0.5);
    }

    // ==========================================
    // STONE GATHERING
    // ==========================================

    /**
     * Find nearest stone piece that can be picked up
     */
    findNearestStonePiece() {
        return this.ai.findNearest(
            this.getAllStonePieces,
            (piece) => piece.canBePickedUp && piece.canBePickedUp()
        );
    }

    /**
     * Find nearest stone deposit that can be mined
     */
    findNearestStoneDeposit() {
        return this.ai.findNearest(
            this.getAllStoneDeposits,
            (deposit) => deposit.canBeMined && deposit.canBeMined()
        );
    }

    /**
     * Update moving to deposit state
     */
    updateMovingToDeposit() {
        if (!this.target || !this.target.isActive || !this.target.canBeMined()) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        const distance = this.ai.getDistanceTo(this.target);

        // Check if in attack range to start mining
        if (distance <= GameConstants.ADULT_BUBBY.ATTACK_RANGE) {
            this.state = 'mining_deposit';
            return;
        }

        // Move toward deposit
        this.ai.moveToward(this.target.getPosition(), this.getAllBubbies, 0.5);
    }

    /**
     * Update mining deposit state - attack deposit to produce stone pieces
     */
    updateMiningDeposit() {
        if (!this.target || !this.target.isActive || !this.target.canBeMined()) {
            this.target = null;
            this.state = 'idle';
            this.stopArmSwing();
            return;
        }

        // If target moved out of range, chase it
        const distance = this.ai.getDistanceTo(this.target);
        if (distance > GameConstants.ADULT_BUBBY.ATTACK_RANGE) {
            this.state = 'moving_to_deposit';
            this.stopArmSwing();
            return;
        }

        // Start arm swing if not already swinging
        if (!this.isSwingingArms) {
            this.startArmSwing(GameConstants.ADULT_BUBBY.HARVEST_INTERVAL);
        }

        // Mine at intervals
        if (this.harvestCooldown <= 0) {
            const damage = GameConstants.ADULT_BUBBY.HARVEST_DAMAGE;

            // Get target position for effects
            const targetPos = this.target.getPosition ? this.target.getPosition() :
                this.target.mesh.position.clone();

            // Play mining animation and effects
            if (this.attackEffects) {
                this.attackEffects.createBounceAnimation(this);
                this.attackEffects.createImpactEffect(targetPos, 'mine');
            }
            if (this.soundManager) {
                this.soundManager.playMineSound();
            }

            this.target.takeDamage(damage);
            this.harvestCooldown = GameConstants.ADULT_BUBBY.HARVEST_INTERVAL;

            // Check if deposit is depleted
            if (!this.target.canBeMined()) {
                this.target = null;
                this.state = 'idle';
                this.stopArmSwing();
            }
        }
    }

    /**
     * Update gathering stone state - move toward stone piece to pick it up
     */
    updateGatheringStone() {
        if (!this.target || !this.target.isActive) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        const distance = this.ai.getDistanceTo(this.target);

        // Check if in pickup range
        if (distance <= GameConstants.ADULT_BUBBY.PICKUP_RANGE) {
            this.pickupResource(this.target, 'stone');
            return;
        }

        // Check if target is out of sensing range
        if (!this.ai.isInSensingRange(this.target)) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Move toward stone piece
        this.ai.moveToward(this.target.mesh.position, this.getAllBubbies, 0.5);
    }

    // ==========================================
    // SOLDIER CONVERSION (from Armory)
    // ==========================================

    /**
     * Check if this bubby should become a soldier
     * Any bubby without a sword wants to equip one if available
     */
    shouldBecomeSoldier() {
        // Any bubby without a sword should want to get one
        // Swords are a limited resource, so natural competition occurs
        return !this.isSoldier;
    }

    /**
     * Find nearest armory with a sword available
     */
    findArmoryWithSword() {
        if (!this.getAllArmories) return null;

        const armories = this.getAllArmories();
        let nearest = null;
        let nearestDist = Infinity;

        for (const armory of armories) {
            if (!armory.isActive || !armory.hasSword()) continue;

            const dist = this.ai.getDistanceTo(armory);
            if (dist < nearestDist && dist <= GameConstants.ADULT_BUBBY.SENSING_RANGE) {
                nearestDist = dist;
                nearest = armory;
            }
        }

        return nearest;
    }

    /**
     * Update moving to armory state
     */
    updateMovingToArmory() {
        if (!this.target || !this.target.isActive || !this.target.hasSword()) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        const distance = this.ai.getDistanceTo(this.target);

        // Check if close enough to armory
        if (distance <= GameConstants.ADULT_BUBBY.PICKUP_RANGE) {
            this.becomeSoldier(this.target);
            return;
        }

        // Move toward armory
        this.ai.moveToward(this.target.getPosition(), this.getAllBubbies, 0.5);
    }

    /**
     * Update moving to armory for armor state
     */
    updateMovingToArmoryForArmor() {
        if (!this.target || !this.target.isActive || !this.target.hasArmor()) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        const distance = this.ai.getDistanceTo(this.target);

        // Check if close enough to armory
        if (distance <= GameConstants.ADULT_BUBBY.PICKUP_RANGE) {
            this.equipArmor(this.target);
            return;
        }

        // Move toward armory
        this.ai.moveToward(this.target.getPosition(), this.getAllBubbies, 0.5);
    }

    /**
     * Become a soldier by taking a sword from the armory
     */
    becomeSoldier(armory) {
        if (!armory || !armory.hasSword()) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Take sword from armory
        if (armory.takeSword()) {
            this.isSoldier = true;
            this.equippedSword = true; // Just a flag now, not an object

            // Create visual sword attached to bubby
            this.createSwordVisual();

            console.log(`Bubby became a soldier!`);
        }

        this.target = null;
        this.state = 'idle';
    }

    /**
     * Create visual sword mesh attached to the bubby's right arm (hand position)
     */
    createSwordVisual() {
        if (this.swordMesh) {
            this.swordMesh.dispose();
        }

        // Create a visual sword attached to the right arm pivot (at hand position)
        const swordRoot = new BABYLON.TransformNode(`bubby_sword_${Date.now()}`, this.scene);
        swordRoot.parent = this.rightArmPivot;
        // Position at the end of the arm (hand position)
        // Arm extends 0.8 units from pivot, hand is at the end
        swordRoot.position = new BABYLON.Vector3(0.8, 0, 0);
        // Rotate sword to stick out perpendicular to the arm
        // Y rotation makes blade point forward (Z direction), perpendicular to arm (X direction)
        swordRoot.rotation.y = Math.PI / 2; // Blade points forward, perpendicular to arm

        // Blade - large and clearly visible
        const blade = BABYLON.MeshBuilder.CreateBox(
            `bubby_blade_${Date.now()}`,
            { width: 0.3, height: 2.4, depth: 0.08 },
            this.scene
        );
        blade.parent = swordRoot;
        blade.position.y = 1.4; // Center of blade above handle

        const bladeMat = new BABYLON.StandardMaterial(`bubby_blade_mat_${Date.now()}`, this.scene);
        bladeMat.diffuseColor = new BABYLON.Color3(0.8, 0.82, 0.85);
        bladeMat.specularColor = new BABYLON.Color3(1.0, 1.0, 1.0);
        bladeMat.specularPower = 64;
        blade.material = bladeMat;

        // Crossguard - doubled
        const crossguard = BABYLON.MeshBuilder.CreateBox(
            `bubby_crossguard_${Date.now()}`,
            { width: 1.0, height: 0.16, depth: 0.16 },
            this.scene
        );
        crossguard.parent = swordRoot;
        crossguard.position.y = 0.2;

        const crossguardMat = new BABYLON.StandardMaterial(`bubby_crossguard_mat_${Date.now()}`, this.scene);
        crossguardMat.diffuseColor = this.team === 'red'
            ? new BABYLON.Color3(0.7, 0.25, 0.15)
            : new BABYLON.Color3(0.15, 0.25, 0.7);
        crossguardMat.specularColor = new BABYLON.Color3(0.4, 0.35, 0.2);
        crossguard.material = crossguardMat;

        // Handle - doubled
        const handle = BABYLON.MeshBuilder.CreateCylinder(
            `bubby_handle_${Date.now()}`,
            { diameter: 0.24, height: 0.6, tessellation: 8 },
            this.scene
        );
        handle.parent = swordRoot;
        handle.position.y = -0.2;

        const handleMat = new BABYLON.StandardMaterial(`bubby_handle_mat_${Date.now()}`, this.scene);
        handleMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.12);
        handle.material = handleMat;

        this.swordMesh = swordRoot;

        // Add to shadow caster
        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(blade);
            this.shadowGenerator.addShadowCaster(crossguard);
            this.shadowGenerator.addShadowCaster(handle);
        }
    }

    /**
     * Check if bubby is a soldier (has a sword equipped)
     */
    isArmed() {
        return this.isSoldier;
    }

    /**
     * Get attack damage (including sword bonus if soldier)
     */
    getAttackDamage() {
        let damage = GameConstants.ADULT_BUBBY.ATTACK_DAMAGE;
        if (this.isSoldier) {
            damage += GameConstants.SWORD.ATTACK_DAMAGE_BONUS;
        }
        return damage;
    }

    /**
     * Get attack interval (including sword bonus if soldier)
     */
    getAttackInterval() {
        let interval = GameConstants.ADULT_BUBBY.ATTACK_INTERVAL;
        if (this.isSoldier) {
            interval += GameConstants.SWORD.ATTACK_INTERVAL_BONUS; // Note: bonus is negative
        }
        return Math.max(0.1, interval); // Minimum 0.1s attack interval
    }

    /**
     * Get attack range (including sword bonus if soldier)
     */
    getAttackRange() {
        let range = GameConstants.ADULT_BUBBY.ATTACK_RANGE;
        if (this.isSoldier) {
            range += GameConstants.SWORD.ATTACK_RANGE_BONUS;
        }
        return range;
    }

    /**
     * Find nearest armory with armor available
     */
    findArmoryWithArmor() {
        if (!this.getAllArmories) return null;

        const armories = this.getAllArmories();
        let nearest = null;
        let nearestDist = Infinity;

        for (const armory of armories) {
            if (!armory.isActive || !armory.hasArmor()) continue;

            const dist = this.ai.getDistanceTo(armory);
            if (dist < nearestDist && dist <= GameConstants.ADULT_BUBBY.SENSING_RANGE) {
                nearestDist = dist;
                nearest = armory;
            }
        }

        return nearest;
    }

    /**
     * Equip armor from an armory
     */
    equipArmor(armory) {
        if (!armory || !armory.hasArmor()) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Take armor from armory
        if (armory.takeArmor()) {
            this.hasArmor = true;

            // Create visual armor on bubby
            this.createArmorVisual();

            console.log(`Bubby equipped armor!`);
        }

        this.target = null;
        this.state = 'idle';
    }

    /**
     * Create visual armor mesh attached to the bubby's body
     */
    createArmorVisual() {
        if (this.armorMesh) {
            this.armorMesh.dispose();
        }

        // Create armor vest around the body
        const armorRoot = new BABYLON.TransformNode(`bubby_armor_${Date.now()}`, this.scene);
        armorRoot.parent = this.body;
        armorRoot.position.y = 0.1; // Centered on body

        // Metal vest (slightly larger than body to wrap around it)
        const vest = BABYLON.MeshBuilder.CreateBox(
            `bubby_armor_vest_${Date.now()}`,
            { width: 0.8, height: 1.0, depth: 0.75 },
            this.scene
        );
        vest.parent = armorRoot;
        vest.position.y = 0;

        const vestMat = new BABYLON.StandardMaterial(`bubby_armor_vest_mat_${Date.now()}`, this.scene);
        vestMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.55);
        vestMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.65);
        vestMat.specularPower = 32;
        vest.material = vestMat;

        // Team-colored trim
        const trim = BABYLON.MeshBuilder.CreateBox(
            `bubby_armor_trim_${Date.now()}`,
            { width: 0.15, height: 0.9, depth: 0.8 },
            this.scene
        );
        trim.parent = armorRoot;
        trim.position.y = 0;

        const trimMat = new BABYLON.StandardMaterial(`bubby_armor_trim_mat_${Date.now()}`, this.scene);
        trimMat.diffuseColor = this.team === 'red'
            ? new BABYLON.Color3(0.6, 0.2, 0.15)
            : new BABYLON.Color3(0.15, 0.2, 0.6);
        trim.material = trimMat;

        // Shoulder pads
        const leftPad = BABYLON.MeshBuilder.CreateBox(
            `bubby_armor_left_pad_${Date.now()}`,
            { width: 0.35, height: 0.15, depth: 0.3 },
            this.scene
        );
        leftPad.parent = armorRoot;
        leftPad.position = new BABYLON.Vector3(-0.5, 0.45, 0);
        leftPad.rotation.z = 0.25;
        leftPad.material = vestMat;

        const rightPad = BABYLON.MeshBuilder.CreateBox(
            `bubby_armor_right_pad_${Date.now()}`,
            { width: 0.35, height: 0.15, depth: 0.3 },
            this.scene
        );
        rightPad.parent = armorRoot;
        rightPad.position = new BABYLON.Vector3(0.5, 0.45, 0);
        rightPad.rotation.z = -0.25;
        rightPad.material = vestMat;

        this.armorMesh = armorRoot;

        // Add to shadow casters
        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(vest);
            this.shadowGenerator.addShadowCaster(trim);
            this.shadowGenerator.addShadowCaster(leftPad);
            this.shadowGenerator.addShadowCaster(rightPad);
        }
    }

    /**
     * Check if bubby has armor equipped
     */
    isArmored() {
        return this.hasArmor;
    }

    /**
     * Override takeDamage to apply armor damage reduction
     */
    takeDamage(amount) {
        let finalDamage = amount;

        // Apply armor damage reduction
        if (this.hasArmor) {
            const reduction = GameConstants.ARMOR.DAMAGE_REDUCTION;
            finalDamage = amount * (1 - reduction);
        }

        // Call parent takeDamage with reduced amount
        super.takeDamage(finalDamage);
    }

    // ==========================================
    // SOLDIER COMBAT
    // ==========================================

    /**
     * Find nearest enemy (unit, building, or castle)
     * Priority: units > buildings > castle
     */
    findNearestEnemy() {
        const sensingRange = GameConstants.ADULT_BUBBY.SENSING_RANGE;
        let nearestEnemy = null;
        let nearestDist = Infinity;

        // Check enemy units first (highest priority)
        if (this.getEnemyUnits) {
            const enemies = this.getEnemyUnits();
            for (const enemy of enemies) {
                if (!enemy.isActive) continue;
                const dist = this.ai.getDistanceTo(enemy);
                if (dist < nearestDist && dist <= sensingRange) {
                    nearestDist = dist;
                    nearestEnemy = enemy;
                }
            }
        }

        // If no units found, check buildings
        if (!nearestEnemy && this.getEnemyBuildings) {
            const buildings = this.getEnemyBuildings();
            for (const building of buildings) {
                if (!building.isActive) continue;
                const dist = this.ai.getDistanceTo(building);
                if (dist < nearestDist && dist <= sensingRange) {
                    nearestDist = dist;
                    nearestEnemy = building;
                }
            }
        }

        // If no buildings found, check castle (lowest priority, only if close)
        if (!nearestEnemy && this.getEnemyCastle) {
            const castle = this.getEnemyCastle();
            if (castle && castle.isActive) {
                const dist = this.ai.getDistanceTo(castle);
                if (dist <= sensingRange) {
                    nearestEnemy = castle;
                }
            }
        }

        return nearestEnemy;
    }

    /**
     * Update stalking enemy state - move toward enemy
     */
    updateStalkingEnemy(deltaTime) {
        // Check if target is still valid
        if (!this.combatTarget || !this.combatTarget.isActive) {
            this.combatTarget = null;
            this.state = 'idle';
            return;
        }

        const distance = this.ai.getDistanceTo(this.combatTarget);
        const attackRange = this.getAttackRange();

        // Check if in attack range
        if (distance <= attackRange) {
            this.state = 'attacking_enemy';
            return;
        }

        // Check if enemy moved out of sensing range - give up chase
        if (distance > GameConstants.ADULT_BUBBY.SENSING_RANGE * 1.5) {
            this.combatTarget = null;
            this.state = 'idle';
            return;
        }

        // Move toward enemy
        let targetPos;
        if (this.combatTarget.getPosition) {
            targetPos = this.combatTarget.getPosition();
        } else if (this.combatTarget.mesh) {
            targetPos = this.combatTarget.mesh.position;
        } else {
            this.combatTarget = null;
            this.state = 'idle';
            return;
        }

        this.ai.moveToward(targetPos, this.getAllBubbies, 0.5);
    }

    /**
     * Update attacking enemy state - attack enemy in range
     */
    updateAttackingEnemy(deltaTime) {
        // Check if target is still valid
        if (!this.combatTarget || !this.combatTarget.isActive) {
            this.combatTarget = null;
            this.state = 'idle';
            this.stopArmSwing();
            return;
        }

        const distance = this.ai.getDistanceTo(this.combatTarget);
        const attackRange = this.getAttackRange();

        // If enemy moved out of attack range, chase it
        if (distance > attackRange) {
            this.state = 'stalking_enemy';
            this.stopArmSwing();
            return;
        }

        // Start arm swing if not already swinging
        if (!this.isSwingingArms) {
            this.startArmSwing(this.getAttackInterval());
        }

        // Attack at intervals
        if (this.attackCooldown <= 0) {
            this.attackEnemy();
            this.attackCooldown = this.getAttackInterval();
        }
    }

    /**
     * Attack the current combat target
     */
    attackEnemy() {
        if (!this.combatTarget || !this.combatTarget.isActive) {
            return;
        }

        // Get target position for effects
        const targetPos = this.combatTarget.getPosition ? this.combatTarget.getPosition() :
            (this.combatTarget.mesh ? this.combatTarget.mesh.position.clone() : this.mesh.position.clone());

        // Get direction to target for slash effect
        const direction = targetPos.subtract(this.mesh.position);
        direction.y = 0;
        if (direction.length() > 0) direction.normalize();

        // Play attack animation and effects
        if (this.attackEffects) {
            // Use lunge animation for combat
            this.attackEffects.createLungeAnimation(this, targetPos, () => {
                // Create slash effect on impact - position it at the attacker's sword (front of attacker)
                if (this.isSoldier) {
                    // Slash position: attacker's position + offset toward target
                    const slashPos = this.mesh.position.clone();
                    slashPos.x += direction.x * 1.2; // Slightly in front of attacker
                    slashPos.z += direction.z * 1.2;
                    slashPos.y += 0.5; // Raise to sword height
                    this.attackEffects.createSlashEffect(slashPos, direction, this.team);
                }
                this.attackEffects.createImpactEffect(targetPos, 'hit');
                // Flash the target
                if (this.combatTarget && this.combatTarget.mesh) {
                    this.attackEffects.createHitFlash(this.combatTarget.mesh);
                }
            });
        }
        if (this.soundManager) {
            if (this.isSoldier) {
                this.soundManager.playSwordSound();
            } else {
                this.soundManager.playAttackSound();
            }
        }

        const damage = this.getAttackDamage();

        // Deal damage to enemy
        if (this.combatTarget.takeDamage) {
            this.combatTarget.takeDamage(damage);
        }

        // Check if enemy was killed
        if (!this.combatTarget.isActive) {
            this.combatTarget = null;
            this.state = 'idle';
        }
    }

    // ==========================================
    // GENERIC RESOURCE CARRYING
    // ==========================================

    /**
     * Pick up a resource (wood or stone)
     */
    pickupResource(resource, resourceType) {
        if (!resource || !resource.isActive) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Carry the resource (parent it to bubby's head)
        this.carriedResource = resource;
        this.carriedResourceType = resourceType;
        this.carriedResource.mesh.parent = this.head;
        this.carriedResource.mesh.position = new BABYLON.Vector3(0, 1.5, 0); // Above head
        this.carriedResource.setBeingCarried(true);
        this.carriedResource.pauseAI();

        this.target = null;
        this.state = resourceType === 'wood' ? 'carrying_wood' : 'carrying_stone';
    }

    /**
     * Update carrying resource state - navigate to castle and deposit
     */
    updateCarryingResource(resourceType) {
        if (!this.carriedResource || !this.carriedResource.isActive) {
            this.carriedResource = null;
            this.carriedResourceType = null;
            this.state = 'idle';
            return;
        }

        // Get castle position for this team
        const castlePos = this.getCastlePosition();
        const distance = this.ai.moveToward(castlePos, this.getAllBubbies, 0.5);

        // Check if in deposit range
        if (distance <= GameConstants.ADULT_BUBBY.DEPOSIT_RANGE) {
            this.depositResource(resourceType);
        }
    }

    /**
     * Deposit resource at castle inventory
     */
    depositResource(resourceType) {
        if (!this.carriedResource) {
            this.state = 'idle';
            return;
        }

        // Add resource to castle inventory
        if (this.getCastle) {
            const castle = this.getCastle();
            if (castle) {
                if (resourceType === 'wood') {
                    castle.addWood(1);
                } else if (resourceType === 'stone') {
                    castle.addStone(1);
                }
            }
        }

        // Dispose the resource
        this.carriedResource.dispose();
        this.carriedResource = null;
        this.carriedResourceType = null;

        // Return to idle state
        this.state = 'idle';
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

        // Drop carried resource if being dragged
        if (this.carriedResource) {
            this.dropCarriedResource();
        }

        // Clear combat target if soldier
        if (this.combatTarget) {
            this.combatTarget = null;
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
     * Drop carried resource (when dragged or disposed)
     */
    dropCarriedResource() {
        if (!this.carriedResource) {
            return;
        }

        // Unparent the resource
        this.carriedResource.mesh.parent = null;
        this.carriedResource.mesh.position = this.mesh.position.clone();
        this.carriedResource.mesh.position.y = 0.2; // Ground level for resources
        this.carriedResource.setBeingCarried(false);
        this.carriedResource.resumeAI();

        this.carriedResource = null;
        this.carriedResourceType = null;
        this.state = 'idle';
    }

    /**
     * Assign a specific task to this bubby (via drag-drop)
     * @param {Object} target - The target object (tree, deposit, fruit, wood, stone)
     * @param {string} taskType - The type of task ('harvest_tree', 'mine_deposit', 'gather_fruit', 'gather_wood', 'gather_stone')
     */
    assignTask(target, taskType) {
        if (!target || !target.isActive) {
            this.isPaused = false;
            this.state = 'idle';
            return;
        }

        // Resume from paused state (was being dragged)
        this.isPaused = false;

        // Set the target and appropriate state based on task type
        this.target = target;

        switch (taskType) {
            case 'harvest_tree':
                if (target.canBeHarvested && target.canBeHarvested()) {
                    this.state = 'moving_to_tree';
                } else {
                    this.state = 'idle';
                    this.target = null;
                }
                break;

            case 'mine_deposit':
                if (target.canBeMined && target.canBeMined()) {
                    this.state = 'moving_to_deposit';
                } else {
                    this.state = 'idle';
                    this.target = null;
                }
                break;

            case 'gather_fruit':
                if (target.isActive) {
                    this.state = 'gathering_fruit';
                } else {
                    this.state = 'idle';
                    this.target = null;
                }
                break;

            case 'gather_wood':
                if (target.canBePickedUp && target.canBePickedUp()) {
                    this.state = 'gathering_wood';
                } else {
                    this.state = 'idle';
                    this.target = null;
                }
                break;

            case 'gather_stone':
                if (target.canBePickedUp && target.canBePickedUp()) {
                    this.state = 'gathering_stone';
                } else {
                    this.state = 'idle';
                    this.target = null;
                }
                break;

            case 'soldier':
                // Dropped on armory - become soldier immediately if sword available
                if (!this.isSoldier && target.hasSword && target.hasSword()) {
                    this.becomeSoldier(target);
                } else {
                    this.state = 'idle';
                    this.target = null;
                }
                break;

            case 'armor':
                // Dropped on armory - equip armor immediately if available
                if (!this.hasArmor && target.hasArmor && target.hasArmor()) {
                    this.equipArmor(target);
                } else {
                    this.state = 'idle';
                    this.target = null;
                }
                break;

            case 'attack':
                // Dropped on enemy unit - target for attack
                if (target.isActive && target.team !== this.team) {
                    this.combatTarget = target;
                    this.state = 'stalking_enemy';
                } else {
                    this.state = 'idle';
                    this.combatTarget = null;
                }
                break;

            case 'attack_building':
                // Dropped on enemy building/castle - target for attack
                if (target.isActive && target.team !== this.team) {
                    this.combatTarget = target;
                    this.state = 'stalking_enemy';
                } else {
                    this.state = 'idle';
                    this.combatTarget = null;
                }
                break;

            default:
                this.state = 'idle';
                this.target = null;
        }
    }

    /**
     * Dispose adult bubby and clean up
     */
    dispose() {
        // Drop carried fruit before disposing
        if (this.carriedFruit) {
            this.dropCarriedFruit();
        }

        // Drop carried resource before disposing
        if (this.carriedResource) {
            this.dropCarriedResource();
        }

        // Clean up sword visual
        if (this.swordMesh) {
            this.swordMesh.dispose();
            this.swordMesh = null;
        }

        // Clean up armor visual
        if (this.armorMesh) {
            this.armorMesh.dispose();
            this.armorMesh = null;
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
        // Clean up arms
        if (this.leftArm) {
            this.leftArm.dispose();
            this.leftArm = null;
        }
        if (this.rightArm) {
            this.rightArm.dispose();
            this.rightArm = null;
        }
        if (this.leftArmPivot) {
            this.leftArmPivot.dispose();
            this.leftArmPivot = null;
        }
        if (this.rightArmPivot) {
            this.rightArmPivot.dispose();
            this.rightArmPivot = null;
        }
        super.dispose();
    }
}
