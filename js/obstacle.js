// Enhanced obstacle.js with geometry-based collision detection

// Constants
const LANE_WIDTH = 2;

// Cache for textures and geometries
let textureCache = new Map();

// Collision geometry definitions for each obstacle type
const COLLISION_GEOMETRIES = {
    barrier: {
        type: 'box',
        width: 2,
        height: 3,
        depth: 1,
        offsetY: 1.5
    },
    low: {
        type: 'box',
        width: 3,
        height: 1,
        depth: 1.5,
        offsetY: 0.5
    },
    train: {
        type: 'composite',
        components: [
            { type: 'box', width: 3, height: 2.5, depth: 4, offsetY: 1.25, offsetZ: 0 },
            { type: 'box', width: 2.5, height: 1, depth: 0.1, offsetY: 1.5, offsetZ: 2.05 }
        ]
    },
    slide_barrier: {
        type: 'composite',
        components: [
            { type: 'box', width: 0.3, height: 4.5, depth: 0.3, offsetX: -1, offsetY: 2.25 },
            { type: 'box', width: 0.3, height: 4.5, depth: 0.3, offsetX: 1, offsetY: 2.25 },
            { type: 'box', width: 2.2, height: 0.4, depth: 0.3, offsetY: 3.2 }
        ]
    },
    swinging_log: {
        type: 'dynamic',
        components: [
            { type: 'box', width: 0.4, height: 6, depth: 0.4, offsetX: -3, offsetY: 3 },
            { type: 'box', width: 0.4, height: 6, depth: 0.4, offsetX: 3, offsetY: 3 },
            { type: 'box', width: 6.5, height: 0.3, depth: 0.4, offsetY: 6 },
            { type: 'cylinder', radius: 0.3, height: 4, offsetY: 3.5, isDynamic: true, swinging: true }
        ]
    },
    sliding_barrier: {
        type: 'dynamic',
        components: [
            { type: 'box', width: 0.3, height: 4, depth: 0.3, offsetX: -4, offsetY: 2 },
            { type: 'box', width: 0.3, height: 4, depth: 0.3, offsetX: 4, offsetY: 2 },
            { type: 'box', width: 8.5, height: 0.2, depth: 0.2, offsetY: 3.5 },
            { type: 'box', width: 1.5, height: 3, depth: 0.5, offsetY: 1.5, isDynamic: true, sliding: true }
        ]
    },
    rotating_hammer: {
        type: 'dynamic',
        components: [
            { type: 'cylinder', radius: 0.3, height: 5, offsetY: 2.5 },
            { type: 'box', width: 6, height: 0.4, depth: 0.4, offsetY: 3, isDynamic: true, rotating: true },
            { type: 'box', width: 0.8, height: 1.2, depth: 0.8, offsetX: -3, offsetY: 3, isDynamic: true, rotating: true },
            { type: 'box', width: 0.8, height: 1.2, depth: 0.8, offsetX: 3, offsetY: 3, isDynamic: true, rotating: true }
        ]
    }
};

// Player collision geometry
const PLAYER_COLLISION = {
    standing: { width: 1.5, height: 2.5, depth: 1.5, offsetY: 1.25 },
    jumping: { width: 1.5, height: 2.5, depth: 1.5, offsetY: 2.5 }, // Higher when jumping
    sliding: { width: 1.5, height: 1.2, depth: 2, offsetY: 0.6 } // Lower and longer when sliding
};

// Collision detection helper functions
class CollisionDetector {
    static boxIntersectsBox(box1, box2) {
        return (box1.min.x <= box2.max.x && box1.max.x >= box2.min.x) &&
               (box1.min.y <= box2.max.y && box1.max.y >= box2.min.y) &&
               (box1.min.z <= box2.max.z && box1.max.z >= box2.min.z);
    }

