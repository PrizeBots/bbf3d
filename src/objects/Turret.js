import { SpawnableObject } from './SpawnableObject.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * Turret - Defensive tower that scans for enemies and shoots projectiles
 *
 * Features:
 * - Brick tower base
 * - Rotating gun platform that scans the area
 * - Laser targeting when enemy detected
 * - Fires projectile balls at enemies
 * - Team-colored accents
 */
export class Turret extends SpawnableObject {
    constructor(scene, position, shadowGenerator, team = 'red') {
        const maxHP = GameConstants.TURRET?.MAX_HP || 150;
        super(scene, position, shadowGenerator, maxHP);

        this.team = team;
        this.velocity = 0;
        this.gravity = GameConstants.PHYSICS.GRAVITY;
        this.groundLevel = 0; // Base sits on ground
        this.state = 'falling'; // 'falling', 'scanning', 'targeting', 'attacking'
        this.isPaused = false;

        // Combat
        this.target = null;
        this.attackCooldown = 0;
        this.scanAngle = 0;
        this.targetYaw = 0;    // Horizontal rotation
        this.targetPitch = 0;  // Vertical tilt (barrel up/down)
        this.currentPitch = 0; // Current barrel pitch

        // Mesh components
        this.baseMesh = null;
        this.gunPlatform = null;
        this.barrelPivot = null; // Pivot for vertical aiming
        this.gunBarrel = null;
        this.muzzleTip = null;   // Reference to muzzle for position
        this.laserBeam = null;

        // Projectiles
        this.projectiles = [];

        // Callbacks
        this.getEnemyUnits = null;
        this.attackEffects = null;
        this.soundManager = null;

        // Team colors
        this.teamColor = team === 'red'
            ? new BABYLON.Color3(0.9, 0.2, 0.2)
            : new BABYLON.Color3(0.2, 0.4, 0.9);
        this.teamColorDark = team === 'red'
            ? new BABYLON.Color3(0.6, 0.1, 0.1)
            : new BABYLON.Color3(0.1, 0.2, 0.6);

        this.create();
        // Note: shadows are added to individual mesh components in createBrickTower() and createGunPlatform()
        this.createHealthBar(8.0);
    }

    /**
     * Create the turret mesh - brick tower with rotating gun
     */
    create() {
        // Create root container
        this.mesh = new BABYLON.TransformNode(`turret_${Date.now()}`, this.scene);
        this.mesh.position = this.position.clone();

        // Create brick tower base
        this.createBrickTower();

        // Create rotating gun platform
        this.createGunPlatform();
    }

