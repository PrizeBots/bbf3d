import { SpawnableObject } from './SpawnableObject.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * Fruit - Food item that falls from mature trees and can be eaten by bubbies
 */
export class Fruit extends SpawnableObject {
    constructor(scene, position, team, shadowGenerator, parentTree = null) {
        // Fruits start at 0 HP and grow to max HP (ripeness)
        super(scene, position, shadowGenerator, GameConstants.FRUIT.MAX_HP);

        this.team = team; // 'red' or 'blue' - determines color
        this.velocity = 0;
        this.gravity = 0.01;
        this.groundLevel = 0.3; // Half of fruit diameter (0.6 / 2)
        this.state = 'ripening'; // 'ripening', 'falling', 'grounded', 'decaying'
        this.stateTime = 0;
        this.ripeningTime = GameConstants.FRUIT.RIPENING_TIME;
        this.ripeningRate = GameConstants.FRUIT.MAX_HP / this.ripeningTime; // HP per second while ripening
        this.decayRate = GameConstants.FRUIT.DECAY_RATE;
        this.isPaused = false;
        this.isBeingEaten = false; // Track if currently being eaten
        this.diedFromEating = false; // Track if HP reached 0 from being eaten
        this.parentTree = parentTree; // Tree that spawned this fruit
        this.onSeedSpawnCallback = null; // Will be set by main.js

        this.draggable = false; // Fruits are not draggable

        this.create();
        this.enableShadows();
        this.createHealthBar(0.5); // Consistent padding: 0.3 radius + 0.2 padding

        // IMPORTANT: Set health to 0 AFTER healthbar is created
        this.setHealth(0);

        this.setupBehavior();
    }

    /**
     * Create the fruit mesh (sphere) - like an apple
     */
    create() {
        this.mesh = BABYLON.MeshBuilder.CreateSphere(
            `fruit_${this.team}_${Date.now()}`,
            {
                diameter: 0.6, // About half foliage sphere size
                segments: 32 // Smooth like an apple
            },
            this.scene
        );

        this.mesh.position = this.position.clone();

        // Create fruit material with 3D apple-like shading
        const fruitMaterial = new BABYLON.StandardMaterial(`fruitMat_${this.team}_${Date.now()}`, this.scene);

        if (this.team === 'red') {
            fruitMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.1); // Apple red
            fruitMaterial.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6); // Shiny highlight
            fruitMaterial.specularPower = 32; // Sharp highlights
            fruitMaterial.ambientColor = new BABYLON.Color3(0.3, 0.1, 0.1); // Subtle ambient
        } else {
            fruitMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.9); // Blueberry blue
            fruitMaterial.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6); // Shiny highlight
            fruitMaterial.specularPower = 32; // Sharp highlights
            fruitMaterial.ambientColor = new BABYLON.Color3(0.1, 0.2, 0.3); // Subtle ambient
        }

        this.mesh.material = fruitMaterial;
    }

    /**
     * Setup behavior
     */
    setupBehavior() {
        // No longer needed - game loop calls update directly
    }

    /**
     * Update fruit state
     */
    update() {
        if (!this.mesh || !this.isActive || this.isPaused) {
            return;
        }

        // IMPORTANT: Call parent update to keep healthbar following mesh
        super.update();

        const deltaTime = this.deltaTime || 0.016; // Use game loop deltaTime
        this.stateTime += deltaTime;

        switch (this.state) {
            case 'ripening':
                this.updateRipening(deltaTime);
                break;
            case 'falling':
                this.updateFalling();
                break;
            case 'decaying':
                this.updateDecaying(deltaTime);
                break;
        }
    }

    /**
     * Update ripening state - fruit HP grows as it ripens
     */
    updateRipening(deltaTime) {
        // Grow HP while ripening
        const hpGrowth = this.ripeningRate * deltaTime;
        const newHealth = Math.min(this.maxHealth, this.getHealth() + hpGrowth);
        this.setHealth(newHealth);

        // When fully ripe (max HP), fall off
        if (this.getHealth() >= this.maxHealth) {
            this.state = 'falling';
            this.velocity = 0;

            // Add some horizontal velocity for wider spread
            const randomAngle = Math.random() * Math.PI * 2;
            const randomDistance = 2 + Math.random() * 3; // 2-5 units away
            this.horizontalVelocity = new BABYLON.Vector3(
                Math.cos(randomAngle) * randomDistance * 0.05,
                0,
                Math.sin(randomAngle) * randomDistance * 0.05
            );

            // Notify parent tree that fruit fell
            if (this.parentTree && this.parentTree.onFruitFell) {
                this.parentTree.onFruitFell();
                this.parentTree = null; // Clear reference
            }
        }
    }

    /**
     * Update falling state
     */
    updateFalling() {
        if (this.mesh.position.y > this.groundLevel) {
            // Apply gravity
            this.velocity += this.gravity;
            this.mesh.position.y -= this.velocity;

            // Apply horizontal velocity for spread
            if (this.horizontalVelocity) {
                this.mesh.position.x += this.horizontalVelocity.x;
                this.mesh.position.z += this.horizontalVelocity.z;
            }

            // Add rotation while falling
            this.mesh.rotation.x += 0.05;
            this.mesh.rotation.z += 0.03;
        } else {
            // Landed - start decaying
            this.mesh.position.y = this.groundLevel;
            this.mesh.rotation.x = 0;
            this.mesh.rotation.z = 0;
            this.state = 'decaying';
            this.stateTime = 0;
            this.horizontalVelocity = null; // Clear velocity
        }
    }

    /**
     * Update decaying state - fruit loses HP while on ground
     */
    updateDecaying(deltaTime) {
        // NO SIZE CHANGE - fruit stays constant size
        // Just decay HP over time (unless currently being eaten)
        if (!this.isBeingEaten) {
            const hpLoss = this.decayRate * deltaTime;
            this.takeDamage(hpLoss);
        }
    }

    /**
     * Check if fruit can be eaten (decaying on ground OR still ripening on tree)
     */
    canBeEaten() {
        // Fruits can be eaten when decaying OR when ripening (bubbies love them so much they'll eat them off the tree!)
        return (this.state === 'decaying' || this.state === 'ripening') && this.isActive && this.getHealth() > 0;
    }

    /**
     * Called when a bubby eats this fruit
     * Returns the amount of HP the fruit provides
     */
    getEaten(hpAmount) {
        if (!this.canBeEaten()) {
            return 0;
        }

        // Mark as being eaten
        this.isBeingEaten = true;
        this.diedFromEating = true; // Track that if it dies, it's from being eaten

        // Calculate how much HP to give (up to the amount requested and available)
        const hpToGive = Math.min(hpAmount, this.getHealth());

        // Reduce fruit HP
        this.takeDamage(hpToGive);

        // Scaling is handled by update methods for each state

        // Allow eating again next frame
        this.isBeingEaten = false;

        return hpToGive;
    }

    /**
     * Override takeDamage to handle fruit depletion
     */
    takeDamage(amount) {
        super.takeDamage(amount);

        // When fruit HP reaches 0
        if (this.getHealth() <= 0) {
            // If died from natural decay (not being eaten), spawn a seed
            if (!this.diedFromEating && this.onSeedSpawnCallback && this.mesh) {
                const seedPosition = this.mesh.position.clone();
                seedPosition.y = 30; // High enough to drop
                this.onSeedSpawnCallback(seedPosition, this.team);
            }
            this.dispose();
        }
    }

    /**
     * Get team
     */
    getTeam() {
        return this.team;
    }

    /**
     * Dispose fruit and clean up
     */
    dispose() {
        // updateObserver no longer used
        super.dispose();
    }
}
