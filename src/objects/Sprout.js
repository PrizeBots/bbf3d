/**
 * Sprout - Green plant that grows from seed
 */
class Sprout extends SpawnableObject {
    constructor(scene, position, shadowGenerator, onMatureCallback, existingHealthBar = null) {
        super(scene, position, shadowGenerator, 50);

        this.growthTime = 0;
        this.swayPhase = 0;
        this.onMatureCallback = onMatureCallback; // Callback when sprout matures to bush
        this.growthRate = 4.0; // HP gained per second (1 HP per 0.25 seconds)
        this.hasMatured = false;

        this.create();
        this.enableShadows();

        // Use existing health bar or create new one
        if (existingHealthBar) {
            this.healthBar = existingHealthBar;
            this.healthBar.setParentMesh(this.mesh);
            this.healthBar.setMaxHealth(this.maxHealth);
        } else {
            this.createHealthBar();
            this.setHealth(10); // Default starting health
        }

        this.setupGrowthBehavior();
    }

    /**
     * Create the sprout mesh
     */
    create() {
        // Create a simple plant using a cone for the sprout
        const sprout = BABYLON.MeshBuilder.CreateCylinder(
            `sprout_${Date.now()}`,
            {
                diameterTop: 0.1,
                diameterBottom: 0.3,
                height: 1.5,
                tessellation: 8
            },
            this.scene
        );

        sprout.position = this.position.clone();
        sprout.position.y = 0.75; // Half height above ground

        // Green sprout material
        const sproutMaterial = new BABYLON.StandardMaterial(`sproutMat_${Date.now()}`, this.scene);
        sproutMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2); // Bright green
        sproutMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.05);
        sprout.material = sproutMaterial;

        this.mesh = sprout;

        // Add leaves at top
        this.createLeaves();
    }

    /**
     * Create simple leaves
     */
    createLeaves() {
        const leafPositions = [
            new BABYLON.Vector3(0.3, 0.6, 0),
            new BABYLON.Vector3(-0.3, 0.5, 0),
            new BABYLON.Vector3(0, 0.7, 0.3)
        ];

        leafPositions.forEach((pos, index) => {
            const leaf = BABYLON.MeshBuilder.CreateBox(
                `leaf_${index}`,
                { width: 0.5, height: 0.1, depth: 0.2 },
                this.scene
            );
            leaf.position = pos;
            leaf.parent = this.mesh;

            const leafMaterial = new BABYLON.StandardMaterial(`leafMat_${index}`, this.scene);
            leafMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.9, 0.3);
            leaf.material = leafMaterial;
        });
    }

    /**
     * Setup growth and idle behavior
     */
    setupGrowthBehavior() {
        this.updateObserver = this.scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
    }

    /**
     * Update sprout state (swaying animation and growth)
     */
    update() {
        if (!this.mesh || !this.isActive) {
            return;
        }

        // Call parent update to handle healthbar
        super.update();

        const deltaTime = 0.016; // ~60fps
        this.growthTime += deltaTime;

        // Grow HP over time
        if (!this.hasMatured && this.getHealth() < this.maxHealth) {
            const currentHealth = this.getHealth();
            const newHealth = currentHealth + (this.growthRate * deltaTime);

            if (newHealth >= this.maxHealth) {
                // Reached maturity - transform to bush
                this.setHealth(this.maxHealth);
                this.hasMatured = true;
                this.mature();
                return; // Stop update after maturing (object is disposed)
            } else {
                this.setHealth(newHealth);
            }
        }

        // Gentle swaying animation
        if (this.mesh) {
            this.swayPhase += 0.02;
            this.mesh.rotation.z = Math.sin(this.swayPhase) * 0.1;
            this.mesh.rotation.x = Math.cos(this.swayPhase * 0.7) * 0.05;
        }
    }

    /**
     * Mature into a bush
     */
    mature() {
        if (this.onMatureCallback) {
            // Pass health bar to bush so it persists
            this.onMatureCallback(this.mesh.position.clone(), this.healthBar);
        }
        this.disposeWithoutHealthBar();
    }

    /**
     * Dispose sprout without disposing health bar (for transformation)
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
     * Dispose sprout and clean up
     */
    dispose() {
        if (this.updateObserver) {
            this.scene.onBeforeRenderObservable.remove(this.updateObserver);
            this.updateObserver = null;
        }
        super.dispose();
    }
}