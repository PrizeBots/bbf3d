import { GameConstants } from '../config/GameConstants.js';

/**
 * BubbyAI - Shared AI behavior for Bubby and AdultBubby
 *
 * Extracts common AI logic to reduce code duplication between
 * baby and adult bubbies.
 */
export class BubbyAI {
    /**
     * Create a BubbyAI helper
     * @param {Object} owner - The bubby instance that owns this AI
     * @param {Object} config - Configuration from GameConstants (BABY_BUBBY or ADULT_BUBBY)
     */
    constructor(owner, config) {
        this.owner = owner;
        this.config = config;
    }

    /**
     * Calculate avoidance vector to avoid other bubbies
     * @param {Function} getAllBubbies - Function that returns all bubbies
     * @returns {BABYLON.Vector3|null} - Normalized avoidance vector or null if no collision
     */
    calculateAvoidance(getAllBubbies) {
        if (!getAllBubbies) {
            return null;
        }

        const bubbies = getAllBubbies();
        const avoidanceRadius = this.config.AVOIDANCE_RADIUS;
        let avoidanceVector = new BABYLON.Vector3(0, 0, 0);
        let hasCollision = false;
        const ownerPos = this.owner.mesh.position;

        for (const other of bubbies) {
            if (other === this.owner || !other.isActive) {
                continue;
            }

            const toOther = other.mesh.position.subtract(ownerPos);
            const distance = toOther.length();

            if (distance < avoidanceRadius && distance > 0) {
                // Too close - add repulsion force
                const repulsion = toOther.normalize().scale(-1);
                const strength = 1 - (distance / avoidanceRadius);
                avoidanceVector.addInPlace(repulsion.scale(strength));
                hasCollision = true;
            }
        }

        return hasCollision ? avoidanceVector.normalize() : null;
    }

    /**
     * Calculate avoidance vector for buildings (armories, turrets, factories, castles)
     * Friendly buildings are avoided, enemy buildings can be walked through (to attack)
     * @param {Function} getAllBuildings - Function that returns all buildings
     * @returns {BABYLON.Vector3|null} - Normalized avoidance vector or null if no collision
     */
    calculateBuildingAvoidance(getAllBuildings) {
        if (!getAllBuildings) {
            return null;
        }

        const buildings = getAllBuildings();
        const ownerPos = this.owner.mesh.position;
        const ownerTeam = this.owner.team;
        let avoidanceVector = new BABYLON.Vector3(0, 0, 0);
        let hasCollision = false;

        for (const building of buildings) {
            if (!building.isActive) continue;

            // Get building position
            let buildingPos;
            if (building.getPosition) {
                buildingPos = building.getPosition();
            } else if (building.mesh && building.mesh.position) {
                buildingPos = building.mesh.position;
            } else {
                continue;
            }

            // Determine building radius based on type
            let buildingRadius = 3.0; // Default radius
            if (building.constructor && building.constructor.name) {
                const name = building.constructor.name;
                if (name === 'Castle') {
                    buildingRadius = 6.0; // Castles are large
                } else if (name === 'Armory') {
                    buildingRadius = 2.5;
                } else if (name === 'Turret') {
                    buildingRadius = 2.0;
                } else if (name === 'Factory') {
                    buildingRadius = 4.0;
                }
            }

            // Check if building is in our path
            const toBuilding = buildingPos.subtract(ownerPos);
            toBuilding.y = 0; // Only consider horizontal distance
            const distance = toBuilding.length();

            // Avoidance radius = building radius + bubby radius + buffer
            const avoidanceRadius = buildingRadius + 1.5;

            if (distance < avoidanceRadius && distance > 0.1) {
                // Check if this is an enemy building - soldiers can pass through to attack
                const isEnemy = building.team && building.team !== ownerTeam;
                const isSoldier = this.owner.isSoldier;

                // If soldier approaching enemy building to attack, don't avoid
                if (isEnemy && isSoldier && this.owner.combatTarget === building) {
                    continue;
                }

                // For friendly buildings or non-combat situations, avoid
                if (!isEnemy || !isSoldier) {
                    const repulsion = toBuilding.normalize().scale(-1);
                    const strength = 1 - (distance / avoidanceRadius);
                    avoidanceVector.addInPlace(repulsion.scale(strength * 2)); // Stronger repulsion for buildings
                    hasCollision = true;
                }
            }
        }

        return hasCollision ? avoidanceVector.normalize() : null;
    }

