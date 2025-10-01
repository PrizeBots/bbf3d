/**
 * Bubby - Hatched creature that idles around and attacks sprouts
 */
class Bubby extends SpawnableObject {
    constructor(scene, position, team, shadowGenerator, getAllSprouts, getAllBubbies, initialHealth = 100) {
        super(scene, position, shadowGenerator, 100); // 100 max health

        this.team = team; // 'red' or 'blue'
        this.getAllSprouts = getAllSprouts; // Function to get all sprouts in the scene
        this.getAllBubbies = getAllBubbies; // Function to get all other bubbies
        this.idleTime = 0;
        this.moveSpeed = 0.08; // Faster movement for hunting
        this.squishPhase = 0;

        // AI behavior
        this.state = 'idle'; // 'idle', 'moving_to_target', 'attacking'
        this.target = null;
        this.sensingRange = 15; // How far bubby can detect sprouts
        this.attackRange = 2; // How close to start attacking
        this.attackCooldown = 0;
        this.attackInterval = 1.0; // Attack every 1.0 seconds
        this.attackDamage = 1; // 1 HP per attack = 1 HP per second

        // Growth
        this.baseSize = 1.5;
        this.currentSize = 1.5;
        this.growthAmount = 0;
        this.maxGrowth = 2.25; // Can grow up to 1.5x original size (2 sprouts worth)

        this.create();
        this.enableShadows();
        this.createHealthBar();

        // Set initial health (transferred from egg)
        if (initialHealth) {
            this.setHealth(initialHealth);
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

        this.mesh.position = this.position.clone();

        // Create bubby material based on team
        const bubbyMaterial = new BABYLON.StandardMaterial(`bubbyMat_${this.team}_${Date.now()}`, this.scene);

        if (this.team === 'red') {
            bubbyMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.2); // Red
            bubbyMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.05, 0.05);
        } else {
            bubbyMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.9); // Blue
            bubbyMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.3);
        }

        bubbyMaterial.alpha = 0.9; // Slightly translucent like slime
        this.mesh.material = bubbyMaterial;
    }

    /**
     * Setup idle behavior
     */
    setupIdleBehavior() {
        this.updateObserver = this.scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
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

        const deltaTime = 0.016; // ~60fps
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
            case 'moving_to_target':
                this.updateMovingToTarget();
                break;
            case 'attacking':
                this.updateAttacking(deltaTime);
                break;
        }

        // Apply squish animation based on current size
        this.squishPhase += 0.05;
        const squishY = 1 + Math.sin(this.squishPhase) * 0.1;
        const squishXZ = 1 / Math.sqrt(squishY);
        this.mesh.scaling = new BABYLON.Vector3(
            squishXZ * this.currentSize,
            squishY * this.currentSize,
            squishXZ * this.currentSize
        );

        // Gentle rocking motion
        this.mesh.rotation.z = Math.sin(this.squishPhase * 0.7) * 0.1;
    }

    /**
     * Update idle state - sense for nearby sprouts
     */
    updateIdle() {
        // Sense for nearby sprouts
        const nearestSprout = this.findNearestSprout();

        if (nearestSprout) {
            this.target = nearestSprout;
            this.state = 'moving_to_target';
        } else {
            // Small random movements when idle
            if (Math.random() < 0.01) {
                const randomX = (Math.random() - 0.5) * this.moveSpeed;
                const randomZ = (Math.random() - 0.5) * this.moveSpeed;
                this.mesh.position.x += randomX;
                this.mesh.position.z += randomZ;
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

        const targetPos = this.target.mesh.position;
        const direction = targetPos.subtract(this.mesh.position);
        const distance = direction.length();

        // Check if in attack range
        if (distance <= this.attackRange) {
            this.state = 'attacking';
            return;
        }

        // Check if target is out of sensing range
        if (distance > this.sensingRange) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        // Move toward target with collision avoidance
        direction.normalize();

        // Check for collisions with other bubbies
        const avoidanceVector = this.calculateAvoidance();
        if (avoidanceVector) {
            // Blend movement direction with avoidance
            direction.x = direction.x * 0.5 + avoidanceVector.x * 0.5;
            direction.z = direction.z * 0.5 + avoidanceVector.z * 0.5;
            direction.normalize();
        }

        this.mesh.position.x += direction.x * this.moveSpeed;
        this.mesh.position.z += direction.z * this.moveSpeed;
    }

    /**
     * Calculate avoidance vector to avoid other bubbies
     */
    calculateAvoidance() {
        if (!this.getAllBubbies) {
            return null;
        }

        const bubbies = this.getAllBubbies();
        const avoidanceRadius = 2.5; // Personal space
        let avoidanceVector = new BABYLON.Vector3(0, 0, 0);
        let hasCollision = false;

        for (const other of bubbies) {
            if (other === this || !other.isActive) {
                continue;
            }

            const toOther = other.mesh.position.subtract(this.mesh.position);
            const distance = toOther.length();

            if (distance < avoidanceRadius && distance > 0) {
                // Too close - add repulsion force
                const repulsion = toOther.normalize().scale(-1);
                const strength = 1 - (distance / avoidanceRadius);
                avoidanceVector.addInPlace(repulsion.scale(strength));
                hasCollision = true;
            }
        }

        return hasCollision ? avoidanceVector.normalize() : null;
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

        const targetPos = this.target.mesh.position;
        const distance = BABYLON.Vector3.Distance(this.mesh.position, targetPos);

        // If target moved out of attack range, chase it
        if (distance > this.attackRange) {
            this.state = 'moving_to_target';
            return;
        }

        // Attack at intervals
        if (this.attackCooldown <= 0) {
            this.attackTarget();
            this.attackCooldown = this.attackInterval;
        }
    }

    /**
     * Attack the current target
     */
    attackTarget() {
        if (!this.target) {
            return;
        }

        // Deal damage to target
        this.target.takeDamage(this.attackDamage);

        // Grow when dealing damage
        this.grow();

        // Check if target is dead
        if (!this.target.isActive) {
            this.target = null;
            this.state = 'idle';
        }
    }

    /**
     * Find the nearest sprout within sensing range
     */
    findNearestSprout() {
        if (!this.getAllSprouts) {
            return null;
        }

        const sprouts = this.getAllSprouts();
        let nearestSprout = null;
        let nearestDistance = this.sensingRange;

        for (const sprout of sprouts) {
            if (!sprout.isActive) {
                continue;
            }

            const distance = BABYLON.Vector3.Distance(
                this.mesh.position,
                sprout.mesh.position
            );

            if (distance <= nearestDistance) {
                nearestDistance = distance;
                nearestSprout = sprout;
            }
        }

        return nearestSprout;
    }

    /**
     * Grow the bubby when it eats
     */
    grow() {
        const growthIncrement = 0.01875; // Calibrated for 2 sprouts worth of food
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
     * Dispose bubby and clean up
     */
    dispose() {
        if (this.updateObserver) {
            this.scene.onBeforeRenderObservable.remove(this.updateObserver);
            this.updateObserver = null;
        }
        super.dispose();
    }
}