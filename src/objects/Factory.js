import { SpawnableObject } from './SpawnableObject.js';
import { GameConstants } from '../config/GameConstants.js';
import { Tank } from './Tank.js';

/**
 * Factory - Production building that creates tanks
 *
 * Features:
 * - Industrial building appearance
 * - Large overhead door that opens for production
 * - Produces tanks when ordered
 * - Team-colored accents
 */
export class Factory extends SpawnableObject {
    constructor(scene, position, shadowGenerator, team = 'red') {
        const maxHP = GameConstants.FACTORY.MAX_HP;
        super(scene, position, shadowGenerator, maxHP);

        this.team = team;
        this.velocity = 0;
        this.gravity = GameConstants.PHYSICS.GRAVITY;
        this.groundLevel = 0;
        this.state = 'falling'; // 'falling', 'idle', 'opening', 'producing', 'deploying', 'closing'
        this.isPaused = false;

        // Production
        this.productionQueue = [];
        this.currentProduction = null;
        this.productionProgress = 0;

        // Door animation
        this.doorOpenAmount = 0; // 0 = closed, 1 = fully open
        this.doorTargetAmount = 0;

        // Deploy timing (door stays open while tank exits)
        this.deployTimer = 0;
        this.deployedTank = null;

        // Mesh components
        this.building = null;
        this.door = null;
        this.doorFrame = null;
        this.chimney = null;

        // Produced tanks
        this.producedTanks = [];

        // Callbacks
        this.onTankProduced = null;
        this.soundManager = null;

        // Team colors
        this.teamColor = team === 'red'
            ? new BABYLON.Color3(0.8, 0.2, 0.2)
            : new BABYLON.Color3(0.2, 0.3, 0.8);
        this.teamColorDark = team === 'red'
            ? new BABYLON.Color3(0.5, 0.1, 0.1)
            : new BABYLON.Color3(0.1, 0.15, 0.5);

        this.create();
        this.createHealthBar(8.0);
        this.setupClickHandler();
    }

