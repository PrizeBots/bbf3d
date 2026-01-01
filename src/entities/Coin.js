import { GameConstants } from '../config/GameConstants.js';

/**
 * Coin - Visual coin that animates from 3D world position to UI
 */
export class Coin {
    constructor(scene, startPosition, targetScreenPosition, onArrivalCallback) {
        this.scene = scene;
        this.startPosition = startPosition.clone();
        this.targetScreenPosition = targetScreenPosition; // {x, y} in pixels
        this.onArrivalCallback = onArrivalCallback;
        this.mesh = null;
        this.particleSystem = null;
        this.isActive = true;

        // Animation phases
        this.phase = 'popup'; // 'popup' -> 'flight'
        this.popupDuration = 0.5; // Seconds for popup phase
        this.flightDuration = GameConstants.ECONOMY.COIN_FLIGHT_DURATION;
        this.animationTime = 0;

        this.create();
    }

    /**
     * Create the coin mesh
     */
    create() {
        // Create a simple gold coin (cylinder)
        this.mesh = BABYLON.MeshBuilder.CreateCylinder(
            `coin_${Date.now()}`,
            {
                diameter: 0.8,
                height: 0.15,
                tessellation: 32
            },
            this.scene
        );

        this.mesh.position = this.startPosition.clone();
        this.mesh.position.y += 0.5; // Start slightly above deposit point

        // Rotate to face up like a coin
        this.mesh.rotation.x = Math.PI / 2;

        // Create shiny gold material
        const coinMaterial = new BABYLON.StandardMaterial(`coinMat_${Date.now()}`, this.scene);
        coinMaterial.diffuseColor = new BABYLON.Color3(1.0, 0.84, 0.0); // Gold
        coinMaterial.specularColor = new BABYLON.Color3(1.0, 0.9, 0.5); // Shiny
        coinMaterial.specularPower = 64; // Very shiny
        coinMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.25, 0.0); // Glow
        this.mesh.material = coinMaterial;

        // Create sparkle particle system
        this.createSparkles();

        // Calculate the target 3D position based on screen coordinates
        this.calculateTargetPosition();
    }

    /**
     * Create sparkle particle system
     */
    createSparkles() {
        this.particleSystem = new BABYLON.ParticleSystem(`coinSparkles_${Date.now()}`, 100, this.scene);

        // Texture for particles (using a simple star shape approximation)
        this.particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", this.scene);

        // Emit from coin position
        this.particleSystem.emitter = this.mesh;
        this.particleSystem.minEmitBox = new BABYLON.Vector3(-0.2, -0.1, -0.2);
        this.particleSystem.maxEmitBox = new BABYLON.Vector3(0.2, 0.1, 0.2);

        // Colors
        this.particleSystem.color1 = new BABYLON.Color4(1.0, 0.9, 0.2, 1.0); // Bright yellow
        this.particleSystem.color2 = new BABYLON.Color4(1.0, 0.7, 0.0, 1.0); // Gold
        this.particleSystem.colorDead = new BABYLON.Color4(1.0, 0.5, 0.0, 0.0); // Fade to transparent

        // Size
        this.particleSystem.minSize = 0.1;
        this.particleSystem.maxSize = 0.3;

        // Life time
        this.particleSystem.minLifeTime = 0.3;
        this.particleSystem.maxLifeTime = 0.6;

        // Emission rate
        this.particleSystem.emitRate = 30;

        // Blend mode
        this.particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // Speed
        this.particleSystem.minEmitPower = 0.5;
        this.particleSystem.maxEmitPower = 1.5;
        this.particleSystem.updateSpeed = 0.01;

        // Start the particle system
        this.particleSystem.start();
    }

    /**
     * Calculate 3D target position from screen coordinates
     */
    calculateTargetPosition() {
        // For now, we'll animate to a position high above the scene
        // and fade out as we approach the UI
        const camera = this.scene.activeCamera;

        // Convert screen position to a point in 3D space
        // We'll use a position near the top-right of the visible area
        this.targetPosition = new BABYLON.Vector3(
            camera.position.x + 40,  // Far right
            20,                       // High up
            camera.position.z
        );
    }

    /**
     * Update coin animation
     */
    update(deltaTime) {
        if (!this.mesh || !this.isActive) {
            return;
        }

        this.animationTime += deltaTime;
        const progress = Math.min(this.animationTime / this.animationDuration, 1.0);

        if (progress >= 1.0) {
            // Animation complete
            this.onArrival();
            return;
        }

        // Easing function (ease-out)
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        // Calculate position along bezier curve
        const start = this.startPosition.clone();
        start.y += 2; // Start position (above deposit)

        // Control point for arc (high in the air)
        const control = new BABYLON.Vector3(
            (this.startPosition.x + this.targetPosition.x) / 2,
            Math.max(this.startPosition.y, this.targetPosition.y) + 10,
            (this.startPosition.z + this.targetPosition.z) / 2
        );

        // Quadratic bezier curve
        const t = easedProgress;
        const oneMinusT = 1 - t;

        this.mesh.position.x = oneMinusT * oneMinusT * start.x +
                               2 * oneMinusT * t * control.x +
                               t * t * this.targetPosition.x;

        this.mesh.position.y = oneMinusT * oneMinusT * start.y +
                               2 * oneMinusT * t * control.y +
                               t * t * this.targetPosition.y;

        this.mesh.position.z = oneMinusT * oneMinusT * start.z +
                               2 * oneMinusT * t * control.z +
                               t * t * this.targetPosition.z;

        // Spin the coin
        this.mesh.rotation.y += deltaTime * 10;

        // Scale down as it approaches target
        const scale = 1.0 - (progress * 0.7); // Shrink to 30% size
        this.mesh.scaling = new BABYLON.Vector3(scale, scale, scale);

        // Fade out near the end
        if (progress > 0.7) {
            const fadeProgress = (progress - 0.7) / 0.3;
            this.mesh.material.alpha = 1 - fadeProgress;
        }
    }

    /**
     * Update with delta time (called by game loop)
     */
    updateWithDelta(deltaTime) {
        this.update(deltaTime);
    }

    /**
     * Called when coin reaches target
     */
    onArrival() {
        if (this.onArrivalCallback) {
            this.onArrivalCallback();
        }
        this.dispose();
    }

    /**
     * Dispose coin
     */
    dispose() {
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }
        this.isActive = false;
    }
}
