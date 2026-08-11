const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let gameState = "MENU";
let survivalTime = 0;
let score = 0;
let gameInterval;

// Realistic Car Physics Model
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 38,
    height: 76,
    angle: 0,           // Heading angle
    velocity: { x: 0, y: 0 }, // True 2D motion vector
    maxSpeed: 10,
    acceleration: 0.12,
    braking: 0.25,
    friction: 0.985,    // Rolling resistance
    steeringSpeed: 0.045,
    grip: 0.18,         // Tire traction (lower = more slip/drift, higher = rigid grip)
    hp: 100
};

let cops = [];
let debris = [];
let skidMarks = [];
let roadblocks = [];
let oilSlicks = [];
let powerups = [];

const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyE' && gameState === "PLAYING") {
        dropOilSlick();
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    gameState = "PLAYING";
    
    cops.push(createCop('cruiser'));

    gameInterval = setInterval(() => {
        if (gameState === "PLAYING") {
            survivalTime++;
            document.getElementById('time-display').innerText = survivalTime + "s";
            document.getElementById('hp-display').innerText = player.hp + "%";

            if (survivalTime % 6 === 0) {
                let type = Math.random() < 0.35 ? 'heavy' : (Math.random() < 0.6 ? 'fast' : 'cruiser');
                cops.push(createCop(type));
            }
            if (survivalTime % 9 === 0) spawnRoadblock();
            if (survivalTime % 14 === 0) spawnPowerup();
        }
    }, 1000);
});

function createCop(type) {
    let isHeavy = type === 'heavy';
    return {
        x: Math.random() * canvas.width,
        y: Math.random() < 0.5 ? -120 : canvas.height + 120,
        width: isHeavy ? 54 : 38,
        height: isHeavy ? 96 : 76,
        angle: 0,
        velocity: { x: 0, y: 0 },
        type: type,
        maxSpeed: type === 'fast' ? 9.5 : (isHeavy ? 6 : 8),
        acceleration: isHeavy ? 0.08 : 0.14,
        grip: isHeavy ? 0.22 : 0.15
    };
}

function spawnRoadblock() {
    roadblocks.push({
        x: Math.random() * (canvas.width - 200) + 100,
        y: Math.random() < 0.5 ? -100 : canvas.height + 100,
        width: 150,
        height: 20,
        angle: Math.random() * Math.PI
    });
}

function spawnPowerup() {
    powerups.push({
        x: Math.random() * (canvas.width - 100) + 50,
        y: Math.random() * (canvas.height - 100) + 50,
        type: Math.random() < 0.5 ? 'wrench' : 'nitro'
    });
}

function dropOilSlick() {
    oilSlicks.push({ x: player.x, y: player.y, radius: 30 });
}

function spawnDebris(x, y) {
    for (let i = 0; i < 6; i++) {
        debris.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.5) * 14,
            size: 4 + Math.random() * 6,
            life: 70
        });
    }
}

