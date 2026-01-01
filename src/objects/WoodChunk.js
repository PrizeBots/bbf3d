import { SpawnableObject } from './SpawnableObject.js';

/**
 * WoodChunk - Collectible wood resource dropped from dead trees
 *
 * Can be picked up by bubbies and delivered to HQ
 */
export class WoodChunk extends SpawnableObject {
    constructor(scene, position, shadowGenerator, team = null) {
        super(scene, position, shadowGenerator, 10); // 10 HP

        this.team = team;
        this.velocity = 0;
        this.gravity = 0.02;
        this.groundLevel = 0.2; // Half of chunk height
        this.state = 'falling'; // 'falling', 'grounded'
        this.isPaused = false;
        this.isBeingCarried = false;

        // Slight random rotation for variety
        this.randomRotation = Math.random() * Math.PI * 2;

        this.create();
        this.enableShadows();
    }

    /**
     * Create the wood chunk mesh (small log shape)
     */
    create() {
        // Create a small cylinder to represent a log chunk
        this.mesh = BABYLON.MeshBuilder.CreateCylinder(
            `woodChunk_${Date.now()}`,
            {
                diameter: 0.3,
                height: 0.5,
                tessellation: 8
            },
            this.scene
        );

        this.mesh.position = this.position.clone();

        // Lay it on its side
        this.mesh.rotation.x = Math.PI / 2;
        this.mesh.rotation.y = this.randomRotation;

        // Brown wood material
        const material = new BABYLON.StandardMaterial(`woodChunkMat_${Date.now()}`, this.scene);
        material.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.1); // Brown
        material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        this.mesh.material = material;
    }

    /**
     * Update wood chunk state
     */
    update() {
        if (!this.mesh || !this.isActive || this.isPaused || this.isBeingCarried) {
            return;
        }

        if (this.state === 'falling') {
            this.updateFalling();
        }
    }

    /**
     * Update falling state
     */
    updateFalling() {
        if (this.mesh.position.y > this.groundLevel) {
            this.velocity += this.gravity;
            this.mesh.position.y -= this.velocity;

            // Tumble while falling
            this.mesh.rotation.z += 0.1;
        } else {
            this.mesh.position.y = this.groundLevel;
            this.state = 'grounded';
            this.velocity = 0;
        }
    }

    /**
     * Check if wood can be picked up
     */
    canBePickedUp() {
        return this.state === 'grounded' && this.isActive && !this.isBeingCarried;
    }

    /**
     * Get the resource type
     */
    getResourceType() {
        return 'wood';
    }

    /**
     * Pause for carrying
     */
    pauseAI() {
        this.isPaused = true;
    }

    /**
     * Resume after being dropped
     */
    resumeAI() {
        this.isPaused = false;
    }

    /**
     * Set being carried state
     */
    setBeingCarried(carried) {
        this.isBeingCarried = carried;
    }
}
