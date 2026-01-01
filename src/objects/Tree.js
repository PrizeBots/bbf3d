import { SpawnableObject } from './SpawnableObject.js';
import { HealthBar } from '../components/HealthBar.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * Tree - Fully mature plant that grows from bush
 */
export class Tree extends SpawnableObject {
    constructor(scene, position, shadowGenerator, existingHealthBar = null, team = null, onFruitSpawnCallback = null) {
        // Start with initial max HP from constants
        super(scene, position, shadowGenerator, GameConstants.PLANT.TREE_START_HP);

        this.swayPhase = 0;
        this.trunk = null;
        this.foliage = [];
        this.trunkSegments = [];
        this.growthRate = GameConstants.PLANT.TREE_GROWTH_RATE;
        this.hasMatured = false;
        this.randomSeed = Math.random(); // For consistent randomization per tree

        // Determine team based on position if not provided
        this.team = team || (position.x < 0 ? 'red' : 'blue');

        // Fruit spawning
        this.onFruitSpawnCallback = onFruitSpawnCallback;
        this.fruitSpawnTimer = 0;
        this.fruitSpawnInterval = GameConstants.PLANT.TREE_FRUIT_SPAWN_INTERVAL;
        this.maxFruitsOnTree = GameConstants.PLANT.TREE_MAX_FRUITS;
        this.fruitsOnTree = 0; // Current number of fruits on tree

        this.create();
        // Shadows are enabled manually in create() for trunk and foliage

        // Use existing health bar or create new one
        if (existingHealthBar) {
            this.healthBar = existingHealthBar;
            // Use TOP foliage sphere (last one added) as parent
            const topFoliage = this.foliage[this.foliage.length - 1];
            this.healthBar.setParentMesh(topFoliage, 0.7); // Consistent padding above top sphere
            // Keep current HP and max HP from bush (should be 100/100)
            this.maxHealth = this.healthBar.maxHealth;
        } else {
            this.createHealthBar();
        }

        this.setupBehavior();
    }

    /**
     * Override createHealthBar to use TOP foliage mesh as parent
     */
    createHealthBar(offsetY = 0.7) {
        if (!this.foliage || this.foliage.length === 0) {
            console.warn("Cannot create healthbar without foliage mesh");
            return;
        }
        // Use TOP foliage sphere (last one added) as parent
        const topFoliage = this.foliage[this.foliage.length - 1];
        this.healthBar = new HealthBar(this.scene, topFoliage, this.maxHealth, offsetY);
    }

    /**
     * Create the tree mesh (tall trunk with taper + clustered foliage)
     */
    create() {
        // Create container for the tree
        this.mesh = new BABYLON.TransformNode(`tree_${Date.now()}`, this.scene);
        this.mesh.position = this.position.clone();
        this.mesh.position.y = 0; // Plant at ground level

        // Create detailed trunk with tapering segments
        const numTrunkSegments = 5;
        const totalHeight = 3.5;
        const segmentHeight = totalHeight / numTrunkSegments;
        const baseDiameter = 0.6 + this.randomSeed * 0.15;

        for (let i = 0; i < numTrunkSegments; i++) {
            const tapering = 1 - (i / numTrunkSegments) * 0.5; // Tapers to 50% at top
            const variation = Math.sin(i * 2.1 + this.randomSeed * 5) * 0.05;

            const segment = BABYLON.MeshBuilder.CreateCylinder(
                `tree_trunk_seg_${Date.now()}_${i}`,
                {
                    diameterTop: baseDiameter * tapering * 0.85 + variation,
                    diameterBottom: baseDiameter * tapering + variation,
                    height: segmentHeight,
                    tessellation: 10
                },
                this.scene
            );
            segment.position.y = segmentHeight * i + segmentHeight / 2;
            segment.parent = this.mesh;
            this.trunkSegments.push(segment);

            // Varied brown trunk material with bark-like appearance
            const trunkMaterial = new BABYLON.StandardMaterial(`treeTrunkMat_${Date.now()}_${i}`, this.scene);
            const brownVariation = this.randomSeed * 0.08 + i * 0.02;
            trunkMaterial.diffuseColor = new BABYLON.Color3(0.28 + brownVariation, 0.18 + brownVariation * 0.5, 0.09);
            trunkMaterial.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02); // Very little shine for bark
            segment.material = trunkMaterial;

            if (this.shadowGenerator) {
                this.shadowGenerator.addShadowCaster(segment);
            }
        }