    /**
     * Setup click handler for opening build menu
     */
    setupClickHandler() {
        // Make all meshes in this factory clickable
        const allMeshes = [];

        if (this.building) {
            allMeshes.push(...this.building.getChildMeshes());
        }
        if (this.doorFrame) {
            allMeshes.push(...this.doorFrame.getChildMeshes());
        }
        if (this.door) {
            allMeshes.push(...this.door.getChildMeshes());
        }
        if (this.chimney) {
            allMeshes.push(...this.chimney.getChildMeshes());
        }

        allMeshes.forEach(mesh => {
            mesh.isPickable = true;
            mesh.actionManager = new BABYLON.ActionManager(this.scene);
            mesh.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPickTrigger,
                    () => {
                        if (this.state === 'idle' && this.onClickCallback) {
                            this.onClickCallback(this);
                        }
                    }
                )
            );
        });
    }

    /**
     * Create the factory mesh
     */
    create() {
        // Create root container
        this.mesh = new BABYLON.TransformNode(`factory_${this.team}_${Date.now()}`, this.scene);
        this.mesh.position = this.position.clone();

        // Rotate factory so door faces enemy HQ
        // Red team is on left (negative X), so door should face positive X (toward blue)
        // Blue team is on right (positive X), so door should face negative X (toward red)
        if (this.team === 'red') {
            this.mesh.rotation.y = Math.PI / 2; // Door faces positive X (toward blue)
        } else {
            this.mesh.rotation.y = -Math.PI / 2; // Door faces negative X (toward red)
        }

        // Create building structure
        this.createBuilding();

        // Create overhead door
        this.createDoor();

        // Create chimney
        this.createChimney();

        // Create details
        this.createDetails();
    }

    /**
     * Create the main factory building
     */
    createBuilding() {
        this.building = new BABYLON.TransformNode('factoryBuilding', this.scene);
        this.building.parent = this.mesh;

        // Main structure - industrial box shape
        const mainStructure = BABYLON.MeshBuilder.CreateBox(
            'mainStructure',
            { width: 10, height: 6, depth: 12 },
            this.scene
        );
        mainStructure.position.y = 3;
        mainStructure.parent = this.building;

        // Industrial gray material
        const wallMat = new BABYLON.StandardMaterial('wallMat', this.scene);
        wallMat.diffuseColor = new BABYLON.Color3(0.45, 0.45, 0.48);
        wallMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        mainStructure.material = wallMat;

        // Sloped roof
        const roof = BABYLON.MeshBuilder.CreateBox(
            'roof',
            { width: 11, height: 0.5, depth: 13 },
            this.scene
        );
        roof.position.y = 6.25;
        roof.parent = this.building;

        const roofMat = new BABYLON.StandardMaterial('roofMat', this.scene);
        roofMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.32);
        roof.material = roofMat;

        // Front wall with door opening
        // Left section
        const leftWall = BABYLON.MeshBuilder.CreateBox(
            'leftWall',
            { width: 2, height: 6, depth: 0.5 },
            this.scene
        );
        leftWall.position = new BABYLON.Vector3(-4, 3, 6.25);
        leftWall.parent = this.building;
        leftWall.material = wallMat;

        // Right section
        const rightWall = BABYLON.MeshBuilder.CreateBox(
            'rightWall',
            { width: 2, height: 6, depth: 0.5 },
            this.scene
        );
        rightWall.position = new BABYLON.Vector3(4, 3, 6.25);
        rightWall.parent = this.building;
        rightWall.material = wallMat;

        // Top section (above door)
        const topWall = BABYLON.MeshBuilder.CreateBox(
            'topWall',
            { width: 6, height: 1, depth: 0.5 },
            this.scene
        );
        topWall.position = new BABYLON.Vector3(0, 5.5, 6.25);
        topWall.parent = this.building;
        topWall.material = wallMat;

        // Team colored stripe
        const stripe = BABYLON.MeshBuilder.CreateBox(
            'teamStripe',
            { width: 10.5, height: 0.5, depth: 12.5 },
            this.scene
        );
        stripe.position.y = 5.85;
        stripe.parent = this.building;

        const stripeMat = new BABYLON.StandardMaterial('stripeMat', this.scene);
        stripeMat.diffuseColor = this.teamColor;
        stripeMat.emissiveColor = this.teamColor.scale(0.2);
        stripe.material = stripeMat;

        // Add shadows
        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(mainStructure);
            this.shadowGenerator.addShadowCaster(roof);
            this.shadowGenerator.addShadowCaster(leftWall);
            this.shadowGenerator.addShadowCaster(rightWall);
            this.shadowGenerator.addShadowCaster(topWall);
        }
    }

    /**
     * Create the overhead door
     */
    createDoor() {
        // Door frame
        this.doorFrame = new BABYLON.TransformNode('doorFrame', this.scene);
        this.doorFrame.position = new BABYLON.Vector3(0, 0, 6);
        this.doorFrame.parent = this.mesh;

        // Frame pieces
        const frameMat = new BABYLON.StandardMaterial('frameMat', this.scene);
        frameMat.diffuseColor = new BABYLON.Color3(0.25, 0.25, 0.27);

        // Left frame
        const leftFrame = BABYLON.MeshBuilder.CreateBox(
            'leftFrame',
            { width: 0.3, height: 5, depth: 0.6 },
            this.scene
        );
        leftFrame.position = new BABYLON.Vector3(-3.15, 2.5, 0);
        leftFrame.parent = this.doorFrame;
        leftFrame.material = frameMat;

        // Right frame
        const rightFrame = BABYLON.MeshBuilder.CreateBox(
            'rightFrame',
            { width: 0.3, height: 5, depth: 0.6 },
            this.scene
        );
        rightFrame.position = new BABYLON.Vector3(3.15, 2.5, 0);
        rightFrame.parent = this.doorFrame;
        rightFrame.material = frameMat;

        // Top frame (guides)
        const topFrame = BABYLON.MeshBuilder.CreateBox(
            'topFrame',
            { width: 6.6, height: 0.3, depth: 0.6 },
            this.scene
        );
        topFrame.position = new BABYLON.Vector3(0, 5.15, 0);
        topFrame.parent = this.doorFrame;
        topFrame.material = frameMat;

        // The actual overhead door (segmented panels)
        this.door = new BABYLON.TransformNode('overheadDoor', this.scene);
        this.door.position = new BABYLON.Vector3(0, 0, 0.1);
        this.door.parent = this.doorFrame;

        // Create door panels (segmented look)
        const doorMat = new BABYLON.StandardMaterial('doorMat', this.scene);
        doorMat.diffuseColor = new BABYLON.Color3(0.35, 0.35, 0.38);
        doorMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

        const panelHeight = 1.0;
        const numPanels = 5;

        for (let i = 0; i < numPanels; i++) {
            const panel = BABYLON.MeshBuilder.CreateBox(
                `doorPanel_${i}`,
                { width: 5.8, height: panelHeight - 0.05, depth: 0.15 },
                this.scene
            );
            panel.position.y = i * panelHeight + panelHeight / 2;
            panel.parent = this.door;
            panel.material = doorMat;

            // Panel groove (detail)
            const groove = BABYLON.MeshBuilder.CreateBox(
                `groove_${i}`,
                { width: 5.6, height: 0.05, depth: 0.18 },
                this.scene
            );
            groove.position.y = i * panelHeight + panelHeight;
            groove.parent = this.door;

            const grooveMat = new BABYLON.StandardMaterial(`grooveMat_${i}`, this.scene);
            grooveMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.22);
            groove.material = grooveMat;
        }

        // Warning stripes on floor
        const warningStripe = BABYLON.MeshBuilder.CreateBox(
            'warningStripe',
            { width: 6, height: 0.05, depth: 4 },
            this.scene
        );
        warningStripe.position = new BABYLON.Vector3(0, 0.03, 8);
        warningStripe.parent = this.mesh;

        const warningMat = new BABYLON.StandardMaterial('warningMat', this.scene);
        warningMat.diffuseColor = new BABYLON.Color3(0.9, 0.7, 0.1);
        warningStripe.material = warningMat;
    }

    /**
     * Create factory chimney
     */
    createChimney() {
        this.chimney = new BABYLON.TransformNode('chimney', this.scene);
        this.chimney.position = new BABYLON.Vector3(-3.5, 6, -4);
        this.chimney.parent = this.mesh;

        // Main chimney stack
        const stack = BABYLON.MeshBuilder.CreateCylinder(
            'chimneyStack',
            { diameterTop: 1.2, diameterBottom: 1.5, height: 4, tessellation: 12 },
            this.scene
        );
        stack.position.y = 2;
        stack.parent = this.chimney;

        const stackMat = new BABYLON.StandardMaterial('stackMat', this.scene);
        stackMat.diffuseColor = new BABYLON.Color3(0.5, 0.3, 0.25);
        stack.material = stackMat;

        // Chimney top ring
        const topRing = BABYLON.MeshBuilder.CreateCylinder(
            'chimneyTop',
            { diameter: 1.4, height: 0.3, tessellation: 12 },
            this.scene
        );
        topRing.position.y = 4.15;
        topRing.parent = this.chimney;

        const ringMat = new BABYLON.StandardMaterial('ringMat', this.scene);
        ringMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        topRing.material = ringMat;

        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(stack);
        }
    }

    /**
     * Create building details
     */
    createDetails() {
        // Side windows
        const windowMat = new BABYLON.StandardMaterial('windowMat', this.scene);
        windowMat.diffuseColor = new BABYLON.Color3(0.3, 0.4, 0.5);
        windowMat.emissiveColor = new BABYLON.Color3(0.1, 0.15, 0.2);
        windowMat.alpha = 0.8;

        // Left side windows
        for (let i = 0; i < 3; i++) {
            const window1 = BABYLON.MeshBuilder.CreateBox(
                `leftWindow_${i}`,
                { width: 0.1, height: 1.5, depth: 1.5 },
                this.scene
            );
            window1.position = new BABYLON.Vector3(-5.05, 4, -3 + i * 4);
            window1.parent = this.mesh;
            window1.material = windowMat;
        }

        // Right side windows
        for (let i = 0; i < 3; i++) {
            const window2 = BABYLON.MeshBuilder.CreateBox(
                `rightWindow_${i}`,
                { width: 0.1, height: 1.5, depth: 1.5 },
                this.scene
            );
            window2.position = new BABYLON.Vector3(5.05, 4, -3 + i * 4);
            window2.parent = this.mesh;
            window2.material = windowMat;
        }

        // Factory sign
        const signBoard = BABYLON.MeshBuilder.CreateBox(
            'signBoard',
            { width: 4, height: 1, depth: 0.2 },
            this.scene
        );
        signBoard.position = new BABYLON.Vector3(0, 7.5, 6);
        signBoard.parent = this.mesh;

        const signMat = new BABYLON.StandardMaterial('signMat', this.scene);
        signMat.diffuseColor = this.teamColor;
        signMat.emissiveColor = this.teamColor.scale(0.3);
        signBoard.material = signMat;

        // Gear icon on sign (simple representation)
        const gear = BABYLON.MeshBuilder.CreateCylinder(
            'gearIcon',
            { diameter: 0.6, height: 0.25, tessellation: 8 },
            this.scene
        );
        gear.position = new BABYLON.Vector3(0, 7.5, 6.15);
        gear.rotation.x = Math.PI / 2;
        gear.parent = this.mesh;

        const gearMat = new BABYLON.StandardMaterial('gearMat', this.scene);
        gearMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
        gearMat.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        gear.material = gearMat;
    }

    /**
     * Queue a tank for production
     */
    queueTank() {
        this.productionQueue.push('tank');

        // Start production if idle
        if (this.state === 'idle' && this.productionQueue.length === 1) {
            this.startProduction();
        }
    }

    /**
     * Start producing the next item in queue
     */
    startProduction() {
        if (this.productionQueue.length === 0) {
            return;
        }

        this.currentProduction = this.productionQueue.shift();
        this.productionProgress = 0;
        this.state = 'opening';
        this.doorTargetAmount = 1; // Open door
    }

    /**
     * Update factory state
     */
    update() {
        if (!this.mesh || !this.isActive || this.isPaused) return;

        super.update();

        const deltaTime = this.deltaTime || 0.016;

        // Update based on state
        switch (this.state) {
            case 'falling':
                this.updateFalling();
                break;
            case 'idle':
                // Check if there's something to produce
                if (this.productionQueue.length > 0) {
                    this.startProduction();
                }
                break;
            case 'opening':
                this.updateDoorAnimation(deltaTime);
                if (this.doorOpenAmount >= 0.95) {
                    this.doorOpenAmount = 1;
                    this.state = 'producing';
                }
                break;
            case 'producing':
                this.updateProduction(deltaTime);
                break;
            case 'deploying':
                // Door stays open while tank exits
                this.deployTimer -= deltaTime;
                // Check if tank has exited or timer expired
                if (this.deployTimer <= 0 || this.hasTankExited()) {
                    this.state = 'closing';
                    this.doorTargetAmount = 0; // Start closing door
                    this.deployedTank = null;
                }
                break;
            case 'closing':
                this.updateDoorAnimation(deltaTime);
                if (this.doorOpenAmount <= 0.05) {
                    this.doorOpenAmount = 0;
                    this.state = 'idle';
                    // Check for more production
                    if (this.productionQueue.length > 0) {
                        this.startProduction();
                    }
                }
                break;
        }
    }

    /**
     * Update falling state
     */
    updateFalling() {
        if (this.mesh.position.y > this.groundLevel) {
            this.velocity += this.gravity;
            this.mesh.position.y -= this.velocity;
        } else {
            this.mesh.position.y = this.groundLevel;
            this.state = 'idle';
            this.onPlaced();
        }
    }

    /**
     * Update door animation
     */
    updateDoorAnimation(deltaTime) {
        if (!this.door) return;

        const openSpeed = 1 / GameConstants.FACTORY.DOOR_OPEN_TIME;
        const closeSpeed = 1 / GameConstants.FACTORY.DOOR_CLOSE_TIME;

        if (this.doorTargetAmount > this.doorOpenAmount) {
            // Opening
            this.doorOpenAmount += openSpeed * deltaTime;
            this.doorOpenAmount = Math.min(this.doorOpenAmount, this.doorTargetAmount);
        } else if (this.doorTargetAmount < this.doorOpenAmount) {
            // Closing
            this.doorOpenAmount -= closeSpeed * deltaTime;
            this.doorOpenAmount = Math.max(this.doorOpenAmount, this.doorTargetAmount);
        }

        // Move door up (overhead style)
        this.door.position.y = this.doorOpenAmount * 5; // Full open = door at y=5
    }

    /**
     * Update production
     */
    updateProduction(deltaTime) {
        this.productionProgress += deltaTime;

        if (this.productionProgress >= GameConstants.FACTORY.PRODUCTION_TIME) {
            // Production complete!
            this.completeProduction();
        }
    }

    /**
     * Complete production and spawn the item
     */
    completeProduction() {
        if (this.currentProduction === 'tank') {
            // Spawn tank INSIDE the factory (will drive out)
            // The door is at local Z=6, so spawn at Z=0 (center) in local space
            // Then transform based on factory rotation
            const factoryRotation = this.mesh.rotation.y;

            // Spawn at factory center
            const spawnPos = new BABYLON.Vector3(
                this.mesh.position.x,
                0,
                this.mesh.position.z
            );

            const tank = new Tank(
                this.scene,
                spawnPos,
                this.shadowGenerator,
                this.team
            );

            // Calculate exit position (in front of door, 15 units out in door direction)
            // Use BabylonJS rotation formula: x' = x*cos + z*sin, z' = -x*sin + z*cos
            const exitLocalZ = 15; // Distance to drive out (in local +Z direction = front)
            const cos = Math.cos(factoryRotation);
            const sin = Math.sin(factoryRotation);
            const exitWorldX = this.mesh.position.x + exitLocalZ * sin;
            const exitWorldZ = this.mesh.position.z + exitLocalZ * cos;
            tank.exitTarget = new BABYLON.Vector3(exitWorldX, 0, exitWorldZ);

            // Set tank to driving out state
            tank.state = 'exiting_factory';
            tank.mesh.rotation.y = factoryRotation; // Face the exit direction

            this.producedTanks.push(tank);

            // Track deployed tank so we know when it's safe to close door
            this.deployedTank = tank;

            // Notify callback
            if (this.onTankProduced) {
                this.onTankProduced(tank);
            }

            console.log(`Factory produced a ${this.team} tank!`);
        }

        this.currentProduction = null;
        this.productionProgress = 0;

        // Enter deploying state - door stays open while tank exits
        this.state = 'deploying';
        this.deployTimer = 3.0; // Max 3 seconds to exit, then door closes anyway
        // Door stays open (doorTargetAmount remains 1)
    }

    /**
     * Check if the deployed tank has exited the factory area
     */
    hasTankExited() {
        if (!this.deployedTank || !this.deployedTank.isActive) {
            return true; // Tank gone or destroyed, safe to close
        }

        // Check if tank has moved far enough from factory
        const tankPos = this.deployedTank.mesh.position;
        const factoryPos = this.mesh.position;
        const dx = tankPos.x - factoryPos.x;
        const dz = tankPos.z - factoryPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Tank needs to be at least 10 units away to be considered "exited"
        return distance > 10;
    }

    /**
     * Get production progress (0-1)
     */
    getProductionProgress() {
        if (this.state !== 'producing' && this.state !== 'opening') {
            return 0;
        }
        return Math.min(1, this.productionProgress / GameConstants.FACTORY.PRODUCTION_TIME);
    }

    /**
     * Check if factory is producing
     */
    isProducing() {
        return this.state === 'producing' || this.state === 'opening' || this.state === 'deploying' || this.state === 'closing';
    }

    /**
     * Get queue length
     */
    getQueueLength() {
        return this.productionQueue.length + (this.currentProduction ? 1 : 0);
    }

    /**
     * Called when factory is placed
     */
    onPlaced() {
        console.log(`Factory placed at (${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.z.toFixed(1)})`);
    }

    /**
     * Set callback for when tank is produced
     */
    setOnTankProduced(callback) {
        this.onTankProduced = callback;
    }

    /**
     * Set click callback (called by main.js to wire up menu)
     */
    setOnClickCallback(callback) {
        this.onClickCallback = callback;
    }

    /**
     * Set sound manager
     */
    setSoundManager(manager) {
        this.soundManager = manager;
    }

    /**
     * Get position
     */
    getPosition() {
        return this.mesh ? this.mesh.position.clone() : this.position.clone();
    }

    /**
     * Get team
     */
    getTeam() {
        return this.team;
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

    /**
     * Dispose factory
     */
    dispose() {
        // Don't dispose produced tanks - they're independent now
        this.producedTanks = [];
        this.productionQueue = [];

        super.dispose();
    }
}
