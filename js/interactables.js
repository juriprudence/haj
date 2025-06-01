import { LANE_WIDTH } from './config.js';

// Cache for textures and geometries
let textureCache = new Map();
let geometryCache = new Map();
let materialCache = new Map();

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

// Create obstacle
export function createObstacle(type, lane, z, scene, isLowEndDevice) {
    let obstacle;
    const x = lane * LANE_WIDTH;
    // Use cached texture instead of loading it every time
    const obstacleTexture = getCachedTexture('texture/gen.jpeg', isLowEndDevice);
    obstacleTexture.wrapS = THREE.RepeatWrapping;
    obstacleTexture.wrapT = THREE.RepeatWrapping;
    obstacleTexture.repeat.set(1, 1); // Show image once per face

    switch (type) {
        case 'barrier':
            const barrierGeometry = new THREE.BoxGeometry(2, 3, 1);
            setBoxUVs(barrierGeometry);
            const barrierMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            obstacle = new THREE.Mesh(barrierGeometry, barrierMaterial);
            obstacle.position.set(x, 1.5, z);
            obstacle.height = 3;
            break;
        case 'low':
            const lowGeometry = new THREE.BoxGeometry(3, 1, 1.5);
            setBoxUVs(lowGeometry);
            const lowMaterial = new THREE.MeshLambertMaterial({ map: obstacleTexture });
            obstacle = new THREE.Mesh(lowGeometry, lowMaterial);
            obstacle.position.set(x, 0.5, z);
            obstacle.height = 1;
            break;
        case 'train':
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
        case 'slide_barrier':
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
            // Group
            const barrierGroup = new THREE.Group();
            barrierGroup.add(leftPost, rightPost, bar);
            barrierGroup.position.set(x, 0, z);
            barrierGroup.obstacleType = 'slide_barrier';
            barrierGroup.castShadow = true;
            barrierGroup.height = 3;
            obstacle = barrierGroup;
            break;
        case 'swinging_log':
            // Create swinging log obstacle
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
            log.rotation.z = Math.PI / 2; // Make it horizontal
            
            // Chain links (simplified)
            const chainGroup = new THREE.Group();
            for (let i = 0; i < 3; i++) {
                const linkGeometry = new THREE.RingGeometry(0.1, 0.15, 8);
                const linkMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
                const link = new THREE.Mesh(linkGeometry, linkMaterial);
                link.position.y = -i * 0.3;
                chainGroup.add(link);
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
                swingSpeed: 0.02 + Math.random() * 0.01, // Random speed
                swingAmplitude: Math.PI / 3 // 60 degrees
            };
            
            obstacle = swingingGroup;
            obstacle.height = 4;
            break;
        case 'sliding_barrier':
            // Create horizontally sliding barrier
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
                slideSpeed: 0.03 + Math.random() * 0.02, // Random speed
                slideRange: 3 // How far it slides
            };
            
            obstacle = slidingGroup;
            obstacle.height = 3;
            break;
        case 'rotating_hammer':
            // Create rotating hammer obstacle
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
                rotationSpeed: 0.04 + Math.random() * 0.02 // Random speed
            };
            
            obstacle = hammerGroup;
            obstacle.height = 4;
            break;
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
            // Update swinging log
            obstacle.userData.swingAngle += obstacle.userData.swingSpeed;
            const swing = Math.sin(obstacle.userData.swingAngle) * obstacle.userData.swingAmplitude;
            obstacle.userData.pivotGroup.rotation.z = swing;
        }
        
        if (obstacle.obstacleType === 'sliding_barrier' && obstacle.userData.movingBarrier) {
            // Update sliding barrier
            obstacle.userData.slidePosition += obstacle.userData.slideSpeed;
            const slide = Math.sin(obstacle.userData.slidePosition) * obstacle.userData.slideRange;
            obstacle.userData.movingBarrier.position.x = slide;
        }
        
        if (obstacle.obstacleType === 'rotating_hammer' && obstacle.userData.rotatingGroup) {
            // Update rotating hammer
            obstacle.userData.rotatingGroup.rotation.y += obstacle.userData.rotationSpeed;
        }
    });
}