    static cylinderIntersectsBox(cylinder, box) {
        // Simplified cylinder-box intersection
        const cylinderBox = {
            min: {
                x: cylinder.center.x - cylinder.radius,
                y: cylinder.center.y - cylinder.height / 2,
                z: cylinder.center.z - cylinder.radius
            },
            max: {
                x: cylinder.center.x + cylinder.radius,
                y: cylinder.center.y + cylinder.height / 2,
                z: cylinder.center.z + cylinder.radius
            }
        };
        return this.boxIntersectsBox(cylinderBox, box);
    }

    static createBoundingBox(position, geometry) {
        const halfWidth = geometry.width / 2;
        const halfHeight = geometry.height / 2;
        const halfDepth = geometry.depth / 2;
        
        return {
            min: {
                x: position.x - halfWidth,
                y: position.y - halfHeight,
                z: position.z - halfDepth
            },
            max: {
                x: position.x + halfWidth,
                y: position.y + halfHeight,
                z: position.z + halfDepth
            }
        };
    }

    static createCylinder(position, radius, height) {
        return {
            center: { ...position },
            radius: radius,
            height: height
        };
    }

    static getPlayerCollisionGeometry(player, isJumping, isSliding, playerY) {
        let playerGeom;
        if (isSliding) {
            playerGeom = PLAYER_COLLISION.sliding;
        } else if (isJumping) {
            playerGeom = { ...PLAYER_COLLISION.jumping };
            playerGeom.offsetY = playerY;
        } else {
            playerGeom = PLAYER_COLLISION.standing;
        }

        return this.createBoundingBox({
            x: player.position.x,
            y: player.position.y + (playerGeom.offsetY || 0),
            z: player.position.z
        }, playerGeom);
    }

    static getDynamicComponentPosition(obstacle, component) {
        const basePos = {
            x: obstacle.position.x + (component.offsetX || 0),
            y: obstacle.position.y + (component.offsetY || 0),
            z: obstacle.position.z + (component.offsetZ || 0)
        };

        if (component.swinging && obstacle.userData.pivotGroup) {
            // Calculate swinging position
            const swingAngle = Math.sin(obstacle.userData.swingAngle || 0) * (obstacle.userData.swingAmplitude || 0);
            const swingRadius = 2.5; // Distance from pivot
            basePos.x += Math.sin(swingAngle) * swingRadius;
            basePos.y -= Math.cos(swingAngle) * swingRadius;
        }

        if (component.sliding && obstacle.userData.movingBarrier) {
            // Calculate sliding position
            const slideOffset = Math.sin(obstacle.userData.slidePosition || 0) * (obstacle.userData.slideRange || 0);
            basePos.x += slideOffset;
        }

        if (component.rotating && obstacle.userData.rotatingGroup) {
            // Calculate rotating position
            const rotationAngle = obstacle.userData.rotatingGroup.rotation.y || 0;
            const distance = component.offsetX || 0;
            if (distance !== 0) {
                basePos.x = obstacle.position.x + Math.cos(rotationAngle) * distance;
                basePos.z = obstacle.position.z + Math.sin(rotationAngle) * distance;
            }
        }

        return basePos;
    }

    static checkObstacleCollision(player, obstacle, isJumping, isSliding, playerY) {
        const playerBox = this.getPlayerCollisionGeometry(player, isJumping, isSliding, playerY);
        const obstacleType = obstacle.obstacleType;
        const collisionDef = COLLISION_GEOMETRIES[obstacleType];

        if (!collisionDef) return false;

        // Handle different collision geometry types
        switch (collisionDef.type) {
            case 'box':
                return this.checkBoxCollision(playerBox, obstacle, collisionDef);
            
            case 'composite':
                return this.checkCompositeCollision(playerBox, obstacle, collisionDef);
            
            case 'dynamic':
                return this.checkDynamicCollision(playerBox, obstacle, collisionDef);
            
            default:
                return false;
        }
    }