    /**
     * Create the brick tower base
     */
    createBrickTower() {
        const brickColor = new BABYLON.Color3(0.55, 0.35, 0.25); // Brown brick
        const mortarColor = new BABYLON.Color3(0.7, 0.7, 0.65); // Light gray mortar

        // Create base - slightly tapered cylinder
        this.baseMesh = new BABYLON.TransformNode('towerBase', this.scene);
        this.baseMesh.parent = this.mesh;

        // Create multiple brick layers for visual interest
        const numLayers = 5;
        const baseRadius = 2.0;
        const topRadius = 1.6;
        const layerHeight = 1.2;

        for (let i = 0; i < numLayers; i++) {
            const t = i / (numLayers - 1);
            const radius = baseRadius - (baseRadius - topRadius) * t;
            const y = i * layerHeight;

            // Create layer cylinder
            const layer = BABYLON.MeshBuilder.CreateCylinder(
                `brickLayer_${i}`,
                {
                    height: layerHeight,
                    diameterTop: radius * 2 * 0.95,
                    diameterBottom: radius * 2,
                    tessellation: 12
                },
                this.scene
            );
            layer.position.y = y + layerHeight / 2;
            layer.parent = this.baseMesh;

            // Brick material
            const layerMat = new BABYLON.StandardMaterial(`brickMat_${i}`, this.scene);
            layerMat.diffuseColor = brickColor;
            layerMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            layer.material = layerMat;

            if (this.shadowGenerator) {
                this.shadowGenerator.addShadowCaster(layer);
            }

            // Add mortar line between layers
            if (i < numLayers - 1) {
                const mortar = BABYLON.MeshBuilder.CreateCylinder(
                    `mortar_${i}`,
                    {
                        height: 0.1,
                        diameter: radius * 2 + 0.1,
                        tessellation: 12
                    },
                    this.scene
                );
                mortar.position.y = y + layerHeight;
                mortar.parent = this.baseMesh;

                const mortarMat = new BABYLON.StandardMaterial(`mortarMat_${i}`, this.scene);
                mortarMat.diffuseColor = mortarColor;
                mortar.material = mortarMat;
            }
        }

        // Add team-colored band near top
        const bandHeight = numLayers * layerHeight - layerHeight / 2;
        const band = BABYLON.MeshBuilder.CreateCylinder(
            'teamBand',
            {
                height: 0.4,
                diameter: topRadius * 2 + 0.2,
                tessellation: 12
            },
            this.scene
        );
        band.position.y = bandHeight;
        band.parent = this.baseMesh;

        const bandMat = new BABYLON.StandardMaterial('bandMat', this.scene);
        bandMat.diffuseColor = this.teamColor;
        bandMat.emissiveColor = this.teamColor.scale(0.3);
        band.material = bandMat;

        // Add crenellations (battlements) at top
        const numCrenels = 8;
        const crenelHeight = 0.6;
        const crenelWidth = 0.5;
        const platformY = numLayers * layerHeight;

        for (let i = 0; i < numCrenels; i++) {
            const angle = (i / numCrenels) * Math.PI * 2;
            const x = Math.cos(angle) * (topRadius - 0.1);
            const z = Math.sin(angle) * (topRadius - 0.1);

            const crenel = BABYLON.MeshBuilder.CreateBox(
                `crenel_${i}`,
                { width: crenelWidth, height: crenelHeight, depth: 0.4 },
                this.scene
            );
            crenel.position = new BABYLON.Vector3(x, platformY + crenelHeight / 2, z);
            crenel.rotation.y = angle;
            crenel.parent = this.baseMesh;

            const crenelMat = new BABYLON.StandardMaterial(`crenelMat_${i}`, this.scene);
            crenelMat.diffuseColor = brickColor;
            crenel.material = crenelMat;

            if (this.shadowGenerator) {
                this.shadowGenerator.addShadowCaster(crenel);
            }
        }
    }

