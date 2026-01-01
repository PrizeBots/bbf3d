import { GameConstants } from '../config/GameConstants.js';

/**
 * Castle - Represents a team's castle structure
 */
export class Castle {
    constructor(scene, team, position, shadowGenerator) {
        this.scene = scene;
        this.team = team;
        this.position = position;
        this.shadowGenerator = shadowGenerator;
        this.rootNode = null;
        this.meshes = [];

        // Resource inventories - start with 10 wood and 10 stone
        this.fruitInventory = 0;
        this.woodInventory = 10;
        this.stoneInventory = 10;

        // Health system
        this.maxHealth = GameConstants.CASTLE?.MAX_HEALTH || 500;
        this.health = this.maxHealth;
        this.isActive = true;
        this.healthBarMesh = null;
        this.healthBarBackground = null;

        // Click callback
        this.onClickCallback = null;

        // Resource deposit callback (for UI updates)
        this.onResourceDepositCallback = null;

        // Death callback
        this.onDeathCallback = null;

        this.build();
        this.createHealthBar();
    }

    /**
     * Build the castle structure
     */
    build() {
        // Create root transform node
        this.rootNode = new BABYLON.TransformNode(`castle_${this.team}`);
        this.rootNode.position = this.position;

        // Get team color
        const color = this.getTeamColor();

        // Build components
        this.createMainBody(color);
        this.createTowers(color);
        this.createGate();
    }

    /**
     * Get color based on team
     */
    getTeamColor() {
        return this.team === "red"
            ? new BABYLON.Color3(0.8, 0.2, 0.2)
            : new BABYLON.Color3(0.2, 0.3, 0.9);
    }

    /**
     * Create main castle body
     */
    createMainBody(color) {
        const body = BABYLON.MeshBuilder.CreateBox(
            `body_${this.team}`,
            {
                width: 8,
                height: 10,
                depth: 8
            },
            this.scene
        );
        body.position.y = 5;
        body.parent = this.rootNode;

        const bodyMaterial = new BABYLON.StandardMaterial(`bodyMat_${this.team}`, this.scene);
        bodyMaterial.diffuseColor = color;
        body.material = bodyMaterial;

        this.shadowGenerator.addShadowCaster(body);
        this.meshes.push(body);
    }

    /**
     * Create corner towers
     */
    createTowers(color) {
        const towerPositions = [
            new BABYLON.Vector3(-3, 7, -3),
            new BABYLON.Vector3(3, 7, -3),
            new BABYLON.Vector3(-3, 7, 3),
            new BABYLON.Vector3(3, 7, 3)
        ];

        towerPositions.forEach((pos, index) => {
            // Tower cylinder
            const tower = BABYLON.MeshBuilder.CreateCylinder(
                `tower_${this.team}_${index}`,
                {
                    diameter: 2.5,
                    height: 6
                },
                this.scene
            );
            tower.position = pos;
            tower.parent = this.rootNode;

            const towerMaterial = new BABYLON.StandardMaterial(
                `towerMat_${this.team}_${index}`,
                this.scene
            );
            towerMaterial.diffuseColor = color;
            tower.material = towerMaterial;

            this.shadowGenerator.addShadowCaster(tower);
            this.meshes.push(tower);

            // Tower roof (cone)
            const roof = BABYLON.MeshBuilder.CreateCylinder(
                `roof_${this.team}_${index}`,
                {
                    diameterTop: 0,
                    diameterBottom: 3,
                    height: 2
                },
                this.scene
            );
            roof.position = pos.add(new BABYLON.Vector3(0, 4, 0));
            roof.parent = this.rootNode;

            const roofMaterial = new BABYLON.StandardMaterial(
                `roofMat_${this.team}_${index}`,
                this.scene
            );
            roofMaterial.diffuseColor = this.team === "red"
                ? new BABYLON.Color3(0.5, 0.1, 0.1)
                : new BABYLON.Color3(0.1, 0.2, 0.6);
            roof.material = roofMaterial;

            this.shadowGenerator.addShadowCaster(roof);
            this.meshes.push(roof);
        });
    }

