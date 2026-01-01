import { SpawnableObject } from './SpawnableObject.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * Seed - Spawnable seed object with falling physics and sprouting behavior
 */
export class Seed extends SpawnableObject {
    constructor(scene, position, shadowGenerator, onSproutCallback, team = null) {
        // Start with max HP of 5, will grow to 10
        super(scene, position, shadowGenerator, 5);

        this.onSproutCallback = onSproutCallback;
        this.velocity = 0;
        this.gravity = GameConstants.PHYSICS.GRAVITY;
        this.groundLevel = 0.4; // Half of seed height (smaller than egg)
        this.state = 'falling'; // 'falling', 'sinking', 'sprouting', 'growing'
        this.stateTime = 0;
        this.sinkTime = GameConstants.PLANT.SEED_SINK_TIME;
        this.growthRate = GameConstants.PLANT.SEED_GROWTH_RATE;
        this.isPaused = false; // For drag system

        // Determine team based on position if not provided (negative X = red, positive X = blue)
        this.team = team || (position.x < 0 ? 'red' : 'blue');

        this.draggable = true; // Seeds are draggable

        this.create();
        this.enableShadows();
        this.createHealthBar(0.6); // Consistent padding: 0.4 radius + 0.2 padding
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
        // No longer needed - game loop calls update directly
    }

    /**
     * Update seed state (falling, sinking, sprouting)
     */
    update() {
        if (!this.mesh || !this.isActive || this.isPaused) {
            return;
        }

        // Call parent update for healthbar
        super.update();

        const deltaTime = this.deltaTime || 0.016; // Use game loop deltaTime

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

        // Grow while sinking (from 5 HP to 10 HP over sink time)
        const growthAmount = this.growthRate * deltaTime;
        const newHealth = this.getHealth() + growthAmount;
        const newMaxHealth = this.maxHealth + growthAmount;

        if (newMaxHealth < GameConstants.PLANT.SPROUT_START_HP) {
            // Still growing
            this.healthBar.setMaxHealth(newMaxHealth);
            this.maxHealth = newMaxHealth;
            this.setHealth(newHealth);
        } else {
            // Cap at sprout starting HP
            this.healthBar.setMaxHealth(GameConstants.PLANT.SPROUT_START_HP);
            this.maxHealth = GameConstants.PLANT.SPROUT_START_HP;
            this.setHealth(GameConstants.PLANT.SPROUT_START_HP);
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
            // Pass health bar and team to sprout so it persists
            this.onSproutCallback(sproutPosition, this.healthBar, this.team);
        }
        // Dispose without disposing health bar (it's transferred)
        this.disposeWithoutHealthBar();
    }

    /**
     * Dispose seed without disposing health bar (for transformation)
     */
    disposeWithoutHealthBar() {
        // updateObserver no longer used
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
     * Start being dragged - lift object up
     */
    startDrag(liftHeight = 8) {
        super.startDrag(liftHeight);
        // Seeds have their own falling physics, so don't use base class falling
        this.isFallingAfterDrop = false;
    }

    /**
     * End drag - reset to falling state
     */
    endDrag() {
        // Don't use base class falling physics
        this.isFallingAfterDrop = false;
        this.isBeingDragged = false;

        // Reset to falling state with seed's own physics
        this.state = 'falling';
        this.velocity = 0;
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
     * Dispose seed and clean up
     */
    dispose() {
        // updateObserver no longer used
        super.dispose();
    }
}