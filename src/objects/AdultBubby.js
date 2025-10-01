/**
 * AdultBubby - Mature bubby with blob head on capsule body
 */
class AdultBubby extends SpawnableObject {
    constructor(scene, position, team, shadowGenerator, getAllPlants, getAllBubbies, initialHealth = 100) {
        super(scene, position, shadowGenerator, 100); // 100 max health

        this.team = team; // 'red' or 'blue'
        this.getAllPlants = getAllPlants; // Function to get all plants in the scene
        this.getAllBubbies = getAllBubbies; // Function to get all other bubbies
        this.idleTime = 0;
        this.moveSpeed = 0.1; // Faster movement for adult
        this.squishPhase = 0;
        this.bobPhase = 0;

        // AI behavior
        this.state = 'idle'; // 'idle', 'wandering', 'moving_to_target', 'attacking'
        this.target = null;
        this.sensingRange = 20; // Longer sensing range for adult
        this.attackRange = 2.5; // Slightly longer attack range
        this.attackCooldown = 0;
        this.attackInterval = 0.8; // Attack faster than baby (every 0.8 seconds)
        this.attackDamage = 2; // More damage per attack

        // Wandering behavior
        this.wanderTarget = null;
        this.wanderTime = 0;
        this.wanderDuration = 4.0; // Wander for longer periods

        // Growth
        this.baseSize = 1.0;
        this.currentSize = 1.0;
        this.growthAmount = 0;
        this.maxGrowth = 1.8; // Can grow larger as adult

        // Body parts
        this.body = null;
        this.head = null;

        this.create();
        this.enableShadows();
        this.createHealthBar(); // Uses head as parent with offset

        // Set initial health
        if (initialHealth) {
            this.setHealth(initialHealth);
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
        this.mesh.position.y = 0; // Ground level

        // Create capsule body (height includes rounded caps)
        this.body = BABYLON.MeshBuilder.CreateCapsule(
            `adult_bubby_body_${this.team}_${Date.now()}`,
            {
                radius: 0.4,
                height: 1.2,
                tessellation: 16
            },
            this.scene
        );
        this.body.position.y = 0.6; // Half of height (1.2/2 = 0.6) to sit on ground
        this.body.parent = this.mesh;

        // Create blob head (sphere)
        this.head = BABYLON.MeshBuilder.CreateSphere(
            `adult_bubby_head_${this.team}_${Date.now()}`,
            {
                diameter: 0.8,
                segments: 16
            },
            this.scene
        );
        this.head.position.y = 1.4; // On top of body (0.6 + 0.6 + 0.4/2 - 0.4/2 = 1.2 + 0.2)
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

        material.alpha = 0.9; // Slightly translucent like slime
        this.body.material = material;
        this.head.material = material;
    }

    /**
     * Override createHealthBar to use head mesh as parent
     */
    createHealthBar(offsetY = 0.8) {
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
        this.updateObserver = this.scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
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

        // Constrain to arena bounds
        this.constrainToArena();

        // Apply animations based on current size
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
            this.head.position.y = 1.4 + Math.sin(this.bobPhase) * 0.05;
        }

        // Gentle rocking motion
        if (this.mesh) {
            this.mesh.rotation.z = Math.sin(this.squishPhase * 0.5) * 0.08;
        }
    }