        // Create large, tightly-packed foliage cluster
        const baseY = totalHeight + 0.3; // Start just above trunk
        const canopyLayers = 4; // Multiple layers for fuller look
        const spheresPerLayer = [8, 6, 5, 3]; // More at bottom, less at top

        for (let layer = 0; layer < canopyLayers; layer++) {
            const spheresInLayer = spheresPerLayer[layer];
            const layerRadius = 1.0 - layer * 0.2; // Gradually smaller radius going up
            const layerHeight = baseY + layer * 0.6; // Tight vertical spacing
            const sphereSize = 1.2 - layer * 0.15; // Gradually smaller spheres going up

            for (let i = 0; i < spheresInLayer; i++) {
                const angle = (i / spheresInLayer) * Math.PI * 2 + this.randomSeed * Math.PI + layer * 0.8;
                const radius = layerRadius + (Math.sin(i * 1.5 + this.randomSeed) * 0.1); // Small variation
                const heightOffset = (Math.sin(i * 2.3 + layer) * 0.15); // Small height variation

                const diameter = sphereSize + (Math.sin(i * 1.7 + this.randomSeed + layer) * 0.2);
                const sphere = BABYLON.MeshBuilder.CreateSphere(
                    `tree_foliage_${Date.now()}_${layer}_${i}`,
                    {
                        diameter: diameter,
                        segments: 10
                    },
                    this.scene
                );

                sphere.position.x = Math.cos(angle) * radius;
                sphere.position.y = layerHeight + heightOffset;
                sphere.position.z = Math.sin(angle) * radius;
                sphere.parent = this.mesh;
                this.foliage.push(sphere);

                // Varied green foliage material with natural variations
                const foliageMaterial = new BABYLON.StandardMaterial(`treeFoliageMat_${Date.now()}_${layer}_${i}`, this.scene);
                const greenVariation = (Math.sin(i + layer + this.randomSeed) * 0.1);
                foliageMaterial.diffuseColor = new BABYLON.Color3(
                    0.12 + greenVariation,
                    0.45 + greenVariation * 0.3,
                    0.12 + greenVariation * 0.5
                );
                foliageMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05); // Reduced shine
                sphere.material = foliageMaterial;

                if (this.shadowGenerator) {
                    this.shadowGenerator.addShadowCaster(sphere);
                }
            }
        }

        // Add central sphere at top for fullness
        const topSphere = BABYLON.MeshBuilder.CreateSphere(
            `tree_foliage_top_${Date.now()}`,
            {
                diameter: 0.9,
                segments: 10
            },
            this.scene
        );
        topSphere.position.y = baseY + 2.4;
        topSphere.parent = this.mesh;
        this.foliage.push(topSphere);

        const topMaterial = new BABYLON.StandardMaterial(`treeFoliageTopMat_${Date.now()}`, this.scene);
        topMaterial.diffuseColor = new BABYLON.Color3(0.14, 0.48, 0.14);
        topMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        topSphere.material = topMaterial;

        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(topSphere);
        }
    }

    /**
     * Setup idle behavior
     */
    setupBehavior() {
        // No longer needed - game loop calls update directly
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

        const deltaTime = this.deltaTime || 0.016; // Use game loop deltaTime

        // Grow HP over time (both current and max HP grow together)
        if (!this.hasMatured && this.maxHealth < GameConstants.PLANT.TREE_MATURE_HP) {
            const growthAmount = this.growthRate * deltaTime;
            const newHealth = this.getHealth() + growthAmount;
            const newMaxHealth = this.maxHealth + growthAmount;

            if (newMaxHealth >= GameConstants.PLANT.TREE_MATURE_HP) {
                // Reached full maturity
                this.healthBar.setMaxHealth(GameConstants.PLANT.TREE_MATURE_HP);
                this.maxHealth = GameConstants.PLANT.TREE_MATURE_HP;
                this.setHealth(GameConstants.PLANT.TREE_MATURE_HP);
                this.hasMatured = true;
            } else {
                // Grow both current and max HP together
                this.healthBar.setMaxHealth(newMaxHealth);
                this.maxHealth = newMaxHealth;
                this.setHealth(newHealth);
            }
        }

        // Spawn fruits when fully mature
        if (this.hasMatured && this.onFruitSpawnCallback) {
            this.fruitSpawnTimer += deltaTime;

            if (this.fruitSpawnTimer >= this.fruitSpawnInterval && this.fruitsOnTree < this.maxFruitsOnTree) {
                this.spawnFruit();
                this.fruitSpawnTimer = 0;
            }
        }

        // Very gentle swaying animation (minimal for large tree)
        this.swayPhase += 0.01;
        this.mesh.rotation.z = Math.sin(this.swayPhase) * 0.02;
        this.mesh.rotation.x = Math.cos(this.swayPhase * 0.7) * 0.01;
    }

    /**
     * Spawn a fruit on the tree - attached to a random foliage sphere
     */
    spawnFruit() {
        if (!this.onFruitSpawnCallback || !this.foliage || this.foliage.length === 0) {
            return;
        }

        // Pick a random foliage sphere
        const randomFoliage = this.foliage[Math.floor(Math.random() * this.foliage.length)];
        const foliageWorldPos = randomFoliage.getAbsolutePosition();

        // Get tree center position
        const treeCenter = this.mesh.position;

        // Calculate base outward direction from tree center through foliage center
        const baseDirection = foliageWorldPos.subtract(treeCenter);
        baseDirection.normalize();

        // Add some randomness to the direction (still generally outward)
        // This creates variation in fruit positions around the foliage sphere
        const randomAngle1 = (Math.random() - 0.5) * Math.PI * 0.5; // ±45 degrees
        const randomAngle2 = (Math.random() - 0.5) * Math.PI * 0.5; // ±45 degrees

        // Create a random perpendicular vector for variation
        const perpVector1 = new BABYLON.Vector3(-baseDirection.z, 0, baseDirection.x);
        perpVector1.normalize();
        const perpVector2 = BABYLON.Vector3.Cross(baseDirection, perpVector1);
        perpVector2.normalize();

        // Combine base direction with random variations
        const outwardDirection = baseDirection
            .add(perpVector1.scale(Math.sin(randomAngle1) * 0.5))
            .add(perpVector2.scale(Math.sin(randomAngle2) * 0.5));
        outwardDirection.normalize();

        // Get the foliage sphere's radius
        const foliageRadius = randomFoliage.getBoundingInfo().boundingSphere.radiusWorld || 0.6;

        // Position fruit so its center is ON the surface of the foliage sphere
        // This makes it look attached/touching the foliage
        const fruitPosition = new BABYLON.Vector3(
            foliageWorldPos.x + outwardDirection.x * foliageRadius,
            foliageWorldPos.y + outwardDirection.y * foliageRadius,
            foliageWorldPos.z + outwardDirection.z * foliageRadius
        );

        // Call spawn callback
        this.onFruitSpawnCallback(fruitPosition, this.team, this);
        this.fruitsOnTree++;
    }

    /**
     * Called when a fruit falls from this tree
     */
    onFruitFell() {
        this.fruitsOnTree = Math.max(0, this.fruitsOnTree - 1);
    }

    /**
     * Get team
     */
    getTeam() {
        return this.team;
    }

    /**
     * Dispose tree and clean up
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