    static checkBoxCollision(playerBox, obstacle, geometry) {
        const obstacleBox = this.createBoundingBox({
            x: obstacle.position.x + (geometry.offsetX || 0),
            y: obstacle.position.y + (geometry.offsetY || 0),
            z: obstacle.position.z + (geometry.offsetZ || 0)
        }, geometry);

        return this.boxIntersectsBox(playerBox, obstacleBox);
    }

    static checkCompositeCollision(playerBox, obstacle, collisionDef) {
        for (const component of collisionDef.components) {
            let collision = false;
            
            if (component.type === 'box') {
                collision = this.checkBoxCollision(playerBox, obstacle, component);
            } else if (component.type === 'cylinder') {
                const cylinderPos = {
                    x: obstacle.position.x + (component.offsetX || 0),
                    y: obstacle.position.y + (component.offsetY || 0),
                    z: obstacle.position.z + (component.offsetZ || 0)
                };
                const cylinder = this.createCylinder(cylinderPos, component.radius, component.height);
                collision = this.cylinderIntersectsBox(cylinder, playerBox);
            }

            if (collision) return true;
        }
        return false;
    }

    static checkDynamicCollision(playerBox, obstacle, collisionDef) {
        for (const component of collisionDef.components) {
            let collision = false;
            
            if (component.isDynamic) {
                const dynamicPos = this.getDynamicComponentPosition(obstacle, component);
                
                if (component.type === 'box') {
                    const dynamicBox = this.createBoundingBox(dynamicPos, component);
                    collision = this.boxIntersectsBox(playerBox, dynamicBox);
                } else if (component.type === 'cylinder') {
                    const cylinder = this.createCylinder(dynamicPos, component.radius, component.height);
                    collision = this.cylinderIntersectsBox(cylinder, playerBox);
                }
            } else {
                // Static component
                if (component.type === 'box') {
                    collision = this.checkBoxCollision(playerBox, obstacle, component);
                } else if (component.type === 'cylinder') {
                    const cylinderPos = {
                        x: obstacle.position.x + (component.offsetX || 0),
                        y: obstacle.position.y + (component.offsetY || 0),
                        z: obstacle.position.z + (component.offsetZ || 0)
                    };
                    const cylinder = this.createCylinder(cylinderPos, component.radius, component.height);
                    collision = this.cylinderIntersectsBox(cylinder, playerBox);
                }
            }

            if (collision) return true;
        }
        return false;
    }
}

