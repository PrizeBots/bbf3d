/**
 * Seed - Spawnable seed object with falling physics and sprouting behavior
 */
class Seed extends SpawnableObject {
    constructor(scene, position, shadowGenerator, onSproutCallback) {
        // Start with max HP of 5, will grow to 10
        super(scene, position, shadowGenerator, 5);

        this.onSproutCallback = onSproutCallback;
        this.velocity = 0;
        this.gravity = 0.015;
        this.groundLevel = 0.4; // Half of seed height (smaller than egg)
        this.state = 'falling'; // 'falling', 'sinking', 'sprouting', 'growing'
        this.stateTime = 0;
        this.sinkTime = 1.5; // Sink into ground for 1.5 seconds
        this.growthRate = 1.0; // Grow 1 HP per second

        this.create();
        this.enableShadows();
        this.createHealthBar(1.5); // Small offset for seed
        this.setupPhysics();
    }

    /**
     * Create the seed mesh
     */
    create() {
        this.mesh = BABYLON.MeshBuilder.CreateSphere(
            `seed_${Date.now()}`,
            {
                diameter: 0.8,
                segments: 12
            },
            this.scene
        );

        this.mesh.position = this.position.clone();
        this.mesh.scaling = new BABYLON.Vector3(1, 1.2, 1); // Slightly elongated

        // Create seed material
        const seedMaterial = new BABYLON.StandardMaterial(`seedMat_${Date.now()}`, this.scene);
        seedMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.4, 0.2); // Brown
        this.mesh.material = seedMaterial;
    }

    /**
     * Setup falling physics
     */
    setupPhysics() {
        this.updateObserver = this.scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
    }

    /**
     * Update seed state (falling, sinking, sprouting)
     */
    update() {
        if (!this.mesh || !this.isActive) {
            return;
        }

        // Call parent update for healthbar
        super.update();

        const deltaTime = 0.016; // ~60fps

        switch (this.state) {
            case 'falling':
                this.updateFalling();
                break;
            case 'sinking':
                this.updateSinking(deltaTime);
                break;
            case 'sprouting':
                this.updateSprouting(deltaTime);
                break;
        }
    }

    /**
     * Update falling state
     */
    updateFalling() {
        if (this.mesh.position.y > this.groundLevel) {
            // Apply gravity
            this.velocity += this.gravity;
            this.mesh.position.y -= this.velocity;

            // Add gentle rotation while falling
            this.mesh.rotation.z += 0.03;
        } else {
            // Landed - transition to sinking
            this.mesh.position.y = this.groundLevel;
            this.mesh.rotation.z = 0;
            this.state = 'sinking';
            this.stateTime = 0;
        }
    }

    /**
     * Update sinking state (seed sinks into ground and grows)
     */
    updateSinking(deltaTime) {
        this.stateTime += deltaTime;

        // Sink into ground
        const sinkProgress = this.stateTime / this.sinkTime;
        this.mesh.position.y = this.groundLevel * (1 - sinkProgress);

        // Fade out
        this.mesh.material.alpha = 1 - sinkProgress;

        // Grow while sinking (from 5 HP to 10 HP over 1.5 seconds)
        const growthAmount = this.growthRate * deltaTime;
        const newHealth = this.getHealth() + growthAmount;
        const newMaxHealth = this.maxHealth + growthAmount;

        if (newMaxHealth < 10) {
            // Still growing
            this.healthBar.setMaxHealth(newMaxHealth);
            this.maxHealth = newMaxHealth;
            this.setHealth(newHealth);
        } else {
            // Cap at 10 HP
            this.healthBar.setMaxHealth(10);
            this.maxHealth = 10;
            this.setHealth(10);
        }

        // After sink time, immediately sprout
        if (this.stateTime >= this.sinkTime) {
            this.state = 'sprouting';
            this.stateTime = 0;
        }
    }

    /**
     * Update sprouting state (seed disappears and sprout appears)
     */
    updateSprouting(deltaTime) {
        // Immediately spawn sprout and dispose seed
        if (this.onSproutCallback) {
            const sproutPosition = new BABYLON.Vector3(
                this.mesh.position.x,
                0,
                this.mesh.position.z
            );
            // Pass health bar to sprout so it persists
            this.onSproutCallback(sproutPosition, this.healthBar);
        }
        // Dispose without disposing health bar (it's transferred)
        this.disposeWithoutHealthBar();
    }

    /**
     * Dispose seed without disposing health bar (for transformation)
     */
    disposeWithoutHealthBar() {
        if (this.updateObserver) {
            this.scene.onBeforeRenderObservable.remove(this.updateObserver);
            this.updateObserver = null;
        }
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }
        this.healthBar = null; // Don't dispose, just unlink
        this.isActive = false;
    }

    /**
     * Check if seed is still falling
     */
    isFallingActive() {
        return this.isFalling;
    }

    /**
     * Dispose seed and clean up
     */
    dispose() {
        if (this.updateObserver) {
            this.scene.onBeforeRenderObservable.remove(this.updateObserver);
            this.updateObserver = null;
        }
        super.dispose();
    }
}