// Realistic Physics Step for Vehicles
function updateVehiclePhysics(vehicle, input) {
    // Forward direction vector based on vehicle angle
    let forwardX = Math.sin(vehicle.angle);
    let forwardY = -Math.cos(vehicle.angle);

    // Right vector for lateral drift calculation
    let rightX = Math.cos(vehicle.angle);
    let rightY = Math.sin(vehicle.angle);

    // Current speed along forward axis
    let forwardSpeed = vehicle.velocity.x * forwardX + vehicle.velocity.y * forwardY;
    let lateralSpeed = vehicle.velocity.x * rightX + vehicle.velocity.y * rightY;

    if (input.accelerating) {
        forwardSpeed += vehicle.acceleration;
    } else if (input.braking) {
        forwardSpeed -= vehicle.braking;
    } else {
        forwardSpeed *= vehicle.friction; // Natural deceleration
    }

    // Speed caps
    forwardSpeed = Math.max(-vehicle.maxSpeed * 0.4, Math.min(vehicle.maxSpeed, forwardSpeed));

    // Dynamic Steering (turning rate scales with forward speed momentum)
    if (input.turningLeft && Math.abs(forwardSpeed) > 0.5) {
        vehicle.angle -= 0.052 * (forwardSpeed / vehicle.maxSpeed);
    }
    if (input.turningRight && Math.abs(forwardSpeed) > 0.5) {
        vehicle.angle += 0.052 * (forwardSpeed / vehicle.maxSpeed);
    }

    // Spacebar Handbrake increases slip (reduces lateral grip for realistic drifting)
    let currentGrip = input.handbraking ? vehicle.grip * 0.35 : vehicle.grip;
    lateralSpeed *= (1 - currentGrip);

    // Reconstruct velocity vector from forward and lateral components
    vehicle.velocity.x = forwardX * forwardSpeed + rightX * lateralSpeed;
    vehicle.velocity.y = forwardY * forwardSpeed + rightY * lateralSpeed;

    // Update physical position
    vehicle.x += vehicle.velocity.x;
    vehicle.y += vehicle.velocity.y;

    // Leave skid marks when sliding sideways or handbraking hard
    if ((input.handbraking || Math.abs(lateralSpeed) > 2.5) && Math.abs(forwardSpeed) > 3) {
        skidMarks.push({ x: vehicle.x, y: vehicle.y, life: 40 });
        if (skidMarks.length > 200) skidMarks.shift();
    }
}

function update() {
    if (gameState !== "PLAYING") return;

    // Player inputs
    let pInput = {
        accelerating: keys['KeyW'] || keys['ArrowUp'],
        braking: keys['KeyS'] || keys['ArrowDown'],
        turningLeft: keys['KeyA'] || keys['ArrowLeft'],
        turningRight: keys['KeyD'] || keys['ArrowRight'],
        handbraking: keys['Space']
    };

    updateVehiclePhysics(player, pInput);

    // Infinite world screen wrap
    if (player.x < 0) player.x = canvas.width;
    if (player.x > canvas.width) player.x = 0;
    if (player.y < 0) player.y = canvas.height;
    if (player.y > canvas.height) player.y = 0;

    // Powerups
    powerups.forEach((p, index) => {
        if (Math.hypot(player.x - p.x, player.y - p.y) < 40) {
            if (p.type === 'wrench') {
                player.hp = Math.min(100, player.hp + 25);
            } else {
                player.velocity.x *= 1.5;
                player.velocity.y *= 1.5;
            }
            powerups.splice(index, 1);
            document.getElementById('hp-display').innerText = player.hp + "%";
        }
    });

    // Roadblocks
    roadblocks.forEach((rb, index) => {
        if (Math.hypot(player.x - rb.x, player.y - rb.y) < 60) {
            player.hp -= 20;
            spawnDebris(player.x, player.y);
            player.velocity.x *= -0.3;
            player.velocity.y *= -0.3;
            roadblocks.splice(index, 1);
            document.getElementById('hp-display').innerText = Math.max(0, player.hp) + "%";
            if (player.hp <= 0) triggerGameOver();
        }
    });

    // Cops Physics & Pursuit AI
    cops.forEach(cop => {
        let hitOil = oilSlicks.findIndex(o => Math.hypot(cop.x - o.x, cop.y - o.y) < o.radius + 10);
        if (hitOil !== -1) {
            cop.angle += Math.PI * 0.8; // Spin out on oil
            oilSlicks.splice(hitOil, 1);
        }

        // Steer towards player
        let dx = player.x - cop.x;
        let dy = player.y - cop.y;
        let targetAngle = Math.atan2(dx, -dy);
        let angleDiff = targetAngle - cop.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        cop.angle += angleDiff * 0.08;

        let copInput = {
            accelerating: true,
            braking: false,
            turningLeft: angleDiff < -0.05,
            turningRight: angleDiff > 0.05,
            handbraking: false
        };

        updateVehiclePhysics(cop, copInput);

        // Collision Check (Player vs Cop)
        if (Math.hypot(player.x - cop.x, player.y - cop.y) < 55) {
            let damage = cop.type === 'heavy' ? 35 : 15;
            player.hp -= damage;
            spawnDebris(player.x, player.y);
            
            // Momentum exchange bounce
            let tempVx = player.velocity.x;
            let tempVy = player.velocity.y;
            player.velocity.x = cop.velocity.x * 0.8;
            player.velocity.y = cop.velocity.y * 0.8;
            cop.velocity.x = tempVx * 0.5;
            cop.velocity.y = tempVy * 0.5;

            document.getElementById('hp-display').innerText = Math.max(0, player.hp) + "%";
            if (player.hp <= 0) triggerGameOver();
        }
    });

    // Debris updates
    debris.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        d.life--;
    });
    debris = debris.filter(d => d.life > 0);

    let currentSpeedMph = Math.round(Math.hypot(player.velocity.x, player.velocity.y) * 12);
    document.getElementById('speed-display').innerText = currentSpeedMph + " MPH";
}

