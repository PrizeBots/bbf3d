import { SpawnableObject } from './SpawnableObject.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * Armory - Placeholder building that can be placed by the player
 */
export class Armory extends SpawnableObject {
    constructor(scene, position, shadowGenerator, team = 'red') {
        super(scene, position, shadowGenerator, 150);

        this.team = team;
        this.velocity = 0;
        this.gravity = GameConstants.PHYSICS.GRAVITY;
        this.groundLevel = 1.25; // Half of building height
        this.state = 'falling'; // 'falling', 'placed'
        this.isPaused = false;

        this.create();
        this.enableShadows();
        this.createHealthBar(2.0);
    }

    /**
     * Create the armory mesh (placeholder - wider box)
     */
    create() {
        this.mesh = BABYLON.MeshBuilder.CreateBox(
            `armory_${Date.now()}`,
            {
                width: 3,
                height: 2.5,
                depth: 2.5
            },
            this.scene
        );

        this.mesh.position = this.position.clone();

        // Create armory material (bronze/brown)
        const material = new BABYLON.StandardMaterial(`armoryMat_${Date.now()}`, this.scene);
        material.diffuseColor = new BABYLON.Color3(0.55, 0.4, 0.25); // Bronze

        // Add team colored emissive for visibility
        if (this.team === 'red') {
            material.emissiveColor = new BABYLON.Color3(0.15, 0, 0);
        } else {
            material.emissiveColor = new BABYLON.Color3(0, 0, 0.15);
        }

        this.mesh.material = material;
    }

    /**
     * Update armory state
     */
    update() {
        if (!this.mesh || !this.isActive || this.isPaused) {
            return;
        }

        // Call parent update for healthbar
        super.update();

        if (this.state === 'falling') {
            this.updateFalling();
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
        } else {
            // Landed
            this.mesh.position.y = this.groundLevel;
            this.state = 'placed';
            this.onPlaced();
        }
    }

    /**
     * Called when armory is placed on the ground
     */
    onPlaced() {
        console.log(`Armory placed at (${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.z.toFixed(1)})`);
    }

    /**
     * Pause for dragging
     */
    pauseAI() {
        this.isPaused = true;
    }

    /**
     * Resume after dragging
     */
    resumeAI() {
        this.isPaused = false;
    }
}
