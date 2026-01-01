import { SpawnableObject } from './SpawnableObject.js';
import { GameConstants } from '../config/GameConstants.js';

/**
 * Armory - Building that crafts swords and equips bubbies as soldiers
 *
 * Click on armory to open build menu (like HQ).
 * Stores crafted swords in inventory.
 * Bubbies can be assigned as soldiers via drag-drop or autonomous decision.
 */
export class Armory extends SpawnableObject {
    constructor(scene, position, shadowGenerator, team = 'red') {
        super(scene, position, shadowGenerator, 150);

        this.team = team;
        this.velocity = 0;
        this.gravity = GameConstants.PHYSICS.GRAVITY;
        this.groundLevel = 1.25; // Half of building height
        this.state = 'falling'; // 'falling', 'placed'
        this.isPaused = false;

        // Sword inventory
        this.swordCount = 0;

        // Armor inventory
        this.armorCount = 0;

        // Callbacks
        this.getCastle = null; // Function to get team's castle (for resources)
        this.onClickCallback = null; // Callback when armory is clicked (opens menu)

        // Visual elements
        this.anvilMesh = null;
        this.chimneyMesh = null;
        this.swordDisplayMeshes = []; // Visual swords around building
        this.armorDisplayMeshes = []; // Visual armor around building

        this.create();
        this.enableShadows();
        this.createHealthBar(2.5);
        this.setupClickHandler();
    }

    /**
     * Create the armory mesh (building with anvil and chimney)
     */
    create() {
        // Main building
        this.mesh = BABYLON.MeshBuilder.CreateBox(
            `armory_${Date.now()}`,
            {
                width: 3,
                height: 2.5,
                depth: 2.5
            },
            this.scene
        );

        this.mesh.position = this.position.clone();

        // Create armory material (bronze/brown)
        const material = new BABYLON.StandardMaterial(`armoryMat_${Date.now()}`, this.scene);
        material.diffuseColor = new BABYLON.Color3(0.55, 0.4, 0.25); // Bronze

        // Add team colored emissive for visibility
        if (this.team === 'red') {
            material.emissiveColor = new BABYLON.Color3(0.15, 0, 0);
        } else {
            material.emissiveColor = new BABYLON.Color3(0, 0, 0.15);
        }

        this.mesh.material = material;

        // Create anvil on top
        this.anvilMesh = BABYLON.MeshBuilder.CreateBox(
            `armoryAnvil_${Date.now()}`,
            {
                width: 0.8,
                height: 0.4,
                depth: 0.5
            },
            this.scene
        );
        this.anvilMesh.position.y = 1.45;
        this.anvilMesh.parent = this.mesh;

        const anvilMaterial = new BABYLON.StandardMaterial(`anvilMat_${Date.now()}`, this.scene);
        anvilMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);
        anvilMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        this.anvilMesh.material = anvilMaterial;

        // Create chimney
        this.chimneyMesh = BABYLON.MeshBuilder.CreateCylinder(
            `armoryChimney_${Date.now()}`,
            {
                diameter: 0.5,
                height: 1.2,
                tessellation: 8
            },
            this.scene
        );
        this.chimneyMesh.position.x = -1.0;
        this.chimneyMesh.position.y = 1.8;
        this.chimneyMesh.parent = this.mesh;

