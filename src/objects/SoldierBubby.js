import { SpawnableObject } from './SpawnableObject.js';
import { BubbyAI } from '../systems/BubbyAI.js';
import { GameConstants } from '../config/GameConstants.js';
import { HealthBar } from '../components/HealthBar.js';

/**
 * SoldierBubby - Combat-focused bubby unit created at the Armory
 *
 * Does not gather resources - only attacks enemy units, buildings, and castle.
 * Has a helmet and weapon visual to distinguish from regular bubbies.
 */
export class SoldierBubby extends SpawnableObject {
    constructor(scene, config) {
        super(scene, config.position, config.shadowGenerator, GameConstants.SOLDIER_BUBBY.MAX_HP);

        this.team = config.team;
        this.getAllBubbies = config.getAllBubbies;
        this.getEnemyUnits = config.getEnemyUnits || null;
        this.getEnemyBuildings = config.getEnemyBuildings || null;
        this.getEnemyCastle = config.getEnemyCastle || null;

        this.idleTime = 0;
        this.squishPhase = 0;
        this.bobPhase = 0;

        // AI helper for shared behavior
        this.ai = new BubbyAI(this, GameConstants.SOLDIER_BUBBY);

        // Combat-focused AI states:
        // 'idle', 'wandering', 'moving_to_target', 'attacking', 'moving_to_castle'
        this.state = 'idle';
        this.target = null;
        this.attackCooldown = 0;

        // Wandering behavior
        this.wanderTarget = null;
        this.wanderTime = 0;

        // Size (soldiers are slightly larger than regular bubbies)
        this.baseSize = 1.1;
        this.currentSize = 1.1;
        this.isPaused = false;

        this.draggable = true;
        this.groundLevel = 0;

        // Body parts
        this.body = null;
        this.head = null;
        this.helmet = null;
        this.weapon = null;

        this.create();
        this.enableShadows();
        this.createHealthBar(1.6);
    }

