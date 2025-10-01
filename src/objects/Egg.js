/**
 * Egg - Spawnable egg object with falling physics and hatching behavior
 */
class Egg extends SpawnableObject {
    constructor(scene, position, team, shadowGenerator, onHatchCallback) {
        super(scene, position, shadowGenerator, 100); // 100 max health

        this.team = team; // 'red' or 'blue'
        this.onHatchCallback = onHatchCallback;
        this.velocity = 0;
        this.gravity = 0.015;
        this.groundLevel = 1.3; // Half of egg height (bigger than seed)
        this.isFalling = true;
        this.state = 'falling'; // 'falling', 'wiggling', 'cracking', 'hatching'
        this.stateTime = 0;
        this.wiggleTime = 2.0; // Wiggle for 2 seconds
        this.crackTime = 1.0; // Crack for 1 second

        this.create();
        this.enableShadows();
        this.createHealthBar();
        this.setupPhysics();
    }

    /**
     * Create the egg mesh
     */
    create() {
        this.mesh = BABYLON.MeshBuilder.CreateSphere(
            `egg_${this.team}_${Date.now()}`,
            {
                diameter: 2.0,
                segments: 16
            },
            this.scene
        );

        this.mesh.position = this.position.clone();
        this.mesh.scaling = new BABYLON.Vector3(1, 1.3, 1); // Make it egg-shaped

        // Create egg material with team-colored tint
        const eggMaterial = new BABYLON.StandardMaterial(`eggMat_${this.team}_${Date.now()}`, this.scene);

        if (this.team === 'red') {
            eggMaterial.diffuseColor = new BABYLON.Color3(0.95, 0.75, 0.75); // Reddish tint
        } else {
            eggMaterial.diffuseColor = new BABYLON.Color3(0.75, 0.85, 0.95); // Bluish tint
        }

        this.mesh.material = eggMaterial;
    }

    /**
     * Setup falling physics
     */
    setupPhysics() {
        this.updateObserver = this.scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
    }

    /**
     * Update egg state (falling, wiggling, cracking, hatching)
     */
    update() {
        if (!this.mesh || !this.isActive) {
            return;
        }

        // Call parent update for healthbar
        super.update();

        const deltaTime = 0.016; // ~60fps

        switch (this.state) {
            case 'falling':
                this.updateFalling();
                break;
            case 'wiggling':
                this.updateWiggling(deltaTime);
                break;
            case 'cracking':
                this.updateCracking(deltaTime);
                break;
            case 'hatching':
                this.updateHatching(deltaTime);
                break;
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

            // Add gentle rotation while falling
            this.mesh.rotation.x += 0.02;
        } else {
            // Landed - transition to wiggling
            this.mesh.position.y = this.groundLevel;
            this.mesh.rotation.x = 0;
            this.state = 'wiggling';
            this.stateTime = 0;
        }
    }

    /**
     * Update wiggling state (egg moves around a little)
     */
    updateWiggling(deltaTime) {
        this.stateTime += deltaTime;

        // Wiggle animation
        const wiggleSpeed = 8.0;
        const wiggleAmount = 0.15;
        this.mesh.rotation.z = Math.sin(this.stateTime * wiggleSpeed) * wiggleAmount;

        // Small position movements
        const moveAmount = 0.02;
        this.mesh.position.x += Math.sin(this.stateTime * 3) * moveAmount * deltaTime;
        this.mesh.position.z += Math.cos(this.stateTime * 2.5) * moveAmount * deltaTime;

        // After wiggle time, start cracking
        if (this.stateTime >= this.wiggleTime) {
            this.state = 'cracking';
            this.stateTime = 0;
        }
    }

    /**
     * Update cracking state (egg shakes more violently)
     */
    updateCracking(deltaTime) {
        this.stateTime += deltaTime;

        // More violent shaking
        const shakeSpeed = 15.0;
        const shakeAmount = 0.3;
        this.mesh.rotation.z = Math.sin(this.stateTime * shakeSpeed) * shakeAmount;
        this.mesh.rotation.x = Math.cos(this.stateTime * shakeSpeed * 1.3) * shakeAmount * 0.5;

        // After crack time, start hatching
        if (this.stateTime >= this.crackTime) {
            this.state = 'hatching';
            this.stateTime = 0;
        }
    }

    /**
     * Update hatching state (egg fades away and spawns bubby)
     */
    updateHatching(deltaTime) {
        this.stateTime += deltaTime;

        // Fade out the egg shell
        const fadeTime = 0.5;
        const alpha = 1.0 - (this.stateTime / fadeTime);
        this.mesh.material.alpha = Math.max(0, alpha);

        // Scale down the egg
        const scale = alpha;
        this.mesh.scaling = new BABYLON.Vector3(scale, scale * 1.3, scale);

        // When fully faded, spawn bubby and dispose
        if (this.stateTime >= fadeTime) {
            if (this.onHatchCallback) {
                this.onHatchCallback(this.mesh.position.clone(), this.team, this.getHealth());
            }
            this.dispose();
        }
    }

    /**
     * Check if egg is still falling
     */
    isFallingActive() {
        return this.isFalling;
    }

    /**
     * Dispose egg and clean up
     */
    dispose() {
        if (this.updateObserver) {
            this.scene.onBeforeRenderObservable.remove(this.updateObserver);
            this.updateObserver = null;
        }
        super.dispose();
    }
}