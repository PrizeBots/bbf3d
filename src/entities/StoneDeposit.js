import { HealthBar } from '../components/HealthBar.js';

/**
 * StoneDeposit - Large rock formation that can be mined for stone pieces
 *
 * Bubbies attack the deposit to knock off stone pieces which can be collected
 */
export class StoneDeposit {
    constructor(scene, position, shadowGenerator) {
        this.scene = scene;
        this.position = position.clone();
        this.shadowGenerator = shadowGenerator;

        // Mining state
        this.maxHP = 50;
        this.currentHP = this.maxHP;
        this.isActive = true;

        // Visual elements
        this.mesh = null;
        this.rocks = [];
        this.healthBar = null;

        // Callback for spawning stone pieces
        this.onStonePieceSpawnCallback = null;

        // Random seed for consistent appearance
        this.randomSeed = Math.random();

        this.create();
        this.createHealthBar();
    }

    /**
     * Seeded random number generator for consistent procedural generation
     */
    seededRandom() {
        this.randomSeed = (this.randomSeed * 9301 + 49297) % 233280;
        return this.randomSeed / 233280;
    }

    /**
     * Create a rounded boulder mesh using icosphere
     */
    createBoulder(name, size) {
        // Use icosphere for rounded boulder look
        const boulder = BABYLON.MeshBuilder.CreateIcoSphere(
            name,
            {
                radius: size,
                subdivisions: 2, // Low poly for rocky feel
                flat: true // Flat shading for faceted rock look
            },
            this.scene
        );
        return boulder;
    }

    /**
     * Create the stone deposit mesh (procedurally generated pile of rounded boulders)
     */
    create() {
        // Create root transform
        this.mesh = new BABYLON.TransformNode(`stoneDeposit_${Date.now()}`, this.scene);
        this.mesh.position = this.position;

        // Generate random number of boulders (4-7)
        const numRocks = 4 + Math.floor(this.seededRandom() * 4);

        // Create main boulder (largest rock in center)
        const mainSize = 1.0 + this.seededRandom() * 0.5; // 1.0 to 1.5

        const mainRock = this.createBoulder(`stoneMain_${Date.now()}`, mainSize);
        mainRock.position.y = mainSize * 0.7;
        mainRock.rotation.x = this.seededRandom() * Math.PI * 0.2;
        mainRock.rotation.y = this.seededRandom() * Math.PI * 2;
        mainRock.rotation.z = this.seededRandom() * Math.PI * 0.2;

        // Squash/stretch for natural boulder shape
        const squashY = 0.7 + this.seededRandom() * 0.3; // Flattened
        const squashX = 0.85 + this.seededRandom() * 0.3;
        const squashZ = 0.85 + this.seededRandom() * 0.3;
        mainRock.scaling = new BABYLON.Vector3(squashX, squashY, squashZ);
        mainRock.parent = this.mesh;
        this.rocks.push(mainRock);

        // Create smaller surrounding boulders piled around
        for (let i = 0; i < numRocks - 1; i++) {
            const angle = this.seededRandom() * Math.PI * 2;
            const distance = 0.6 + this.seededRandom() * 1.0;
            const size = 0.4 + this.seededRandom() * 0.45; // 0.4 to 0.85

            const rock = this.createBoulder(`stoneSmall_${Date.now()}_${i}`, size);

            rock.position.x = Math.cos(angle) * distance;
            rock.position.z = Math.sin(angle) * distance;
            // Stack some rocks slightly higher for pile effect
            const stackHeight = this.seededRandom() < 0.3 ? size * 1.5 : size * 0.6;
            rock.position.y = stackHeight;

            // Gentle random rotation
            rock.rotation.x = this.seededRandom() * Math.PI * 0.3;
            rock.rotation.y = this.seededRandom() * Math.PI * 2;
            rock.rotation.z = this.seededRandom() * Math.PI * 0.3;

            // Random squash for natural boulder shapes
            const sX = 0.8 + this.seededRandom() * 0.4;
            const sY = 0.6 + this.seededRandom() * 0.4; // More flattened
            const sZ = 0.8 + this.seededRandom() * 0.4;
            rock.scaling = new BABYLON.Vector3(sX, sY, sZ);

            rock.parent = this.mesh;
            this.rocks.push(rock);
        }

        // Create stone material with slight color variation
        const stoneMaterial = new BABYLON.StandardMaterial(`stoneDepositMat_${Date.now()}`, this.scene);
        const grayBase = 0.4 + this.seededRandom() * 0.15; // 0.4 to 0.55
        const blueHint = this.seededRandom() * 0.06; // Slight blue tint
        const warmHint = this.seededRandom() * 0.04; // Slight warm tint
        stoneMaterial.diffuseColor = new BABYLON.Color3(
            grayBase + warmHint,
            grayBase,
            grayBase + blueHint
        );
        stoneMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.12);
        stoneMaterial.specularPower = 4 + this.seededRandom() * 8; // Less shiny

        // Apply material and shadows to all rocks
        this.rocks.forEach(rock => {
            rock.material = stoneMaterial;
            if (this.shadowGenerator) {
                this.shadowGenerator.addShadowCaster(rock);
            }
        });

        // Random overall rotation for the entire deposit
        this.mesh.rotation.y = this.seededRandom() * Math.PI * 2;
    }

    /**
     * Create health bar above deposit
     */
    createHealthBar() {
        // Use main rock as parent
        if (this.rocks.length > 0) {
            this.healthBar = new HealthBar(this.scene, this.rocks[0], this.maxHP, 1.5);
        }
    }

    /**
     * Check if deposit can be mined
     */
    canBeMined() {
        return this.isActive && this.currentHP > 0;
    }

    /**
     * Take damage from mining (bubby attack)
     * Returns true if stone piece should spawn
     */
    takeDamage(damage) {
        if (!this.canBeMined()) {
            return false;
        }

        this.currentHP -= damage;

        // Update health bar
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHP);
        }

        // Spawn a stone piece
        if (this.onStonePieceSpawnCallback) {
            const piecePosition = this.position.clone();
            // Random offset from deposit center
            piecePosition.x += (Math.random() - 0.5) * 3;
            piecePosition.z += (Math.random() - 0.5) * 3;
            piecePosition.y = 2; // Drop from mid-height
            this.onStonePieceSpawnCallback(piecePosition);
        }

        // Shrink rocks as HP decreases
        const scale = 0.5 + (this.currentHP / this.maxHP) * 0.5; // Scale from 1.0 to 0.5
        this.rocks.forEach(rock => {
            rock.scaling = new BABYLON.Vector3(scale, scale, scale);
        });

        // Check if fully mined
        if (this.currentHP <= 0) {
            this.dispose();
        }

        return true;
    }

    /**
     * Get position
     */
    getPosition() {
        return this.position.clone();
    }

    /**
     * Update (for delta time tracking if needed)
     */
    update() {
        // Stone deposits are static, no update needed
    }

    /**
     * Dispose deposit and clean up
     */
    dispose() {
        this.isActive = false;

        // Dispose health bar
        if (this.healthBar) {
            this.healthBar.dispose();
            this.healthBar = null;
        }

        // Dispose all rocks
        this.rocks.forEach(rock => {
            rock.dispose();
        });
        this.rocks = [];

        // Dispose root mesh
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }
    }
}