// Utility to set custom UVs for a box so the texture appears once per face
function setBoxUVs(geometry) {
    const uv = [
        0, 0,  1, 0,  1, 1,  0, 1, // face 1
        0, 0,  1, 0,  1, 1,  0, 1, // face 2
        0, 0,  1, 0,  1, 1,  0, 1, // face 3
        0, 0,  1, 0,  1, 1,  0, 1, // face 4
        0, 0,  1, 0,  1, 1,  0, 1, // face 5
        0, 0,  1, 0,  1, 1,  0, 1  // face 6
    ];
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

// Optimized texture loading with caching
function getCachedTexture(url, isLowEndDevice) {
    if (!textureCache.has(url)) {
        const loader = new THREE.TextureLoader();
        const texture = loader.load(url);
        texture.generateMipmaps = !isLowEndDevice;
        texture.minFilter = isLowEndDevice ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        textureCache.set(url, texture);
    }
    return textureCache.get(url);
}

// Create obstacle (enhanced with collision metadata)
export function createObstacle(type, lane, z, scene, isLowEndDevice) {
    let obstacle;
    const x = lane * LANE_WIDTH;
    const obstacleTexture = getCachedTexture('texture/gen.jpeg', isLowEndDevice);
    obstacleTexture.wrapS = THREE.RepeatWrapping;
    obstacleTexture.wrapT = THREE.RepeatWrapping;
    obstacleTexture.repeat.set(1, 1);

    switch (type) {
        case 'barrier': {
            const barrierGeometry = new THREE.BoxGeometry(2, 3, 1);
            setBoxUVs(barrierGeometry);
            const barrierMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            obstacle = new THREE.Mesh(barrierGeometry, barrierMaterial);
            obstacle.position.set(x, 1.5, z);
            obstacle.height = 3;
            break;
        }
        case 'low': {
            const lowGeometry = new THREE.BoxGeometry(3, 1, 1.5);
            setBoxUVs(lowGeometry);
            const lowMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            obstacle = new THREE.Mesh(lowGeometry, lowMaterial);
            obstacle.position.set(x, 0.5, z);
            obstacle.height = 1;
            break;
        }
        case 'train': {
            const trainGroup = new THREE.Group();
            const trainBody = new THREE.BoxGeometry(3, 2.5, 4);
            const trainMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            const trainMesh = new THREE.Mesh(trainBody, trainMaterial);
            trainMesh.position.y = 1.25;
            trainGroup.add(trainMesh);
            // Train windows
            const windowGeometry = new THREE.BoxGeometry(2.5, 1, 0.1);
            const windowMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
            window1.position.set(0, 1.5, 2.05);
            trainGroup.add(window1);
            trainGroup.position.set(x, 0, z);
            obstacle = trainGroup;
            obstacle.height = 2.5;
            break;
        }
        case 'slide_barrier': {
            const barrierGroup = new THREE.Group();
            // Posts
            const postGeometry = new THREE.BoxGeometry(0.3, 4.5, 0.3);
            const postMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            const leftPost = new THREE.Mesh(postGeometry, postMaterial);
            leftPost.position.set(-1, 2.25, 0);
            const rightPost = new THREE.Mesh(postGeometry, postMaterial);
            rightPost.position.set(1, 2.25, 0);
            // Bar
            const barGeometry = new THREE.BoxGeometry(2.2, 0.4, 0.3);
            const barMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            const bar = new THREE.Mesh(barGeometry, barMaterial);
            bar.position.set(0, 3.2, 0);
            barrierGroup.add(leftPost, rightPost, bar);
            barrierGroup.position.set(x, 0, z);
            barrierGroup.obstacleType = 'slide_barrier';
            barrierGroup.castShadow = true;
            barrierGroup.height = 3;
            obstacle = barrierGroup;
            break;
        }
        case 'swinging_log': {
            const swingingGroup = new THREE.Group();
            // Support posts
            const supportGeometry = new THREE.BoxGeometry(0.4, 6, 0.4);
            const supportMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            const leftSupport = new THREE.Mesh(supportGeometry, supportMaterial);
            leftSupport.position.set(-3, 3, 0);
            const rightSupport = new THREE.Mesh(supportGeometry, supportMaterial);
            rightSupport.position.set(3, 3, 0);
            swingingGroup.add(leftSupport, rightSupport);
            // Top beam
            const beamGeometry = new THREE.BoxGeometry(6.5, 0.3, 0.4);
            const beamMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            const topBeam = new THREE.Mesh(beamGeometry, beamMaterial);
            topBeam.position.set(0, 6, 0);
            swingingGroup.add(topBeam);
            // Swinging log
            const logGeometry = new THREE.CylinderGeometry(0.3, 0.3, 4, 12);
            const logMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const log = new THREE.Mesh(logGeometry, logMaterial);
            log.rotation.z = Math.PI / 2;
            // Chain links
            const chainGroup = new THREE.Group();
            for (let i = 0; i < 3; i++) {
                const chainGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
                const chainMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
                const chain = new THREE.Mesh(chainGeo, chainMat);
                chain.position.set(0, -i - 0.5, 0);
                chainGroup.add(chain);
            }
            // Pivot point for swinging
            const pivotGroup = new THREE.Group();
            chainGroup.position.y = -1;
            log.position.y = -2.5;
            pivotGroup.add(chainGroup, log);
            pivotGroup.position.set(0, 6, 0);
            swingingGroup.add(pivotGroup);
            swingingGroup.position.set(x, 0, z);
            // Animation properties
            swingingGroup.userData = {
                pivotGroup: pivotGroup,
                swingAngle: 0,
                swingSpeed: 0.02 + Math.random() * 0.01,
                swingAmplitude: Math.PI / 3
            };
            obstacle = swingingGroup;
            obstacle.height = 4;
            break;
        }
        case 'sliding_barrier': {
            const slidingGroup = new THREE.Group();
            // Track posts
            const trackPostGeometry = new THREE.BoxGeometry(0.3, 4, 0.3);
            const trackPostMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            const trackLeft = new THREE.Mesh(trackPostGeometry, trackPostMaterial);
            trackLeft.position.set(-4, 2, 0);
            const trackRight = new THREE.Mesh(trackPostGeometry, trackPostMaterial);
            trackRight.position.set(4, 2, 0);
            slidingGroup.add(trackLeft, trackRight);
            // Track rail
            const railGeometry = new THREE.BoxGeometry(8.5, 0.2, 0.2);
            const railMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
            const rail = new THREE.Mesh(railGeometry, railMaterial);
            rail.position.set(0, 3.5, 0);
            slidingGroup.add(rail);
            // Moving barrier
            const movingBarrierGeometry = new THREE.BoxGeometry(1.5, 3, 0.5);
            const movingBarrierMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            const movingBarrier = new THREE.Mesh(movingBarrierGeometry, movingBarrierMaterial);
            movingBarrier.position.set(0, 1.5, 0);
            slidingGroup.add(movingBarrier);
            slidingGroup.position.set(x, 0, z);
            // Animation properties
            slidingGroup.userData = {
                movingBarrier: movingBarrier,
                slidePosition: 0,
                slideSpeed: 0.03 + Math.random() * 0.02,
                slideRange: 3
            };
            obstacle = slidingGroup;
            obstacle.height = 3;
            break;
        }
        case 'rotating_hammer': {
            const hammerGroup = new THREE.Group();
            // Central post
            const hammerPostGeometry = new THREE.CylinderGeometry(0.3, 0.3, 5, 12);
            const hammerPostMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            const hammerPost = new THREE.Mesh(hammerPostGeometry, hammerPostMaterial);
            hammerPost.position.y = 2.5;
            hammerGroup.add(hammerPost);
            // Rotating arm
            const armGeometry = new THREE.BoxGeometry(6, 0.4, 0.4);
            const armMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const arm = new THREE.Mesh(armGeometry, armMaterial);
            // Hammer heads at both ends
            const hammerHeadGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.8);
            const hammerHeadMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
            const hammerHead1 = new THREE.Mesh(hammerHeadGeometry, hammerHeadMaterial);
            hammerHead1.position.set(-3, 0, 0);
            const hammerHead2 = new THREE.Mesh(hammerHeadGeometry, hammerHeadMaterial);
            hammerHead2.position.set(3, 0, 0);
            // Rotating group
            const rotatingGroup = new THREE.Group();
            rotatingGroup.add(arm, hammerHead1, hammerHead2);
            rotatingGroup.position.y = 3;
            hammerGroup.add(rotatingGroup);
            hammerGroup.position.set(x, 0, z);
            // Animation properties
            hammerGroup.userData = {
                rotatingGroup: rotatingGroup,
                rotationSpeed: 0.04 + Math.random() * 0.02
            };
            obstacle = hammerGroup;
            obstacle.height = 4;
            break;
        }
        default: {
            const fallbackGeometry = new THREE.BoxGeometry(2, 2, 2);
            setBoxUVs(fallbackGeometry);
            const fallbackMaterial = new THREE.MeshLambertMaterial({ color: 0xff00ff });
            obstacle = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            obstacle.position.set(x, 1, z);
            obstacle.height = 2;
        }
    }
    
    obstacle.castShadow = true;
    obstacle.obstacleType = type;
    scene.add(obstacle);
    return obstacle;
}