    /**
     * Constrain position to arena bounds
     * @param {Object} wanderState - Object with wanderTarget property to reset on boundary hit
     * @returns {boolean} - True if position was constrained (hit boundary)
     */
    constrainToArena(wanderState = null) {
        const mesh = this.owner.mesh;
        if (!mesh) {
            return false;
        }

        const maxX = GameConstants.ARENA.MAX_X;
        const maxZ = GameConstants.ARENA.MAX_Z;
        let hitBoundary = false;

        if (mesh.position.x < -maxX) {
            mesh.position.x = -maxX;
            hitBoundary = true;
        } else if (mesh.position.x > maxX) {
            mesh.position.x = maxX;
            hitBoundary = true;
        }

        if (mesh.position.z < -maxZ) {
            mesh.position.z = -maxZ;
            hitBoundary = true;
        } else if (mesh.position.z > maxZ) {
            mesh.position.z = maxZ;
            hitBoundary = true;
        }

        // Reset wander target if provided and hit boundary
        if (hitBoundary && wanderState) {
            wanderState.wanderTarget = null;
        }

        return hitBoundary;
    }

    /**
     * Pick a random wander target within the arena
     * @param {number} minDistance - Minimum wander distance
     * @param {number} maxDistance - Maximum wander distance
     * @returns {BABYLON.Vector3} - The wander target position
     */
    pickWanderTarget(minDistance = 10, maxDistance = 30) {
        const mesh = this.owner.mesh;
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistance + Math.random() * (maxDistance - minDistance);

        const target = new BABYLON.Vector3(
            mesh.position.x + Math.cos(angle) * distance,
            0,
            mesh.position.z + Math.sin(angle) * distance
        );

        // Clamp to arena bounds
        target.x = Math.max(-GameConstants.ARENA.MAX_X, Math.min(GameConstants.ARENA.MAX_X, target.x));
        target.z = Math.max(-GameConstants.ARENA.MAX_Z, Math.min(GameConstants.ARENA.MAX_Z, target.z));

        return target;
    }

    /**
     * Move toward a target position with optional collision avoidance
     * @param {BABYLON.Vector3} targetPos - Position to move toward
     * @param {Function} getAllBubbies - Function to get all bubbies for avoidance
     * @param {number} avoidanceBlend - How much to blend avoidance (0-1)
     * @param {Function} getAllBuildings - Function to get all buildings for avoidance
     * @returns {number} - Distance to target after movement
     */
    moveToward(targetPos, getAllBubbies = null, avoidanceBlend = 0.5, getAllBuildings = null) {
        const mesh = this.owner.mesh;
        const direction = targetPos.subtract(mesh.position);
        const distance = direction.length();

        if (distance < 0.1) {
            return distance;
        }

        direction.normalize();

        // Apply bubby collision avoidance if available
        if (getAllBubbies) {
            const avoidanceVector = this.calculateAvoidance(getAllBubbies);
            if (avoidanceVector) {
                const moveBlend = 1 - avoidanceBlend;
                direction.x = direction.x * moveBlend + avoidanceVector.x * avoidanceBlend;
                direction.z = direction.z * moveBlend + avoidanceVector.z * avoidanceBlend;
                direction.normalize();
            }
        }

        // Apply building avoidance if available
        if (getAllBuildings) {
            const buildingAvoidance = this.calculateBuildingAvoidance(getAllBuildings);
            if (buildingAvoidance) {
                // Buildings have stronger avoidance priority
                const buildingBlend = 0.7;
                const moveBlend = 1 - buildingBlend;
                direction.x = direction.x * moveBlend + buildingAvoidance.x * buildingBlend;
                direction.z = direction.z * moveBlend + buildingAvoidance.z * buildingBlend;
                direction.normalize();
            }
        }

        // Move position
        mesh.position.x += direction.x * this.config.MOVE_SPEED;
        mesh.position.z += direction.z * this.config.MOVE_SPEED;

        // Rotate to face movement direction (smooth rotation)
        const targetAngle = Math.atan2(direction.x, direction.z);
        const currentAngle = mesh.rotation.y;

        // Calculate shortest rotation direction
        let angleDiff = targetAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Smooth rotation (lerp toward target angle)
        const rotationSpeed = 0.15;
        mesh.rotation.y += angleDiff * rotationSpeed;

        return distance;
    }

