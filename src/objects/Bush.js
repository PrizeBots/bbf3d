import { SpawnableObject } from './SpawnableObject.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * Bush - Mature plant that grows from sprout
 */
export class Bush extends SpawnableObject {
    constructor(scene, position, shadowGenerator, onMatureCallback, existingHealthBar = null, team = null) {
        // Start with initial max HP from constants
        super(scene, position, shadowGenerator, GameConstants.PLANT.BUSH_START_HP);

        this.swayPhase = 0;
        this.trunk = null;
        this.foliage = [];
        this.trunkSegments = [];
        this.onMatureCallback = onMatureCallback; // Callback when bush matures to tree
        this.growthRate = GameConstants.PLANT.BUSH_GROWTH_RATE;
        this.hasMatured = false;
        this.randomSeed = Math.random(); // For consistent randomization per bush

        // Determine team based on position if not provided
        this.team = team || (position.x < 0 ? 'red' : 'blue');

        this.create();
        // Shadows are enabled manually in create() for trunk and foliage

        // Use existing health bar or create new one
        if (existingHealthBar) {
            this.healthBar = existingHealthBar;
            this.healthBar.setParentMesh(this.foliage[0], 1.5); // Use first foliage sphere as parent
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
    createHealthBar(offsetY = 1.0) {
        if (!this.foliage || this.foliage.length === 0) {
            console.warn("Cannot create healthbar without foliage mesh");
            return;
        }
        // Use first foliage sphere as parent
        this.healthBar = new HealthBar(this.scene, this.foliage[0], this.maxHealth, offsetY);
    }

    /**
     * Create the bush mesh (detailed trunk + clustered foliage)
     */
    create() {
        // Create container for the bush
        this.mesh = new BABYLON.TransformNode(`bush_${Date.now()}`, this.scene);
        this.mesh.position = this.position.clone();
        this.mesh.position.y = 0; // Plant at ground level

        // Create varied trunk with multiple segments
        const numSegments = 3;
        const baseHeight = 0.7;
        const segmentHeight = baseHeight / numSegments;

        for (let i = 0; i < numSegments; i++) {
            const segment = BABYLON.MeshBuilder.CreateCylinder(
                `bush_trunk_seg_${Date.now()}_${i}`,
                {
                    diameterTop: 0.35 - i * 0.05 + (this.randomSeed * 0.05),
                    diameterBottom: 0.4 - i * 0.05 + (this.randomSeed * 0.05),
                    height: segmentHeight,
                    tessellation: 8
                },
                this.scene
            );
            segment.position.y = segmentHeight * i + segmentHeight / 2;
            segment.parent = this.mesh;
            this.trunkSegments.push(segment);

            // Varied brown trunk material with less shine
            const trunkMaterial = new BABYLON.StandardMaterial(`trunkMat_${Date.now()}_${i}`, this.scene);
            const brownVariation = this.randomSeed * 0.1;
            trunkMaterial.diffuseColor = new BABYLON.Color3(0.35 + brownVariation, 0.22 + brownVariation * 0.5, 0.12);
            trunkMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05); // Reduced shine
            segment.material = trunkMaterial;

            if (this.shadowGenerator) {
                this.shadowGenerator.addShadowCaster(segment);
            }
        }

        // Create tightly clustered foliage with multiple spheres
        const baseY = baseHeight + 0.15; // Start just above trunk

        // Bottom layer - larger spheres around trunk
        const bottomSpheres = 5 + Math.floor(this.randomSeed * 2); // 5-6 spheres
        for (let i = 0; i < bottomSpheres; i++) {
            const angle = (i / bottomSpheres) * Math.PI * 2 + this.randomSeed * Math.PI;
            const radius = 0.35 + (Math.sin(i * 1.5) * 0.05); // Tight to trunk
            const diameter = 0.75 + (Math.sin(i * 1.7 + this.randomSeed) * 0.15);

            const sphere = BABYLON.MeshBuilder.CreateSphere(
                `bush_foliage_${Date.now()}_bottom_${i}`,
                {
                    diameter: diameter,
                    segments: 10
                },
                this.scene
            );

            sphere.position.x = Math.cos(angle) * radius;
            sphere.position.y = baseY + 0.25;
            sphere.position.z = Math.sin(angle) * radius;
            sphere.parent = this.mesh;
            this.foliage.push(sphere);

            // Varied green foliage material
            const foliageMaterial = new BABYLON.StandardMaterial(`foliageMat_${Date.now()}_bottom_${i}`, this.scene);
            const greenVariation = (Math.sin(i + this.randomSeed) * 0.08);
            foliageMaterial.diffuseColor = new BABYLON.Color3(0.15 + greenVariation, 0.5 + greenVariation * 0.3, 0.15 + greenVariation);
            foliageMaterial.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
            sphere.material = foliageMaterial;

            if (this.shadowGenerator) {
                this.shadowGenerator.addShadowCaster(sphere);
            }
        }

        // Top layer - smaller spheres for fullness
        const topSpheres = 4;
        for (let i = 0; i < topSpheres; i++) {
            const angle = (i / topSpheres) * Math.PI * 2 + this.randomSeed * Math.PI + 0.5;
            const radius = 0.25 + (Math.sin(i * 2.1) * 0.05);
            const diameter = 0.6 + (Math.sin(i * 2.3 + this.randomSeed) * 0.1);

            const sphere = BABYLON.MeshBuilder.CreateSphere(
                `bush_foliage_${Date.now()}_top_${i}`,
                {
                    diameter: diameter,
                    segments: 10
                },
                this.scene
            );

            sphere.position.x = Math.cos(angle) * radius;
            sphere.position.y = baseY + 0.65;
            sphere.position.z = Math.sin(angle) * radius;
            sphere.parent = this.mesh;
            this.foliage.push(sphere);

            // Varied green foliage material
            const foliageMaterial = new BABYLON.StandardMaterial(`foliageMat_${Date.now()}_top_${i}`, this.scene);
            const greenVariation = (Math.sin(i + this.randomSeed + 1) * 0.08);
            foliageMaterial.diffuseColor = new BABYLON.Color3(0.15 + greenVariation, 0.5 + greenVariation * 0.3, 0.15 + greenVariation);
            foliageMaterial.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
            sphere.material = foliageMaterial;

            if (this.shadowGenerator) {
                this.shadowGenerator.addShadowCaster(sphere);
            }
        }

        // Add central top sphere
        const centerTop = BABYLON.MeshBuilder.CreateSphere(
            `bush_foliage_${Date.now()}_center`,
            {
                diameter: 0.55,
                segments: 10
            },
            this.scene
        );
        centerTop.position.y = baseY + 0.85;
        centerTop.parent = this.mesh;
        this.foliage.push(centerTop);

        const centerMaterial = new BABYLON.StandardMaterial(`foliageMat_${Date.now()}_center`, this.scene);
        centerMaterial.diffuseColor = new BABYLON.Color3(0.16, 0.52, 0.16);
        centerMaterial.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
        centerTop.material = centerMaterial;

        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(centerTop);
        }
    }

