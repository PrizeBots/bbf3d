import { GameConstants } from './config/GameConstants.js';
import { HealthBar } from './components/HealthBar.js';
import { CameraController } from './controllers/CameraController.js';
import { Arena } from './entities/Arena.js';
import { Castle } from './entities/Castle.js';
import { Coin } from './entities/Coin.js';
import { SpawnableObject } from './objects/SpawnableObject.js';
import { Egg } from './objects/Egg.js';
import { Seed } from './objects/Seed.js';
import { Bubby } from './objects/Bubby.js';
import { AdultBubby } from './objects/AdultBubby.js';
import { Sprout } from './objects/Sprout.js';
import { Bush } from './objects/Bush.js';
import { Tree } from './objects/Tree.js';
import { Fruit } from './objects/Fruit.js';
import { Turret } from './objects/Turret.js';
import { Armory } from './objects/Armory.js';
import { TargetingSystem } from './systems/TargetingSystem.js';
import { DragSystem } from './systems/DragSystem.js';
import { UIManager } from './ui/UIManager.js';

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
        this.dragSystem = null;
        this.castles = [];
        this.spawnedObjects = [];
        this.currentTargetType = null;

        // Cleanup tracking
        this.updateFrameCount = 0;
        this.cleanupInterval = 300; // Cleanup every 300 frames (~5 seconds at 60fps)

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

        // Initialize drag system
        this.dragSystem = new DragSystem(
            this.scene,
            this.cameraController.getCamera(),
            this.arena,
            () => this.getAllDraggableObjects()
        );

        // Sync targeting system with camera movement
        this.cameraController.setOnCameraMoveCallback((x) => {
            if (this.targetingSystem && this.targetingSystem.isTargeting()) {
                this.targetingSystem.updateCameraPosition(x);
            }
        });

        // Register spawn callbacks
        this.registerSpawnHandlers();

        // Register camera freeze callback
        this.uiManager.registerCameraFreezeCallback((frozen) => {
            this.cameraController.setCameraFrozen(frozen);
        });

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
        // Egg button - click to enter placement mode
        this.uiManager.registerSelectCallback("egg", () => this.startPlacementMode("egg"));

        // Seed button - click to enter placement mode
        this.uiManager.registerSelectCallback("seed", () => this.startPlacementMode("seed"));

        // Building type handlers (from submenu)
        this.uiManager.registerSelectCallback("turret", () => this.startPlacementMode("turret"));
        this.uiManager.registerSelectCallback("armory", () => this.startPlacementMode("armory"));
    }

    /**
     * Start placement mode - cursor follows mouse, click to place
     */
    startPlacementMode(objectType) {
        this.currentTargetType = objectType;

        // Activate targeting with callback for when user clicks to place
        this.targetingSystem.activate((targetPosition) => {
            this.handlePlacement(objectType, targetPosition);
        });
    }

    /**
     * Handle placement when user clicks in placement mode
     */
    handlePlacement(objectType, targetPosition) {
        const spawnPosition = new BABYLON.Vector3(
            targetPosition.x,
            GameConstants.PHYSICS.SPAWN_DROP_HEIGHT,
            targetPosition.z
        );

        switch (objectType) {
            case "egg":
                this.spawnEggAt(spawnPosition);
                break;
            case "seed":
                this.spawnSeedAt(spawnPosition);
                break;
            case "turret":
                this.spawnTurretAt(spawnPosition);
                break;
            case "armory":
                this.spawnArmoryAt(spawnPosition);
                break;
        }

        // Deactivate targeting and clear UI selection
        this.targetingSystem.deactivate();
        this.uiManager.onPlacementComplete();
        this.currentTargetType = null;
    }

    /**
     * Spawn an egg at the given position
     */
    spawnEggAt(spawnPosition) {
        const egg = new Egg(
            this.scene,
            spawnPosition,
            'red', // Player team
            this.arena.getShadowGenerator(),
            (position, team) => this.spawnBubby(position, team)
        );

        this.spawnedObjects.push(egg);
    }

    /**
     * Spawn a baby bubby at the given position with health from egg
     */
    spawnBubby(position, team, health) {
        const bubby = new Bubby(this.scene, {
            position: position,
            team: team,
            shadowGenerator: this.arena.getShadowGenerator(),
            getAllPlants: () => this.getAllPlants(),
            getAllBubbies: () => this.getAllBubbies(),
            getAllFruits: () => this.getAllFruits(),
            onMatureCallback: (pos, t, h) => this.spawnAdultBubby(pos, t, h),
            initialHealth: health
        });

        this.spawnedObjects.push(bubby);
    }

    /**
     * Spawn an adult bubby at the given position
     */
    spawnAdultBubby(position, team, health) {
        const adultBubby = new AdultBubby(this.scene, {
            position: position,
            team: team,
            shadowGenerator: this.arena.getShadowGenerator(),
            getAllPlants: () => this.getAllPlants(),
            getAllBubbies: () => this.getAllBubbies(),
            getAllFruits: () => this.getAllFruits(),
            initialHealth: health,
            onCoinEarnedCallback: (pos, t, val) => this.spawnCoin(pos, t, val)
        });

        this.spawnedObjects.push(adultBubby);
    }

    /**
     * Spawn a coin that flies to UI when fruit is deposited
     */
    spawnCoin(depositPosition, team, coinValue) {
        // Get screen position of coin counter
        const targetScreenPos = this.uiManager.getCoinCounterScreenPosition();

        // Create coin with callback to increment counter when it arrives
        const coin = new Coin(
            this.scene,
            depositPosition,
            targetScreenPos,
            () => {
                // Increment coin count in UI
                this.uiManager.addCoins(coinValue);
            }
        );

        this.spawnedObjects.push(coin);
    }

    /**
     * Get all active plants (sprouts, bushes, trees) in the game
     */
    getAllPlants() {
        return this.spawnedObjects.filter(obj => {
            return (obj instanceof Sprout || obj instanceof Bush || obj instanceof Tree) && obj.isActive;
        });
    }

    /**
     * Get all active fruits in the game
     */
    getAllFruits() {
        return this.spawnedObjects.filter(obj => {
            return obj instanceof Fruit && obj.isActive;
        });
    }

    /**
     * Get all active sprouts in the game
     */
    getAllSprouts() {
        return this.spawnedObjects.filter(obj => {
            return obj instanceof Sprout && obj.isActive;
        });
    }

    /**
     * Get all active bubbies (baby and adult) in the game
     */
    getAllBubbies() {
        return this.spawnedObjects.filter(obj => {
            return (obj instanceof Bubby || obj instanceof AdultBubby) && obj.isActive;
        });
    }

    /**
     * Get all draggable objects in the game
     */
    getAllDraggableObjects() {
        return this.spawnedObjects.filter(obj => {
            return obj.isActive && obj.isDraggable && obj.isDraggable();
        });
    }

    /**
     * Spawn a seed at the given position
     */
    spawnSeedAt(spawnPosition) {
        const seed = new Seed(
            this.scene,
            spawnPosition,
            this.arena.getShadowGenerator(),
            (position, healthBar, team) => this.spawnSprout(position, healthBar, team),
            'red' // Player team
        );

        this.spawnedObjects.push(seed);
    }

    /**
     * Spawn a sprout at the given position with health bar from seed
     */
    spawnSprout(position, healthBar, team) {
        const sprout = new Sprout(
            this.scene,
            position,
            this.arena.getShadowGenerator(),
            (position, healthBar, team) => this.spawnBush(position, healthBar, team),
            healthBar,
            team
        );

        this.spawnedObjects.push(sprout);
    }

    /**
     * Spawn a bush at the given position with health bar from sprout
     */
    spawnBush(position, healthBar, team) {
        const bush = new Bush(
            this.scene,
            position,
            this.arena.getShadowGenerator(),
            (position, healthBar, team) => this.spawnTree(position, healthBar, team),
            healthBar,
            team
        );

        this.spawnedObjects.push(bush);
    }

    /**
     * Spawn a tree at the given position with health bar from bush
     */
    spawnTree(position, healthBar, team) {
        const tree = new Tree(
            this.scene,
            position,
            this.arena.getShadowGenerator(),
            healthBar,
            team,
            (fruitPosition, fruitTeam, parentTree) => this.spawnFruit(fruitPosition, fruitTeam, parentTree)
        );

        this.spawnedObjects.push(tree);
    }

    /**
     * Spawn a fruit from a tree
     */
    spawnFruit(position, team, parentTree) {
        const fruit = new Fruit(
            this.scene,
            position,
            team,
            this.arena.getShadowGenerator(),
            parentTree
        );

        // Set up seed spawn callback for when fruit decays naturally
        fruit.onSeedSpawnCallback = (seedPosition, seedTeam) => {
            this.spawnSeedFromFruit(seedPosition, seedTeam);
        };

        this.spawnedObjects.push(fruit);
    }

    /**
     * Spawn a seed from a decayed fruit
     */
    spawnSeedFromFruit(position, team) {
        const seed = new Seed(
            this.scene,
            position,
            this.arena.getShadowGenerator(),
            (position, healthBar, team) => this.spawnSprout(position, healthBar, team),
            team
        );

        this.spawnedObjects.push(seed);
    }

    /**
     * Spawn a turret at the given position
     */
    spawnTurretAt(spawnPosition) {
        const turret = new Turret(
            this.scene,
            spawnPosition,
            this.arena.getShadowGenerator(),
            'red' // Player team
        );

        this.spawnedObjects.push(turret);
    }

    /**
     * Spawn an armory at the given position
     */
    spawnArmoryAt(spawnPosition) {
        const armory = new Armory(
            this.scene,
            spawnPosition,
            this.arena.getShadowGenerator(),
            'red' // Player team
        );

        this.spawnedObjects.push(armory);
    }

    /**
     * Start the game render and update loops
     */
    startRenderLoop() {
        // Separate update loop (runs even when tab not focused)
        // Target 60 updates per second
        const updateInterval = 1000 / 60; // ~16.67ms
        let lastUpdateTime = Date.now();

        this.updateIntervalId = setInterval(() => {
            const currentTime = Date.now();
            const deltaTime = (currentTime - lastUpdateTime) / 1000; // Convert to seconds
            lastUpdateTime = currentTime;

            // Update all game objects
            this.updateGame(deltaTime);
        }, updateInterval);

        // Render loop (pauses when tab not focused, which is fine)
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }

    /**
     * Update all game logic
     */
    updateGame(deltaTime) {
        this.updateFrameCount++;

        // Periodic cleanup of inactive objects to prevent memory growth
        if (this.updateFrameCount % this.cleanupInterval === 0) {
            this.cleanupInactiveObjects();
        }

        // Update all spawned objects
        this.spawnedObjects.forEach(obj => {
            if (obj && obj.isActive && obj.update) {
                // Pass deltaTime to update method
                obj.updateWithDelta(deltaTime);
            }
        });
    }

    /**
     * Remove inactive objects from the spawned objects array
     */
    cleanupInactiveObjects() {
        const beforeCount = this.spawnedObjects.length;
        this.spawnedObjects = this.spawnedObjects.filter(obj => obj && obj.isActive);
        const removedCount = beforeCount - this.spawnedObjects.length;

        if (removedCount > 0) {
            console.log(`Cleaned up ${removedCount} inactive objects`);
        }
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
        // Stop update loop
        if (this.updateIntervalId) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }

        // Dispose spawned objects
        this.spawnedObjects.forEach(obj => obj.dispose());
        this.spawnedObjects = [];

        // Dispose castles
        this.castles.forEach(castle => castle.dispose());
        this.castles = [];

        // Dispose systems
        if (this.dragSystem) {
            this.dragSystem.dispose();
        }
        if (this.targetingSystem) {
            this.targetingSystem.dispose();
        }

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