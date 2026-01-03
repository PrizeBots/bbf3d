import { SpawnableObject } from './SpawnableObject.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * Tank - A piloted vehicle that bubbies can drive
 *
 * Features:
 * - High HP and armor (50% damage reduction)
 * - Slow movement but powerful attacks
 * - Explosive cannonballs with splash damage
 * - Bubby pilot visible in turret
 */
export class Tank extends SpawnableObject {
    constructor(scene, position, shadowGenerator, team = 'red') {
        const maxHP = GameConstants.TANK.MAX_HP;
        super(scene, position, shadowGenerator, maxHP);

        this.team = team;
        this.velocity = 0;
        this.gravity = GameConstants.PHYSICS.GRAVITY;
        this.groundLevel = 0;
        this.state = 'idle'; // 'idle', 'waiting_for_pilot', 'exiting_factory', 'moving', 'attacking', 'avoiding'
        this.isPaused = false;

        // Pilot
        this.pilot = null; // The bubby driving this tank
        this.pilotMesh = null; // Visual representation of pilot

        // Combat
        this.target = null;
        this.attackCooldown = 0;
        this.projectiles = [];

        // Idle animation
        this.idleTime = 0;
        this.turretScanDirection = 1;
        this.bodyBobPhase = Math.random() * Math.PI * 2; // Random start phase

        // Avoidance behavior
        this.avoidTarget = null;
        this.avoidTimer = 0;

        // Mesh components
        this.body = null;
        this.turret = null;
        this.cannon = null;
        this.leftTread = null;
        this.rightTread = null;
        this.turretAngle = 0;

        // Callbacks
        this.getEnemyUnits = null;
        this.getEnemyBuildings = null;
        this.attackEffects = null;
        this.soundManager = null;

        // Team colors
        this.teamColor = team === 'red'
            ? new BABYLON.Color3(0.8, 0.2, 0.2)
            : new BABYLON.Color3(0.2, 0.3, 0.8);
        this.teamColorDark = team === 'red'
            ? new BABYLON.Color3(0.5, 0.1, 0.1)
            : new BABYLON.Color3(0.1, 0.15, 0.5);

        this.create();
        this.createHealthBar(3.5);
    }

    /**
     * Create the tank mesh
     */
    create() {
        // Create root container
        this.mesh = new BABYLON.TransformNode(`tank_${this.team}_${Date.now()}`, this.scene);
        this.mesh.position = this.position.clone();

        // Create tank body
        this.createBody();

        // Create treads
        this.createTreads();

        // Create turret with cannon
        this.createTurret();
    }

