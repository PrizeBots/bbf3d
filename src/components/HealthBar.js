/**
 * HealthBar - Visual health indicator for game objects
 */
export class HealthBar {
    constructor(scene, parentMesh, maxHealth = 100, offsetY = 2.5) {
        this.scene = scene;
        this.parentMesh = parentMesh;
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.container = null;
        this.background = null;
        this.healthBar = null;
        this.offsetY = offsetY; // Height above parent

        this.create();
    }

    /**
     * Create healthbar visuals
     */
    create() {
        // Container for healthbar
        this.container = new BABYLON.TransformNode("healthbar_container", this.scene);

        // Calculate width based on max HP (base width of 0.03 per HP)
        const baseWidth = this.maxHealth * 0.03;
        const barHeight = 0.2;

        // Background (black border)
        this.background = BABYLON.MeshBuilder.CreatePlane(
            "healthbar_bg",
            { width: baseWidth, height: barHeight },
            this.scene
        );
        this.background.parent = this.container;
        this.background.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; // Always face camera

        const bgMaterial = new BABYLON.StandardMaterial("healthbar_bg_mat", this.scene);
        bgMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        bgMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        this.background.material = bgMaterial;

        // Health bar (green line that changes color)
        this.healthBar = BABYLON.MeshBuilder.CreatePlane(
            "healthbar",
            { width: baseWidth * 0.93, height: barHeight * 0.75 },
            this.scene
        );
        this.healthBar.parent = this.container;
        this.healthBar.position.z = -0.01; // Slightly in front of background
        this.healthBar.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const healthMaterial = new BABYLON.StandardMaterial("healthbar_mat", this.scene);
        healthMaterial.diffuseColor = new BABYLON.Color3(0.2, 1, 0.2); // Green
        healthMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.5, 0.1);
        this.healthBar.material = healthMaterial;

        // Initial position update
        this.updatePosition();
    }

    /**
     * Update health value and visual
     */
    setHealth(health) {
        this.currentHealth = Math.max(0, Math.min(health, this.maxHealth));
        this.updateHealthBarVisual();
    }

    /**
     * Update max health and resize the health bar
     */
    setMaxHealth(newMaxHealth) {
        this.maxHealth = newMaxHealth;
        this.currentHealth = Math.min(this.currentHealth, this.maxHealth);
        this.updateHealthBarSize();
        this.updateHealthBarVisual();
    }

    /**
     * Get current health
     */
    getHealth() {
        return this.currentHealth;
    }

    /**
     * Update healthbar size based on max HP
     */
    updateHealthBarSize() {
        const baseWidth = this.maxHealth * 0.03;
        const barHeight = 0.2;

        // Dispose old meshes and recreate with new size
        if (this.background) {
            this.background.dispose();
        }
        if (this.healthBar) {
            this.healthBar.dispose();
        }

        // Background (black border)
        this.background = BABYLON.MeshBuilder.CreatePlane(
            "healthbar_bg",
            { width: baseWidth, height: barHeight },
            this.scene
        );
        this.background.parent = this.container;
        this.background.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const bgMaterial = new BABYLON.StandardMaterial("healthbar_bg_mat", this.scene);
        bgMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        bgMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        this.background.material = bgMaterial;

        // Health bar
        this.healthBar = BABYLON.MeshBuilder.CreatePlane(
            "healthbar",
            { width: baseWidth * 0.93, height: barHeight * 0.75 },
            this.scene
        );
        this.healthBar.parent = this.container;
        this.healthBar.position.z = -0.01;
        this.healthBar.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const healthMaterial = new BABYLON.StandardMaterial("healthbar_mat", this.scene);
        healthMaterial.diffuseColor = new BABYLON.Color3(0.2, 1, 0.2);
        healthMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.5, 0.1);
        this.healthBar.material = healthMaterial;

        // Update position after resizing
        this.updatePosition();
    }

    /**
     * Update the parent mesh the health bar follows
     */
    setParentMesh(newParentMesh, offsetY = null) {
        this.parentMesh = newParentMesh;
        if (offsetY !== null) {
            this.offsetY = offsetY;
        }
        this.updatePosition();
    }

    /**
     * Update healthbar visual based on current health
     */
    updateHealthBarVisual() {
        const healthPercent = this.currentHealth / this.maxHealth;

        // Scale the health bar
        this.healthBar.scaling.x = healthPercent;

        // Position adjustment to keep left-aligned
        const baseWidth = this.maxHealth * 0.03 * 0.93;
        const offset = (1 - healthPercent) * (baseWidth / 2);
        this.healthBar.position.x = -offset;

        // Color changes based on health
        let color;
        if (healthPercent > 0.6) {
            // Green
            color = new BABYLON.Color3(0.2, 1, 0.2);
        } else if (healthPercent > 0.3) {
            // Yellow/Orange
            color = new BABYLON.Color3(1, 0.8, 0);
        } else {
            // Red
            color = new BABYLON.Color3(1, 0.2, 0.2);
        }

        this.healthBar.material.diffuseColor = color;
        this.healthBar.material.emissiveColor = color.scale(0.5);
    }

    /**
     * Update position to follow parent
     */
    updatePosition() {
        if (this.parentMesh && this.container) {
            const offset = new BABYLON.Vector3(0, this.offsetY, 0);
            // Use absolutePosition for meshes with parents (like bush foliage)
            const parentPosition = this.parentMesh.absolutePosition || this.parentMesh.position;
            this.container.position = parentPosition.add(offset);
        }
    }

    /**
     * Show healthbar
     */
    show() {
        if (this.container) {
            this.container.setEnabled(true);
        }
    }

    /**
     * Hide healthbar
     */
    hide() {
        if (this.container) {
            this.container.setEnabled(false);
        }
    }

    /**
     * Damage the object
     */
    takeDamage(amount) {
        this.setHealth(this.currentHealth - amount);
    }

    /**
     * Heal the object
     */
    heal(amount) {
        this.setHealth(this.currentHealth + amount);
    }

    /**
     * Check if dead
     */
    isDead() {
        return this.currentHealth <= 0;
    }

    /**
     * Dispose healthbar
     */
    dispose() {
        if (this.healthBar) {
            this.healthBar.dispose();
        }
        if (this.background) {
            this.background.dispose();
        }
        if (this.container) {
            this.container.dispose();
        }
    }
}