    /**
     * Create the soldier bubby mesh (head with helmet, body, weapon)
     */
    create() {
        // Create container
        this.mesh = new BABYLON.TransformNode(`soldier_bubby_${this.team}_${Date.now()}`, this.scene);
        this.mesh.position = this.position.clone();
        this.mesh.position.y = this.groundLevel;

        // Create capsule body (same as adult bubby)
        this.body = BABYLON.MeshBuilder.CreateCapsule(
            `soldier_body_${this.team}_${Date.now()}`,
            {
                radius: 0.6,
                height: 1.8,
                tessellation: 16
            },
            this.scene
        );
        this.body.position.y = 0.9;
        this.body.parent = this.mesh;

        // Create head (slightly smaller than adult)
        this.head = BABYLON.MeshBuilder.CreateSphere(
            `soldier_head_${this.team}_${Date.now()}`,
            {
                diameter: 2.0,
                segments: 16
            },
            this.scene
        );
        this.head.position.y = 2.8;
        this.head.parent = this.mesh;

        // Create helmet (half-sphere on top of head)
        this.helmet = BABYLON.MeshBuilder.CreateSphere(
            `soldier_helmet_${this.team}_${Date.now()}`,
            {
                diameter: 2.3,
                segments: 16,
                slice: 0.5 // Half sphere
            },
            this.scene
        );
        this.helmet.position.y = 3.0;
        this.helmet.rotation.x = Math.PI; // Flip to sit on head
        this.helmet.parent = this.mesh;

        // Create weapon (simple sword/club shape)
        this.weapon = BABYLON.MeshBuilder.CreateCylinder(
            `soldier_weapon_${this.team}_${Date.now()}`,
            {
                diameter: 0.15,
                height: 1.5,
                tessellation: 8
            },
            this.scene
        );
        this.weapon.position.x = 1.2;
        this.weapon.position.y = 1.5;
        this.weapon.rotation.z = Math.PI / 4; // Angled
        this.weapon.parent = this.mesh;

        // Create materials
        const bodyMaterial = new BABYLON.StandardMaterial(`soldierBodyMat_${this.team}_${Date.now()}`, this.scene);
        const helmetMaterial = new BABYLON.StandardMaterial(`soldierHelmetMat_${Date.now()}`, this.scene);
        const weaponMaterial = new BABYLON.StandardMaterial(`soldierWeaponMat_${Date.now()}`, this.scene);

        if (this.team === 'red') {
            bodyMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.2);
            bodyMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.05, 0.05);
        } else {
            bodyMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.9);
            bodyMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.3);
        }

        // Helmet is metallic gray
        helmetMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.55);
        helmetMaterial.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);

        // Weapon is dark metal
        weaponMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);
        weaponMaterial.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);

        this.body.material = bodyMaterial;
        this.head.material = bodyMaterial;
        this.helmet.material = helmetMaterial;
        this.weapon.material = weaponMaterial;
    }

    /**
     * Override createHealthBar to use head mesh as parent
     */
    createHealthBar(offsetY = 1.6) {
        if (!this.head) {
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
            if (this.helmet) this.shadowGenerator.addShadowCaster(this.helmet);
            if (this.weapon) this.shadowGenerator.addShadowCaster(this.weapon);
        }
    }

    /**
     * Update soldier bubby state (combat AI)
     */
    update() {
        if (!this.mesh || !this.isActive) {
            return;
        }

        super.update();

        if (this.isPaused) {
            return;
        }

        const deltaTime = this.deltaTime || 0.016;
        this.idleTime += deltaTime;

        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Combat AI state machine
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
                this.updateAttacking();
                break;
            case 'moving_to_castle':
                this.updateMovingToCastle();
                break;
        }

        // Constrain to arena and animate
        if (!this.isFallingAfterDrop) {
            this.constrainToArena();
            if (this.mesh) {
                this.mesh.position.y = this.groundLevel;
            }
            this.animateSoldier();
        }
    }

    /**
     * Animate soldier (squish and bob)
     */
    animateSoldier() {
        this.squishPhase += 0.05;
        this.bobPhase += 0.04;

        const squishY = 1 + Math.sin(this.squishPhase) * 0.06;
        const squishXZ = 1 / Math.sqrt(squishY);

        if (this.body) {
            this.body.scaling = new BABYLON.Vector3(
                squishXZ * this.currentSize,
                squishY * this.currentSize,
                squishXZ * this.currentSize
            );
        }

        if (this.head) {
            const headSquish = 1 + Math.sin(this.squishPhase * 1.3) * 0.08;
            this.head.scaling = new BABYLON.Vector3(
                this.currentSize / headSquish,
                this.currentSize * headSquish,
                this.currentSize / headSquish
            );
            this.head.position.y = 2.8 + Math.sin(this.bobPhase) * 0.04;
        }

        // Weapon swing when attacking
        if (this.state === 'attacking') {
            this.weapon.rotation.z = Math.PI / 4 + Math.sin(this.squishPhase * 3) * 0.5;
        }

        if (this.mesh) {
            this.mesh.rotation.z = Math.sin(this.squishPhase * 0.5) * 0.06;
        }
    }

    /**
     * Update idle state - look for enemies to attack
     */
    updateIdle() {
        // Priority 1: Attack nearby enemy units
        if (this.getEnemyUnits) {
            const nearestEnemy = this.findNearestEnemy();
            if (nearestEnemy) {
                this.target = nearestEnemy;
                this.state = 'moving_to_target';
                return;
            }
        }

        // Priority 2: Attack nearby enemy buildings
        if (this.getEnemyBuildings) {
            const nearestBuilding = this.findNearestEnemyBuilding();
            if (nearestBuilding) {
                this.target = nearestBuilding;
                this.state = 'moving_to_target';
                return;
            }
        }

        // Priority 3: Move toward enemy castle
        if (this.getEnemyCastle) {
            const enemyCastle = this.getEnemyCastle();
            if (enemyCastle) {
                this.target = enemyCastle;
                this.state = 'moving_to_castle';
                return;
            }
        }

        // Otherwise wander
        if (this.idleTime > 0.5) {
            this.state = 'wandering';
            this.idleTime = 0;
            this.wanderTime = 0;
            this.pickWanderTarget();
        }
    }

    /**
     * Pick a random wander target
     */
    pickWanderTarget() {
        this.wanderTarget = this.ai.pickWanderTarget(10, 30);
    }

    /**
     * Update wandering state
     */
    updateWandering(deltaTime) {
        this.wanderTime += deltaTime;

        // Check for enemies while wandering
        if (this.getEnemyUnits) {
            const nearestEnemy = this.findNearestEnemy();
            if (nearestEnemy) {
                this.target = nearestEnemy;
                this.state = 'moving_to_target';
                this.wanderTarget = null;
                return;
            }
        }

        if (this.wanderTime >= GameConstants.SOLDIER_BUBBY.WANDER_DURATION || !this.wanderTarget) {
            this.pickWanderTarget();
            this.wanderTime = 0;
        }

        if (this.wanderTarget) {
            const distance = this.ai.moveToward(this.wanderTarget, this.getAllBubbies, 0.5);
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

        if (this.ai.isInAttackRange(this.target)) {
            this.state = 'attacking';
            return;
        }

        if (!this.ai.isInSensingRange(this.target)) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        const targetPos = this.target.mesh ? this.target.mesh.position : this.target.getPosition();
        this.ai.moveToward(targetPos, this.getAllBubbies, 0.6);
    }

    /**
     * Update attacking state
     */
    updateAttacking() {
        if (!this.target || !this.target.isActive) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        if (!this.ai.isInAttackRange(this.target)) {
            this.state = 'moving_to_target';
            return;
        }

        if (this.attackCooldown <= 0) {
            this.attackTarget();
            this.attackCooldown = GameConstants.SOLDIER_BUBBY.ATTACK_INTERVAL;
        }
    }

    /**
     * Attack the current target
     */
    attackTarget() {
        if (!this.target || !this.target.takeDamage) {
            return;
        }

        const damage = GameConstants.SOLDIER_BUBBY.ATTACK_DAMAGE;
        this.target.takeDamage(damage);

        if (!this.target.isActive) {
            this.target = null;
            this.state = 'idle';
        }
    }

    /**
     * Update moving to castle state
     */
    updateMovingToCastle() {
        if (!this.target) {
            this.state = 'idle';
            return;
        }

        const castlePos = this.target.getPosition();
        const distance = this.ai.moveToward(castlePos, this.getAllBubbies, 0.6);

        // Attack castle when in range
        if (distance <= GameConstants.SOLDIER_BUBBY.ATTACK_RANGE) {
            this.state = 'attacking';
        }

        // Check for closer enemies while moving to castle
        if (this.getEnemyUnits) {
            const nearestEnemy = this.findNearestEnemy();
            if (nearestEnemy && this.ai.getDistanceTo(nearestEnemy) < 10) {
                this.target = nearestEnemy;
                this.state = 'moving_to_target';
            }
        }
    }

    /**
     * Find nearest enemy unit
     */
    findNearestEnemy() {
        if (!this.getEnemyUnits) return null;
        return this.ai.findNearest(this.getEnemyUnits);
    }

    /**
     * Find nearest enemy building
     */
    findNearestEnemyBuilding() {
        if (!this.getEnemyBuildings) return null;
        return this.ai.findNearest(this.getEnemyBuildings);
    }

    /**
     * Constrain position to arena bounds
     */
    constrainToArena() {
        this.ai.constrainToArena(this);
    }

    /**
     * Get team
     */
    getTeam() {
        return this.team;
    }

    /**
     * Check if draggable
     */
    isDraggable() {
        return this.draggable && this.isActive;
    }

    /**
     * Called when soldier lands after being dropped
     */
    onLanded() {
        if (this.mesh) {
            this.mesh.rotation.x = 0;
            this.mesh.rotation.z = 0;
        }
    }

    /**
     * Pause AI for dragging
     */
    pauseAI() {
        this.isPaused = true;
    }

    /**
     * Resume AI after dragging
     */
    resumeAI() {
        this.isPaused = false;
    }

    /**
     * Dispose soldier bubby
     */
    dispose() {
        if (this.body) {
            this.body.dispose();
            this.body = null;
        }
        if (this.head) {
            this.head.dispose();
            this.head = null;
        }
        if (this.helmet) {
            this.helmet.dispose();
            this.helmet = null;
        }
        if (this.weapon) {
            this.weapon.dispose();
            this.weapon = null;
        }
        super.dispose();
    }
}
