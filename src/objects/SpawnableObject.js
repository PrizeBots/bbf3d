/**
 * SpawnableObject - Base class for all spawnable game objects
 */
class SpawnableObject {
    constructor(scene, position, shadowGenerator, maxHealth = 100) {
        this.scene = scene;
        this.position = position.clone();
        this.shadowGenerator = shadowGenerator;
        this.mesh = null;
        this.isActive = true;
        this.groundLevel = 0;
        this.maxHealth = maxHealth;
        this.healthBar = null;
    }

    /**
     * Create the mesh - to be implemented by subclasses
     */
    create() {
        throw new Error("create() must be implemented by subclass");
    }

    /**
     * Update object state - to be overridden by subclasses
     */
    update() {
        // Update healthbar position
        if (this.healthBar) {
            this.healthBar.updatePosition();
        }
    }

    /**
     * Create and attach healthbar
     */
    createHealthBar() {
        if (!this.mesh) {
            console.warn("Cannot create healthbar without mesh");
            return;
        }
        this.healthBar = new HealthBar(this.scene, this.mesh, this.maxHealth);
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
}