    /**
     * Find the nearest object from a list that matches a filter
     * @param {Function} getObjects - Function that returns objects to search
     * @param {Function} filter - Filter function (object) => boolean
     * @param {number} maxRange - Maximum range to search (defaults to sensing range)
     * @returns {Object|null} - Nearest matching object or null
     */
    findNearest(getObjects, filter = null, maxRange = null) {
        if (!getObjects) {
            return null;
        }

        const objects = getObjects();
        const range = maxRange || this.config.SENSING_RANGE;
        let nearest = null;
        let nearestDistance = range;
        const ownerPos = this.owner.mesh.position;

        for (const obj of objects) {
            if (!obj.isActive) {
                continue;
            }

            if (filter && !filter(obj)) {
                continue;
            }

            // Get object position - support both mesh.position and getPosition()
            let objPos;
            if (obj.getPosition) {
                objPos = obj.getPosition();
            } else if (obj.mesh && obj.mesh.position) {
                objPos = obj.mesh.position;
            } else {
                continue;
            }

            const distance = BABYLON.Vector3.Distance(ownerPos, objPos);

            if (distance <= nearestDistance) {
                nearestDistance = distance;
                nearest = obj;
            }
        }

        return nearest;
    }

    /**
     * Check if target is within attack range
     * @param {Object} target - Target object with mesh or getPosition method
     * @returns {boolean} - True if within attack range
     */
    isInAttackRange(target) {
        const distance = this.getDistanceTo(target);
        return distance <= this.config.ATTACK_RANGE;
    }

    /**
     * Check if target is within sensing range
     * @param {Object} target - Target object with mesh or getPosition method
     * @returns {boolean} - True if within sensing range
     */
    isInSensingRange(target) {
        const distance = this.getDistanceTo(target);
        return distance <= this.config.SENSING_RANGE;
    }

    /**
     * Get distance to a target
     * @param {Object} target - Target object with mesh or getPosition method
     * @returns {number} - Distance to target, or Infinity if invalid
     */
    getDistanceTo(target) {
        if (!target || !this.owner.mesh) {
            return Infinity;
        }

        // Get target position - support both mesh.position and getPosition()
        let targetPos;
        if (target.getPosition) {
            targetPos = target.getPosition();
        } else if (target.mesh && target.mesh.position) {
            targetPos = target.mesh.position;
        } else {
            return Infinity;
        }

        return BABYLON.Vector3.Distance(
            this.owner.mesh.position,
            targetPos
        );
    }

    /**
     * Get position from a target object (handles various object types)
     * @param {Object} target - Target object
     * @returns {BABYLON.Vector3|null} - Position or null if not found
     */
    getTargetPosition(target) {
        if (!target) return null;
        if (target.getPosition) return target.getPosition();
        if (target.mesh && target.mesh.position) return target.mesh.position;
        if (target.position) return target.position;
        return null;
    }

    /**
     * Rotate to face a target position (without moving)
     * @param {BABYLON.Vector3} targetPos - Position to face
     * @param {number} rotationSpeed - How fast to rotate (0-1, default 0.15)
     */
    faceTarget(targetPos, rotationSpeed = 0.15) {
        const mesh = this.owner.mesh;
        if (!mesh) return;

        const direction = targetPos.subtract(mesh.position);
        if (direction.length() < 0.1) return;

        direction.normalize();

        // Calculate target angle
        const targetAngle = Math.atan2(direction.x, direction.z);
        const currentAngle = mesh.rotation.y;

        // Calculate shortest rotation direction
        let angleDiff = targetAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Smooth rotation
        mesh.rotation.y += angleDiff * rotationSpeed;
    }

    /**
     * Instantly face a direction (for immediate facing needs)
     * @param {BABYLON.Vector3} direction - Direction to face (will be normalized)
     */
    faceDirection(direction) {
        const mesh = this.owner.mesh;
        if (!mesh || direction.length() < 0.01) return;

        direction.normalize();
        mesh.rotation.y = Math.atan2(direction.x, direction.z);
    }
}
