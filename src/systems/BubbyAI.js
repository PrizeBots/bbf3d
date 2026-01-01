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
     * @returns {number} - Distance to target after movement
     */
    moveToward(targetPos, getAllBubbies = null, avoidanceBlend = 0.5) {
        const mesh = this.owner.mesh;
        const direction = targetPos.subtract(mesh.position);
        const distance = direction.length();

        if (distance < 0.1) {
            return distance;
        }

        direction.normalize();

        // Apply collision avoidance if available
        if (getAllBubbies) {
            const avoidanceVector = this.calculateAvoidance(getAllBubbies);
            if (avoidanceVector) {
                const moveBlend = 1 - avoidanceBlend;
                direction.x = direction.x * moveBlend + avoidanceVector.x * avoidanceBlend;
                direction.z = direction.z * moveBlend + avoidanceVector.z * avoidanceBlend;
                direction.normalize();
            }
        }

        mesh.position.x += direction.x * this.config.MOVE_SPEED;
        mesh.position.z += direction.z * this.config.MOVE_SPEED;

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

            const distance = BABYLON.Vector3.Distance(ownerPos, obj.mesh.position);

            if (distance <= nearestDistance) {
                nearestDistance = distance;
                nearest = obj;
            }
        }

        return nearest;
    }

    /**
     * Check if target is within attack range
     * @param {Object} target - Target object with mesh
     * @returns {boolean} - True if within attack range
     */
    isInAttackRange(target) {
        if (!target || !target.mesh || !this.owner.mesh) {
            return false;
        }

        const distance = BABYLON.Vector3.Distance(
            this.owner.mesh.position,
            target.mesh.position
        );

        return distance <= this.config.ATTACK_RANGE;
    }

    /**
     * Check if target is within sensing range
     * @param {Object} target - Target object with mesh
     * @returns {boolean} - True if within sensing range
     */
    isInSensingRange(target) {
        if (!target || !target.mesh || !this.owner.mesh) {
            return false;
        }

        const distance = BABYLON.Vector3.Distance(
            this.owner.mesh.position,
            target.mesh.position
        );

        return distance <= this.config.SENSING_RANGE;
    }

    /**
     * Get distance to a target
     * @param {Object} target - Target object with mesh
     * @returns {number} - Distance to target, or Infinity if invalid
     */
    getDistanceTo(target) {
        if (!target || !target.mesh || !this.owner.mesh) {
            return Infinity;
        }

        return BABYLON.Vector3.Distance(
            this.owner.mesh.position,
            target.mesh.position
        );
    }
}
