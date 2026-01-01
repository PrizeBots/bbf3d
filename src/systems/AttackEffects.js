/**
 * AttackEffects - Visual effects for attacks, harvesting, and combat
 */
export class AttackEffects {
    constructor(scene) {
        this.scene = scene;
        this.activeEffects = [];
    }

    /**
     * Create a slash effect (for sword attacks)
     * @param {BABYLON.Vector3} position - Position of the slash (at sword tip)
     * @param {BABYLON.Vector3} direction - Direction the attacker is facing
     * @param {string} color - Color of the slash ('red', 'blue', 'white')
     */
    createSlashEffect(position, direction, color = 'white') {
        const slashLines = [];
        const numLines = 3;

        // Get color values
        const colors = {
            red: new BABYLON.Color3(1, 0.3, 0.3),
            blue: new BABYLON.Color3(0.3, 0.5, 1),
            white: new BABYLON.Color3(1, 1, 1)
        };
        const slashColor = colors[color] || colors.white;

        // Calculate perpendicular direction for slash arc
        const perpX = -direction.z;
        const perpZ = direction.x;

        // Create arc of slash lines - smaller and tighter
        for (let i = 0; i < numLines; i++) {
            const offset = (i - 1) * 0.15; // Tighter spacing
            const points = [];

            // Create curved slash arc
            for (let t = 0; t <= 1; t += 0.1) {
                const angle = (t - 0.5) * Math.PI * 0.8; // Wider arc angle
                const radius = 0.6 + offset * 0.1; // Smaller radius
                const height = Math.sin(t * Math.PI) * 0.4; // Arc up then down
                points.push(new BABYLON.Vector3(
                    position.x + perpX * Math.sin(angle) * radius,
                    position.y + height + offset * 0.2,
                    position.z + perpZ * Math.sin(angle) * radius
                ));
            }

            const line = BABYLON.MeshBuilder.CreateLines(
                `slash_${Date.now()}_${i}`,
                { points: points },
                this.scene
            );
            line.color = slashColor;
            line.alpha = 1;
            slashLines.push(line);
        }

        // Animate and dispose
        const effect = {
            meshes: slashLines,
            startTime: Date.now(),
            duration: 150, // Faster animation
            update: (progress) => {
                const alpha = 1 - progress;
                const scale = 1 + progress * 0.3;
                slashLines.forEach(line => {
                    line.alpha = alpha;
                    line.scaling = new BABYLON.Vector3(scale, scale, scale);
                });
            }
        };

        this.activeEffects.push(effect);
    }

    /**
     * Create impact particles effect
     * @param {BABYLON.Vector3} position - Position of impact
     * @param {string} type - Type of impact ('hit', 'harvest', 'mine')
     */
    createImpactEffect(position, type = 'hit') {
        const particles = [];
        const numParticles = type === 'mine' ? 8 : 5;

        // Get colors based on type
        let particleColor;
        switch (type) {
            case 'harvest':
                particleColor = new BABYLON.Color3(0.6, 0.4, 0.2); // Brown for wood
                break;
            case 'mine':
                particleColor = new BABYLON.Color3(0.5, 0.5, 0.55); // Gray for stone
                break;
            default:
                particleColor = new BABYLON.Color3(1, 1, 0.5); // Yellow for hit
        }

        // Create burst of small particles
        for (let i = 0; i < numParticles; i++) {
            const angle = (i / numParticles) * Math.PI * 2;
            const speed = 0.1 + Math.random() * 0.15;
            const size = type === 'mine' ? 0.15 + Math.random() * 0.1 : 0.1 + Math.random() * 0.08;

            let particle;
            if (type === 'mine') {
                // Cube particles for stone
                particle = BABYLON.MeshBuilder.CreateBox(
                    `particle_${Date.now()}_${i}`,
                    { size: size },
                    this.scene
                );
            } else {
                // Sphere particles for other types
                particle = BABYLON.MeshBuilder.CreateSphere(
                    `particle_${Date.now()}_${i}`,
                    { diameter: size, segments: 4 },
                    this.scene
                );
            }

            particle.position = position.clone();
            particle.position.y += 0.5;

            const material = new BABYLON.StandardMaterial(`particleMat_${Date.now()}_${i}`, this.scene);
            material.diffuseColor = particleColor;
            material.emissiveColor = particleColor.scale(0.5);
            particle.material = material;

            // Store velocity
            particle.velocity = new BABYLON.Vector3(
                Math.cos(angle) * speed,
                0.15 + Math.random() * 0.1,
                Math.sin(angle) * speed
            );

            particles.push(particle);
        }

        const effect = {
            meshes: particles,
            startTime: Date.now(),
            duration: 400,
            update: (progress) => {
                const gravity = 0.008;
                particles.forEach(particle => {
                    particle.position.addInPlace(particle.velocity);
                    particle.velocity.y -= gravity;
                    particle.scaling = new BABYLON.Vector3(
                        1 - progress * 0.5,
                        1 - progress * 0.5,
                        1 - progress * 0.5
                    );
                    if (particle.material) {
                        particle.material.alpha = 1 - progress;
                    }
                });
            }
        };

        this.activeEffects.push(effect);
    }

