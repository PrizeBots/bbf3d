import { SpawnableObject } from './SpawnableObject.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * Sprout - Green plant that grows from seed
 */
export class Sprout extends SpawnableObject {
    constructor(scene, position, shadowGenerator, onMatureCallback, existingHealthBar = null, team = null) {
        // Start with initial max HP from constants
        super(scene, position, shadowGenerator, GameConstants.PLANT.SPROUT_START_HP);

        this.growthTime = 0;
        this.swayPhase = 0;
        this.onMatureCallback = onMatureCallback; // Callback when sprout matures to bush
        this.growthRate = GameConstants.PLANT.SPROUT_GROWTH_RATE;
        this.hasMatured = false;

        // Determine team based on position if not provided
        this.team = team || (position.x < 0 ? 'red' : 'blue');

        this.create();
        this.enableShadows();

        // Use existing health bar or create new one
        if (existingHealthBar) {
            this.healthBar = existingHealthBar;
            this.healthBar.setParentMesh(this.mesh, 0.95); // Consistent padding
            // Keep current HP and max HP from seed (should be 10/10)
            this.maxHealth = this.healthBar.maxHealth;
        } else {
            this.createHealthBar(0.95); // Consistent padding: 0.75 height + 0.2 padding
            this.setHealth(GameConstants.PLANT.SPROUT_START_HP);
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
        // No longer needed - game loop calls update directly
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

        const deltaTime = this.deltaTime || 0.016; // Use game loop deltaTime
        this.growthTime += deltaTime;

        // Grow HP over time (both current and max HP grow together)
        if (!this.hasMatured && this.maxHealth < GameConstants.PLANT.SPROUT_MATURE_HP) {
            const growthAmount = this.growthRate * deltaTime;
            const newHealth = this.getHealth() + growthAmount;
            const newMaxHealth = this.maxHealth + growthAmount;

            if (newMaxHealth >= GameConstants.PLANT.SPROUT_MATURE_HP) {
                // Reached maturity - transform to bush
                this.healthBar.setMaxHealth(GameConstants.PLANT.SPROUT_MATURE_HP);
                this.maxHealth = GameConstants.PLANT.SPROUT_MATURE_HP;
                this.setHealth(GameConstants.PLANT.SPROUT_MATURE_HP);
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
            // Pass health bar and team to bush so it persists
            this.onMatureCallback(this.mesh.position.clone(), this.healthBar, this.team);
        }
        this.disposeWithoutHealthBar();
    }

    /**
     * Dispose sprout without disposing health bar (for transformation)
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
     * Dispose sprout and clean up
     */
    dispose() {
        // updateObserver no longer used
        super.dispose();
    }
}