        const chimneyMaterial = new BABYLON.StandardMaterial(`chimneyMat_${Date.now()}`, this.scene);
        chimneyMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.35, 0.3);
        this.chimneyMesh.material = chimneyMaterial;

        // Create equipment displays (visual items around building when available)
        this.createSwordDisplay();
        this.createArmorDisplay();
    }

    /**
     * Create sword display meshes (shows swords leaning against building)
     */
    createSwordDisplay() {
        // Array to hold multiple sword displays
        this.swordDisplayMeshes = [];

        // Create materials once to reuse
        this.swordBladeMat = new BABYLON.StandardMaterial(`armorySwordBladeMat_${Date.now()}`, this.scene);
        this.swordBladeMat.diffuseColor = new BABYLON.Color3(0.8, 0.82, 0.85);
        this.swordBladeMat.specularColor = new BABYLON.Color3(1.0, 1.0, 1.0);
        this.swordBladeMat.specularPower = 64;

        this.swordCrossguardMat = new BABYLON.StandardMaterial(`armorySwordCrossguardMat_${Date.now()}`, this.scene);
        this.swordCrossguardMat.diffuseColor = this.team === 'red'
            ? new BABYLON.Color3(0.7, 0.25, 0.15)
            : new BABYLON.Color3(0.15, 0.25, 0.7);

        this.swordHandleMat = new BABYLON.StandardMaterial(`armorySwordHandleMat_${Date.now()}`, this.scene);
        this.swordHandleMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.12);

        // Legacy reference for compatibility
        this.swordDisplayMesh = null;
    }

    /**
     * Create a single sword mesh leaning against the building
     */
    createLeaningSword(index) {
        const swordRoot = new BABYLON.TransformNode(`armorySwordDisplay_${index}_${Date.now()}`, this.scene);
        swordRoot.parent = this.mesh;

        // Position swords in a circle around the armory at random angles
        // Building is 3 wide, 2.5 deep, 2.5 tall
        const radius = 2.2; // Distance from center of building
        const randomAngle = Math.random() * Math.PI * 2; // Random angle around building

        const xPos = Math.cos(randomAngle) * radius;
        const zPos = Math.sin(randomAngle) * radius;

        swordRoot.position = new BABYLON.Vector3(xPos, -0.8, zPos); // Around building, near ground
        swordRoot.rotation.x = -0.25 + Math.random() * 0.1; // Slight lean variation
        swordRoot.rotation.y = randomAngle + Math.PI + (Math.random() - 0.5) * 0.4; // Face outward with variation

        // Blade - same size as bubby sword
        const blade = BABYLON.MeshBuilder.CreateBox(
            `armorySwordBlade_${index}_${Date.now()}`,
            { width: 0.3, height: 2.4, depth: 0.08 },
            this.scene
        );
        blade.parent = swordRoot;
        blade.position.y = 1.4;
        blade.material = this.swordBladeMat;

        // Crossguard
        const crossguard = BABYLON.MeshBuilder.CreateBox(
            `armorySwordCrossguard_${index}_${Date.now()}`,
            { width: 1.0, height: 0.16, depth: 0.16 },
            this.scene
        );
        crossguard.parent = swordRoot;
        crossguard.position.y = 0.2;
        crossguard.material = this.swordCrossguardMat;

        // Handle
        const handle = BABYLON.MeshBuilder.CreateCylinder(
            `armorySwordHandle_${index}_${Date.now()}`,
            { diameter: 0.24, height: 0.6, tessellation: 8 },
            this.scene
        );
        handle.parent = swordRoot;
        handle.position.y = -0.2;
        handle.material = this.swordHandleMat;

        // Add to shadow casters
        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(blade);
            this.shadowGenerator.addShadowCaster(crossguard);
            this.shadowGenerator.addShadowCaster(handle);
        }

        return swordRoot;
    }

    /**
     * Update sword display - add or remove sword meshes based on inventory
     */
    updateSwordDisplay() {
        // Add swords if we have more than displayed
        while (this.swordDisplayMeshes.length < this.swordCount) {
            const sword = this.createLeaningSword(this.swordDisplayMeshes.length);
            this.swordDisplayMeshes.push(sword);
        }

        // Remove swords if we have fewer than displayed
        while (this.swordDisplayMeshes.length > this.swordCount) {
            const sword = this.swordDisplayMeshes.pop();
            if (sword) {
                sword.dispose();
            }
        }
    }

    /**
     * Create armor display materials
     */
    createArmorDisplay() {
        // Create materials once to reuse
        this.armorMetalMat = new BABYLON.StandardMaterial(`armoryArmorMetalMat_${Date.now()}`, this.scene);
        this.armorMetalMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.55);
        this.armorMetalMat.specularColor = new BABYLON.Color3(0.7, 0.7, 0.75);
        this.armorMetalMat.specularPower = 32;

        this.armorTrimMat = new BABYLON.StandardMaterial(`armoryArmorTrimMat_${Date.now()}`, this.scene);
        this.armorTrimMat.diffuseColor = this.team === 'red'
            ? new BABYLON.Color3(0.6, 0.2, 0.15)
            : new BABYLON.Color3(0.15, 0.2, 0.6);
    }

    /**
     * Create a single armor mesh displayed around the building
     */
    createStandingArmor(index) {
        const armorRoot = new BABYLON.TransformNode(`armoryArmorDisplay_${index}_${Date.now()}`, this.scene);
        armorRoot.parent = this.mesh;

        // Position armor in a circle around the armory at random angles
        const radius = 2.5; // Slightly further out than swords
        const randomAngle = Math.random() * Math.PI * 2;

        const xPos = Math.cos(randomAngle) * radius;
        const zPos = Math.sin(randomAngle) * radius;

        armorRoot.position = new BABYLON.Vector3(xPos, -1.0, zPos); // Near ground
        armorRoot.rotation.y = randomAngle + Math.PI + (Math.random() - 0.5) * 0.3; // Face outward

        // Metal vest (main body piece) - curved box shape
        const vest = BABYLON.MeshBuilder.CreateBox(
            `armoryArmorVest_${index}_${Date.now()}`,
            { width: 1.2, height: 1.4, depth: 0.6 },
            this.scene
        );
        vest.parent = armorRoot;
        vest.position.y = 0.9;
        vest.material = this.armorMetalMat;

        // Shoulder guards
        const leftShoulder = BABYLON.MeshBuilder.CreateBox(
            `armoryArmorLeftShoulder_${index}_${Date.now()}`,
            { width: 0.5, height: 0.25, depth: 0.4 },
            this.scene
        );
        leftShoulder.parent = armorRoot;
        leftShoulder.position = new BABYLON.Vector3(-0.7, 1.5, 0);
        leftShoulder.rotation.z = 0.3;
        leftShoulder.material = this.armorMetalMat;

        const rightShoulder = BABYLON.MeshBuilder.CreateBox(
            `armoryArmorRightShoulder_${index}_${Date.now()}`,
            { width: 0.5, height: 0.25, depth: 0.4 },
            this.scene
        );
        rightShoulder.parent = armorRoot;
        rightShoulder.position = new BABYLON.Vector3(0.7, 1.5, 0);
        rightShoulder.rotation.z = -0.3;
        rightShoulder.material = this.armorMetalMat;

        // Team-colored trim stripe down the center
        const trim = BABYLON.MeshBuilder.CreateBox(
            `armoryArmorTrim_${index}_${Date.now()}`,
            { width: 0.2, height: 1.3, depth: 0.65 },
            this.scene
        );
        trim.parent = armorRoot;
        trim.position.y = 0.9;
        trim.material = this.armorTrimMat;

        // Add to shadow casters
        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(vest);
            this.shadowGenerator.addShadowCaster(leftShoulder);
            this.shadowGenerator.addShadowCaster(rightShoulder);
            this.shadowGenerator.addShadowCaster(trim);
        }

        return armorRoot;
    }

    /**
     * Update armor display - add or remove armor meshes based on inventory
     */
    updateArmorDisplay() {
        // Add armor if we have more than displayed
        while (this.armorDisplayMeshes.length < this.armorCount) {
            const armor = this.createStandingArmor(this.armorDisplayMeshes.length);
            this.armorDisplayMeshes.push(armor);
        }

        // Remove armor if we have fewer than displayed
        while (this.armorDisplayMeshes.length > this.armorCount) {
            const armor = this.armorDisplayMeshes.pop();
            if (armor) {
                armor.dispose();
            }
        }
    }

    /**
     * Setup click handler to open menu
     */
    setupClickHandler() {
        this.mesh.isPickable = true;
        this.mesh.actionManager = new BABYLON.ActionManager(this.scene);
        this.mesh.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPickTrigger,
                () => {
                    if (this.state === 'placed' && this.onClickCallback) {
                        this.onClickCallback(this);
                    }
                }
            )
        );
    }

    /**
     * Set click callback (called by main.js to wire up menu)
     */
    setOnClickCallback(callback) {
        this.onClickCallback = callback;
    }

    /**
     * Craft a sword (consumes resources, adds to inventory)
     * @returns {boolean} True if sword was crafted
     */
    craftSword() {
        if (!this.getCastle) {
            console.log('Armory not properly configured');
            return false;
        }

        const castle = this.getCastle();
        if (!castle) {
            console.log('No castle found');
            return false;
        }

        const woodCost = GameConstants.SWORD.WOOD_COST;
        const stoneCost = GameConstants.SWORD.STONE_COST;

        // Check if we have enough resources
        if (castle.getWoodCount() < woodCost) {
            console.log(`Not enough wood for sword. Need ${woodCost}, have ${castle.getWoodCount()}`);
            this.flashInsufficient();
            return false;
        }

        if (castle.getStoneCount() < stoneCost) {
            console.log(`Not enough stone for sword. Need ${stoneCost}, have ${castle.getStoneCount()}`);
            this.flashInsufficient();
            return false;
        }

        // Consume resources
        castle.useWood(woodCost);
        castle.useStone(stoneCost);

        // Add sword to inventory
        this.swordCount++;
        this.updateSwordDisplay();

        // Visual feedback
        this.flashSuccess();

        console.log(`Sword crafted! Inventory: ${this.swordCount} swords`);
        return true;
    }

    /**
     * Check if armory can craft a sword
     */
    canCraftSword() {
        if (!this.getCastle) return false;

        const castle = this.getCastle();
        if (!castle) return false;

        const woodCost = GameConstants.SWORD.WOOD_COST;
        const stoneCost = GameConstants.SWORD.STONE_COST;

        return castle.getWoodCount() >= woodCost && castle.getStoneCount() >= stoneCost;
    }

    /**
     * Check if armory has a sword available
     */
    hasSword() {
        return this.swordCount > 0;
    }

    /**
     * Take a sword from inventory (for equipping a bubby)
     * @returns {boolean} True if sword was taken
     */
    takeSword() {
        if (this.swordCount > 0) {
            this.swordCount--;
            this.updateSwordDisplay();
            return true;
        }
        return false;
    }

    /**
     * Get sword count
     */
    getSwordCount() {
        return this.swordCount;
    }

    /**
     * Get sword cost
     */
    getSwordCost() {
        return {
            wood: GameConstants.SWORD.WOOD_COST,
            stone: GameConstants.SWORD.STONE_COST
        };
    }

    /**
     * Craft armor (consumes resources, adds to inventory)
     * @returns {boolean} True if armor was crafted
     */
    craftArmor() {
        if (!this.getCastle) {
            console.log('Armory not properly configured');
            return false;
        }

        const castle = this.getCastle();
        if (!castle) {
            console.log('No castle found');
            return false;
        }

        const woodCost = GameConstants.ARMOR.WOOD_COST;
        const stoneCost = GameConstants.ARMOR.STONE_COST;

        // Check if we have enough resources
        if (castle.getWoodCount() < woodCost) {
            console.log(`Not enough wood for armor. Need ${woodCost}, have ${castle.getWoodCount()}`);
            this.flashInsufficient();
            return false;
        }

        if (castle.getStoneCount() < stoneCost) {
            console.log(`Not enough stone for armor. Need ${stoneCost}, have ${castle.getStoneCount()}`);
            this.flashInsufficient();
            return false;
        }

        // Consume resources
        castle.useWood(woodCost);
        castle.useStone(stoneCost);

        // Add armor to inventory
        this.armorCount++;
        this.updateArmorDisplay();

        // Visual feedback
        this.flashSuccess();

        console.log(`Armor crafted! Inventory: ${this.armorCount} armor sets`);
        return true;
    }

    /**
     * Check if armory can craft armor
     */
    canCraftArmor() {
        if (!this.getCastle) return false;

        const castle = this.getCastle();
        if (!castle) return false;

        const woodCost = GameConstants.ARMOR.WOOD_COST;
        const stoneCost = GameConstants.ARMOR.STONE_COST;

        return castle.getWoodCount() >= woodCost && castle.getStoneCount() >= stoneCost;
    }

    /**
     * Check if armory has armor available
     */
    hasArmor() {
        return this.armorCount > 0;
    }

    /**
     * Take armor from inventory (for equipping a bubby)
     * @returns {boolean} True if armor was taken
     */
    takeArmor() {
        if (this.armorCount > 0) {
            this.armorCount--;
            this.updateArmorDisplay();
            return true;
        }
        return false;
    }

    /**
     * Get armor count
     */
    getArmorCount() {
        return this.armorCount;
    }

    /**
     * Get armor cost
     */
    getArmorCost() {
        return {
            wood: GameConstants.ARMOR.WOOD_COST,
            stone: GameConstants.ARMOR.STONE_COST
        };
    }

    /**
     * Get position (for drop detection)
     */
    getPosition() {
        return this.mesh ? this.mesh.position.clone() : this.position.clone();
    }

    /**
     * Flash red when resources are insufficient
     */
    flashInsufficient() {
        const originalColor = this.mesh.material.diffuseColor.clone();
        this.mesh.material.diffuseColor = new BABYLON.Color3(1, 0.2, 0.2);

        setTimeout(() => {
            if (this.mesh && this.mesh.material) {
                this.mesh.material.diffuseColor = originalColor;
            }
        }, 200);
    }

    /**
     * Flash green when action succeeds
     */
    flashSuccess() {
        const originalColor = this.mesh.material.diffuseColor.clone();
        this.mesh.material.diffuseColor = new BABYLON.Color3(0.2, 1, 0.2);

        setTimeout(() => {
            if (this.mesh && this.mesh.material) {
                this.mesh.material.diffuseColor = originalColor;
            }
        }, 300);
    }

    /**
     * Override enableShadows for multiple meshes
     */
    enableShadows() {
        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(this.mesh);
            if (this.anvilMesh) this.shadowGenerator.addShadowCaster(this.anvilMesh);
            if (this.chimneyMesh) this.shadowGenerator.addShadowCaster(this.chimneyMesh);
        }
    }

    /**
     * Update armory state
     */
    update() {
        if (!this.mesh || !this.isActive || this.isPaused) {
            return;
        }

        // Call parent update for healthbar
        super.update();

        if (this.state === 'falling') {
            this.updateFalling();
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
        } else {
            // Landed
            this.mesh.position.y = this.groundLevel;
            this.state = 'placed';
            this.onPlaced();
        }
    }

    /**
     * Called when armory is placed on the ground
     */
    onPlaced() {
        console.log(`Armory placed at (${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.z.toFixed(1)}). Click to open menu!`);
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
     * Dispose armory
     */
    dispose() {
        if (this.anvilMesh) {
            this.anvilMesh.dispose();
            this.anvilMesh = null;
        }
        if (this.chimneyMesh) {
            this.chimneyMesh.dispose();
            this.chimneyMesh = null;
        }
        // Dispose all sword display meshes
        if (this.swordDisplayMeshes) {
            for (const sword of this.swordDisplayMeshes) {
                if (sword) sword.dispose();
            }
            this.swordDisplayMeshes = [];
        }
        // Dispose all armor display meshes
        if (this.armorDisplayMeshes) {
            for (const armor of this.armorDisplayMeshes) {
                if (armor) armor.dispose();
            }
            this.armorDisplayMeshes = [];
        }
        // Dispose sword materials
        if (this.swordBladeMat) this.swordBladeMat.dispose();
        if (this.swordCrossguardMat) this.swordCrossguardMat.dispose();
        if (this.swordHandleMat) this.swordHandleMat.dispose();
        // Dispose armor materials
        if (this.armorMetalMat) this.armorMetalMat.dispose();
        if (this.armorTrimMat) this.armorTrimMat.dispose();

        super.dispose();
    }
}
