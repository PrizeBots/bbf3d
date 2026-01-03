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
import { WoodChunk } from './objects/WoodChunk.js';
import { StonePiece } from './objects/StonePiece.js';
import { StoneDeposit } from './entities/StoneDeposit.js';
import { SoldierBubby } from './objects/SoldierBubby.js';
import { Turret } from './objects/Turret.js';
import { Armory } from './objects/Armory.js';
import { Factory } from './objects/Factory.js';
import { Tank } from './objects/Tank.js';
import { TargetingSystem } from './systems/TargetingSystem.js';
import { DragSystem } from './systems/DragSystem.js';
import { UIManager } from './ui/UIManager.js';
import { PlayerCursor } from './ui/PlayerCursor.js';
import { AIPlayer } from './systems/AIPlayer.js';
import { AttackEffects } from './systems/AttackEffects.js';
import { GrassSystem } from './systems/GrassSystem.js';
import { soundManager } from './systems/SoundManager.js';

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
        this.playerCursor = null;
        this.aiPlayer = null;
        this.castles = [];
        this.stoneDeposits = [];
        this.spawnedObjects = [];
        this.currentTargetType = null;
        this.attackEffects = null;
        this.grassSystem = null;

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
        this.grassSystem = new GrassSystem(this.scene);
        this.setupCastles();
        this.uiManager = new UIManager(this.scene, this.canvas);
        this.attackEffects = new AttackEffects(this.scene);

        // Wire up UIManager to CameraController for mobile controls
        this.cameraController.setUIManager(this.uiManager);

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

        // Initialize player cursor (white glove hand)
        this.playerCursor = new PlayerCursor(
            this.scene,
            this.cameraController.getCamera(),
            'red' // Player team
        );

        // Wire cursor gestures to drag system
        this.dragSystem.setOnDragStartCallback(() => {
            this.playerCursor.setGesture('grabbing');
        });
        this.dragSystem.setOnDragEndCallback(() => {
            this.playerCursor.setGesture('pointing');
        });
        this.dragSystem.setOnHoverCallback((isHovering) => {
            if (isHovering) {
                this.playerCursor.setGesture('open');
            } else {
                this.playerCursor.setGesture('pointing');
            }
        });

        // Setup drag-drop task assignment for bubbies
        this.dragSystem.setGetAllTaskTargets(() => this.getAllTaskTargets());

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

        // Register debug drop bubby callback
        this.uiManager.setOnDropBubbyCallback(() => {
            this.debugDropBubby();
        });

        // Register debug drop soldier callback
        this.uiManager.setOnDropSoldierCallback(() => {
            this.debugDropSoldier();
        });

        // Register debug give resources callback
        this.uiManager.setOnGiveResourcesCallback(() => {
            this.debugGiveResources();
        });

        // Setup castle click handlers for HQ menu
        this.setupCastleClickHandlers();

        // Setup initial stone deposits on the arena
        this.setupStoneDeposits();

        // Initialize AI player (blue team)
        this.setupAIPlayer();

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
     * Setup castle click handlers (called after UI is ready)
     */
    setupCastleClickHandlers() {
        this.castles.forEach(castle => {
            castle.setOnClickCallback((clickedCastle) => {
                // Only open menu for player's team (red)
                if (clickedCastle.getTeam() === 'red') {
                    this.openHQMenu(clickedCastle);
                }
            });

            // Setup resource deposit callback for real-time UI updates
            castle.setOnResourceDepositCallback((depositCastle) => {
                this.uiManager.onResourceDeposited(depositCastle);
            });
        });
    }

    /**
     * Setup initial stone deposits on the arena
     * These are predetermined positions to help tune stage difficulty
     */
    setupStoneDeposits() {
        // Place stone deposits in strategic locations across the arena
        // Safe Z range: ±12 to keep boulder piles fully on the arena (depth 40, boulders ~3 unit radius)
        const depositPositions = [
            // Center area - near edges but safe
            new BABYLON.Vector3(0, 0, 12),
            new BABYLON.Vector3(0, 0, -12),
            // Left side (closer to red castle)
            new BABYLON.Vector3(-35, 0, 8),
            new BABYLON.Vector3(-35, 0, -8),
            // Right side (closer to blue castle)
            new BABYLON.Vector3(35, 0, 8),
            new BABYLON.Vector3(35, 0, -8),
            // Mid-field positions - kept within safe bounds
            new BABYLON.Vector3(-20, 0, 12),
            new BABYLON.Vector3(20, 0, -12)
        ];

        depositPositions.forEach(position => {
            this.spawnStoneDeposit(position);
        });
    }

    /**
     * Setup AI player for blue team
     */
    setupAIPlayer() {
        this.aiPlayer = new AIPlayer(this.scene, this.cameraController.getCamera(), {
            spawnEgg: (position) => this.spawnEggForTeam(position, 'blue'),
            spawnSeed: (position) => this.spawnSeedForTeam(position, 'blue'),
            spawnArmory: (position) => this.spawnArmoryForTeam(position, 'blue'),
            spawnTurret: (position) => this.spawnTurretForTeam(position, 'blue'),
            getCastle: () => this.getCastleByTeam('blue'),
            getEnemyCastle: () => this.getCastleByTeam('red'),
            getAllBubbies: () => this.getAllBubbies(),
            getAllPlants: () => this.getAllPlants(),
            getAllArmories: () => this.getAllArmories('blue')
        });

        // Set initial difficulty - medium provides a good challenge
        this.aiPlayer.setDifficulty('medium');
    }

    /**
     * Spawn an egg for a specific team (used by AI)
     */
    spawnEggForTeam(spawnPosition, team) {
        const egg = new Egg(
            this.scene,
            spawnPosition,
            team,
            this.arena.getShadowGenerator(),
            (position, eggTeam) => this.spawnBubby(position, eggTeam)
        );

        this.spawnedObjects.push(egg);
    }

    /**
     * Spawn a seed for a specific team (used by AI)
     */
    spawnSeedForTeam(spawnPosition, team) {
        const seed = new Seed(
            this.scene,
            spawnPosition,
            this.arena.getShadowGenerator(),
            (position, healthBar, seedTeam) => this.spawnSprout(position, healthBar, seedTeam),
            team
        );

        this.spawnedObjects.push(seed);
    }

    /**
     * Spawn an armory for a specific team (used by AI)
     */
    spawnArmoryForTeam(spawnPosition, team) {
        const armory = new Armory(
            this.scene,
            spawnPosition,
            this.arena.getShadowGenerator(),
            team
        );

        // Wire up armory callbacks
        armory.getCastle = () => this.getCastleByTeam(team);
        armory.setOnClickCallback((clickedArmory) => {
            // Only open menu for player's team (red)
            if (clickedArmory.team === 'red') {
                this.openArmoryMenu(clickedArmory);
            }
        });

        this.spawnedObjects.push(armory);
    }

    /**
     * Spawn a turret for a specific team (used by AI)
     */
    spawnTurretForTeam(spawnPosition, team) {
        const enemyTeam = team === 'red' ? 'blue' : 'red';

        const turret = new Turret(
            this.scene,
            spawnPosition,
            this.arena.getShadowGenerator(),
            team
        );

        // Wire up turret callbacks for enemy detection and effects
        turret.setGetEnemyUnits(() => this.getEnemyUnits(enemyTeam));
        turret.setAttackEffects(this.attackEffects);
        turret.setSoundManager(soundManager);

        this.spawnedObjects.push(turret);
    }

    /**
     * Open HQ menu for a castle
     */
    openHQMenu(castle) {
        this.uiManager.showHQBuildMenu(castle, (castleToSell) => {
            this.sellFruit(castleToSell);
        });
    }

    /**
     * Sell a fruit from the castle inventory
     */
    sellFruit(castle) {
        if (castle.sellFruit()) {
            // Create coin animation from castle position
            const castlePos = castle.getPosition();
            const coinStartPos = new BABYLON.Vector3(
                castlePos.x,
                castlePos.y + 8, // Top of castle
                castlePos.z
            );

            // Get screen position of coin counter
            const targetScreenPos = this.uiManager.getCoinCounterScreenPosition();

            // Create coin with callback to increment counter when it arrives
            const coin = new Coin(
                this.scene,
                coinStartPos,
                targetScreenPos,
                () => {
                    // Increment coin count in UI
                    this.uiManager.addCoins(GameConstants.ECONOMY.FRUIT_SELL_VALUE);
                }
            );

            this.spawnedObjects.push(coin);
        }
    }

    /**
     * Get castle by team
     */
    getCastleByTeam(team) {
        return this.castles.find(c => c.getTeam() === team);
    }

    /**
     * Register spawn handlers for UI buttons
     */
    registerSpawnHandlers() {
        const objectTypes = ["egg", "seed", "turret", "armory", "factory"];

        objectTypes.forEach(objectType => {
            // Desktop: click to enter placement mode
            this.uiManager.registerSelectCallback(objectType, () => this.startPlacementMode(objectType));

            // Mobile: drag to place
            this.uiManager.registerDragStartCallback(objectType, () => this.startDragPlacement(objectType));
            this.uiManager.registerDragEndCallback(objectType, () => this.endDragPlacement(objectType));
        });
    }

    /**
     * Start drag placement mode (mobile) - targeting follows finger
     */
    startDragPlacement(objectType) {
        this.currentTargetType = objectType;
        // Activate targeting without callback - we'll place on drag end
        this.targetingSystem.activate(null);
    }

    /**
     * End drag placement (mobile) - place at current target position
     */
    endDragPlacement(objectType) {
        if (!this.targetingSystem.isTargeting()) {
            return;
        }

        const targetPosition = this.targetingSystem.getTargetPosition();
        this.handlePlacement(objectType, targetPosition);
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
            case "factory":
                this.spawnFactoryAt(spawnPosition);
                break;
        }

        // Deactivate targeting and clear UI selection
        this.targetingSystem.deactivate();
        this.uiManager.onPlacementComplete();
        this.currentTargetType = null;

        // Flash thumbs up gesture on cursor
        if (this.playerCursor) {
            this.playerCursor.flashThumbsUp(400);
        }
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
            getAllBuildings: () => this.getAllBuildings(),
            onMatureCallback: (pos, t, h) => this.spawnAdultBubby(pos, t, h),
            initialHealth: health,
            attackEffects: this.attackEffects,
            soundManager: soundManager
        });

        this.spawnedObjects.push(bubby);
    }

    /**
     * Spawn an adult bubby at the given position
     */
    spawnAdultBubby(position, team, health) {
        const enemyTeam = team === 'red' ? 'blue' : 'red';

        const adultBubby = new AdultBubby(this.scene, {
            position: position,
            team: team,
            shadowGenerator: this.arena.getShadowGenerator(),
            getAllPlants: () => this.getAllPlants(),
            getAllBubbies: () => this.getAllBubbies(),
            getAllFruits: () => this.getAllFruits(),
            getAllWoodChunks: () => this.getAllWoodChunks(),
            getAllHarvestableTrees: () => this.getAllHarvestableTrees(),
            getAllStonePieces: () => this.getAllStonePieces(),
            getAllStoneDeposits: () => this.getAllStoneDeposits(),
            getAllArmories: () => this.getAllArmories(team),
            getAllTanks: () => this.getAllTanks(team),
            getAllBuildings: () => this.getAllBuildings(),
            getEnemyUnits: () => this.getEnemyUnits(enemyTeam),
            getEnemyBuildings: () => this.getEnemyBuildings(enemyTeam),
            getEnemyCastle: () => this.getCastleByTeam(enemyTeam),
            initialHealth: health,
            getCastle: () => this.getCastleByTeam(team),
            attackEffects: this.attackEffects,
            soundManager: soundManager
        });

        this.spawnedObjects.push(adultBubby);
    }

    /**
     * Debug: Drop a full grown adult bubby on the player's side
     */
    debugDropBubby() {
        // Random position on player (red) side
        const x = -20 - Math.random() * 30; // Between -20 and -50
        const z = (Math.random() - 0.5) * 30; // Between -15 and 15
        const dropHeight = GameConstants.PHYSICS.SPAWN_DROP_HEIGHT;

        const position = new BABYLON.Vector3(x, dropHeight, z);

        // Spawn adult bubby with full health
        this.spawnAdultBubby(position, 'red', GameConstants.ADULT_BUBBY.MAX_HP);

        console.log(`Debug: Dropped adult bubby at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }

    /**
     * Debug: Drop a soldier bubby (with sword) on the player's side
     */
    debugDropSoldier() {
        // Random position on player (red) side
        const x = -20 - Math.random() * 30; // Between -20 and -50
        const z = (Math.random() - 0.5) * 30; // Between -15 and 15
        const dropHeight = GameConstants.PHYSICS.SPAWN_DROP_HEIGHT;

        const position = new BABYLON.Vector3(x, dropHeight, z);

        // Spawn adult bubby with full health
        this.spawnAdultBubby(position, 'red', GameConstants.ADULT_BUBBY.MAX_HP);

        // Get the just-spawned bubby and equip it with a sword
        const soldier = this.spawnedObjects[this.spawnedObjects.length - 1];
        if (soldier && soldier.isSoldier !== undefined) {
            soldier.isSoldier = true;
            soldier.equippedSword = true;
            soldier.createSwordVisual();
        }

        console.log(`Debug: Dropped soldier bubby at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }

    /**
     * Debug: Give 100 wood and 100 stone to player's castle
     */
    debugGiveResources() {
        const playerCastle = this.getCastleByTeam('red');
        if (playerCastle) {
            playerCastle.addWood(100);
            playerCastle.addStone(100);
            console.log(`Debug: Added 100 wood and 100 stone. Total: ${playerCastle.getWoodCount()} wood, ${playerCastle.getStoneCount()} stone`);
        }
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
     * Get all wood chunks that can be picked up
     */
    getAllWoodChunks() {
        return this.spawnedObjects.filter(obj => {
            return obj instanceof WoodChunk && obj.isActive && obj.canBePickedUp && obj.canBePickedUp();
        });
    }

    /**
     * Get all harvestable dead trees (trunk only)
     */
    getAllHarvestableTrees() {
        return this.spawnedObjects.filter(obj => {
            return obj instanceof Tree && obj.isActive && obj.canBeHarvested && obj.canBeHarvested();
        });
    }

    /**
     * Get all stone pieces that can be picked up
     */
    getAllStonePieces() {
        return this.spawnedObjects.filter(obj => {
            return obj instanceof StonePiece && obj.isActive && obj.canBePickedUp && obj.canBePickedUp();
        });
    }

    /**
     * Get all armories for a specific team
     */
    getAllArmories(team = null) {
        return this.spawnedObjects.filter(obj => {
            if (!(obj instanceof Armory) || !obj.isActive) return false;
            if (team && obj.team !== team) return false;
            return true;
        });
    }

    /**
     * Get all factories for a specific team
     */
    getAllFactories(team = null) {
        return this.spawnedObjects.filter(obj => {
            if (!(obj instanceof Factory) || !obj.isActive) return false;
            if (team && obj.team !== team) return false;
            return true;
        });
    }

    /**
     * Get all buildings (armories, turrets, factories, and castles)
     * Used for bubby pathfinding to avoid walking through structures
     */
    getAllBuildings() {
        const buildings = this.spawnedObjects.filter(obj => {
            return (obj instanceof Armory || obj instanceof Turret || obj instanceof Factory)
                && obj.isActive;
        });

        // Add castles
        this.castles.forEach(castle => {
            if (castle.isActive) {
                buildings.push(castle);
            }
        });

        return buildings;
    }

    /**
     * Get all tanks for a specific team
     */
    getAllTanks(team = null) {
        return this.spawnedObjects.filter(obj => {
            if (!(obj instanceof Tank) || !obj.isActive) return false;
            if (team && obj.team !== team) return false;
            return true;
        });
    }

    /**
     * Get all active stone deposits that can be mined
     */
    getAllStoneDeposits() {
        return this.stoneDeposits.filter(deposit => deposit.isActive && deposit.canBeMined());
    }

    /**
     * Get all valid task targets for drag-drop assignment
     * Returns array of { target, taskType } objects
     */
    getAllTaskTargets() {
        const targets = [];

        // Harvestable trees (dead trunks)
        this.getAllHarvestableTrees().forEach(tree => {
            targets.push({ target: tree, taskType: 'harvest_tree' });
        });

        // Mineable stone deposits
        this.getAllStoneDeposits().forEach(deposit => {
            targets.push({ target: deposit, taskType: 'mine_deposit' });
        });

        // Collectible fruits
        this.getAllFruits().forEach(fruit => {
            targets.push({ target: fruit, taskType: 'gather_fruit' });
        });

        // Collectible wood chunks
        this.getAllWoodChunks().forEach(wood => {
            targets.push({ target: wood, taskType: 'gather_wood' });
        });

        // Collectible stone pieces
        this.getAllStonePieces().forEach(stone => {
            targets.push({ target: stone, taskType: 'gather_stone' });
        });

        // Armories with swords (for soldier assignment)
        this.getAllArmories('red').forEach(armory => {
            if (armory.hasSword()) {
                targets.push({ target: armory, taskType: 'soldier' });
            }
        });

        // Enemy units (for attack targeting)
        this.getEnemyUnits('blue').forEach(unit => {
            targets.push({ target: unit, taskType: 'attack' });
        });

        // Enemy buildings (for attack targeting)
        this.getEnemyBuildings('blue').forEach(building => {
            targets.push({ target: building, taskType: 'attack_building' });
        });

        // Enemy castle (for attack targeting)
        const enemyCastle = this.getCastleByTeam('blue');
        if (enemyCastle && enemyCastle.isActive) {
            targets.push({ target: enemyCastle, taskType: 'attack_building' });
        }

        return targets;
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

        // Set wood chunk spawn callback for when trunk is harvested
        tree.onWoodChunkSpawnCallback = (chunkPosition, chunkTeam) => {
            this.spawnWoodChunk(chunkPosition, chunkTeam);
        };

        this.spawnedObjects.push(tree);
    }

    /**
     * Spawn a wood chunk from a harvested tree trunk
     */
    spawnWoodChunk(position, team) {
        const woodChunk = new WoodChunk(
            this.scene,
            position,
            this.arena.getShadowGenerator(),
            team
        );

        this.spawnedObjects.push(woodChunk);
    }

    /**
     * Spawn a stone piece from a mined stone deposit
     */
    spawnStonePiece(position) {
        const stonePiece = new StonePiece(
            this.scene,
            position,
            this.arena.getShadowGenerator()
        );

        this.spawnedObjects.push(stonePiece);
    }

    /**
     * Spawn a stone deposit at the given position
     */
    spawnStoneDeposit(position) {
        const stoneDeposit = new StoneDeposit(
            this.scene,
            position,
            this.arena.getShadowGenerator()
        );

        // Wire up callback for spawning stone pieces when mined
        stoneDeposit.onStonePieceSpawnCallback = (piecePosition) => {
            this.spawnStonePiece(piecePosition);
        };

        this.stoneDeposits.push(stoneDeposit);
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
        const team = 'red'; // Player team
        const enemyTeam = 'blue';

        const turret = new Turret(
            this.scene,
            spawnPosition,
            this.arena.getShadowGenerator(),
            team
        );

        // Wire up turret callbacks for enemy detection and effects
        turret.setGetEnemyUnits(() => this.getEnemyUnits(enemyTeam));
        turret.setAttackEffects(this.attackEffects);
        turret.setSoundManager(soundManager);

        this.spawnedObjects.push(turret);
    }

    /**
     * Spawn an armory at the given position
     */
    spawnArmoryAt(spawnPosition) {
        const team = 'red'; // Player team
        const armory = new Armory(
            this.scene,
            spawnPosition,
            this.arena.getShadowGenerator(),
            team
        );

        // Wire up armory callbacks
        armory.getCastle = () => this.getCastleByTeam(team);
        armory.setOnClickCallback((clickedArmory) => {
            this.openArmoryMenu(clickedArmory);
        });

        this.spawnedObjects.push(armory);
    }

    /**
     * Open armory menu for an armory building
     */
    openArmoryMenu(armory) {
        const castle = armory.getCastle();
        if (!castle) {
            console.log('No castle found for armory');
            return;
        }

        this.uiManager.showArmoryBuildMenu(armory, castle, (updatedArmory) => {
            // Callback when sword is crafted - could trigger visual effects
            console.log(`Armory now has ${updatedArmory.getSwordCount()} swords`);
        });
    }

    /**
     * Spawn a factory at the given position
     */
    spawnFactoryAt(spawnPosition) {
        const team = 'red'; // Player team
        const factory = new Factory(
            this.scene,
            spawnPosition,
            this.arena.getShadowGenerator(),
            team
        );

        // Wire up factory callbacks
        factory.setOnTankProduced((tank) => {
            // Add tank to spawned objects
            this.spawnedObjects.push(tank);

            // Set up tank callbacks
            const enemyTeam = team === 'red' ? 'blue' : 'red';
            tank.setGetEnemyUnits(() => this.getEnemyUnits(enemyTeam));
            tank.setGetEnemyBuildings(() => this.getEnemyBuildings(enemyTeam));
            tank.setGetAllTanks(() => this.getAllTanks(team));
            tank.setAttackEffects(this.attackEffects);
            tank.setSoundManager(soundManager);

            console.log(`Factory produced a tank for ${team} team!`);
        });

        factory.setSoundManager(soundManager);

        // Make factory clickable to open build menu
        factory.setOnClickCallback((clickedFactory) => {
            this.openFactoryMenu(clickedFactory);
        });

        this.spawnedObjects.push(factory);
    }

    /**
     * Open factory menu for a factory building
     */
    openFactoryMenu(factory) {
        const castle = this.getCastleByTeam(factory.team);
        if (!castle) {
            console.log('No castle found for factory');
            return;
        }

        this.uiManager.showFactoryBuildMenu(factory, castle, (updatedFactory) => {
            // Callback when tank production is queued
            console.log(`Factory queue: ${updatedFactory.getQueueLength()} items`);
        });
    }

    /**
     * Spawn a soldier bubby at the given position
     */
    spawnSoldierBubby(position, team) {
        const enemyTeam = team === 'red' ? 'blue' : 'red';

        const soldier = new SoldierBubby(this.scene, {
            position: position,
            team: team,
            shadowGenerator: this.arena.getShadowGenerator(),
            getAllBubbies: () => this.getAllBubbies(),
            getEnemyUnits: () => this.getEnemyUnits(enemyTeam),
            getEnemyBuildings: () => this.getEnemyBuildings(enemyTeam),
            getEnemyCastle: () => this.getCastleByTeam(enemyTeam)
        });

        this.spawnedObjects.push(soldier);
    }

    /**
     * Get all enemy units (bubbies of the specified team)
     */
    getEnemyUnits(team) {
        return this.spawnedObjects.filter(obj => {
            return (obj instanceof Bubby || obj instanceof AdultBubby || obj instanceof SoldierBubby)
                && obj.isActive
                && obj.team === team;
        });
    }

    /**
     * Get all enemy buildings (armories, turrets, factories of the specified team)
     */
    getEnemyBuildings(team) {
        return this.spawnedObjects.filter(obj => {
            return (obj instanceof Armory || obj instanceof Turret || obj instanceof Factory || obj instanceof Tank)
                && obj.isActive
                && obj.team === team;
        });
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

        // Update AI player
        if (this.aiPlayer) {
            this.aiPlayer.update(deltaTime);
        }

        // Update castles (banner animations)
        this.castles.forEach(castle => {
            if (castle && castle.isActive && castle.update) {
                castle.update(deltaTime);
            }
        });

        // Update grass system (wind animation)
        if (this.grassSystem) {
            this.grassSystem.update(deltaTime);
        }

        // Update all spawned objects
        this.spawnedObjects.forEach(obj => {
            if (obj && obj.isActive && obj.update) {
                // Pass deltaTime to update method
                obj.updateWithDelta(deltaTime);
            }
        });

        // Update attack visual effects
        if (this.attackEffects) {
            this.attackEffects.update();
        }
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

        // Dispose stone deposits
        this.stoneDeposits.forEach(deposit => deposit.dispose());
        this.stoneDeposits = [];

        // Dispose AI player
        if (this.aiPlayer) {
            this.aiPlayer.dispose();
            this.aiPlayer = null;
        }

        // Dispose grass system
        if (this.grassSystem) {
            this.grassSystem.dispose();
            this.grassSystem = null;
        }

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