    /**
     * Create the rotating gun platform with tilting barrel
     */
    createGunPlatform() {
        const platformY = 5 * 1.2; // Top of tower

        // Gun platform (rotates horizontally - yaw)
        this.gunPlatform = new BABYLON.TransformNode('gunPlatform', this.scene);
        this.gunPlatform.position.y = platformY;
        this.gunPlatform.parent = this.mesh;

        // Platform base
        const platformBase = BABYLON.MeshBuilder.CreateCylinder(
            'platformBase',
            { height: 0.5, diameter: 2.5, tessellation: 16 },
            this.scene
        );
        platformBase.position.y = 0.25;
        platformBase.parent = this.gunPlatform;

        const platformMat = new BABYLON.StandardMaterial('platformMat', this.scene);
        platformMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);
        platformMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        platformBase.material = platformMat;

        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(platformBase);
        }

        // Gun mount (stationary on platform)
        const mount = BABYLON.MeshBuilder.CreateBox(
            'gunMount',
            { width: 0.8, height: 0.8, depth: 1.2 },
            this.scene
        );
        mount.position.y = 0.9;
        mount.parent = this.gunPlatform;

        const mountMat = new BABYLON.StandardMaterial('mountMat', this.scene);
        mountMat.diffuseColor = new BABYLON.Color3(0.25, 0.25, 0.28);
        mount.material = mountMat;

        // Barrel pivot (tilts vertically - pitch)
        // Position at the back of the barrel where it pivots
        this.barrelPivot = new BABYLON.TransformNode('barrelPivot', this.scene);
        this.barrelPivot.position.y = 0.9;
        this.barrelPivot.position.z = 0.3; // Pivot point at back of mount
        this.barrelPivot.parent = this.gunPlatform;

        // Gun barrel (attached to pivot)
        this.gunBarrel = BABYLON.MeshBuilder.CreateCylinder(
            'gunBarrel',
            { height: 2.5, diameter: 0.35, tessellation: 12 },
            this.scene
        );
        this.gunBarrel.rotation.x = Math.PI / 2; // Point forward
        this.gunBarrel.position.z = 1.25; // Center of barrel, relative to pivot
        this.gunBarrel.parent = this.barrelPivot;

        const barrelMat = new BABYLON.StandardMaterial('barrelMat', this.scene);
        barrelMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.22);
        barrelMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
        this.gunBarrel.material = barrelMat;

        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(this.gunBarrel);
        }

        // Muzzle tip (team colored, attached to pivot)
        this.muzzleTip = BABYLON.MeshBuilder.CreateCylinder(
            'muzzle',
            { height: 0.3, diameter: 0.45, tessellation: 12 },
            this.scene
        );
        this.muzzleTip.rotation.x = Math.PI / 2;
        this.muzzleTip.position.z = 2.65; // At end of barrel, relative to pivot
        this.muzzleTip.parent = this.barrelPivot;

        const muzzleMat = new BABYLON.StandardMaterial('muzzleMat', this.scene);
        muzzleMat.diffuseColor = this.teamColor;
        muzzleMat.emissiveColor = this.teamColor.scale(0.4);
        this.muzzleTip.material = muzzleMat;
    }

    /**
     * Get the world position of the muzzle tip
     */
    getMuzzleWorldPosition() {
        if (!this.muzzleTip) {
            // Fallback if muzzle doesn't exist
            const pos = this.mesh.position.clone();
            pos.y += 6.5;
            return pos;
        }

        // Force update of world matrix
        this.muzzleTip.computeWorldMatrix(true);

        // Get absolute position of the muzzle mesh
        const muzzlePos = this.muzzleTip.getAbsolutePosition().clone();

        // Add offset for the tip of the muzzle (forward in barrel direction)
        // The muzzle is a cylinder rotated 90 degrees, so its local Z points forward
        const worldMatrix = this.muzzleTip.getWorldMatrix();
        const forward = new BABYLON.Vector3(0, 0, 0.25); // Tip offset
        const rotatedForward = BABYLON.Vector3.TransformNormal(forward, worldMatrix);
        muzzlePos.addInPlace(rotatedForward);

        return muzzlePos;
    }

    /**
     * Update turret state
     */
    update() {
        if (!this.mesh || !this.isActive || this.isPaused) {
            return;
        }

        // Call parent update for healthbar
        super.update();

        const deltaTime = this.deltaTime || 0.016;

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Update based on state
        switch (this.state) {
            case 'falling':
                this.updateFalling();
                break;
            case 'scanning':
                this.updateScanning(deltaTime);
                break;
            case 'targeting':
                this.updateTargeting(deltaTime);
                break;
            case 'attacking':
                this.updateAttacking(deltaTime);
                break;
        }

        // Update projectiles
        this.updateProjectiles();
    }

    /**
     * Update falling state
     */
    updateFalling() {
        if (this.mesh.position.y > this.groundLevel) {
            // Apply gravity
            this.velocity += this.gravity;
            this.mesh.position.y -= this.velocity;
        } else {
            // Landed
            this.mesh.position.y = this.groundLevel;
            this.state = 'scanning';
            this.onPlaced();
        }
    }

    /**
     * Update scanning state - rotate gun to look for enemies
     */
    updateScanning(deltaTime) {
        // Rotate gun platform slowly
        this.scanAngle += GameConstants.TURRET.SCAN_SPEED;
        if (this.gunPlatform) {
            this.gunPlatform.rotation.y = this.scanAngle;
        }

        // Gradually return barrel to horizontal when scanning
        if (this.barrelPivot && Math.abs(this.currentPitch) > 0.01) {
            this.currentPitch *= 0.95; // Ease back to horizontal
            this.barrelPivot.rotation.x = -this.currentPitch;
        }

        // Check for enemies
        this.target = this.findNearestEnemy();
        if (this.target) {
            this.state = 'targeting';
            this.showLaser();
        }
    }

    /**
     * Update targeting state - aim at target (yaw and pitch)
     */
    updateTargeting(deltaTime) {
        // Verify target is still valid
        if (!this.target || !this.target.isActive) {
            this.target = null;
            this.state = 'scanning';
            this.hideLaser();
            return;
        }

        // Check if target is still in range
        const distance = this.getDistanceToTarget();
        if (distance > GameConstants.TURRET.DETECTION_RANGE) {
            this.target = null;
            this.state = 'scanning';
            this.hideLaser();
            return;
        }

        // Calculate angles to target
        const aimResult = this.calculateAimAngles();
        this.targetYaw = aimResult.yaw;
        this.targetPitch = aimResult.pitch;

        // Smoothly rotate yaw toward target
        let yawDiff = this.targetYaw - this.gunPlatform.rotation.y;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

        let yawLocked = false;
        if (Math.abs(yawDiff) > 0.05) {
            this.gunPlatform.rotation.y += Math.sign(yawDiff) * GameConstants.TURRET.AIM_SPEED;
        } else {
            this.gunPlatform.rotation.y = this.targetYaw;
            yawLocked = true;
        }

        // Smoothly adjust pitch (barrel tilt)
        let pitchDiff = this.targetPitch - this.currentPitch;
        let pitchLocked = false;
        if (Math.abs(pitchDiff) > 0.02) {
            this.currentPitch += Math.sign(pitchDiff) * GameConstants.TURRET.AIM_SPEED * 0.5;
        } else {
            this.currentPitch = this.targetPitch;
            pitchLocked = true;
        }

        // Apply pitch to barrel pivot (negative because rotating down is positive pitch)
        if (this.barrelPivot) {
            this.barrelPivot.rotation.x = -this.currentPitch;
        }

        // Locked on target when both yaw and pitch are aligned
        if (yawLocked && pitchLocked && distance <= GameConstants.TURRET.ATTACK_RANGE) {
            this.state = 'attacking';
        }

        // Update laser position
        this.updateLaser();
    }

    /**
     * Calculate yaw and pitch angles to aim at target
     */
    calculateAimAngles() {
        const targetPos = this.target.getPosition ? this.target.getPosition() : this.target.mesh.position;

        // Get approximate muzzle base position (platform height)
        const platformY = this.mesh.position.y + 5 * 1.2 + 0.9; // Tower height + pivot height

        // Horizontal distance and angle (yaw)
        const dx = targetPos.x - this.mesh.position.x;
        const dz = targetPos.z - this.mesh.position.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);
        const yaw = Math.atan2(dx, dz);

        // Vertical angle (pitch) - aim at target center (add 1 for center mass)
        const dy = (targetPos.y + 1) - platformY;
        const pitch = Math.atan2(dy, horizontalDist);

        // Clamp pitch to reasonable limits (-60 degrees to +30 degrees)
        const clampedPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 6, pitch));

        return { yaw, pitch: clampedPitch };
    }

    /**
     * Update attacking state - fire at target
     */
    updateAttacking(deltaTime) {
        // Verify target is still valid
        if (!this.target || !this.target.isActive) {
            this.target = null;
            this.state = 'scanning';
            this.hideLaser();
            return;
        }

        // Check if target is still in range
        const distance = this.getDistanceToTarget();
        if (distance > GameConstants.TURRET.ATTACK_RANGE) {
            this.state = 'targeting';
            return;
        }

        // Keep aiming at target (both yaw and pitch)
        const aimResult = this.calculateAimAngles();
        this.gunPlatform.rotation.y = aimResult.yaw;
        this.currentPitch = aimResult.pitch;

        // Apply pitch to barrel
        if (this.barrelPivot) {
            this.barrelPivot.rotation.x = -this.currentPitch;
        }

        // Update laser
        this.updateLaser();

        // Fire when ready
        if (this.attackCooldown <= 0) {
            this.fireProjectile();
            this.attackCooldown = GameConstants.TURRET.ATTACK_INTERVAL;
        }
    }

    /**
     * Find nearest enemy in range
     */
    findNearestEnemy() {
        if (!this.getEnemyUnits) return null;

        const enemies = this.getEnemyUnits();
        let nearest = null;
        let nearestDist = GameConstants.TURRET.DETECTION_RANGE;

        for (const enemy of enemies) {
            if (!enemy.isActive) continue;

            const enemyPos = enemy.getPosition ? enemy.getPosition() : enemy.mesh.position;
            const dx = enemyPos.x - this.mesh.position.x;
            const dz = enemyPos.z - this.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }

        return nearest;
    }

    /**
     * Get distance to current target
     */
    getDistanceToTarget() {
        if (!this.target) return Infinity;

        const targetPos = this.target.getPosition ? this.target.getPosition() : this.target.mesh.position;
        const dx = targetPos.x - this.mesh.position.x;
        const dz = targetPos.z - this.mesh.position.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    /**
     * Show laser targeting beam
     */
    showLaser() {
        // Laser is created/updated dynamically in updateLaser
    }

    /**
     * Update laser beam position and length - from muzzle tip to target center
     */
    updateLaser() {
        if (!this.target) return;

        // Get target center position
        const targetPos = this.target.getPosition ? this.target.getPosition() : this.target.mesh.position;
        const targetCenter = new BABYLON.Vector3(targetPos.x, targetPos.y + 1, targetPos.z);

        // Get actual muzzle world position
        const muzzlePos = this.getMuzzleWorldPosition();

        // Dispose old laser and create new one with updated points
        if (this.laserBeam) {
            this.laserBeam.dispose();
        }

        // Create laser as a tube from muzzle to target
        const path = [muzzlePos, targetCenter];
        this.laserBeam = BABYLON.MeshBuilder.CreateTube(
            'laserBeam',
            {
                path: path,
                radius: 0.04,
                tessellation: 8,
                cap: BABYLON.Mesh.CAP_ALL
            },
            this.scene
        );

        const laserMat = new BABYLON.StandardMaterial('laserMat', this.scene);
        laserMat.diffuseColor = this.teamColor;
        laserMat.emissiveColor = this.teamColor;
        laserMat.alpha = 0.8;
        this.laserBeam.material = laserMat;
    }

    /**
     * Hide laser beam
     */
    hideLaser() {
        if (this.laserBeam) {
            this.laserBeam.dispose();
            this.laserBeam = null;
        }
    }

    /**
     * Fire a projectile at the target from the muzzle
     */
    fireProjectile() {
        if (!this.target) return;

        // Get target center
        const targetPos = this.target.getPosition ? this.target.getPosition() : this.target.mesh.position;
        const targetCenter = new BABYLON.Vector3(targetPos.x, targetPos.y + 1, targetPos.z);

        // Get muzzle world position
        const muzzlePos = this.getMuzzleWorldPosition();

        // Create projectile at muzzle
        const projectile = BABYLON.MeshBuilder.CreateSphere(
            `projectile_${Date.now()}`,
            { diameter: GameConstants.TURRET.PROJECTILE_SIZE, segments: 8 },
            this.scene
        );
        projectile.position = muzzlePos.clone();

        const projMat = new BABYLON.StandardMaterial('projMat', this.scene);
        projMat.diffuseColor = this.teamColor;
        projMat.emissiveColor = this.teamColor.scale(0.8);
        projectile.material = projMat;

        // Calculate velocity toward target center
        const dx = targetCenter.x - muzzlePos.x;
        const dy = targetCenter.y - muzzlePos.y;
        const dz = targetCenter.z - muzzlePos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const speed = GameConstants.TURRET.PROJECTILE_SPEED;
        const velocity = new BABYLON.Vector3(
            (dx / dist) * speed,
            (dy / dist) * speed,
            (dz / dist) * speed
        );

        this.projectiles.push({
            mesh: projectile,
            velocity: velocity,
            target: this.target,
            life: 3.0 // Max lifetime in seconds
        });

        // Play sound
        if (this.soundManager) {
            this.soundManager.playAttackSound();
        }

        // Flash muzzle
        if (this.attackEffects) {
            this.attackEffects.createImpactEffect(muzzlePos.clone(), 'hit');
        }
    }

    /**
     * Update all projectiles
     */
    updateProjectiles() {
        const deltaTime = this.deltaTime || 0.016;
        const toRemove = [];

        for (let i = 0; i < this.projectiles.length; i++) {
            const proj = this.projectiles[i];

            // Move projectile
            proj.mesh.position.addInPlace(proj.velocity);

            // Apply slight gravity
            proj.velocity.y -= 0.005;

            // Check for hit
            if (proj.target && proj.target.isActive) {
                const targetPos = proj.target.getPosition ? proj.target.getPosition() : proj.target.mesh.position;
                const dx = targetPos.x - proj.mesh.position.x;
                const dy = (targetPos.y + 1) - proj.mesh.position.y;
                const dz = targetPos.z - proj.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < 1.5) {
                    // Hit!
                    this.onProjectileHit(proj);
                    toRemove.push(i);
                    continue;
                }
            }

            // Check lifetime
            proj.life -= deltaTime;
            if (proj.life <= 0 || proj.mesh.position.y < -5) {
                toRemove.push(i);
            }
        }

        // Remove dead projectiles (reverse order)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            const idx = toRemove[i];
            this.projectiles[idx].mesh.dispose();
            this.projectiles.splice(idx, 1);
        }
    }

    /**
     * Handle projectile hitting target
     */
    onProjectileHit(proj) {
        if (!proj.target || !proj.target.isActive) return;

        // Deal damage
        if (proj.target.takeDamage) {
            proj.target.takeDamage(GameConstants.TURRET.ATTACK_DAMAGE);
        }

        // Visual effect
        if (this.attackEffects) {
            const hitPos = proj.mesh.position.clone();
            this.attackEffects.createImpactEffect(hitPos, 'hit');
            if (proj.target.mesh) {
                this.attackEffects.createHitFlash(proj.target.mesh);
            }
        }

        // Sound
        if (this.soundManager) {
            this.soundManager.playAttackSound();
        }
    }

    /**
     * Called when turret is placed on the ground
     */
    onPlaced() {
        console.log(`Turret placed at (${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.z.toFixed(1)})`);
    }

    /**
     * Set function to get enemy units
     */
    setGetEnemyUnits(callback) {
        this.getEnemyUnits = callback;
    }

    /**
     * Set attack effects system
     */
    setAttackEffects(effects) {
        this.attackEffects = effects;
    }

    /**
     * Set sound manager
     */
    setSoundManager(manager) {
        this.soundManager = manager;
    }

    /**
     * Get position
     */
    getPosition() {
        return this.mesh ? this.mesh.position.clone() : this.position.clone();
    }

    /**
     * Get team
     */
    getTeam() {
        return this.team;
    }

    /**
     * Pause for dragging
     */
    pauseAI() {
        this.isPaused = true;
    }

    /**
     * Resume after dragging
     */
    resumeAI() {
        this.isPaused = false;
    }

    /**
     * Dispose turret and all components
     */
    dispose() {
        // Dispose projectiles
        this.projectiles.forEach(proj => proj.mesh.dispose());
        this.projectiles = [];

        // Dispose laser
        this.hideLaser();

        // Call parent dispose
        super.dispose();
    }
}