// Create coin (now as a small chicken)
export function createCoin(lane, z, scene) {
    const chickenGroup = new THREE.Group();
    
    // Chicken body (ellipsoid shape)
    const bodyGeometry = new THREE.SphereGeometry(0.3, 12, 8);
    bodyGeometry.scale(1, 0.8, 1.2); // Make it slightly egg-shaped
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 }); // Golden yellow
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0, 0);
    chickenGroup.add(body);
    
    // Chicken head
    const headGeometry = new THREE.SphereGeometry(0.15, 10, 8);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.25, 0.25);
    chickenGroup.add(head);
    
    // Beak
    const beakGeometry = new THREE.ConeGeometry(0.03, 0.08, 6);
    const beakMaterial = new THREE.MeshLambertMaterial({ color: 0xff8c00 }); // Orange
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.position.set(0, 0.25, 0.35);
    beak.rotation.x = Math.PI / 2;
    chickenGroup.add(beak);
    
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.02, 6, 6);
    const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.08, 0.3, 0.32);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.08, 0.3, 0.32);
    chickenGroup.add(leftEye, rightEye);
    
    // Wings
    const wingGeometry = new THREE.SphereGeometry(0.15, 8, 6);
    wingGeometry.scale(0.6, 0.8, 1.2);
    const wingMaterial = new THREE.MeshLambertMaterial({ color: 0xffb347 }); // Slightly darker yellow
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.25, 0, -0.05);
    leftWing.rotation.z = -0.3;
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.25, 0, -0.05);
    rightWing.rotation.z = 0.3;
    chickenGroup.add(leftWing, rightWing);
    
    // Tail feathers
    const tailGeometry = new THREE.SphereGeometry(0.1, 6, 6);
    tailGeometry.scale(0.5, 1, 0.3);
    const tailMaterial = new THREE.MeshLambertMaterial({ color: 0xffb347 });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 0.15, -0.35);
    chickenGroup.add(tail);
    
    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0xff8c00 });
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.1, -0.35, 0.1);
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.1, -0.35, 0.1);
    chickenGroup.add(leftLeg, rightLeg);
    
    // Feet
    const footGeometry = new THREE.SphereGeometry(0.04, 6, 6);
    footGeometry.scale(1, 0.3, 1.5);
    const footMaterial = new THREE.MeshLambertMaterial({ color: 0xff8c00 });
    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.1, -0.42, 0.12);
    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.1, -0.42, 0.12);
    chickenGroup.add(leftFoot, rightFoot);
    
    // Position the chicken
    chickenGroup.position.set(lane * LANE_WIDTH, 1.5, z);
    chickenGroup.castShadow = true;
    
    // Add a gentle bobbing animation
    chickenGroup.userData = {
        originalY: 1.5,
        bobSpeed: 0.05,
        bobAmount: 0.1
    };
    
    scene.add(chickenGroup);
    return chickenGroup;
}

// Create fly power-up
export function createPowerUp(lane, z, scene) {
    const powerUpGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const powerUpMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x00ffff, 
        emissive: 0x00ffff, 
        emissiveIntensity: 0.7 
    });
    const powerUp = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
    powerUp.position.set(lane * LANE_WIDTH, 3, z);
    powerUp.castShadow = true;
    powerUp.isPowerUp = true;
    scene.add(powerUp);
    return powerUp;
}

// Create particle effect
export function createParticleEffect(position, scene) {
    const particleGroup = new THREE.Group();
    const particles = [];
    
    for (let i = 0; i < 8; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const particleMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        particle.position.copy(position);
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.2
        );
        
        particleGroup.add(particle);
        scene.add(particle);
        particles.push(particle);
    }
    
    return particles;
}

// Update particles
export function updateParticles(particles, scene) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        
        particle.position.add(particle.velocity);
        particle.velocity.y -= 0.01;
        particle.material.opacity -= 0.02;
        
        if (particle.material.opacity <= 0) {
            scene.remove(particle);
            particles.splice(i, 1);
        }
    }
}

// Update chicken animation (call this in your game loop)
export function updateChicken(chicken) {
    if (chicken.userData && chicken.userData.originalY !== undefined) {
        const time = Date.now() * chicken.userData.bobSpeed;
        chicken.position.y = chicken.userData.originalY + Math.sin(time) * chicken.userData.bobAmount;
    }
}

// Dispose of 3D objects properly
export function disposeObject(obj) {
    if (obj.geometry && !geometryCache.has(obj.geometry.uuid)) {
        obj.geometry.dispose();
    }
    if (obj.material) {
        if (obj.material.map && !textureCache.has(obj.material.map.image?.src)) {
            obj.material.map.dispose();
        }
        if (!materialCache.has(obj.material.uuid)) {
            obj.material.dispose();
        }
    }
    if (obj.children) {
        obj.children.forEach(child => disposeObject(child));
    }
}