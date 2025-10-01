/**
 * Tree - Fully mature plant that grows from bush
 */
class Tree extends SpawnableObject {
    constructor(scene, position, shadowGenerator, existingHealthBar = null) {
        // Start with initial max HP of 100, will grow to 200
        super(scene, position, shadowGenerator, 100);

        this.swayPhase = 0;
        this.trunk = null;
        this.foliage = null;
        this.growthRate = 4.0; // HP gained per second (1 HP per 0.25 seconds)
        this.hasMatured = false;

        this.create();
        // Shadows are enabled manually in create() for trunk and foliage

        // Use existing health bar or create new one
        if (existingHealthBar) {
            this.healthBar = existingHealthBar;
            this.healthBar.setParentMesh(this.foliage, 2.0); // Higher offset for tree
            // Keep current HP and max HP from bush (should be 100/100)
            this.maxHealth = this.healthBar.maxHealth;
        } else {
            this.createHealthBar();
        }

        this.setupBehavior();
    }

    /**
     * Override createHealthBar to use foliage mesh as parent
     */
    createHealthBar(offsetY = 2.0) {
        if (!this.foliage) {
            console.warn("Cannot create healthbar without foliage mesh");
            return;
        }
        this.healthBar = new HealthBar(this.scene, this.foliage, this.maxHealth, offsetY);
    }

    /**
     * Create the tree mesh (tall trunk + foliage)
     */
    create() {
        // Create container for the tree
        this.mesh = new BABYLON.TransformNode(`tree_${Date.now()}`, this.scene);
        this.mesh.position = this.position.clone();
        this.mesh.position.y = 0; // Plant at ground level

        // Create tall brown trunk
        this.trunk = BABYLON.MeshBuilder.CreateCylinder(
            `tree_trunk_${Date.now()}`,
            {
                diameter: 0.6,
                height: 4.0,
                tessellation: 12
            },
            this.scene
        );
        this.trunk.position.y = 2.0; // Half height above ground
        this.trunk.parent = this.mesh;

        // Brown trunk material
        const trunkMaterial = new BABYLON.StandardMaterial(`treeTrunkMat_${Date.now()}`, this.scene);
        trunkMaterial.diffuseColor = new BABYLON.Color3(0.35, 0.2, 0.1); // Darker brown
        trunkMaterial.emissiveColor = new BABYLON.Color3(0.08, 0.04, 0.02);
        this.trunk.material = trunkMaterial;

        // Create large green foliage sphere on top
        this.foliage = BABYLON.MeshBuilder.CreateSphere(
            `tree_foliage_${Date.now()}`,
            {
                diameter: 3.0,
                segments: 16
            },
            this.scene
        );
        this.foliage.position.y = 5.5; // On top of trunk
        this.foliage.parent = this.mesh;

        // Green foliage material
        const foliageMaterial = new BABYLON.StandardMaterial(`treeFoliageMat_${Date.now()}`, this.scene);
        foliageMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.5, 0.1); // Dark green
        foliageMaterial.emissiveColor = new BABYLON.Color3(0.03, 0.15, 0.03);
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
     * Update tree state (growth and gentle swaying)
     */
    update() {
        if (!this.mesh || !this.isActive) {
            return;
        }

        // Call parent update to handle healthbar
        super.update();

        const deltaTime = 0.016; // ~60fps

        // Grow HP over time (both current and max HP grow together)
        if (!this.hasMatured && this.maxHealth < 200) {
            const growthAmount = this.growthRate * deltaTime;
            const newHealth = this.getHealth() + growthAmount;
            const newMaxHealth = this.maxHealth + growthAmount;

            if (newMaxHealth >= 200) {
                // Reached full maturity
                this.healthBar.setMaxHealth(200);
                this.maxHealth = 200;
                this.setHealth(200);
                this.hasMatured = true;
            } else {
                // Grow both current and max HP together
                this.healthBar.setMaxHealth(newMaxHealth);
                this.maxHealth = newMaxHealth;
                this.setHealth(newHealth);
            }
        }

        // Very gentle swaying animation (minimal for large tree)
        this.swayPhase += 0.01;
        this.mesh.rotation.z = Math.sin(this.swayPhase) * 0.02;
        this.mesh.rotation.x = Math.cos(this.swayPhase * 0.7) * 0.01;
    }

    /**
     * Dispose tree and clean up
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