    /**
     * Update idle state - sense for nearby plants or start wandering
     */
    updateIdle() {
        // Only hunt if not at full HP (adult bubbies only eat to heal)
        if (this.getHealth() < this.maxHealth) {
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
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 25;

        this.wanderTarget = new BABYLON.Vector3(
            this.mesh.position.x + Math.cos(angle) * distance,
            0,
            this.mesh.position.z + Math.sin(angle) * distance
        );

        // Clamp to arena bounds
        const maxDist = 60;
        this.wanderTarget.x = Math.max(-maxDist, Math.min(maxDist, this.wanderTarget.x));
        this.wanderTarget.z = Math.max(-maxDist, Math.min(maxDist, this.wanderTarget.z));
    }

    /**
     * Update wandering state - meander around the arena
     */
    updateWandering(deltaTime) {
        this.wanderTime += deltaTime;

        // Check if we sense a plant while wandering (only if not at full HP)
        if (this.getHealth() < this.maxHealth) {
            const nearestPlant = this.findNearestPlant();
            if (nearestPlant) {
                this.target = nearestPlant;
                this.state = 'moving_to_target';
                this.wanderTarget = null;
                return;
            }
        }

        // Pick new wander target after duration
        if (this.wanderTime >= this.wanderDuration || !this.wanderTarget) {
            this.pickWanderTarget();
            this.wanderTime = 0;
        }

        // Move toward wander target
        if (this.wanderTarget) {
            const direction = this.wanderTarget.subtract(this.mesh.position);
            const distance = direction.length();

            if (distance < 2) {
                this.state = 'idle';
                this.wanderTarget = null;
                return;
            }

            direction.normalize();

            const avoidanceVector = this.calculateAvoidance();
            if (avoidanceVector) {
                direction.x = direction.x * 0.6 + avoidanceVector.x * 0.4;
                direction.z = direction.z * 0.6 + avoidanceVector.z * 0.4;
                direction.normalize();
            }

            this.mesh.position.x += direction.x * this.moveSpeed;
            this.mesh.position.z += direction.z * this.moveSpeed;
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

        if (distance <= this.attackRange) {
            this.state = 'attacking';
            return;
        }

        if (distance > this.sensingRange) {
            this.target = null;
            this.state = 'idle';
            return;
        }

        direction.normalize();

        const avoidanceVector = this.calculateAvoidance();
        if (avoidanceVector) {
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
        const avoidanceRadius = 3.0;
        let avoidanceVector = new BABYLON.Vector3(0, 0, 0);
        let hasCollision = false;

        for (const other of bubbies) {
            if (other === this || !other.isActive) {
                continue;
            }

            const toOther = other.mesh.position.subtract(this.mesh.position);
            const distance = toOther.length();

            if (distance < avoidanceRadius && distance > 0) {
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

        if (distance > this.attackRange) {
            this.state = 'moving_to_target';
            return;
        }

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

        this.target.takeDamage(this.attackDamage);
        this.grow();

        if (!this.target.isActive) {
            this.target = null;
            this.state = 'idle';
        }
    }

    /**
     * Find the nearest plant within sensing range
     */
    findNearestPlant() {
        if (!this.getAllPlants) {
            return null;
        }

        const plants = this.getAllPlants();
        let nearestPlant = null;
        let nearestDistance = this.sensingRange;

        for (const plant of plants) {
            if (!plant.isActive) {
                continue;
            }

            const distance = BABYLON.Vector3.Distance(
                this.mesh.position,
                plant.mesh.position
            );

            if (distance <= nearestDistance) {
                nearestDistance = distance;
                nearestPlant = plant;
            }
        }

        return nearestPlant;
    }

    /**
     * Constrain position to arena bounds
     */
    constrainToArena() {
        if (!this.mesh) {
            return;
        }

        // Arena bounds (grass field is roughly -60 to 60 in X and Z)
        const maxX = 60;
        const maxZ = 60;

        if (this.mesh.position.x < -maxX) {
            this.mesh.position.x = -maxX;
            this.wanderTarget = null; // Reset wander target if hit boundary
        } else if (this.mesh.position.x > maxX) {
            this.mesh.position.x = maxX;
            this.wanderTarget = null;
        }

        if (this.mesh.position.z < -maxZ) {
            this.mesh.position.z = -maxZ;
            this.wanderTarget = null;
        } else if (this.mesh.position.z > maxZ) {
            this.mesh.position.z = maxZ;
            this.wanderTarget = null;
        }
    }

    /**
     * Grow the adult bubby when it eats
     */
    grow() {
        const growthIncrement = 0.015;
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
     * Dispose adult bubby and clean up
     */
    dispose() {
        if (this.updateObserver) {
            this.scene.onBeforeRenderObservable.remove(this.updateObserver);
            this.updateObserver = null;
        }
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