    /**
     * Setup idle behavior
     */
    setupBehavior() {
        // No longer needed - game loop calls update directly
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

        const deltaTime = this.deltaTime || 0.016; // Use game loop deltaTime

        // Grow HP over time (both current and max HP grow together)
        if (!this.hasMatured && this.maxHealth < GameConstants.PLANT.BUSH_MATURE_HP) {
            const growthAmount = this.growthRate * deltaTime;
            const newHealth = this.getHealth() + growthAmount;
            const newMaxHealth = this.maxHealth + growthAmount;

            if (newMaxHealth >= GameConstants.PLANT.BUSH_MATURE_HP) {
                // Reached maturity - transform to tree
                this.healthBar.setMaxHealth(GameConstants.PLANT.BUSH_MATURE_HP);
                this.maxHealth = GameConstants.PLANT.BUSH_MATURE_HP;
                this.setHealth(GameConstants.PLANT.BUSH_MATURE_HP);
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
            // Pass health bar and team to tree so it persists
            this.onMatureCallback(this.mesh.position.clone(), this.healthBar, this.team);
        }
        this.disposeWithoutHealthBar();
    }

    /**
     * Dispose bush without disposing health bar (for transformation)
     */
    disposeWithoutHealthBar() {
        // updateObserver no longer used

        // Dispose trunk segments
        this.trunkSegments.forEach(segment => segment.dispose());
        this.trunkSegments = [];

        // Dispose foliage spheres
        this.foliage.forEach(sphere => sphere.dispose());
        this.foliage = [];

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
        // updateObserver no longer used

        // Dispose trunk segments
        this.trunkSegments.forEach(segment => segment.dispose());
        this.trunkSegments = [];

        // Dispose foliage spheres
        this.foliage.forEach(sphere => sphere.dispose());
        this.foliage = [];

        super.dispose();
    }
}