function triggerGameOver() {
    gameState = "OVER";
    document.getElementById('game-over-screen').style.display = 'flex';
}

function draw() {
    ctx.fillStyle = '#0b0b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Background Asphalt Grid Lines
    ctx.strokeStyle = '#151525';
    ctx.lineWidth = 2;
    let gridSize = 120;
    let offsetX = -(player.x * 0.5) % gridSize;
    let offsetY = -(player.y * 0.5) % gridSize;

    ctx.beginPath();
    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Draw Skid Marks
    skidMarks.forEach(sm => {
        ctx.fillStyle = 'rgba(5, 5, 10, 0.5)';
        ctx.fillRect(sm.x - 2, sm.y - 2, 4, 4);
        sm.life--;
    });
    skidMarks = skidMarks.filter(sm => sm.life > 0);

    if (gameState !== "PLAYING") return;

    // Oil Slicks
    oilSlicks.forEach(o => {
        ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Powerups
    powerups.forEach(p => {
        ctx.fillStyle = p.type === 'wrench' ? '#00ff66' : '#ffaa00';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
        ctx.shadowBlur = 0;
    });

    // Roadblocks
    roadblocks.forEach(rb => {
        ctx.save();
        ctx.translate(rb.x, rb.y);
        ctx.rotate(rb.angle);
        ctx.fillStyle = '#ff2200';
        ctx.fillRect(-rb.width / 2, -rb.height / 2, rb.width, rb.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-rb.width / 2, -rb.height / 2 + 4, rb.width, 4);
        ctx.restore();
    });

    // Debris
    debris.forEach(d => {
        ctx.fillStyle = '#ff4500';
        ctx.fillRect(d.x, d.y, d.size, d.size);
    });

    // Cops Rendering with Headlights & Sirens
    cops.forEach(cop => {
        ctx.save();
        ctx.translate(cop.x, cop.y);
        ctx.rotate(cop.angle);

        ctx.fillStyle = cop.type === 'heavy' ? '#1c1c28' : '#111118';
        ctx.fillRect(-cop.width / 2, -cop.height / 2, cop.width, cop.height);

        // Windshield
        ctx.fillStyle = '#223344';
        ctx.fillRect(-cop.width / 2 + 4, -cop.height / 2 + 12, cop.width - 8, 16);

        // Flashing Siren
        let siren = Math.floor(Date.now() / 120) % 2 === 0 ? '#ff0000' : '#0066ff';
        ctx.fillStyle = siren;
        ctx.shadowColor = siren;
        ctx.shadowBlur = 12;
        ctx.fillRect(-4, -4, 8, 8);

        ctx.restore();
    });

    // Player Car Rendering with Headlights
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Tail lights glow
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8;
    ctx.fillRect(-player.width / 2 + 4, player.height / 2 - 4, 6, 4);
    ctx.fillRect(player.width / 2 - 10, player.height / 2 - 4, 6, 4);

    // Car Body
    ctx.fillStyle = player.hp < 40 ? '#aa0022' : '#ff0055';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 14;
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

    // Windshield & Roof
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(-player.width / 2 + 5, -player.height / 2 + 14, player.width - 10, 18);

    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