    /**
     * Create a hit flash effect on target
     * @param {BABYLON.Mesh} targetMesh - The mesh that was hit
     */
    createHitFlash(targetMesh) {
        if (!targetMesh || !targetMesh.material) return;

        const originalEmissive = targetMesh.material.emissiveColor ?
            targetMesh.material.emissiveColor.clone() :
            new BABYLON.Color3(0, 0, 0);

        // Flash white
        targetMesh.material.emissiveColor = new BABYLON.Color3(1, 1, 1);

        // Restore after short delay
        setTimeout(() => {
            if (targetMesh.material) {
                targetMesh.material.emissiveColor = originalEmissive;
            }
        }, 80);
    }

    /**
     * Create lunge animation for attacker
     * @param {Object} attacker - The attacking bubby
     * @param {BABYLON.Vector3} targetPos - Position of target
     * @param {Function} onImpact - Callback when impact occurs
     */
    createLungeAnimation(attacker, targetPos, onImpact) {
        if (!attacker.mesh) return;

        const startPos = attacker.mesh.position.clone();
        const direction = targetPos.subtract(startPos);
        direction.y = 0;
        direction.normalize();

        const lungeDistance = 0.8;
        const lungeDuration = 100; // ms
        const returnDuration = 150; // ms

        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;

            if (elapsed < lungeDuration) {
                // Lunge forward
                const progress = elapsed / lungeDuration;
                const easeOut = 1 - Math.pow(1 - progress, 2);
                attacker.mesh.position.x = startPos.x + direction.x * lungeDistance * easeOut;
                attacker.mesh.position.z = startPos.z + direction.z * lungeDistance * easeOut;

                // Squish effect - compress in direction of movement
                if (attacker.head) {
                    attacker.head.scaling.y = 1 - progress * 0.2;
                    attacker.head.scaling.x = 1 + progress * 0.15;
                    attacker.head.scaling.z = 1 + progress * 0.15;
                }
            } else if (elapsed < lungeDuration + returnDuration) {
                // Impact at peak
                if (elapsed - lungeDuration < 20 && onImpact) {
                    onImpact();
                }

                // Return back
                const returnProgress = (elapsed - lungeDuration) / returnDuration;
                const easeIn = returnProgress * returnProgress;
                attacker.mesh.position.x = startPos.x + direction.x * lungeDistance * (1 - easeIn);
                attacker.mesh.position.z = startPos.z + direction.z * lungeDistance * (1 - easeIn);

                // Unsquish
                if (attacker.head) {
                    attacker.head.scaling.y = 0.8 + returnProgress * 0.2;
                    attacker.head.scaling.x = 1.15 - returnProgress * 0.15;
                    attacker.head.scaling.z = 1.15 - returnProgress * 0.15;
                }
            } else {
                // Animation complete - ensure we're back at start
                attacker.mesh.position.x = startPos.x;
                attacker.mesh.position.z = startPos.z;
                if (attacker.head) {
                    attacker.head.scaling = new BABYLON.Vector3(1, 1, 1);
                }
                return; // Stop animation loop
            }

            requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Create headbutt/bounce animation (simpler, no position change)
     * @param {Object} attacker - The attacking bubby
     */
    createBounceAnimation(attacker) {
        if (!attacker.head) return;

        const startTime = Date.now();
        const duration = 150;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Bounce squish
            const squish = Math.sin(progress * Math.PI);
            if (attacker.head) {
                attacker.head.scaling.y = 1 - squish * 0.25;
                attacker.head.scaling.x = 1 + squish * 0.15;
                attacker.head.scaling.z = 1 + squish * 0.15;
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Reset
                if (attacker.head) {
                    attacker.head.scaling = new BABYLON.Vector3(1, 1, 1);
                }
            }
        };

        animate();
    }

    /**
     * Update all active effects
     */
    update() {
        const now = Date.now();
        const toRemove = [];

        for (let i = 0; i < this.activeEffects.length; i++) {
            const effect = this.activeEffects[i];
            const elapsed = now - effect.startTime;
            const progress = Math.min(elapsed / effect.duration, 1);

            effect.update(progress);

            if (progress >= 1) {
                // Dispose meshes
                effect.meshes.forEach(mesh => {
                    if (mesh.material) mesh.material.dispose();
                    mesh.dispose();
                });
                toRemove.push(i);
            }
        }

        // Remove completed effects (reverse order to maintain indices)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.activeEffects.splice(toRemove[i], 1);
        }
    }

    /**
     * Dispose all effects
     */
    dispose() {
        this.activeEffects.forEach(effect => {
            effect.meshes.forEach(mesh => {
                if (mesh.material) mesh.material.dispose();
                mesh.dispose();
            });
        });
        this.activeEffects = [];
    }
}
