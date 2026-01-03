import { GameConstants } from '../config/GameConstants.js';

/**
 * Castle - Represents a team's castle structure
 * Features detailed architecture with procedural stone textures and team accents
 */
export class Castle {
    constructor(scene, team, position, shadowGenerator) {
        this.scene = scene;
        this.team = team;
        this.position = position;
        this.shadowGenerator = shadowGenerator;
        this.rootNode = null;
        this.meshes = [];
        this.materials = {}; // Cache materials for reuse

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

        // Animation
        this.bannerPhase = Math.random() * Math.PI * 2;

        this.createMaterials();
        this.build();
        this.createHealthBar();
    }

    /**
     * Create all materials with procedural textures
     */
    createMaterials() {
        // Stone wall material with procedural block texture
        this.materials.stone = this.createStoneMaterial();

        // Dark stone for base/foundation
        this.materials.darkStone = this.createDarkStoneMaterial();

        // Team accent color material
        this.materials.accent = this.createAccentMaterial();

        // Roof material (darker team color)
        this.materials.roof = this.createRoofMaterial();

        // Wood material for gate and details
        this.materials.wood = this.createWoodMaterial();

        // Metal material for portcullis
        this.materials.metal = this.createMetalMaterial();

        // Banner/flag material
        this.materials.banner = this.createBannerMaterial();
    }

    /**
     * Create procedural stone block texture
     */
    createStoneTexture(size = 512) {
        const texture = new BABYLON.DynamicTexture(
            `stoneTexture_${this.team}_${Date.now()}`,
            size,
            this.scene,
            true
        );
        const ctx = texture.getContext();

        // Base stone color with slight variation
        const baseR = 140, baseG = 135, baseB = 125;

        // Fill with base color
        ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
        ctx.fillRect(0, 0, size, size);

        // Add noise for texture
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 30;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imageData, 0, 0);

        // Draw stone blocks
        const blockWidth = size / 4;
        const blockHeight = size / 8;

        ctx.strokeStyle = 'rgba(60, 55, 50, 0.8)';
        ctx.lineWidth = 3;

        for (let row = 0; row < 8; row++) {
            const offset = (row % 2) * (blockWidth / 2);
            for (let col = -1; col < 5; col++) {
                const x = col * blockWidth + offset;
                const y = row * blockHeight;

                // Block outline
                ctx.strokeRect(x, y, blockWidth, blockHeight);

                // Add slight 3D effect - lighter top/left edges
                ctx.strokeStyle = 'rgba(180, 175, 165, 0.4)';
                ctx.beginPath();
                ctx.moveTo(x + 2, y + blockHeight - 2);
                ctx.lineTo(x + 2, y + 2);
                ctx.lineTo(x + blockWidth - 2, y + 2);
                ctx.stroke();

                // Darker bottom/right edges
                ctx.strokeStyle = 'rgba(40, 35, 30, 0.4)';
                ctx.beginPath();
                ctx.moveTo(x + blockWidth - 2, y + 2);
                ctx.lineTo(x + blockWidth - 2, y + blockHeight - 2);
                ctx.lineTo(x + 2, y + blockHeight - 2);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(60, 55, 50, 0.8)';
            }
        }

