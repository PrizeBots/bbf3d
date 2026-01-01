import { SpawnableObject } from './SpawnableObject.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * Turret - Placeholder building that can be placed by the player
 */
export class Turret extends SpawnableObject {
    constructor(scene, position, shadowGenerator, team = 'red') {
        super(scene, position, shadowGenerator, 100);

        this.team = team;
        this.velocity = 0;
        this.gravity = GameConstants.PHYSICS.GRAVITY;
        this.groundLevel = 1.5; // Half of cube height
        this.state = 'falling'; // 'falling', 'placed'
        this.isPaused = false;

        this.create();
        this.enableShadows();
        this.createHealthBar(2.0);
    }

    /**
     * Create the turret mesh (placeholder cube)
     */
    create() {
        this.mesh = BABYLON.MeshBuilder.CreateBox(
            `turret_${Date.now()}`,
            {
                width: 2,
                height: 3,
                depth: 2
            },
            this.scene
        );

        this.mesh.position = this.position.clone();

        // Create turret material (gray with team-colored accent)
        const material = new BABYLON.StandardMaterial(`turretMat_${Date.now()}`, this.scene);
        material.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45); // Gray metal

        // Add team colored emissive for visibility
        if (this.team === 'red') {
            material.emissiveColor = new BABYLON.Color3(0.2, 0, 0);
        } else {
            material.emissiveColor = new BABYLON.Color3(0, 0, 0.2);
        }

        this.mesh.material = material;
    }

    /**
     * Update turret state
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
     * Called when turret is placed on the ground
     */
    onPlaced() {
        console.log(`Turret placed at (${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.z.toFixed(1)})`);
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
