/**
 * Bush - Mature plant that grows from sprout
 */
class Bush extends SpawnableObject {
    constructor(scene, position, shadowGenerator, existingHealthBar = null) {
        super(scene, position, shadowGenerator, 50); // Mature plant with 50 HP

        this.swayPhase = 0;
        this.trunk = null;
        this.foliage = null;

        this.create();
        // Shadows are enabled manually in create() for trunk and foliage

        // Use existing health bar or create new one
        if (existingHealthBar) {
            this.healthBar = existingHealthBar;
            this.healthBar.setParentMesh(this.foliage);
            this.healthBar.setMaxHealth(this.maxHealth);
        } else {
            this.createHealthBar();
        }

        this.setupBehavior();
    }

    /**
     * Override createHealthBar to use foliage mesh as parent
     */
    createHealthBar() {
        if (!this.foliage) {
            console.warn("Cannot create healthbar without foliage mesh");
            return;
        }
        this.healthBar = new HealthBar(this.scene, this.foliage, this.maxHealth);
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
     * Update bush state (gentle swaying)
     */
    update() {
        if (!this.mesh || !this.isActive) {
            return;
        }

        // Call parent update to handle healthbar
        super.update();

        // Gentle swaying animation (less than sprout since it's more sturdy)
        this.swayPhase += 0.015;
        this.mesh.rotation.z = Math.sin(this.swayPhase) * 0.05;
        this.mesh.rotation.x = Math.cos(this.swayPhase * 0.7) * 0.03;
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