/**
 * Castle - Represents a team's castle structure
 */
class Castle {
    constructor(scene, team, position, shadowGenerator) {
        this.scene = scene;
        this.team = team;
        this.position = position;
        this.shadowGenerator = shadowGenerator;
        this.rootNode = null;
        this.meshes = [];

        this.build();
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
     * Dispose castle and all its meshes
     */
    dispose() {
        this.meshes.forEach(mesh => mesh.dispose());
        this.rootNode.dispose();
    }
}