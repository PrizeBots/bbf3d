import { GameConstants } from '../config/GameConstants.js';

/**
 * GrassSystem - High-performance grass rendering using thin instances
 *
 * Creates thousands of grass blades with:
 * - Segmented geometry with natural bends
 * - Color variation (greens and tans)
 * - Subtle wind animation via custom shader
 * - Optimized using thin instances and frozen meshes
 */
export class GrassSystem {
    constructor(scene) {
        this.scene = scene;
        this.grassMeshes = []; // Base meshes for different blade types
        this.instanceMatrices = []; // Transform matrices for instances
        this.time = 0;

        // Grass configuration
        this.config = {
            // Blade counts and density
            bladeCount: 35000, // Total grass blades - dense coverage

            // Blade dimensions
            minHeight: 0.4,
            maxHeight: 1.0,
            bladeWidth: 0.06,
            segments: 3, // Number of segments per blade

            // Bending
            maxBend: 0.3, // Maximum bend amount

            // Color palette (greens and tans)
            colors: [
                new BABYLON.Color3(0.18, 0.45, 0.12),  // Dark green
                new BABYLON.Color3(0.25, 0.55, 0.18),  // Medium green
                new BABYLON.Color3(0.35, 0.65, 0.22),  // Light green
                new BABYLON.Color3(0.30, 0.50, 0.18),  // Olive green
                new BABYLON.Color3(0.45, 0.52, 0.25),  // Yellow-green
                new BABYLON.Color3(0.50, 0.48, 0.28),  // Tan
                new BABYLON.Color3(0.55, 0.52, 0.32),  // Light tan
                new BABYLON.Color3(0.42, 0.38, 0.22),  // Brown-tan
            ],

            // Arena bounds (grass only on green area)
            arenaWidth: GameConstants.ARENA.WIDTH,
            arenaDepth: GameConstants.ARENA.DEPTH,
            margin: 1, // Keep grass slightly inside edges
        };

        this.initialize();
    }

    /**
     * Initialize the grass system
     */
    initialize() {
        // Create base blade meshes with different variations
        this.createBladeVariations();

        // Spawn all grass instances
        this.spawnGrass();

        // Freeze meshes for performance
        this.optimizeForPerformance();

        console.log("GrassSystem: Initialized");
    }

    /**
     * Create a single grass blade mesh with segments and bend
     */
    createBladeMesh(height, bendAmount, bendDirection, colorIndex) {
        const segments = this.config.segments;
        const width = this.config.bladeWidth;
        const segmentHeight = height / segments;

        // Create vertices for a blade with segments
        const positions = [];
        const indices = [];
        const normals = [];
        const uvs = [];

        let currentX = 0;
        let currentZ = 0;

        for (let i = 0; i <= segments; i++) {
            const y = i * segmentHeight;
            const t = i / segments;

            // Progressive bend (more bend toward top)
            const currentBend = bendAmount * t * t;
            currentX = Math.cos(bendDirection) * currentBend;
            currentZ = Math.sin(bendDirection) * currentBend;

            // Blade width tapers toward top
            const currentWidth = width * (1 - t * 0.7);

            // Left vertex
            positions.push(currentX - currentWidth / 2, y, currentZ);
            // Right vertex
            positions.push(currentX + currentWidth / 2, y, currentZ);

            // UVs
            uvs.push(0, t);
            uvs.push(1, t);

            // Normals (pointing outward and up)
            const nx = -Math.sin(bendDirection) * 0.5;
            const nz = Math.cos(bendDirection) * 0.5;
            normals.push(nx, 0.7, nz);
            normals.push(nx, 0.7, nz);
        }

        // Create triangles
        for (let i = 0; i < segments; i++) {
            const base = i * 2;
            // First triangle
            indices.push(base, base + 2, base + 1);
            // Second triangle
            indices.push(base + 1, base + 2, base + 3);
        }

        // Create the mesh
        const blade = new BABYLON.Mesh(`grassBlade_${colorIndex}`, this.scene);

        const vertexData = new BABYLON.VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.normals = normals;
        vertexData.uvs = uvs;
        vertexData.applyToMesh(blade);

        return blade;
    }

    /**
     * Create a standard material for grass with given colors
     */
    createGrassMaterial(baseColor, index) {
        const mat = new BABYLON.StandardMaterial(`grassMat_${index}`, this.scene);
        mat.diffuseColor = baseColor;
        mat.specularColor = new BABYLON.Color3(0.05, 0.08, 0.03);
        mat.specularPower = 4;
        mat.backFaceCulling = false;
        // Slight emissive to brighten
        mat.emissiveColor = new BABYLON.Color3(
            baseColor.r * 0.1,
            baseColor.g * 0.15,
            baseColor.b * 0.08
        );
        return mat;
    }

