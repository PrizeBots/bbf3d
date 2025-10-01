/**
 * Bush - Mature plant that grows from sprout
 */
class Bush extends SpawnableObject {
    constructor(scene, position, shadowGenerator, onMatureCallback, existingHealthBar = null) {
        // Start with initial max HP of 50, will grow to 100
        super(scene, position, shadowGenerator, 50);

        this.swayPhase = 0;
        this.trunk = null;
        this.foliage = null;
        this.onMatureCallback = onMatureCallback; // Callback when bush matures to tree
        this.growthRate = 4.0; // HP gained per second (1 HP per 0.25 seconds)
        this.hasMatured = false;

        this.create();
        // Shadows are enabled manually in create() for trunk and foliage

        // Use existing health bar or create new one
        if (existingHealthBar) {
            this.healthBar = existingHealthBar;
            this.healthBar.setParentMesh(this.foliage, 1.5); // Offset from foliage center
            // Keep current HP and max HP from sprout (should be 50/50)
            this.maxHealth = this.healthBar.maxHealth;
        } else {
            this.createHealthBar();
        }

        this.setupBehavior();
    }

    /**
     * Override createHealthBar to use foliage mesh as parent
     */
    createHealthBar(offsetY = 1.5) {
        if (!this.foliage) {
            console.warn("Cannot create healthbar without foliage mesh");
            return;
        }
        this.healthBar = new HealthBar(this.scene, this.foliage, this.maxHealth, offsetY);
    }

    /**
     * Create the bush mesh (trunk + foliage)
     */
    create() {
        // Create container for the bush
        this.mesh = new BABYLON.TransformNode(`bush_${Date.now()}`, this.scene);
        this.mesh.position = this.position.clone();
        this.mesh.position.y = 0; // Plant at ground level

        // Create brown trunk
        this.trunk = BABYLON.MeshBuilder.CreateCylinder(
            `bush_trunk_${Date.now()}`,
            {
                diameter: 0.4,
                height: 2.0,
                tessellation: 8
            },
            this.scene
        );
        this.trunk.position.y = 1.0; // Half height above ground
        this.trunk.parent = this.mesh;

        // Brown trunk material
        const trunkMaterial = new BABYLON.StandardMaterial(`trunkMat_${Date.now()}`, this.scene);
        trunkMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.15); // Brown
        trunkMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.05, 0.03);
        this.trunk.material = trunkMaterial;

        // Create green foliage sphere on top
        this.foliage = BABYLON.MeshBuilder.CreateSphere(
            `bush_foliage_${Date.now()}`,
            {
                diameter: 2.0,
                segments: 12
            },
            this.scene
        );
        this.foliage.position.y = 2.3; // On top of trunk
        this.foliage.parent = this.mesh;

        // Green foliage material
        const foliageMaterial = new BABYLON.StandardMaterial(`foliageMat_${Date.now()}`, this.scene);
        foliageMaterial.diffuseColor = new BABYLON.Color3(0.15, 0.6, 0.15); // Dark green
        foliageMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.05);
        this.foliage.material = foliageMaterial;

        // Enable shadows for both parts
        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(this.trunk);
            this.shadowGenerator.addShadowCaster(this.foliage);
        }
    }

    /**
     * Setup idle behavior
     */
    setupBehavior() {
        this.updateObserver = this.scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
    }

    /**
     * Update bush state (growth and gentle swaying)
     */
    update() {
        if (!this.mesh || !this.isActive) {
            return;
        }

        // Call parent update to handle healthbar
        super.update();

        const deltaTime = 0.016; // ~60fps

        // Grow HP over time (both current and max HP grow together)
        if (!this.hasMatured && this.maxHealth < 100) {
            const growthAmount = this.growthRate * deltaTime;
            const newHealth = this.getHealth() + growthAmount;
            const newMaxHealth = this.maxHealth + growthAmount;

            if (newMaxHealth >= 100) {
                // Reached maturity - transform to tree
                this.healthBar.setMaxHealth(100);
                this.maxHealth = 100;
                this.setHealth(100);
                this.hasMatured = true;
                this.mature();
                return; // Stop update after maturing (object is disposed)
            } else {
                // Grow both current and max HP together
                this.healthBar.setMaxHealth(newMaxHealth);
                this.maxHealth = newMaxHealth;
                this.setHealth(newHealth);
            }
        }

        // Gentle swaying animation (less than sprout since it's more sturdy)
        this.swayPhase += 0.015;
        this.mesh.rotation.z = Math.sin(this.swayPhase) * 0.05;
        this.mesh.rotation.x = Math.cos(this.swayPhase * 0.7) * 0.03;
    }

    /**
     * Mature into a tree
     */
    mature() {
        if (this.onMatureCallback) {
            // Pass health bar to tree so it persists
            this.onMatureCallback(this.mesh.position.clone(), this.healthBar);
        }
        this.disposeWithoutHealthBar();
    }

    /**
     * Dispose bush without disposing health bar (for transformation)
     */
    disposeWithoutHealthBar() {
        if (this.updateObserver) {
            this.scene.onBeforeRenderObservable.remove(this.updateObserver);
            this.updateObserver = null;
        }
        if (this.trunk) {
            this.trunk.dispose();
            this.trunk = null;
        }
        if (this.foliage) {
            this.foliage.dispose();
            this.foliage = null;
        }
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }
        this.healthBar = null; // Don't dispose, just unlink
        this.isActive = false;
    }

    /**
     * Dispose bush and clean up
     */
    dispose() {
        if (this.updateObserver) {
            this.scene.onBeforeRenderObservable.remove(this.updateObserver);
            this.updateObserver = null;
        }
        if (this.trunk) {
            this.trunk.dispose();
            this.trunk = null;
        }
        if (this.foliage) {
            this.foliage.dispose();
            this.foliage = null;
        }
        super.dispose();
    }
}