        // Add some random darker spots for weathering
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const radius = Math.random() * 8 + 2;
            ctx.fillStyle = `rgba(80, 75, 70, ${Math.random() * 0.3})`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        texture.update();
        return texture;
    }

    /**
     * Create procedural normal map for stone blocks
     */
    createStoneNormalMap(size = 512) {
        const texture = new BABYLON.DynamicTexture(
            `stoneNormal_${this.team}_${Date.now()}`,
            size,
            this.scene,
            true
        );
        const ctx = texture.getContext();

        // Neutral normal (pointing up: RGB = 128, 128, 255)
        ctx.fillStyle = 'rgb(128, 128, 255)';
        ctx.fillRect(0, 0, size, size);

        const blockWidth = size / 4;
        const blockHeight = size / 8;

        // Draw block edges as normals
        for (let row = 0; row < 8; row++) {
            const offset = (row % 2) * (blockWidth / 2);
            for (let col = -1; col < 5; col++) {
                const x = col * blockWidth + offset;
                const y = row * blockHeight;

                // Top edge - normal pointing up (lighter blue = upward)
                ctx.fillStyle = 'rgb(128, 180, 255)';
                ctx.fillRect(x, y, blockWidth, 4);

                // Bottom edge - normal pointing down
                ctx.fillStyle = 'rgb(128, 76, 255)';
                ctx.fillRect(x, y + blockHeight - 4, blockWidth, 4);

                // Left edge - normal pointing left
                ctx.fillStyle = 'rgb(76, 128, 255)';
                ctx.fillRect(x, y, 4, blockHeight);

                // Right edge - normal pointing right
                ctx.fillStyle = 'rgb(180, 128, 255)';
                ctx.fillRect(x + blockWidth - 4, y, 4, blockHeight);
            }
        }

        // Add some surface noise for rough stone
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            // Small random perturbation to normals
            data[i] = Math.max(0, Math.min(255, data[i] + (Math.random() - 0.5) * 20));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (Math.random() - 0.5) * 20));
        }
        ctx.putImageData(imageData, 0, 0);

        texture.update();
        return texture;
    }

    /**
     * Create stone material with textures
     */
    createStoneMaterial() {
        const mat = new BABYLON.StandardMaterial(`stoneMat_${this.team}`, this.scene);

        const diffuseTexture = this.createStoneTexture();
        diffuseTexture.uScale = 2;
        diffuseTexture.vScale = 2;
        mat.diffuseTexture = diffuseTexture;

        const bumpTexture = this.createStoneNormalMap();
        bumpTexture.uScale = 2;
        bumpTexture.vScale = 2;
        mat.bumpTexture = bumpTexture;
        mat.bumpTexture.level = 0.8;

        mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        mat.specularPower = 16;

        return mat;
    }

    /**
     * Create darker stone for foundation
     */
    createDarkStoneMaterial() {
        const mat = new BABYLON.StandardMaterial(`darkStoneMat_${this.team}`, this.scene);

        const texture = this.createStoneTexture(256);
        texture.uScale = 3;
        texture.vScale = 1;
        mat.diffuseTexture = texture;
        mat.diffuseColor = new BABYLON.Color3(0.6, 0.58, 0.55);

        mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

        return mat;
    }

    /**
     * Create team accent material
     */
    createAccentMaterial() {
        const mat = new BABYLON.StandardMaterial(`accentMat_${this.team}`, this.scene);

        if (this.team === 'red') {
            mat.diffuseColor = new BABYLON.Color3(0.85, 0.15, 0.15);
            mat.emissiveColor = new BABYLON.Color3(0.2, 0.02, 0.02);
        } else {
            mat.diffuseColor = new BABYLON.Color3(0.15, 0.3, 0.9);
            mat.emissiveColor = new BABYLON.Color3(0.02, 0.05, 0.2);
        }

        mat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        mat.specularPower = 32;

        return mat;
    }

    /**
     * Create roof material (darker team color with shingles)
     */
    createRoofMaterial() {
        const mat = new BABYLON.StandardMaterial(`roofMat_${this.team}`, this.scene);

        if (this.team === 'red') {
            mat.diffuseColor = new BABYLON.Color3(0.5, 0.08, 0.08);
            mat.emissiveColor = new BABYLON.Color3(0.1, 0.01, 0.01);
        } else {
            mat.diffuseColor = new BABYLON.Color3(0.08, 0.15, 0.5);
            mat.emissiveColor = new BABYLON.Color3(0.01, 0.02, 0.1);
        }

        mat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

        return mat;
    }

    /**
     * Create wood material
     */
    createWoodMaterial() {
        const mat = new BABYLON.StandardMaterial(`woodMat_${this.team}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.35, 0.22, 0.1);
        mat.specularColor = new BABYLON.Color3(0.1, 0.08, 0.05);
        return mat;
    }

    /**
     * Create metal material for portcullis
     */
    createMetalMaterial() {
        const mat = new BABYLON.StandardMaterial(`metalMat_${this.team}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.25, 0.25, 0.28);
        mat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        mat.specularPower = 64;
        return mat;
    }

    /**
     * Create banner material
     */
    createBannerMaterial() {
        const mat = new BABYLON.StandardMaterial(`bannerMat_${this.team}`, this.scene);

        if (this.team === 'red') {
            mat.diffuseColor = new BABYLON.Color3(0.9, 0.1, 0.1);
            mat.emissiveColor = new BABYLON.Color3(0.3, 0.03, 0.03);
        } else {
            mat.diffuseColor = new BABYLON.Color3(0.1, 0.2, 0.95);
            mat.emissiveColor = new BABYLON.Color3(0.03, 0.06, 0.3);
        }

        mat.backFaceCulling = false;
        return mat;
    }

    /**
     * Build the castle structure
     */
    build() {
        // Create root transform node
        this.rootNode = new BABYLON.TransformNode(`castle_${this.team}`);
        this.rootNode.position = this.position;

        // Build castle components
        this.createFoundation();
        this.createMainWalls();
        this.createCornerTowers();
        this.createCentralKeep();
        this.createGatehouse();
        this.createBattlements();
        this.createBanners();
        this.createWindowsAndDetails();
    }

    /**
     * Create stone foundation
     */
    createFoundation() {
        const foundation = BABYLON.MeshBuilder.CreateBox(
            `foundation_${this.team}`,
            { width: 14, height: 1.5, depth: 14 },
            this.scene
        );
        foundation.position.y = 0.75;
        foundation.parent = this.rootNode;
        foundation.material = this.materials.darkStone;

        this.shadowGenerator.addShadowCaster(foundation);
        this.meshes.push(foundation);
    }

    /**
     * Create main castle walls
     */
    createMainWalls() {
        const wallHeight = 8;
        const wallThickness = 1.2;
        const innerSize = 10;

        // Front wall (with gate opening)
        const frontWallLeft = BABYLON.MeshBuilder.CreateBox(
            `frontWallLeft_${this.team}`,
            { width: 3, height: wallHeight, depth: wallThickness },
            this.scene
        );
        frontWallLeft.position = new BABYLON.Vector3(-3.5, wallHeight / 2 + 1.5, innerSize / 2);
        frontWallLeft.parent = this.rootNode;
        frontWallLeft.material = this.materials.stone;
        this.shadowGenerator.addShadowCaster(frontWallLeft);
        this.meshes.push(frontWallLeft);

        const frontWallRight = BABYLON.MeshBuilder.CreateBox(
            `frontWallRight_${this.team}`,
            { width: 3, height: wallHeight, depth: wallThickness },
            this.scene
        );
        frontWallRight.position = new BABYLON.Vector3(3.5, wallHeight / 2 + 1.5, innerSize / 2);
        frontWallRight.parent = this.rootNode;
        frontWallRight.material = this.materials.stone;
        this.shadowGenerator.addShadowCaster(frontWallRight);
        this.meshes.push(frontWallRight);

        // Top of gate
        const gateTop = BABYLON.MeshBuilder.CreateBox(
            `gateTop_${this.team}`,
            { width: 4, height: 2, depth: wallThickness },
            this.scene
        );
        gateTop.position = new BABYLON.Vector3(0, wallHeight + 0.5, innerSize / 2);
        gateTop.parent = this.rootNode;
        gateTop.material = this.materials.stone;
        this.shadowGenerator.addShadowCaster(gateTop);
        this.meshes.push(gateTop);

        // Back wall
        const backWall = BABYLON.MeshBuilder.CreateBox(
            `backWall_${this.team}`,
            { width: innerSize, height: wallHeight, depth: wallThickness },
            this.scene
        );
        backWall.position = new BABYLON.Vector3(0, wallHeight / 2 + 1.5, -innerSize / 2);
        backWall.parent = this.rootNode;
        backWall.material = this.materials.stone;
        this.shadowGenerator.addShadowCaster(backWall);
        this.meshes.push(backWall);

        // Side walls
        const leftWall = BABYLON.MeshBuilder.CreateBox(
            `leftWall_${this.team}`,
            { width: wallThickness, height: wallHeight, depth: innerSize },
            this.scene
        );
        leftWall.position = new BABYLON.Vector3(-innerSize / 2, wallHeight / 2 + 1.5, 0);
        leftWall.parent = this.rootNode;
        leftWall.material = this.materials.stone;
        this.shadowGenerator.addShadowCaster(leftWall);
        this.meshes.push(leftWall);

        const rightWall = BABYLON.MeshBuilder.CreateBox(
            `rightWall_${this.team}`,
            { width: wallThickness, height: wallHeight, depth: innerSize },
            this.scene
        );
        rightWall.position = new BABYLON.Vector3(innerSize / 2, wallHeight / 2 + 1.5, 0);
        rightWall.parent = this.rootNode;
        rightWall.material = this.materials.stone;
        this.shadowGenerator.addShadowCaster(rightWall);
        this.meshes.push(rightWall);
    }

    /**
     * Create corner towers
     */
    createCornerTowers() {
        const towerPositions = [
            { x: -5, z: -5 },
            { x: 5, z: -5 },
            { x: -5, z: 5 },
            { x: 5, z: 5 }
        ];

        towerPositions.forEach((pos, index) => {
            // Tower base (octagonal for more detail)
            const tower = BABYLON.MeshBuilder.CreateCylinder(
                `tower_${this.team}_${index}`,
                {
                    diameter: 4,
                    height: 12,
                    tessellation: 8
                },
                this.scene
            );
            tower.position = new BABYLON.Vector3(pos.x, 7.5, pos.z);
            tower.parent = this.rootNode;
            tower.material = this.materials.stone;
            this.shadowGenerator.addShadowCaster(tower);
            this.meshes.push(tower);

            // Tower top platform with battlements
            const platform = BABYLON.MeshBuilder.CreateCylinder(
                `towerPlatform_${this.team}_${index}`,
                {
                    diameter: 4.5,
                    height: 0.5,
                    tessellation: 8
                },
                this.scene
            );
            platform.position = new BABYLON.Vector3(pos.x, 13.75, pos.z);
            platform.parent = this.rootNode;
            platform.material = this.materials.stone;
            this.shadowGenerator.addShadowCaster(platform);
            this.meshes.push(platform);

            // Tower battlements (merlons)
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const merlon = BABYLON.MeshBuilder.CreateBox(
                    `towerMerlon_${this.team}_${index}_${i}`,
                    { width: 0.8, height: 1.2, depth: 0.5 },
                    this.scene
                );
                merlon.position = new BABYLON.Vector3(
                    pos.x + Math.cos(angle) * 2,
                    14.6,
                    pos.z + Math.sin(angle) * 2
                );
                merlon.rotation.y = angle;
                merlon.parent = this.rootNode;
                merlon.material = this.materials.stone;
                this.shadowGenerator.addShadowCaster(merlon);
                this.meshes.push(merlon);
            }

            // Conical roof with team color
            const roof = BABYLON.MeshBuilder.CreateCylinder(
                `towerRoof_${this.team}_${index}`,
                {
                    diameterTop: 0,
                    diameterBottom: 5,
                    height: 3.5,
                    tessellation: 8
                },
                this.scene
            );
            roof.position = new BABYLON.Vector3(pos.x, 16.75, pos.z);
            roof.parent = this.rootNode;
            roof.material = this.materials.roof;
            this.shadowGenerator.addShadowCaster(roof);
            this.meshes.push(roof);

            // Team color trim ring at base of roof
            const trimRing = BABYLON.MeshBuilder.CreateTorus(
                `towerTrim_${this.team}_${index}`,
                {
                    diameter: 5,
                    thickness: 0.3,
                    tessellation: 16
                },
                this.scene
            );
            trimRing.position = new BABYLON.Vector3(pos.x, 15, pos.z);
            trimRing.parent = this.rootNode;
            trimRing.material = this.materials.accent;
            this.meshes.push(trimRing);
        });
    }

    /**
     * Create central keep (main tower)
     */
    createCentralKeep() {
        // Main keep body
        const keep = BABYLON.MeshBuilder.CreateBox(
            `keep_${this.team}`,
            { width: 5, height: 14, depth: 5 },
            this.scene
        );
        keep.position = new BABYLON.Vector3(0, 8.5, -1);
        keep.parent = this.rootNode;
        keep.material = this.materials.stone;
        this.shadowGenerator.addShadowCaster(keep);
        this.meshes.push(keep);

        // Keep top platform
        const keepTop = BABYLON.MeshBuilder.CreateBox(
            `keepTop_${this.team}`,
            { width: 6, height: 0.5, depth: 6 },
            this.scene
        );
        keepTop.position = new BABYLON.Vector3(0, 15.75, -1);
        keepTop.parent = this.rootNode;
        keepTop.material = this.materials.stone;
        this.shadowGenerator.addShadowCaster(keepTop);
        this.meshes.push(keepTop);

        // Keep battlements
        const merlonPositions = [
            { x: -2.5, z: -3.5 }, { x: 0, z: -3.5 }, { x: 2.5, z: -3.5 },
            { x: -2.5, z: 1.5 }, { x: 0, z: 1.5 }, { x: 2.5, z: 1.5 },
            { x: -2.5, z: -1 }, { x: 2.5, z: -1 }
        ];

        merlonPositions.forEach((pos, i) => {
            const merlon = BABYLON.MeshBuilder.CreateBox(
                `keepMerlon_${this.team}_${i}`,
                { width: 1, height: 1.5, depth: 0.6 },
                this.scene
            );
            merlon.position = new BABYLON.Vector3(pos.x, 16.75, pos.z);
            merlon.parent = this.rootNode;
            merlon.material = this.materials.stone;
            this.shadowGenerator.addShadowCaster(merlon);
            this.meshes.push(merlon);
        });

        // Pyramidal roof on keep
        const keepRoof = BABYLON.MeshBuilder.CreateCylinder(
            `keepRoof_${this.team}`,
            {
                diameterTop: 0,
                diameterBottom: 7,
                height: 4,
                tessellation: 4
            },
            this.scene
        );
        keepRoof.position = new BABYLON.Vector3(0, 19.5, -1);
        keepRoof.rotation.y = Math.PI / 4;
        keepRoof.parent = this.rootNode;
        keepRoof.material = this.materials.roof;
        this.shadowGenerator.addShadowCaster(keepRoof);
        this.meshes.push(keepRoof);

        // Team color trim on keep
        const keepTrim = BABYLON.MeshBuilder.CreateBox(
            `keepTrim_${this.team}`,
            { width: 5.2, height: 0.4, depth: 5.2 },
            this.scene
        );
        keepTrim.position = new BABYLON.Vector3(0, 15.3, -1);
        keepTrim.parent = this.rootNode;
        keepTrim.material = this.materials.accent;
        this.meshes.push(keepTrim);
    }

    /**
     * Create gatehouse with portcullis
     */
    createGatehouse() {
        // Gate archway frame - team colored
        const archLeft = BABYLON.MeshBuilder.CreateBox(
            `archLeft_${this.team}`,
            { width: 0.6, height: 6, depth: 1.5 },
            this.scene
        );
        archLeft.position = new BABYLON.Vector3(-1.8, 4.5, 5);
        archLeft.parent = this.rootNode;
        archLeft.material = this.materials.accent;
        this.shadowGenerator.addShadowCaster(archLeft);
        this.meshes.push(archLeft);

        const archRight = BABYLON.MeshBuilder.CreateBox(
            `archRight_${this.team}`,
            { width: 0.6, height: 6, depth: 1.5 },
            this.scene
        );
        archRight.position = new BABYLON.Vector3(1.8, 4.5, 5);
        archRight.parent = this.rootNode;
        archRight.material = this.materials.accent;
        this.shadowGenerator.addShadowCaster(archRight);
        this.meshes.push(archRight);

        const archTop = BABYLON.MeshBuilder.CreateBox(
            `archTop_${this.team}`,
            { width: 4.2, height: 1, depth: 1.5 },
            this.scene
        );
        archTop.position = new BABYLON.Vector3(0, 8, 5);
        archTop.parent = this.rootNode;
        archTop.material = this.materials.accent;
        this.shadowGenerator.addShadowCaster(archTop);
        this.meshes.push(archTop);

        // Wooden gate (double doors)
        const doorLeft = BABYLON.MeshBuilder.CreateBox(
            `doorLeft_${this.team}`,
            { width: 1.4, height: 5, depth: 0.3 },
            this.scene
        );
        doorLeft.position = new BABYLON.Vector3(-0.75, 4, 5.3);
        doorLeft.parent = this.rootNode;
        doorLeft.material = this.materials.wood;
        this.meshes.push(doorLeft);

        const doorRight = BABYLON.MeshBuilder.CreateBox(
            `doorRight_${this.team}`,
            { width: 1.4, height: 5, depth: 0.3 },
            this.scene
        );
        doorRight.position = new BABYLON.Vector3(0.75, 4, 5.3);
        doorRight.parent = this.rootNode;
        doorRight.material = this.materials.wood;
        this.meshes.push(doorRight);

        // Metal door bands
        for (let i = 0; i < 3; i++) {
            const bandLeft = BABYLON.MeshBuilder.CreateBox(
                `doorBandL_${this.team}_${i}`,
                { width: 1.5, height: 0.2, depth: 0.35 },
                this.scene
            );
            bandLeft.position = new BABYLON.Vector3(-0.75, 2.5 + i * 1.8, 5.32);
            bandLeft.parent = this.rootNode;
            bandLeft.material = this.materials.metal;
            this.meshes.push(bandLeft);

            const bandRight = BABYLON.MeshBuilder.CreateBox(
                `doorBandR_${this.team}_${i}`,
                { width: 1.5, height: 0.2, depth: 0.35 },
                this.scene
            );
            bandRight.position = new BABYLON.Vector3(0.75, 2.5 + i * 1.8, 5.32);
            bandRight.parent = this.rootNode;
            bandRight.material = this.materials.metal;
            this.meshes.push(bandRight);
        }

        // Gatehouse tower extensions
        const gateLeftTower = BABYLON.MeshBuilder.CreateBox(
            `gateLeftTower_${this.team}`,
            { width: 2.5, height: 10, depth: 2.5 },
            this.scene
        );
        gateLeftTower.position = new BABYLON.Vector3(-3, 6.5, 5.5);
        gateLeftTower.parent = this.rootNode;
        gateLeftTower.material = this.materials.stone;
        this.shadowGenerator.addShadowCaster(gateLeftTower);
        this.meshes.push(gateLeftTower);

        const gateRightTower = BABYLON.MeshBuilder.CreateBox(
            `gateRightTower_${this.team}`,
            { width: 2.5, height: 10, depth: 2.5 },
            this.scene
        );
        gateRightTower.position = new BABYLON.Vector3(3, 6.5, 5.5);
        gateRightTower.parent = this.rootNode;
        gateRightTower.material = this.materials.stone;
        this.shadowGenerator.addShadowCaster(gateRightTower);
        this.meshes.push(gateRightTower);

        // Gatehouse roofs
        const gateRoofLeft = BABYLON.MeshBuilder.CreateCylinder(
            `gateRoofLeft_${this.team}`,
            { diameterTop: 0, diameterBottom: 3.5, height: 2.5, tessellation: 4 },
            this.scene
        );
        gateRoofLeft.position = new BABYLON.Vector3(-3, 12.75, 5.5);
        gateRoofLeft.rotation.y = Math.PI / 4;
        gateRoofLeft.parent = this.rootNode;
        gateRoofLeft.material = this.materials.roof;
        this.shadowGenerator.addShadowCaster(gateRoofLeft);
        this.meshes.push(gateRoofLeft);

        const gateRoofRight = BABYLON.MeshBuilder.CreateCylinder(
            `gateRoofRight_${this.team}`,
            { diameterTop: 0, diameterBottom: 3.5, height: 2.5, tessellation: 4 },
            this.scene
        );
        gateRoofRight.position = new BABYLON.Vector3(3, 12.75, 5.5);
        gateRoofRight.rotation.y = Math.PI / 4;
        gateRoofRight.parent = this.rootNode;
        gateRoofRight.material = this.materials.roof;
        this.shadowGenerator.addShadowCaster(gateRoofRight);
        this.meshes.push(gateRoofRight);
    }

    /**
     * Create wall battlements
     */
    createBattlements() {
        const wallTop = 9.5;
        const merlonHeight = 1.2;
        const merlonWidth = 0.8;
        const spacing = 1.6;

        // Front wall battlements (above gate)
        for (let x = -4.5; x <= 4.5; x += spacing) {
            if (Math.abs(x) > 1.5) { // Skip area above gate
                const merlon = BABYLON.MeshBuilder.CreateBox(
                    `wallMerlon_front_${this.team}_${x}`,
                    { width: merlonWidth, height: merlonHeight, depth: 0.5 },
                    this.scene
                );
                merlon.position = new BABYLON.Vector3(x, wallTop + merlonHeight / 2, 5);
                merlon.parent = this.rootNode;
                merlon.material = this.materials.stone;
                this.shadowGenerator.addShadowCaster(merlon);
                this.meshes.push(merlon);
            }
        }

        // Back wall battlements
        for (let x = -4.5; x <= 4.5; x += spacing) {
            const merlon = BABYLON.MeshBuilder.CreateBox(
                `wallMerlon_back_${this.team}_${x}`,
                { width: merlonWidth, height: merlonHeight, depth: 0.5 },
                this.scene
            );
            merlon.position = new BABYLON.Vector3(x, wallTop + merlonHeight / 2, -5);
            merlon.parent = this.rootNode;
            merlon.material = this.materials.stone;
            this.shadowGenerator.addShadowCaster(merlon);
            this.meshes.push(merlon);
        }

        // Side wall battlements
        for (let z = -4; z <= 4; z += spacing) {
            // Left wall
            const merlonLeft = BABYLON.MeshBuilder.CreateBox(
                `wallMerlon_left_${this.team}_${z}`,
                { width: 0.5, height: merlonHeight, depth: merlonWidth },
                this.scene
            );
            merlonLeft.position = new BABYLON.Vector3(-5, wallTop + merlonHeight / 2, z);
            merlonLeft.parent = this.rootNode;
            merlonLeft.material = this.materials.stone;
            this.shadowGenerator.addShadowCaster(merlonLeft);
            this.meshes.push(merlonLeft);

            // Right wall
            const merlonRight = BABYLON.MeshBuilder.CreateBox(
                `wallMerlon_right_${this.team}_${z}`,
                { width: 0.5, height: merlonHeight, depth: merlonWidth },
                this.scene
            );
            merlonRight.position = new BABYLON.Vector3(5, wallTop + merlonHeight / 2, z);
            merlonRight.parent = this.rootNode;
            merlonRight.material = this.materials.stone;
            this.shadowGenerator.addShadowCaster(merlonRight);
            this.meshes.push(merlonRight);
        }
    }

    /**
     * Create team banners/flags
     */
    createBanners() {
        // Main keep banner pole and flag
        const keepPole = BABYLON.MeshBuilder.CreateCylinder(
            `keepPole_${this.team}`,
            { diameter: 0.15, height: 5 },
            this.scene
        );
        keepPole.position = new BABYLON.Vector3(0, 24, -1);
        keepPole.parent = this.rootNode;
        keepPole.material = this.materials.wood;
        this.meshes.push(keepPole);

        // Keep flag (animated later)
        this.keepBanner = BABYLON.MeshBuilder.CreatePlane(
            `keepBanner_${this.team}`,
            { width: 2.5, height: 1.8 },
            this.scene
        );
        this.keepBanner.position = new BABYLON.Vector3(1.3, 25.5, -1);
        this.keepBanner.rotation.y = Math.PI / 2;
        this.keepBanner.parent = this.rootNode;
        this.keepBanner.material = this.materials.banner;
        this.meshes.push(this.keepBanner);

        // Corner tower flags
        const towerPositions = [
            { x: -5, z: -5 },
            { x: 5, z: -5 },
            { x: -5, z: 5 },
            { x: 5, z: 5 }
        ];

        this.towerBanners = [];
        towerPositions.forEach((pos, i) => {
            const pole = BABYLON.MeshBuilder.CreateCylinder(
                `towerPole_${this.team}_${i}`,
                { diameter: 0.1, height: 2.5 },
                this.scene
            );
            pole.position = new BABYLON.Vector3(pos.x, 19.75, pos.z);
            pole.parent = this.rootNode;
            pole.material = this.materials.wood;
            this.meshes.push(pole);

            // Small pennant flag
            const pennant = BABYLON.MeshBuilder.CreatePlane(
                `pennant_${this.team}_${i}`,
                { width: 1.2, height: 0.8 },
                this.scene
            );
            pennant.position = new BABYLON.Vector3(pos.x + 0.65, 20.5, pos.z);
            pennant.rotation.y = Math.PI / 2;
            pennant.parent = this.rootNode;
            pennant.material = this.materials.banner;
            this.towerBanners.push(pennant);
            this.meshes.push(pennant);
        });
    }

    /**
     * Create windows and architectural details
     */
    createWindowsAndDetails() {
        // Arrow slits on towers
        const towerPositions = [
            { x: -5, z: -5 },
            { x: 5, z: -5 },
            { x: -5, z: 5 },
            { x: 5, z: 5 }
        ];

        towerPositions.forEach((pos, towerIndex) => {
            // 3 arrow slits per tower at different heights
            for (let h = 0; h < 3; h++) {
                const angle = (towerIndex + h) * (Math.PI / 2);
                const slit = BABYLON.MeshBuilder.CreateBox(
                    `arrowSlit_${this.team}_${towerIndex}_${h}`,
                    { width: 0.15, height: 1.2, depth: 0.3 },
                    this.scene
                );
                slit.position = new BABYLON.Vector3(
                    pos.x + Math.cos(angle) * 2.1,
                    5 + h * 3,
                    pos.z + Math.sin(angle) * 2.1
                );
                slit.rotation.y = angle;
                slit.parent = this.rootNode;

                // Dark interior
                const slitMat = new BABYLON.StandardMaterial(`slitMat_${towerIndex}_${h}`, this.scene);
                slitMat.diffuseColor = new BABYLON.Color3(0.1, 0.08, 0.08);
                slit.material = slitMat;
                this.meshes.push(slit);
            }
        });

        // Keep windows
        const keepWindowPositions = [
            { x: 2.6, y: 6, z: -1 },
            { x: 2.6, y: 10, z: -1 },
            { x: 2.6, y: 13, z: -1 },
            { x: -2.6, y: 6, z: -1 },
            { x: -2.6, y: 10, z: -1 },
            { x: -2.6, y: 13, z: -1 },
            { x: 0, y: 10, z: -3.6 },
            { x: 0, y: 13, z: -3.6 },
        ];

        keepWindowPositions.forEach((pos, i) => {
            // Window frame (team color)
            const frame = BABYLON.MeshBuilder.CreateBox(
                `windowFrame_${this.team}_${i}`,
                { width: pos.x !== 0 ? 0.3 : 1.2, height: 1.8, depth: pos.x !== 0 ? 1.2 : 0.3 },
                this.scene
            );
            frame.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
            frame.parent = this.rootNode;
            frame.material = this.materials.accent;
            this.meshes.push(frame);

            // Dark window interior
            const window = BABYLON.MeshBuilder.CreateBox(
                `window_${this.team}_${i}`,
                { width: pos.x !== 0 ? 0.35 : 0.8, height: 1.4, depth: pos.x !== 0 ? 0.8 : 0.35 },
                this.scene
            );
            window.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
            window.parent = this.rootNode;
            const windowMat = new BABYLON.StandardMaterial(`windowMat_${i}`, this.scene);
            windowMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.1);
            window.material = windowMat;
            this.meshes.push(window);
        });

        // Team colored trim along wall tops
        const trimPositions = [
            { x: 0, z: 5, w: 10, d: 0.3 },
            { x: 0, z: -5, w: 10, d: 0.3 },
            { x: -5, z: 0, w: 0.3, d: 10 },
            { x: 5, z: 0, w: 0.3, d: 10 }
        ];

        trimPositions.forEach((pos, i) => {
            const trim = BABYLON.MeshBuilder.CreateBox(
                `wallTrim_${this.team}_${i}`,
                { width: pos.w, height: 0.3, depth: pos.d },
                this.scene
            );
            trim.position = new BABYLON.Vector3(pos.x, 9.65, pos.z);
            trim.parent = this.rootNode;
            trim.material = this.materials.accent;
            this.meshes.push(trim);
        });
    }

    /**
     * Get color based on team (legacy support)
     */
    getTeamColor() {
        return this.team === "red"
            ? new BABYLON.Color3(0.8, 0.2, 0.2)
            : new BABYLON.Color3(0.2, 0.3, 0.9);
    }

    /**
     * Update castle animations (banners waving)
     */
    update(deltaTime) {
        if (!this.isActive) return;

        this.bannerPhase += deltaTime * 2;

        // Animate main keep banner
        if (this.keepBanner) {
            const wave = Math.sin(this.bannerPhase) * 0.15;
            this.keepBanner.rotation.z = wave;
            this.keepBanner.position.x = 1.3 + Math.sin(this.bannerPhase * 1.5) * 0.1;
        }

        // Animate tower pennants
        if (this.towerBanners) {
            this.towerBanners.forEach((banner, i) => {
                const offset = i * 0.5;
                const wave = Math.sin(this.bannerPhase + offset) * 0.2;
                banner.rotation.z = wave;
            });
        }
    }

    /**
     * Create health bar above castle
     */
    createHealthBar() {
        const barWidth = 10;
        const barHeight = 0.8;
        const barY = 28; // Above castle towers and banners

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