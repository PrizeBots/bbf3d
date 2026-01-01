import { SpawnableObject } from './SpawnableObject.js';

/**
 * Sword - Equippable weapon crafted at Armory
 *
 * Can be picked up by AdultBubby to gain combat bonuses.
 * Team-colored for visibility.
 */
export class Sword extends SpawnableObject {
    constructor(scene, position, shadowGenerator, team = 'red') {
        super(scene, position, shadowGenerator, 20); // 20 HP

        this.team = team;
        this.velocity = 0;
        this.gravity = 0.02;
        this.groundLevel = 0.15;
        this.state = 'falling'; // 'falling', 'grounded', 'equipped'
        this.isPaused = false;
        this.isBeingCarried = false;

        // Slight random rotation for variety
        this.randomRotation = Math.random() * Math.PI * 2;

        this.create();
        this.enableShadows();
    }

    /**
     * Create the sword mesh (blade + hilt)
     */
    create() {
        // Root transform
        this.mesh = new BABYLON.TransformNode(`sword_${Date.now()}`, this.scene);
        this.mesh.position = this.position.clone();

        // Blade (flattened box)
        this.bladeMesh = BABYLON.MeshBuilder.CreateBox(
            `swordBlade_${Date.now()}`,
            {
                width: 0.08,
                height: 0.6,
                depth: 0.02
            },
            this.scene
        );
        this.bladeMesh.parent = this.mesh;
        this.bladeMesh.position.y = 0.35;

        // Blade material (silver/steel)
        const bladeMaterial = new BABYLON.StandardMaterial(`bladeMat_${Date.now()}`, this.scene);
        bladeMaterial.diffuseColor = new BABYLON.Color3(0.75, 0.75, 0.8);
        bladeMaterial.specularColor = new BABYLON.Color3(0.9, 0.9, 0.95);
        bladeMaterial.specularPower = 64;
        this.bladeMesh.material = bladeMaterial;

        // Crossguard (horizontal bar)
        this.crossguardMesh = BABYLON.MeshBuilder.CreateBox(
            `swordCrossguard_${Date.now()}`,
            {
                width: 0.2,
                height: 0.04,
                depth: 0.04
            },
            this.scene
        );
        this.crossguardMesh.parent = this.mesh;
        this.crossguardMesh.position.y = 0.05;

        // Crossguard material (team colored)
        const crossguardMaterial = new BABYLON.StandardMaterial(`crossguardMat_${Date.now()}`, this.scene);
        if (this.team === 'red') {
            crossguardMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.2, 0.1);
            crossguardMaterial.emissiveColor = new BABYLON.Color3(0.15, 0, 0);
        } else {
            crossguardMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.2, 0.6);
            crossguardMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0.15);
        }
        this.crossguardMesh.material = crossguardMaterial;

        // Handle (grip)
        this.handleMesh = BABYLON.MeshBuilder.CreateCylinder(
            `swordHandle_${Date.now()}`,
            {
                diameter: 0.06,
                height: 0.15,
                tessellation: 8
            },
            this.scene
        );
        this.handleMesh.parent = this.mesh;
        this.handleMesh.position.y = -0.05;

        // Handle material (brown leather wrap)
        const handleMaterial = new BABYLON.StandardMaterial(`handleMat_${Date.now()}`, this.scene);
        handleMaterial.diffuseColor = new BABYLON.Color3(0.35, 0.2, 0.1);
        this.handleMesh.material = handleMaterial;

        // Lay sword on ground when spawned
        this.mesh.rotation.z = Math.PI / 2;
        this.mesh.rotation.y = this.randomRotation;
    }

    /**
     * Override enableShadows for multiple meshes
     */
    enableShadows() {
        if (this.shadowGenerator) {
            if (this.bladeMesh) this.shadowGenerator.addShadowCaster(this.bladeMesh);
            if (this.crossguardMesh) this.shadowGenerator.addShadowCaster(this.crossguardMesh);
            if (this.handleMesh) this.shadowGenerator.addShadowCaster(this.handleMesh);
        }
    }

    /**
     * Update sword state
     */
    update() {
        if (!this.mesh || !this.isActive || this.isPaused || this.isBeingCarried) {
            return;
        }

        if (this.state === 'falling') {
            this.updateFalling();
        }

        // Gentle spinning when on ground to attract attention
        if (this.state === 'grounded') {
            this.mesh.rotation.y += 0.02;
        }
    }

    /**
     * Update falling state
     */
    updateFalling() {
        if (this.mesh.position.y > this.groundLevel) {
            this.velocity += this.gravity;
            this.mesh.position.y -= this.velocity;

            // Spin while falling
            this.mesh.rotation.y += 0.15;
        } else {
            this.mesh.position.y = this.groundLevel;
            this.state = 'grounded';
            this.velocity = 0;
        }
    }

    /**
     * Check if sword can be picked up
     */
    canBePickedUp() {
        return this.state === 'grounded' && this.isActive && !this.isBeingCarried;
    }

    /**
     * Check if sword can be equipped by a team
     */
    canBeEquippedBy(team) {
        return this.canBePickedUp() && this.team === team;
    }

    /**
     * Get the item type
     */
    getResourceType() {
        return 'sword';
    }

    /**
     * Pause for carrying/equipping
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

    /**
     * Called when equipped by a bubby (sword becomes invisible)
     */
    onEquipped() {
        this.state = 'equipped';
        this.isBeingCarried = true;
        this.setVisible(false);
    }

    /**
     * Set visibility
     */
    setVisible(visible) {
        if (this.bladeMesh) this.bladeMesh.setEnabled(visible);
        if (this.crossguardMesh) this.crossguardMesh.setEnabled(visible);
        if (this.handleMesh) this.handleMesh.setEnabled(visible);
    }

    /**
     * Dispose sword
     */
    dispose() {
        if (this.bladeMesh) {
            this.bladeMesh.dispose();
            this.bladeMesh = null;
        }
        if (this.crossguardMesh) {
            this.crossguardMesh.dispose();
            this.crossguardMesh = null;
        }
        if (this.handleMesh) {
            this.handleMesh.dispose();
            this.handleMesh = null;
        }
        super.dispose();
    }
}