    /**
     * Create castle gate
     */
    createGate() {
        const gate = BABYLON.MeshBuilder.CreateBox(
            `gate_${this.team}`,
            {
                width: 3,
                height: 4,
                depth: 0.2
            },
            this.scene
        );
        gate.position = new BABYLON.Vector3(0, 2, 4);
        gate.parent = this.rootNode;

        const gateMaterial = new BABYLON.StandardMaterial(`gateMat_${this.team}`, this.scene);
        gateMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.1);
        gate.material = gateMaterial;

        this.shadowGenerator.addShadowCaster(gate);
        this.meshes.push(gate);
    }

    /**
     * Create health bar above castle
     */
    createHealthBar() {
        const barWidth = 10;
        const barHeight = 0.8;
        const barY = 14; // Above castle towers

        // Background (dark gray)
        this.healthBarBackground = BABYLON.MeshBuilder.CreatePlane(
            `castleHealthBg_${this.team}`,
            { width: barWidth, height: barHeight },
            this.scene
        );
        this.healthBarBackground.position = new BABYLON.Vector3(
            this.position.x,
            barY,
            this.position.z
        );
        this.healthBarBackground.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const bgMaterial = new BABYLON.StandardMaterial(`castleHealthBgMat_${this.team}`, this.scene);
        bgMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        bgMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        bgMaterial.backFaceCulling = false;
        this.healthBarBackground.material = bgMaterial;

        // Health bar (team color)
        this.healthBarMesh = BABYLON.MeshBuilder.CreatePlane(
            `castleHealthBar_${this.team}`,
            { width: barWidth - 0.2, height: barHeight - 0.2 },
            this.scene
        );
        this.healthBarMesh.position = new BABYLON.Vector3(
            this.position.x,
            barY,
            this.position.z - 0.01
        );
        this.healthBarMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const healthMaterial = new BABYLON.StandardMaterial(`castleHealthMat_${this.team}`, this.scene);
        healthMaterial.diffuseColor = this.team === 'red'
            ? new BABYLON.Color3(0.9, 0.2, 0.2)
            : new BABYLON.Color3(0.2, 0.4, 0.9);
        healthMaterial.emissiveColor = this.team === 'red'
            ? new BABYLON.Color3(0.4, 0.1, 0.1)
            : new BABYLON.Color3(0.1, 0.2, 0.4);
        healthMaterial.backFaceCulling = false;
        this.healthBarMesh.material = healthMaterial;
    }

    /**
     * Update health bar display
     */
    updateHealthBar() {
        if (!this.healthBarMesh) return;

        const healthPercent = this.health / this.maxHealth;
        this.healthBarMesh.scaling.x = Math.max(0.01, healthPercent);

        // Offset to keep bar left-aligned
        const barWidth = 9.8;
        const offset = (barWidth * (1 - healthPercent)) / 2;
        this.healthBarMesh.position.x = this.position.x - offset;

        // Change color as health decreases
        if (healthPercent < 0.3) {
            this.healthBarMesh.material.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2);
            this.healthBarMesh.material.emissiveColor = new BABYLON.Color3(0.4, 0.1, 0.1);
        } else if (healthPercent < 0.6) {
            this.healthBarMesh.material.diffuseColor = new BABYLON.Color3(0.9, 0.7, 0.2);
            this.healthBarMesh.material.emissiveColor = new BABYLON.Color3(0.4, 0.3, 0.1);
        }
    }

    /**
     * Take damage
     * @param {number} damage - Amount of damage to take
     * @returns {boolean} True if castle was destroyed
     */
    takeDamage(damage) {
        if (!this.isActive) return false;

        this.health -= damage;
        this.updateHealthBar();

        // Flash red on damage
        this.flashDamage();

        if (this.health <= 0) {
            this.health = 0;
            this.die();
            return true;
        }

        return false;
    }

    /**
     * Flash meshes red when taking damage
     */
    flashDamage() {
        const originalColors = [];

        // Store original colors
        this.meshes.forEach((mesh, index) => {
            if (mesh.material) {
                originalColors[index] = mesh.material.diffuseColor.clone();
                mesh.material.diffuseColor = new BABYLON.Color3(1, 0.3, 0.3);
            }
        });

        // Restore after delay
        setTimeout(() => {
            this.meshes.forEach((mesh, index) => {
                if (mesh.material && originalColors[index]) {
                    mesh.material.diffuseColor = originalColors[index];
                }
            });
        }, 100);
    }

    /**
     * Castle destroyed
     */
    die() {
        this.isActive = false;
        console.log(`${this.team} castle has been destroyed!`);

        if (this.onDeathCallback) {
            this.onDeathCallback(this);
        }
    }

    /**
     * Set death callback
     */
    setOnDeathCallback(callback) {
        this.onDeathCallback = callback;
    }

    /**
     * Get current health
     */
    getHealth() {
        return this.health;
    }

    /**
     * Get max health
     */
    getMaxHealth() {
        return this.maxHealth;
    }

    /**
     * Get castle position
     */
    getPosition() {
        return this.position;
    }

    /**
     * Get team identifier
     */
    getTeam() {
        return this.team;
    }

    /**
     * Add fruit to inventory (called when bubby deposits)
     */
    addFruit(amount = 1) {
        this.fruitInventory += amount;
        // Notify listeners (for real-time UI updates)
        if (this.onResourceDepositCallback) {
            this.onResourceDepositCallback(this);
        }
    }

    /**
     * Set callback for when resources are deposited
     */
    setOnResourceDepositCallback(callback) {
        this.onResourceDepositCallback = callback;
    }

    /**
     * Get current fruit inventory
     */
    getFruitCount() {
        return this.fruitInventory;
    }

    /**
     * Sell a fruit (remove from inventory)
     * Returns true if successful, false if no fruit available
     */
    sellFruit() {
        if (this.fruitInventory > 0) {
            this.fruitInventory--;
            return true;
        }
        return false;
    }

    /**
     * Add wood to inventory
     */
    addWood(amount = 1) {
        this.woodInventory += amount;
        // Notify listeners (for real-time UI updates)
        if (this.onResourceDepositCallback) {
            this.onResourceDepositCallback(this);
        }
    }

    /**
     * Get current wood inventory
     */
    getWoodCount() {
        return this.woodInventory;
    }

    /**
     * Use wood from inventory
     * Returns true if successful
     */
    useWood(amount) {
        if (this.woodInventory >= amount) {
            this.woodInventory -= amount;
            return true;
        }
        return false;
    }

    /**
     * Add stone to inventory
     */
    addStone(amount = 1) {
        this.stoneInventory += amount;
        // Notify listeners (for real-time UI updates)
        if (this.onResourceDepositCallback) {
            this.onResourceDepositCallback(this);
        }
    }

    /**
     * Get current stone inventory
     */
    getStoneCount() {
        return this.stoneInventory;
    }

    /**
     * Use stone from inventory
     * Returns true if successful
     */
    useStone(amount) {
        if (this.stoneInventory >= amount) {
            this.stoneInventory -= amount;
            return true;
        }
        return false;
    }

    /**
     * Set click callback for when castle is clicked
     */
    setOnClickCallback(callback) {
        this.onClickCallback = callback;

        // Make all meshes pickable
        this.meshes.forEach(mesh => {
            mesh.isPickable = true;
            mesh.actionManager = new BABYLON.ActionManager(this.scene);
            mesh.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPickTrigger,
                    () => {
                        if (this.onClickCallback) {
                            this.onClickCallback(this);
                        }
                    }
                )
            );
        });
    }

    /**
     * Dispose castle and all its meshes
     */
    dispose() {
        if (this.healthBarMesh) {
            this.healthBarMesh.dispose();
            this.healthBarMesh = null;
        }
        if (this.healthBarBackground) {
            this.healthBarBackground.dispose();
            this.healthBarBackground = null;
        }
        this.meshes.forEach(mesh => mesh.dispose());
        this.rootNode.dispose();
    }
}