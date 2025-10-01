/**
 * Arena - Manages the game arena including ground, lighting, and shadows
 */
class Arena {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.shadowGenerator = null;
        this.width = 160;
        this.depth = 40;

        this.setupLighting();
        this.createGround();
        this.createMidline();
    }

    /**
     * Setup lighting and shadow system
     */
    setupLighting() {
        // Hemispheric light for ambient lighting
        const hemisphericLight = new BABYLON.HemisphericLight(
            "hemisphericLight",
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
        hemisphericLight.intensity = 0.5;

        // Directional light for shadows
        const directionalLight = new BABYLON.DirectionalLight(
            "directionalLight",
            new BABYLON.Vector3(-1, -2, -1),
            this.scene
        );
        directionalLight.position = new BABYLON.Vector3(20, 40, 20);
        directionalLight.intensity = 0.6;

        // Shadow generator
        this.shadowGenerator = new BABYLON.ShadowGenerator(1024, directionalLight);
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        this.shadowGenerator.blurKernel = 32;
    }

    /**
     * Create the ground/field
     */
    createGround() {
        this.ground = BABYLON.MeshBuilder.CreateGround(
            "ground",
            {
                width: this.width,
                height: this.depth
            },
            this.scene
        );

        const groundMaterial = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2); // Green grass
        this.ground.material = groundMaterial;
        this.ground.receiveShadows = true; // Enable shadow receiving
    }

    /**
     * Create center line marker
     */
    createMidline() {
        const midline = BABYLON.MeshBuilder.CreateBox(
            "midline",
            {
                width: 0.5,
                height: 0.2,
                depth: this.depth
            },
            this.scene
        );
        midline.position = new BABYLON.Vector3(0, 0.1, 0);

        const midlineMaterial = new BABYLON.StandardMaterial("midlineMat", this.scene);
        midlineMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1); // White
        midline.material = midlineMaterial;
    }

    /**
     * Get shadow generator for objects to cast shadows
     */
    getShadowGenerator() {
        return this.shadowGenerator;
    }

    /**
     * Get ground level Y position
     */
    getGroundLevel() {
        return 0;
    }

    /**
     * Get arena dimensions
     */
    getDimensions() {
        return {
            width: this.width,
            depth: this.depth
        };
    }
}