    /**
     * Create the tank body (hull)
     */
    createBody() {
        // Main hull - angular box shape
        this.body = BABYLON.MeshBuilder.CreateBox(
            'tankBody',
            { width: 3.5, height: 1.2, depth: 5 },
            this.scene
        );
        this.body.position.y = 1.0;
        this.body.parent = this.mesh;

        // Body material - metallic gray with team accent
        const bodyMat = new BABYLON.StandardMaterial('tankBodyMat', this.scene);
        bodyMat.diffuseColor = new BABYLON.Color3(0.3, 0.35, 0.3); // Military green-gray
        bodyMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        this.body.material = bodyMat;

        // Front armor plate (angled)
        const frontPlate = BABYLON.MeshBuilder.CreateBox(
            'frontPlate',
            { width: 3.3, height: 1.0, depth: 0.8 },
            this.scene
        );
        frontPlate.position = new BABYLON.Vector3(0, 1.1, 2.5);
        frontPlate.rotation.x = -0.3; // Angled for deflection
        frontPlate.parent = this.mesh;
        frontPlate.material = bodyMat;

        // Team colored stripe
        const stripe = BABYLON.MeshBuilder.CreateBox(
            'teamStripe',
            { width: 3.6, height: 0.2, depth: 5.1 },
            this.scene
        );
        stripe.position.y = 1.7;
        stripe.parent = this.mesh;

        const stripeMat = new BABYLON.StandardMaterial('stripeMat', this.scene);
        stripeMat.diffuseColor = this.teamColor;
        stripeMat.emissiveColor = this.teamColor.scale(0.2);
        stripe.material = stripeMat;

        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(this.body);
            this.shadowGenerator.addShadowCaster(frontPlate);
        }
    }

    /**
     * Create the tank treads
     */
    createTreads() {
        const treadMat = new BABYLON.StandardMaterial('treadMat', this.scene);
        treadMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);

        // Left tread assembly
        this.leftTread = new BABYLON.TransformNode('leftTread', this.scene);
        this.leftTread.position = new BABYLON.Vector3(-2.0, 0.5, 0);
        this.leftTread.parent = this.mesh;

        const leftTreadBody = BABYLON.MeshBuilder.CreateBox(
            'leftTreadBody',
            { width: 0.8, height: 1.0, depth: 5.5 },
            this.scene
        );
        leftTreadBody.parent = this.leftTread;
        leftTreadBody.material = treadMat;

        // Tread wheels
        for (let i = -2; i <= 2; i++) {
            const wheel = BABYLON.MeshBuilder.CreateCylinder(
                `leftWheel_${i}`,
                { diameter: 0.9, height: 0.3, tessellation: 12 },
                this.scene
            );
            wheel.position = new BABYLON.Vector3(0.4, 0, i * 1.2);
            wheel.rotation.z = Math.PI / 2;
            wheel.parent = this.leftTread;
            wheel.material = treadMat;
        }

        // Right tread assembly
        this.rightTread = new BABYLON.TransformNode('rightTread', this.scene);
        this.rightTread.position = new BABYLON.Vector3(2.0, 0.5, 0);
        this.rightTread.parent = this.mesh;

        const rightTreadBody = BABYLON.MeshBuilder.CreateBox(
            'rightTreadBody',
            { width: 0.8, height: 1.0, depth: 5.5 },
            this.scene
        );
        rightTreadBody.parent = this.rightTread;
        rightTreadBody.material = treadMat;

        for (let i = -2; i <= 2; i++) {
            const wheel = BABYLON.MeshBuilder.CreateCylinder(
                `rightWheel_${i}`,
                { diameter: 0.9, height: 0.3, tessellation: 12 },
                this.scene
            );
            wheel.position = new BABYLON.Vector3(-0.4, 0, i * 1.2);
            wheel.rotation.z = Math.PI / 2;
            wheel.parent = this.rightTread;
            wheel.material = treadMat;
        }

        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(leftTreadBody);
            this.shadowGenerator.addShadowCaster(rightTreadBody);
        }
    }

    /**
     * Create the rotating turret with cannon
     */
    createTurret() {
        // Turret base (rotates)
        this.turret = new BABYLON.TransformNode('turret', this.scene);
        this.turret.position.y = 1.8;
        this.turret.parent = this.mesh;

        // Turret dome
        const turretDome = BABYLON.MeshBuilder.CreateCylinder(
            'turretDome',
            { diameterTop: 1.8, diameterBottom: 2.2, height: 0.8, tessellation: 16 },
            this.scene
        );
        turretDome.position.y = 0.4;
        turretDome.parent = this.turret;

        const turretMat = new BABYLON.StandardMaterial('turretMat', this.scene);
        turretMat.diffuseColor = new BABYLON.Color3(0.25, 0.3, 0.25);
        turretMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        turretDome.material = turretMat;

        // Hatch (where pilot sits)
        const hatch = BABYLON.MeshBuilder.CreateCylinder(
            'hatch',
            { diameter: 0.9, height: 0.3, tessellation: 12 },
            this.scene
        );
        hatch.position.y = 0.95;
        hatch.parent = this.turret;

        const hatchMat = new BABYLON.StandardMaterial('hatchMat', this.scene);
        hatchMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.22);
        hatch.material = hatchMat;

        // Cannon mount
        const cannonMount = BABYLON.MeshBuilder.CreateBox(
            'cannonMount',
            { width: 0.6, height: 0.5, depth: 0.8 },
            this.scene
        );
        cannonMount.position = new BABYLON.Vector3(0, 0.4, 1.2);
        cannonMount.parent = this.turret;
        cannonMount.material = turretMat;

        // Main cannon barrel
        this.cannon = BABYLON.MeshBuilder.CreateCylinder(
            'cannon',
            { diameterTop: 0.3, diameterBottom: 0.4, height: 2.5, tessellation: 12 },
            this.scene
        );
        this.cannon.rotation.x = Math.PI / 2; // Point forward
        this.cannon.position = new BABYLON.Vector3(0, 0.4, 2.5);
        this.cannon.parent = this.turret;

        const cannonMat = new BABYLON.StandardMaterial('cannonMat', this.scene);
        cannonMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.17);
        cannonMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        this.cannon.material = cannonMat;

        // Cannon muzzle (team colored)
        const muzzle = BABYLON.MeshBuilder.CreateCylinder(
            'muzzle',
            { diameter: 0.5, height: 0.3, tessellation: 12 },
            this.scene
        );
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position = new BABYLON.Vector3(0, 0.4, 3.8);
        muzzle.parent = this.turret;

        const muzzleMat = new BABYLON.StandardMaterial('muzzleMat', this.scene);
        muzzleMat.diffuseColor = this.teamColor;
        muzzleMat.emissiveColor = this.teamColor.scale(0.3);
        muzzle.material = muzzleMat;

        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(turretDome);
            this.shadowGenerator.addShadowCaster(this.cannon);
        }
    }

    /**
     * Attach bubby to turret as pilot
     */
    attachPilotToTurret(bubby) {
        if (!bubby || !bubby.mesh) return;

        // Store original parent for restoration
        this.pilotOriginalParent = bubby.mesh.parent;

        // Parent bubby mesh to turret so it rotates with the turret
        bubby.mesh.parent = this.turret;

        // Position bubby on top of the turret hatch
        // Reset local position relative to turret
        bubby.mesh.position = new BABYLON.Vector3(0, 1.2, 0);
        bubby.mesh.rotation = new BABYLON.Vector3(0, 0, 0);

        // Make sure bubby is visible
        bubby.mesh.setEnabled(true);

        // Pause bubby AI so it doesn't try to move
        if (bubby.pauseAI) {
            bubby.pauseAI();
        }
    }

    /**
     * Detach bubby from turret
     */
    detachPilotFromTurret(bubby) {
        if (!bubby || !bubby.mesh) return;

        // Remove from turret parent
        bubby.mesh.parent = null;

        // Position next to tank
        const tankPos = this.mesh.position.clone();
        bubby.mesh.position = new BABYLON.Vector3(
            tankPos.x + 4,
            0,
            tankPos.z
        );
        bubby.mesh.rotation = new BABYLON.Vector3(0, 0, 0);

        // Resume bubby AI
        if (bubby.resumeAI) {
            bubby.resumeAI();
        }
    }

    /**
     * Bubby enters the tank
     */
    enterTank(bubby) {
        if (this.pilot) return false; // Already has a pilot

        this.pilot = bubby;
        this.state = 'moving';

        // Attach the actual bubby model to the turret
        this.attachPilotToTurret(bubby);

        console.log(`Bubby entered tank!`);
        return true;
    }

    /**
     * Bubby exits the tank
     */
    exitTank() {
        if (!this.pilot) return null;

        const bubby = this.pilot;
        this.pilot = null;
        this.state = 'waiting_for_pilot';

        // Detach bubby from turret and position next to tank
        this.detachPilotFromTurret(bubby);

        return bubby;
    }

    /**
     * Check if tank needs a pilot
     */
    needsPilot() {
        return this.pilot === null && this.state !== 'idle' && this.isActive;
    }

    /**
     * Update tank state
     */
    update() {
        if (!this.mesh || !this.isActive || this.isPaused) return;

        super.update();

        const deltaTime = this.deltaTime || 0.016;

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Handle exiting factory state
        if (this.state === 'exiting_factory') {
            this.updateExitingFactory(deltaTime);
            this.updateProjectiles(deltaTime);
            return;
        }

        // Handle avoiding state (moving out of the way)
        if (this.state === 'avoiding') {
            this.updateAvoiding(deltaTime);
            this.updateProjectiles(deltaTime);
            return;
        }

        // Check if we need to move out of the way for other units
        this.checkAndAvoidBlocking(deltaTime);

        // Update idle animation when not moving
        if (this.state === 'idle' || this.state === 'waiting_for_pilot') {
            this.updateIdleAnimation(deltaTime);
        }

        // Combat behavior - works with or without pilot
        // Piloted tanks actively pursue, unpiloted tanks defend in place
        this.updateCombat(deltaTime);

        // Update projectiles
        this.updateProjectiles(deltaTime);
    }

    /**
     * Update idle animation - turret scanning and subtle body movement
     */
    updateIdleAnimation(deltaTime) {
        this.idleTime += deltaTime;

        // Slow turret scanning back and forth
        if (!this.target) {
            this.turretAngle += 0.3 * deltaTime * this.turretScanDirection;

            // Reverse direction at limits
            if (this.turretAngle > 0.8) {
                this.turretScanDirection = -1;
            } else if (this.turretAngle < -0.8) {
                this.turretScanDirection = 1;
            }

            if (this.turret) {
                this.turret.rotation.y = this.turretAngle;
            }
        }

        // Subtle body bob (engine idle vibration)
        if (this.body) {
            const bobAmount = Math.sin(this.idleTime * 3 + this.bodyBobPhase) * 0.02;
            this.body.position.y = 1.0 + bobAmount;
        }
    }

    /**
     * Check if tank is blocking other units and needs to move
     */
    checkAndAvoidBlocking(deltaTime) {
        if (!this.getAllTanks) return;

        const tanks = this.getAllTanks();
        const blockingRadius = 6; // How close before we're considered blocking

        for (const other of tanks) {
            if (other === this || !other.isActive) continue;

            // Check if other tank is trying to exit factory and we're in the way
            if (other.state === 'exiting_factory' && other.exitTarget) {
                const dx = this.mesh.position.x - other.mesh.position.x;
                const dz = this.mesh.position.z - other.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < blockingRadius) {
                    // We're blocking! Move out of the way
                    this.startAvoiding(other);
                    return;
                }
            }

            // Check if other tank is moving toward us
            if (other.state === 'moving' || other.state === 'attacking') {
                const dx = this.mesh.position.x - other.mesh.position.x;
                const dz = this.mesh.position.z - other.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < blockingRadius && dist > 0) {
                    // Check if other is moving toward us
                    const otherDir = Math.atan2(
                        this.mesh.position.x - other.mesh.position.x,
                        this.mesh.position.z - other.mesh.position.z
                    );
                    const otherFacing = other.mesh.rotation.y;
                    const angleDiff = Math.abs(otherDir - otherFacing);

                    if (angleDiff < Math.PI / 3) {
                        // Other tank is heading toward us, move aside
                        this.startAvoiding(other);
                        return;
                    }
                }
            }
        }
    }

    /**
     * Start avoiding another unit
     */
    startAvoiding(blocker) {
        // Don't interrupt if we're already doing something important
        if (this.state === 'exiting_factory' || this.state === 'attacking') return;
        if (this.pilot && this.target) return; // Piloted tanks with targets don't yield

        this.state = 'avoiding';
        this.avoidTimer = 1.5; // Move for 1.5 seconds

        // Calculate perpendicular direction to move (out of the way)
        const dx = this.mesh.position.x - blocker.mesh.position.x;
        const dz = this.mesh.position.z - blocker.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0) {
            // Move perpendicular to the blocker's direction
            // Choose side based on current position
            const perpX = -dz / dist;
            const perpZ = dx / dist;

            // Pick a point to move to
            this.avoidTarget = new BABYLON.Vector3(
                this.mesh.position.x + perpX * 8,
                0,
                this.mesh.position.z + perpZ * 8
            );
        }
    }

    /**
     * Update avoiding behavior - move out of the way
     */
    updateAvoiding(deltaTime) {
        this.avoidTimer -= deltaTime;

        if (this.avoidTimer <= 0 || !this.avoidTarget) {
            this.state = this.pilot ? 'moving' : 'waiting_for_pilot';
            this.avoidTarget = null;
            return;
        }

        const dx = this.avoidTarget.x - this.mesh.position.x;
        const dz = this.avoidTarget.z - this.mesh.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < 1) {
            this.state = this.pilot ? 'moving' : 'waiting_for_pilot';
            this.avoidTarget = null;
            return;
        }

        // Move toward avoid target
        const dirX = dx / distance;
        const dirZ = dz / distance;

        const moveSpeed = GameConstants.TANK.MOVE_SPEED * 0.8;
        this.mesh.position.x += dirX * moveSpeed;
        this.mesh.position.z += dirZ * moveSpeed;

        // Face movement direction
        this.mesh.rotation.y = Math.atan2(dirX, dirZ);
    }

    /**
     * Update exiting factory - drive out of factory to exit point
     */
    updateExitingFactory(deltaTime) {
        if (!this.exitTarget) {
            this.state = 'waiting_for_pilot';
            return;
        }

        const dx = this.exitTarget.x - this.mesh.position.x;
        const dz = this.exitTarget.z - this.mesh.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Reached exit point?
        if (distance < 2) {
            this.state = 'waiting_for_pilot';
            this.exitTarget = null;
            return;
        }

        // Check for collision with other tanks
        const avoidance = this.calculateTankAvoidance();

        // Calculate movement direction
        let dirX = dx / distance;
        let dirZ = dz / distance;

        // Blend with avoidance
        if (avoidance) {
            dirX = dirX * 0.6 + avoidance.x * 0.4;
            dirZ = dirZ * 0.6 + avoidance.z * 0.4;
            const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
            if (len > 0) {
                dirX /= len;
                dirZ /= len;
            }
        }

        // Move toward exit (faster than normal combat speed)
        const exitSpeed = GameConstants.TANK.MOVE_SPEED * 1.5;
        this.mesh.position.x += dirX * exitSpeed;
        this.mesh.position.z += dirZ * exitSpeed;

        // Face movement direction
        this.mesh.rotation.y = Math.atan2(dirX, dirZ);
    }

    /**
     * Calculate avoidance vector for other tanks
     */
    calculateTankAvoidance() {
        if (!this.getAllTanks) return null;

        const tanks = this.getAllTanks();
        const avoidanceRadius = 8; // Tanks need more space
        let avoidX = 0;
        let avoidZ = 0;
        let hasCollision = false;

        for (const other of tanks) {
            if (other === this || !other.isActive) continue;

            const dx = other.mesh.position.x - this.mesh.position.x;
            const dz = other.mesh.position.z - this.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < avoidanceRadius && dist > 0) {
                // Push away from other tank
                const strength = 1 - (dist / avoidanceRadius);
                avoidX -= (dx / dist) * strength;
                avoidZ -= (dz / dist) * strength;
                hasCollision = true;
            }
        }

        if (!hasCollision) return null;

        const len = Math.sqrt(avoidX * avoidX + avoidZ * avoidZ);
        if (len > 0) {
            return { x: avoidX / len, z: avoidZ / len };
        }
        return null;
    }

    /**
     * Update combat behavior
     * - With pilot: actively pursues and attacks enemies
     * - Without pilot: defends in place, attacks enemies in range
     */
    updateCombat(deltaTime) {
        // Find nearest enemy
        const enemy = this.findNearestEnemy();

        if (enemy) {
            this.target = enemy;

            // Rotate turret to face enemy (independent of body)
            this.aimTurretAtTarget(enemy, deltaTime);

            const distance = this.getDistanceTo(enemy);
            const optimalRange = GameConstants.TANK.ATTACK_RANGE * 0.7; // Stay at 70% of max range

            // Only piloted tanks pursue enemies
            if (this.pilot) {
                if (distance > GameConstants.TANK.ATTACK_RANGE) {
                    // Too far - move toward enemy
                    this.state = 'moving';
                    this.moveTowardTarget(enemy, deltaTime);
                } else if (distance < optimalRange * 0.5) {
                    // Too close - back up while attacking
                    this.state = 'attacking';
                    this.moveAwayFromTarget(enemy, deltaTime);
                } else if (distance > optimalRange) {
                    // Move closer to optimal range while attacking
                    this.state = 'attacking';
                    this.moveTowardTarget(enemy, deltaTime);
                } else {
                    // At optimal range - hold position or strafe
                    this.state = 'attacking';
                    this.strafeAroundTarget(enemy, deltaTime);
                }

                // Attack if in range and ready
                if (distance <= GameConstants.TANK.ATTACK_RANGE && this.attackCooldown <= 0) {
                    this.fireCannonball();
                    this.attackCooldown = GameConstants.TANK.ATTACK_INTERVAL;
                }
            } else {
                // Unpiloted tanks defend in place - rotate body toward enemy slowly
                this.rotateBodyToward(enemy, deltaTime, 0.5);

                // Attack if enemy comes within range
                if (distance <= GameConstants.TANK.ATTACK_RANGE && this.attackCooldown <= 0) {
                    this.fireCannonball();
                    this.attackCooldown = GameConstants.TANK.ATTACK_INTERVAL;
                }
            }
        } else {
            this.target = null;
            // State returns to idle/waiting when no target
            if (this.pilot && this.state === 'attacking') {
                this.state = 'moving';
            }
        }
    }

    /**
     * Aim turret at target (relative to body rotation)
     */
    aimTurretAtTarget(target, deltaTime) {
        if (!this.turret || !target) return;

        const targetPos = target.getPosition ? target.getPosition() : target.mesh.position;
        const dx = targetPos.x - this.mesh.position.x;
        const dz = targetPos.z - this.mesh.position.z;

        // Calculate world angle to target
        const worldAngle = Math.atan2(dx, dz);

        // Turret rotation is relative to body, so subtract body rotation
        const relativeAngle = worldAngle - this.mesh.rotation.y;

        // Smooth turret rotation
        const turnSpeed = 3.0 * deltaTime;
        let angleDiff = relativeAngle - this.turret.rotation.y;

        // Normalize angle difference to -PI to PI
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) < turnSpeed) {
            this.turret.rotation.y = relativeAngle;
        } else {
            this.turret.rotation.y += Math.sign(angleDiff) * turnSpeed;
        }
    }

    /**
     * Rotate tank body toward a direction smoothly
     */
    rotateBodyToward(target, deltaTime, speedMultiplier = 1.0) {
        const targetPos = target.getPosition ? target.getPosition() : target.mesh.position;
        const dx = targetPos.x - this.mesh.position.x;
        const dz = targetPos.z - this.mesh.position.z;

        const targetAngle = Math.atan2(dx, dz);
        const turnSpeed = 2.0 * deltaTime * speedMultiplier;

        let angleDiff = targetAngle - this.mesh.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) < turnSpeed) {
            this.mesh.rotation.y = targetAngle;
        } else {
            this.mesh.rotation.y += Math.sign(angleDiff) * turnSpeed;
        }
    }

    /**
     * Move tank toward a target with collision avoidance
     */
    moveTowardTarget(target, deltaTime) {
        if (!target) return;

        const targetPos = target.getPosition ? target.getPosition() : target.mesh.position;
        const dx = targetPos.x - this.mesh.position.x;
        const dz = targetPos.z - this.mesh.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < 0.5) return;

        // Calculate base direction
        let dirX = dx / distance;
        let dirZ = dz / distance;

        // Apply collision avoidance with other tanks
        const avoidance = this.calculateTankAvoidance();
        if (avoidance) {
            dirX = dirX * 0.7 + avoidance.x * 0.3;
            dirZ = dirZ * 0.7 + avoidance.z * 0.3;
            const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
            if (len > 0) {
                dirX /= len;
                dirZ /= len;
            }
        }

        // Move in calculated direction
        this.mesh.position.x += dirX * GameConstants.TANK.MOVE_SPEED;
        this.mesh.position.z += dirZ * GameConstants.TANK.MOVE_SPEED;

        // Smoothly rotate tank body to face movement direction
        const moveAngle = Math.atan2(dirX, dirZ);
        const turnSpeed = 2.5 * deltaTime;
        let angleDiff = moveAngle - this.mesh.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) < turnSpeed) {
            this.mesh.rotation.y = moveAngle;
        } else {
            this.mesh.rotation.y += Math.sign(angleDiff) * turnSpeed;
        }
    }

    /**
     * Move tank away from target (backing up)
     */
    moveAwayFromTarget(target, deltaTime) {
        if (!target) return;

        const targetPos = target.getPosition ? target.getPosition() : target.mesh.position;
        const dx = this.mesh.position.x - targetPos.x;
        const dz = this.mesh.position.z - targetPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < 0.1) return;

        // Move away from target (reverse)
        let dirX = dx / distance;
        let dirZ = dz / distance;

        // Apply collision avoidance
        const avoidance = this.calculateTankAvoidance();
        if (avoidance) {
            dirX = dirX * 0.6 + avoidance.x * 0.4;
            dirZ = dirZ * 0.6 + avoidance.z * 0.4;
            const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
            if (len > 0) {
                dirX /= len;
                dirZ /= len;
            }
        }

        // Move backward at reduced speed
        this.mesh.position.x += dirX * GameConstants.TANK.MOVE_SPEED * 0.6;
        this.mesh.position.z += dirZ * GameConstants.TANK.MOVE_SPEED * 0.6;

        // Keep body facing the target while backing up
        this.rotateBodyToward(target, deltaTime, 1.5);
    }

    /**
     * Strafe around target to find better angle
     */
    strafeAroundTarget(target, deltaTime) {
        if (!target) return;

        const targetPos = target.getPosition ? target.getPosition() : target.mesh.position;
        const dx = targetPos.x - this.mesh.position.x;
        const dz = targetPos.z - this.mesh.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < 0.1) return;

        // Calculate perpendicular direction for strafing
        // Alternate strafe direction based on tank's ID to prevent all tanks strafing same way
        const strafeDir = (this.mesh.uniqueId % 2 === 0) ? 1 : -1;
        let strafeX = -dz / distance * strafeDir;
        let strafeZ = dx / distance * strafeDir;

        // Apply collision avoidance
        const avoidance = this.calculateTankAvoidance();
        if (avoidance) {
            strafeX = strafeX * 0.5 + avoidance.x * 0.5;
            strafeZ = strafeZ * 0.5 + avoidance.z * 0.5;
            const len = Math.sqrt(strafeX * strafeX + strafeZ * strafeZ);
            if (len > 0) {
                strafeX /= len;
                strafeZ /= len;
            }
        }

        // Strafe at reduced speed
        this.mesh.position.x += strafeX * GameConstants.TANK.MOVE_SPEED * 0.4;
        this.mesh.position.z += strafeZ * GameConstants.TANK.MOVE_SPEED * 0.4;

        // Body faces movement direction while strafing
        const moveAngle = Math.atan2(strafeX, strafeZ);
        const turnSpeed = 2.0 * deltaTime;
        let angleDiff = moveAngle - this.mesh.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        this.mesh.rotation.y += Math.sign(angleDiff) * turnSpeed;
    }

    /**
     * Legacy method for compatibility
     */
    moveToward(target) {
        this.moveTowardTarget(target, 0.016);
    }

    /**
     * Fire a cannonball at the target
     */
    fireCannonball() {
        if (!this.target) return;

        const targetPos = this.target.getPosition ? this.target.getPosition() : this.target.mesh.position;

        // Get muzzle position (front of cannon)
        const muzzleOffset = new BABYLON.Vector3(0, 1.8 + 0.4, 3.8);
        const rotatedOffset = new BABYLON.Vector3(
            muzzleOffset.x * Math.cos(this.turret.rotation.y) - muzzleOffset.z * Math.sin(this.turret.rotation.y),
            muzzleOffset.y,
            muzzleOffset.x * Math.sin(this.turret.rotation.y) + muzzleOffset.z * Math.cos(this.turret.rotation.y)
        );
        const startPos = this.mesh.position.add(rotatedOffset);

        // Create cannonball
        const cannonball = BABYLON.MeshBuilder.CreateSphere(
            `cannonball_${Date.now()}`,
            { diameter: GameConstants.TANK.PROJECTILE_SIZE, segments: 8 },
            this.scene
        );
        cannonball.position = startPos;

        const projMat = new BABYLON.StandardMaterial('cannonballMat', this.scene);
        projMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        projMat.emissiveColor = new BABYLON.Color3(0.3, 0.2, 0.1);
        cannonball.material = projMat;

        // Calculate velocity
        const dx = targetPos.x - startPos.x;
        const dy = (targetPos.y + 1) - startPos.y;
        const dz = targetPos.z - startPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const speed = GameConstants.TANK.PROJECTILE_SPEED;
        const velocity = new BABYLON.Vector3(
            (dx / dist) * speed,
            (dy / dist) * speed + 0.1, // Add arc
            (dz / dist) * speed
        );

        this.projectiles.push({
            mesh: cannonball,
            velocity: velocity,
            target: this.target,
            life: 5.0
        });

        // Play sound and effects
        if (this.soundManager) {
            this.soundManager.playAttackSound();
        }
        if (this.attackEffects) {
            this.attackEffects.createImpactEffect(startPos, 'hit');
        }
    }

    /**
     * Update all projectiles
     */
    updateProjectiles(deltaTime) {
        const toRemove = [];

        for (let i = 0; i < this.projectiles.length; i++) {
            const proj = this.projectiles[i];

            // Move projectile
            proj.mesh.position.addInPlace(proj.velocity);

            // Apply gravity
            proj.velocity.y -= 0.01;

            // Check for ground hit
            if (proj.mesh.position.y <= 0.5) {
                this.createExplosion(proj.mesh.position);
                toRemove.push(i);
                continue;
            }

            // Check for target hit
            if (proj.target && proj.target.isActive) {
                const targetPos = proj.target.getPosition ? proj.target.getPosition() : proj.target.mesh.position;
                const dist = BABYLON.Vector3.Distance(proj.mesh.position, targetPos);

                if (dist < 2) {
                    this.createExplosion(proj.mesh.position);
                    toRemove.push(i);
                    continue;
                }
            }

            // Check lifetime
            proj.life -= deltaTime;
            if (proj.life <= 0) {
                toRemove.push(i);
            }
        }

        // Remove dead projectiles
        for (let i = toRemove.length - 1; i >= 0; i--) {
            const idx = toRemove[i];
            this.projectiles[idx].mesh.dispose();
            this.projectiles.splice(idx, 1);
        }
    }

    /**
     * Create explosion with splash damage
     */
    createExplosion(position) {
        // Visual explosion effect
        if (this.attackEffects) {
            // Create multiple impact effects for explosion
            for (let i = 0; i < 3; i++) {
                const offset = new BABYLON.Vector3(
                    (Math.random() - 0.5) * 2,
                    Math.random() * 1,
                    (Math.random() - 0.5) * 2
                );
                this.attackEffects.createImpactEffect(position.add(offset), 'hit');
            }
        }

        // Deal splash damage
        this.dealSplashDamage(position);

        // Play sound
        if (this.soundManager) {
            this.soundManager.playAttackSound();
        }
    }

    /**
     * Deal splash damage to all enemies in radius
     */
    dealSplashDamage(position) {
        const splashRadius = GameConstants.TANK.SPLASH_RADIUS;
        const splashDamage = GameConstants.TANK.SPLASH_DAMAGE;
        const directDamage = GameConstants.TANK.ATTACK_DAMAGE;

        // Get all enemies
        const enemies = [];
        if (this.getEnemyUnits) {
            enemies.push(...this.getEnemyUnits());
        }
        if (this.getEnemyBuildings) {
            enemies.push(...this.getEnemyBuildings());
        }

        for (const enemy of enemies) {
            if (!enemy.isActive) continue;

            const enemyPos = enemy.getPosition ? enemy.getPosition() : (enemy.mesh ? enemy.mesh.position : null);
            if (!enemyPos) continue;

            const dist = BABYLON.Vector3.Distance(position, enemyPos);

            if (dist <= splashRadius) {
                // Calculate damage falloff
                const falloff = 1 - (dist / splashRadius);
                const damage = dist < 1.5 ? directDamage : splashDamage * falloff;

                if (enemy.takeDamage) {
                    enemy.takeDamage(damage);

                    // Flash effect
                    if (this.attackEffects && enemy.mesh) {
                        this.attackEffects.createHitFlash(enemy.mesh);
                    }
                }
            }
        }
    }

    /**
     * Find nearest enemy
     */
    findNearestEnemy() {
        let nearest = null;
        let nearestDist = GameConstants.TANK.SENSING_RANGE;

        // Check enemy units
        if (this.getEnemyUnits) {
            for (const enemy of this.getEnemyUnits()) {
                if (!enemy.isActive) continue;

                const dist = this.getDistanceTo(enemy);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = enemy;
                }
            }
        }

        // Check enemy buildings
        if (this.getEnemyBuildings) {
            for (const building of this.getEnemyBuildings()) {
                if (!building.isActive) continue;

                const dist = this.getDistanceTo(building);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = building;
                }
            }
        }

        return nearest;
    }

    /**
     * Get distance to target
     */
    getDistanceTo(target) {
        if (!target) return Infinity;

        const targetPos = target.getPosition ? target.getPosition() : (target.mesh ? target.mesh.position : null);
        if (!targetPos) return Infinity;

        return BABYLON.Vector3.Distance(this.mesh.position, targetPos);
    }

    /**
     * Override takeDamage for armor
     */
    takeDamage(amount) {
        // Apply tank armor
        const reducedDamage = amount * (1 - GameConstants.TANK.DAMAGE_REDUCTION);
        super.takeDamage(reducedDamage);

        // If destroyed, eject pilot
        if (this.healthBar && this.healthBar.isDead()) {
            if (this.pilot) {
                const ejectedPilot = this.exitTank();
                if (ejectedPilot) {
                    // Pilot takes some damage from explosion
                    ejectedPilot.takeDamage(10);
                }
            }
        }
    }

    /**
     * Set callbacks
     */
    setGetEnemyUnits(callback) {
        this.getEnemyUnits = callback;
    }

    setGetEnemyBuildings(callback) {
        this.getEnemyBuildings = callback;
    }

    setAttackEffects(effects) {
        this.attackEffects = effects;
    }

    setSoundManager(manager) {
        this.soundManager = manager;
    }

    setGetAllTanks(callback) {
        this.getAllTanks = callback;
    }

    /**
     * Check if tank can be dragged by the user
     */
    isDraggable() {
        // Can drag tanks that are idle or waiting (not in combat or exiting factory)
        return this.isActive &&
               this.state !== 'exiting_factory' &&
               this.state !== 'attacking' &&
               this.team === 'red'; // Only player's tanks
    }

    /**
     * Pause AI for dragging
     */
    pauseAI() {
        this.isPaused = true;
        this.previousState = this.state;
    }

    /**
     * Resume AI after dragging
     */
    resumeAI() {
        this.isPaused = false;
        // Return to appropriate state after drag
        if (this.pilot) {
            this.state = 'moving';
        } else {
            this.state = 'waiting_for_pilot';
        }
    }

    /**
     * Get position
     */
    getPosition() {
        return this.mesh ? this.mesh.position.clone() : this.position.clone();
    }

    /**
     * Dispose
     */
    dispose() {
        // Eject pilot first
        if (this.pilot) {
            this.exitTank();
        }

        // Dispose projectiles
        this.projectiles.forEach(p => p.mesh.dispose());
        this.projectiles = [];

        super.dispose();
    }
}
