/**
 * Game - Main game controller and orchestrator
 */
class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.engine = null;
        this.scene = null;
        this.cameraController = null;
        this.arena = null;
        this.uiManager = null;
        this.targetingSystem = null;
        this.castles = [];
        this.spawnedObjects = [];
        this.currentTargetType = null;

        this.initialize();
    }

    /**
     * Initialize game systems
     */
    initialize() {
        // Create engine and scene
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color3(0.5, 0.7, 1); // Blue sky

        // Initialize game components
        this.cameraController = new CameraController(this.scene, this.canvas);
        this.arena = new Arena(this.scene);
        this.setupCastles();
        this.uiManager = new UIManager(this.scene, this.canvas);

        // Initialize targeting system
        this.targetingSystem = new TargetingSystem(
            this.scene,
            this.cameraController.getCamera(),
            this.arena
        );

        // Sync targeting system with camera movement
        this.cameraController.setOnCameraMoveCallback((x) => {
            if (this.targetingSystem.isTargeting()) {
                this.targetingSystem.updateCameraPosition(x);
            }
        });

        // Register spawn callbacks
        this.registerSpawnHandlers();

        // Start render loop
        this.startRenderLoop();

        // Handle window resize
        this.setupResizeHandler();
    }

    /**
     * Setup castles for both teams
     */
    setupCastles() {
        const shadowGenerator = this.arena.getShadowGenerator();

        // Red castle (left side)
        const redCastle = new Castle(
            this.scene,
            "red",
            new BABYLON.Vector3(-65, 0, 0),
            shadowGenerator
        );
        this.castles.push(redCastle);

        // Blue castle (right side)
        const blueCastle = new Castle(
            this.scene,
            "blue",
            new BABYLON.Vector3(65, 0, 0),
            shadowGenerator
        );
        this.castles.push(blueCastle);
    }

    /**
     * Register spawn handlers for UI buttons
     */
    registerSpawnHandlers() {
        // Egg button handlers
        this.uiManager.registerHoldStartCallback("egg", () => this.startTargeting("egg"));
        this.uiManager.registerHoldEndCallback("egg", () => this.spawnEgg());

        // Seed button handlers
        this.uiManager.registerHoldStartCallback("seed", () => this.startTargeting("seed"));
        this.uiManager.registerHoldEndCallback("seed", () => this.spawnSeed());

        // Building button handlers
        this.uiManager.registerHoldStartCallback("building", () => this.startTargeting("building"));
        this.uiManager.registerHoldEndCallback("building", () => this.spawnBuilding());
    }

    /**
     * Start targeting mode when button is held
     */
    startTargeting(objectType) {
        this.currentTargetType = objectType;
        this.targetingSystem.activate(this.cameraController.getTargetX());
    }

    /**
     * Spawn an egg at targeted position (player is red team)
     */
    spawnEgg() {
        if (!this.targetingSystem.isTargeting()) {
            return;
        }

        const targetPos = this.targetingSystem.getTargetPosition();
        const spawnPosition = new BABYLON.Vector3(
            targetPos.x,
            30, // High enough to drop
            targetPos.z
        );

        const egg = new Egg(
            this.scene,
            spawnPosition,
            'red', // Player team
            this.arena.getShadowGenerator(),
            (position, team) => this.spawnBubby(position, team)
        );

        this.spawnedObjects.push(egg);
        this.targetingSystem.deactivate();
        this.currentTargetType = null;
    }

    /**
     * Spawn a baby bubby at the given position with health from egg
     */
    spawnBubby(position, team, health) {
        const bubby = new Bubby(
            this.scene,
            position,
            team,
            this.arena.getShadowGenerator(),
            () => this.getAllPlants(),
            () => this.getAllBubbies(),
            (position, team, health) => this.spawnAdultBubby(position, team, health),
            health
        );

        this.spawnedObjects.push(bubby);
    }

    /**
     * Spawn an adult bubby at the given position
     */
    spawnAdultBubby(position, team, health) {
        const adultBubby = new AdultBubby(
            this.scene,
            position,
            team,
            this.arena.getShadowGenerator(),
            () => this.getAllPlants(),
            () => this.getAllBubbies(),
            health
        );

        this.spawnedObjects.push(adultBubby);
    }

    /**
     * Get all active plants (sprouts, bushes, trees) in the game
     */
    getAllPlants() {
        return this.spawnedObjects.filter(obj => {
            const name = obj.constructor.name;
            return (name === 'Sprout' || name === 'Bush' || name === 'Tree') && obj.isActive;
        });
    }

    /**
     * Get all active sprouts in the game
     */
    getAllSprouts() {
        return this.spawnedObjects.filter(obj => {
            return obj.constructor.name === 'Sprout' && obj.isActive;
        });
    }

    /**
     * Get all active bubbies (baby and adult) in the game
     */
    getAllBubbies() {
        return this.spawnedObjects.filter(obj => {
            const name = obj.constructor.name;
            return (name === 'Bubby' || name === 'AdultBubby') && obj.isActive;
        });
    }

    /**
     * Spawn a seed at targeted position
     */
    spawnSeed() {
        if (!this.targetingSystem.isTargeting()) {
            return;
        }

        const targetPos = this.targetingSystem.getTargetPosition();
        const spawnPosition = new BABYLON.Vector3(
            targetPos.x,
            30, // High enough to drop
            targetPos.z
        );

        const seed = new Seed(
            this.scene,
            spawnPosition,
            this.arena.getShadowGenerator(),
            (position, healthBar) => this.spawnSprout(position, healthBar)
        );

        this.spawnedObjects.push(seed);
        this.targetingSystem.deactivate();
        this.currentTargetType = null;
    }

    /**
     * Spawn a sprout at the given position with health bar from seed
     */
    spawnSprout(position, healthBar) {
        const sprout = new Sprout(
            this.scene,
            position,
            this.arena.getShadowGenerator(),
            (position, healthBar) => this.spawnBush(position, healthBar),
            healthBar
        );

        this.spawnedObjects.push(sprout);
    }

    /**
     * Spawn a bush at the given position with health bar from sprout
     */
    spawnBush(position, healthBar) {
        const bush = new Bush(
            this.scene,
            position,
            this.arena.getShadowGenerator(),
            (position, healthBar) => this.spawnTree(position, healthBar),
            healthBar
        );

        this.spawnedObjects.push(bush);
    }

    /**
     * Spawn a tree at the given position with health bar from bush
     */
    spawnTree(position, healthBar) {
        const tree = new Tree(
            this.scene,
            position,
            this.arena.getShadowGenerator(),
            healthBar
        );

        this.spawnedObjects.push(tree);
    }

    /**
     * Spawn a building (placeholder for future implementation)
     */
    spawnBuilding() {
        if (!this.targetingSystem.isTargeting()) {
            return;
        }

        console.log("Building spawning coming soon!");
        // TODO: Implement Building class and spawning

        this.targetingSystem.deactivate();
        this.currentTargetType = null;
    }

    /**
     * Start the game render loop
     */
    startRenderLoop() {
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }

    /**
     * Setup window resize handler
     */
    setupResizeHandler() {
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    /**
     * Get game scene
     */
    getScene() {
        return this.scene;
    }

    /**
     * Get camera controller
     */
    getCameraController() {
        return this.cameraController;
    }

    /**
     * Get arena
     */
    getArena() {
        return this.arena;
    }

    /**
     * Clean up and dispose game resources
     */
    dispose() {
        // Dispose spawned objects
        this.spawnedObjects.forEach(obj => obj.dispose());
        this.spawnedObjects = [];

        // Dispose castles
        this.castles.forEach(castle => castle.dispose());
        this.castles = [];

        // Dispose UI
        if (this.uiManager) {
            this.uiManager.dispose();
        }

        // Dispose scene and engine
        if (this.scene) {
            this.scene.dispose();
        }
        if (this.engine) {
            this.engine.dispose();
        }
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game("renderCanvas");
});