import { SpawnableObject } from './SpawnableObject.js';

/**
 * StonePiece - Collectible stone resource dropped from stone deposits
 *
 * Can be picked up by bubbies and delivered to HQ
 */
export class StonePiece extends SpawnableObject {
    constructor(scene, position, shadowGenerator) {
        super(scene, position, shadowGenerator, 10); // 10 HP

        this.velocity = 0;
        this.gravity = 0.025; // Heavier than wood
        this.groundLevel = 0.15; // Half of piece height
        this.state = 'falling'; // 'falling', 'grounded'
        this.isPaused = false;
        this.isBeingCarried = false;

        // Random rotation for variety
        this.randomRotationY = Math.random() * Math.PI * 2;

        this.create();
        this.enableShadows();
    }

    /**
     * Create the stone piece mesh (small irregular rock shape)
     */
    create() {
        // Create a dodecahedron for rocky appearance
        this.mesh = BABYLON.MeshBuilder.CreatePolyhedron(
            `stonePiece_${Date.now()}`,
            {
                type: 2, // Dodecahedron
                size: 0.15
            },
            this.scene
        );

        this.mesh.position = this.position.clone();
        this.mesh.rotation.y = this.randomRotationY;

        // Gray stone material
        const material = new BABYLON.StandardMaterial(`stonePieceMat_${Date.now()}`, this.scene);
        material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.55); // Gray
        material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        this.mesh.material = material;
    }

    /**
     * Update stone piece state
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
            this.mesh.rotation.x += 0.08;
            this.mesh.rotation.z += 0.05;
        } else {
            this.mesh.position.y = this.groundLevel;
            this.state = 'grounded';
            this.velocity = 0;
        }
    }

    /**
     * Check if stone can be picked up
     */
    canBePickedUp() {
        return this.state === 'grounded' && this.isActive && !this.isBeingCarried;
    }

    /**
     * Get the resource type
     */
    getResourceType() {
        return 'stone';
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