    /**
     * Create several blade variations for visual diversity
     */
    createBladeVariations() {
        const variationCount = 8; // Different blade shapes

        for (let i = 0; i < variationCount; i++) {
            // Random height within range
            const height = this.config.minHeight +
                Math.random() * (this.config.maxHeight - this.config.minHeight);

            // Random bend
            const bendAmount = Math.random() * this.config.maxBend;
            const bendDirection = Math.random() * Math.PI * 2;

            // Create blade mesh
            const blade = this.createBladeMesh(height, bendAmount, bendDirection, i);

            // Create material for this variation
            const colorIndex = i % this.config.colors.length;
            const baseColor = this.config.colors[colorIndex];

            const material = this.createGrassMaterial(baseColor, i);
            blade.material = material;
            blade.isVisible = false; // Base mesh is invisible, instances are visible

            this.grassMeshes.push({
                mesh: blade,
                material: material,
                baseColor: baseColor
            });
        }
    }

    /**
     * Spawn grass instances across the arena
     */
    spawnGrass() {
        const halfWidth = this.config.arenaWidth / 2 - this.config.margin;
        const halfDepth = this.config.arenaDepth / 2 - this.config.margin;

        const bladesPerMesh = Math.floor(this.config.bladeCount / this.grassMeshes.length);

        let totalSpawned = 0;

        this.grassMeshes.forEach((grassData, meshIndex) => {
            const matrices = [];

            for (let i = 0; i < bladesPerMesh; i++) {
                // Random position within arena bounds - no exclusions, grass everywhere
                const x = (Math.random() - 0.5) * 2 * halfWidth;
                const z = (Math.random() - 0.5) * 2 * halfDepth;

                // Random rotation
                const rotation = Math.random() * Math.PI * 2;

                // Random scale variation
                const scaleY = 0.6 + Math.random() * 0.8;
                const scaleXZ = 0.8 + Math.random() * 0.4;

                // Create transformation matrix - grass sits on ground (Y=0.01 to avoid z-fighting)
                const matrix = BABYLON.Matrix.Compose(
                    new BABYLON.Vector3(scaleXZ, scaleY, scaleXZ),
                    BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, rotation),
                    new BABYLON.Vector3(x, 0.01, z)
                );

                matrices.push(matrix);
                totalSpawned++;
            }

            // Apply thin instances
            if (matrices.length > 0) {
                // Convert to buffer
                const bufferMatrices = new Float32Array(matrices.length * 16);
                for (let i = 0; i < matrices.length; i++) {
                    matrices[i].copyToArray(bufferMatrices, i * 16);
                }

                grassData.mesh.thinInstanceSetBuffer("matrix", bufferMatrices, 16);
                grassData.mesh.isVisible = true;
            }
        });

        console.log(`GrassSystem: Spawned ${totalSpawned} grass blades`);
    }

    /**
     * Optimize meshes for performance
     */
    optimizeForPerformance() {
        this.grassMeshes.forEach(grassData => {
            const mesh = grassData.mesh;

            // Disable picking (not interactive)
            mesh.isPickable = false;

            // Optimize for rendering
            mesh.doNotSyncBoundingInfo = true;

            // Freeze material to prevent unnecessary updates
            if (grassData.material) {
                grassData.material.freeze();
            }
        });

        console.log("GrassSystem: Optimized for performance");
    }

    /**
     * Update grass animation (subtle wind sway)
     * @param {number} deltaTime - Time since last frame
     */
    update(deltaTime) {
        this.time += deltaTime;

        // Subtle rotation-based wind animation
        // This is very lightweight - just rotating the base meshes slightly
        const windX = Math.sin(this.time * 1.2) * 0.03;
        const windZ = Math.cos(this.time * 0.9) * 0.02;

        this.grassMeshes.forEach((grassData, i) => {
            const offset = i * 0.3;
            const meshWindX = Math.sin(this.time * 1.2 + offset) * 0.03;
            const meshWindZ = Math.cos(this.time * 0.9 + offset) * 0.02;

            // Very subtle lean effect
            grassData.mesh.rotation.x = meshWindX;
            grassData.mesh.rotation.z = meshWindZ;
        });
    }

    /**
     * Dispose of all grass resources
     */
    dispose() {
        this.grassMeshes.forEach(grassData => {
            if (grassData.material) {
                grassData.material.dispose();
            }
            if (grassData.mesh) {
                grassData.mesh.dispose();
            }
        });

        this.grassMeshes = [];
        console.log("GrassSystem: Disposed");
    }
}
