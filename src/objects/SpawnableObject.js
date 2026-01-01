import { HealthBar } from '../components/HealthBar.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * SpawnableObject - Base class for all spawnable game objects
 */
export class SpawnableObject {
    constructor(scene, position, shadowGenerator, maxHealth = 100) {
        this.scene = scene;
        this.position = position.clone();
        this.shadowGenerator = shadowGenerator;
        this.mesh = null;
        this.isActive = true;
        this.groundLevel = 0;
        this.maxHealth = maxHealth;
        this.healthBar = null;
        this.draggable = false; // Most objects are not draggable by default

        // Physics properties for drag & drop
        this.isBeingDragged = false;
        this.isFallingAfterDrop = false;
        this.fallVelocity = 0;
        this.fallGravity = 0.015;
    }

    /**
     * Create the mesh - to be implemented by subclasses
     */
    create() {
        throw new Error("create() must be implemented by subclass");
    }

    /**
     * Update with delta time - called by game loop
     */
    updateWithDelta(deltaTime) {
        this.deltaTime = deltaTime;
        this.update();
    }

    /**
     * Update object state - to be overridden by subclasses
     */
    update() {
        // Update healthbar position
        if (this.healthBar) {
            this.healthBar.updatePosition();
        }

        // Apply falling physics if object is falling after being dropped
        if (this.isFallingAfterDrop && this.mesh) {
            this.updateFallingPhysics();
        }
    }

    /**
     * Create and attach healthbar
     */
    createHealthBar(offsetY = 2.5) {
        if (!this.mesh) {
            console.warn("Cannot create healthbar without mesh");
            return;
        }
        this.healthBar = new HealthBar(this.scene, this.mesh, this.maxHealth, offsetY);
    }

    /**
     * Transfer health to another object (for transformations like egg->bubby)
     */
    transferHealthTo(targetObject) {
        if (this.healthBar && targetObject) {
            const currentHealth = this.healthBar.getHealth();
            if (targetObject.healthBar) {
                targetObject.healthBar.setHealth(currentHealth);
            }
        }
    }

    /**
     * Get current health
     */
    getHealth() {
        return this.healthBar ? this.healthBar.getHealth() : this.maxHealth;
    }

    /**
     * Set health
     */
    setHealth(health) {
        if (this.healthBar) {
            this.healthBar.setHealth(health);
        }
    }

    /**
     * Take damage
     */
    takeDamage(amount) {
        if (this.healthBar) {
            this.healthBar.takeDamage(amount);

            // Check if dead and dispose
            if (this.healthBar.isDead()) {
                this.dispose();
            }
        }
    }

    /**
     * Enable shadow casting for this object
     */
    enableShadows() {
        if (this.mesh && this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(this.mesh);
        }
    }

    /**
     * Get current position
     */
    getPosition() {
        return this.mesh ? this.mesh.position : this.position;
    }

    /**
     * Set position
     */
    setPosition(position) {
        if (this.mesh) {
            this.mesh.position = position.clone();
        }
        this.position = position.clone();
    }

    /**
     * Check if object is active
     */
    isObjectActive() {
        return this.isActive;
    }

    /**
     * Deactivate object
     */
    deactivate() {
        this.isActive = false;
    }

    /**
     * Dispose object and clean up resources
     */
    dispose() {
        if (this.healthBar) {
            this.healthBar.dispose();
            this.healthBar = null;
        }
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }
        this.isActive = false;
    }

    /**
     * Get mesh instance
     */
    getMesh() {
        return this.mesh;
    }

    /**
     * Check if object is draggable
     */
    isDraggable() {
        return this.draggable;
    }

    /**
     * Set draggable state
     */
    setDraggable(draggable) {
        this.draggable = draggable;
    }

    /**
     * Apply falling physics (for drag & drop)
     */
    updateFallingPhysics() {
        if (this.mesh.position.y > this.groundLevel) {
            // Apply gravity
            this.fallVelocity += this.fallGravity;
            this.mesh.position.y -= this.fallVelocity;

            // Add slight rotation while falling for effect
            this.mesh.rotation.x += 0.02;
        } else {
            // Landed
            this.mesh.position.y = this.groundLevel;
            this.mesh.rotation.x = 0;
            this.isFallingAfterDrop = false;
            this.fallVelocity = 0;
            this.onLanded();
        }
    }

    /**
     * Called when object lands after being dropped - to be overridden by subclasses
     */
    onLanded() {
        // Override in subclasses if needed
    }

    /**
     * Start being dragged - lift object up
     */
    startDrag(liftHeight = 5) {
        this.isBeingDragged = true;
        this.isFallingAfterDrop = false;

        if (this.mesh) {
            // Smoothly lift to drag height
            this.mesh.position.y = liftHeight;
        }
    }

    /**
     * End drag - start falling
     */
    endDrag() {
        this.isBeingDragged = false;
        this.isFallingAfterDrop = true;
        this.fallVelocity = 0;
    }

    /**
     * Pause AI/physics for dragging - to be overridden by subclasses
     */
    pauseAI() {
        // Override in subclasses that have AI/physics
    }

    /**
     * Resume AI/physics after dragging - to be overridden by subclasses
     */
    resumeAI() {
        // Override in subclasses that have AI/physics
    }
}