// Update moving obstacles
export function updateMovingObstacles(obstacles) {
    obstacles.forEach(obstacle => {
        if (obstacle.obstacleType === 'swinging_log' && obstacle.userData.pivotGroup) {
            obstacle.userData.swingAngle += obstacle.userData.swingSpeed;
            const swing = Math.sin(obstacle.userData.swingAngle) * obstacle.userData.swingAmplitude;
            obstacle.userData.pivotGroup.rotation.z = swing;
        }
        if (obstacle.obstacleType === 'sliding_barrier' && obstacle.userData.movingBarrier) {
            obstacle.userData.slidePosition += obstacle.userData.slideSpeed;
            const slide = Math.sin(obstacle.userData.slidePosition) * obstacle.userData.slideRange;
            obstacle.userData.movingBarrier.position.x = slide;
        }
        if (obstacle.obstacleType === 'rotating_hammer' && obstacle.userData.rotatingGroup) {
            obstacle.userData.rotatingGroup.rotation.y += obstacle.userData.rotationSpeed;
        }
    });
}

// Enhanced geometry-based collision detection
export function checkObstacleCollisions(player, obstacles, onSmallHit, scene, isJumping, isSliding, playerY, playHitAnimation, playHitAnimationAndFreeze, dog, playDogBark, setGameRunning, gameOver) {
    if (!player) return;

    obstacles.forEach(obstacle => {
        if (!obstacle.visible) return;

        const hasCollision = CollisionDetector.checkObstacleCollision(player, obstacle, isJumping, isSliding, playerY);
        
        function handleLargeObstacleHit() {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            const playerBox = new THREE.Box3().setFromObject(player);
            player.position.z = obstacleBox.max.z + (playerBox.max.z - playerBox.min.z) / 2 + 0.1;
            if (typeof playHitAnimationAndFreeze === 'function') {
                playHitAnimationAndFreeze(isJumping);
            }
            if (dog && player) {
                dog.position.set(player.position.x, player.position.y, player.position.z + 1.5);
                if (typeof playDogBark === 'function') playDogBark();
                if (dog.lookAt) dog.lookAt(player.position);
            }
            if (typeof setGameRunning === 'function') setGameRunning(false);
            setTimeout(() => {
                if (typeof gameOver === 'function') gameOver('obstacle');
            }, 700);
        }

        if (hasCollision) {
            // Handle specific obstacle behaviors
            switch (obstacle.obstacleType) {
                case 'low':
                    // Can jump over low obstacles
                    if (isJumping && playerY > 2) {
                        if (typeof playHitAnimation === 'function') playHitAnimation(true);
                        return;
                    }
                    // Hit by low obstacle
                    if (typeof playHitAnimation === 'function') playHitAnimation(isJumping);
                    if (typeof onSmallHit === 'function') onSmallHit(obstacle);
                    if (scene) scene.remove(obstacle);
                    const index = obstacles.indexOf(obstacle);
                    if (index > -1) obstacles.splice(index, 1);
                    break;
                case 'barrier':
                    // Can slide under barriers
                    if (isSliding) {
                        if (typeof playHitAnimation === 'function') playHitAnimation(false);
                        return;
                    }
                    // Hit by barrier - game over
                    handleLargeObstacleHit();
                    break;
                case 'slide_barrier':
                    // Must slide under slide barriers
                    if (isSliding) {
                        return; // Successfully avoided
                    }
                    // Hit by slide barrier - game over
                    handleLargeObstacleHit();
                    break;
                case 'train':
                case 'swinging_log':
                case 'sliding_barrier':
                case 'rotating_hammer':
                    // These are always large obstacles - game over on hit
                    handleLargeObstacleHit();
                    break;
                default:
                    handleLargeObstacleHit();
                    break;
            }
        }
    });
}