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
let gameInterval;

const player = {
    x: 0,
    y: 0,
    width: 40,
    height: 80,
    angle: 0,
    velocity: { x: 0, y: 0 },
    maxSpeed: 13,
    acceleration: 0.15,
    braking: 0.3,
    friction: 0.975,
    grip: 0.22,
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
    
    // Spawn initial cops around the player
    cops.push(createCop(player.x + 400, player.y + 400, 'cruiser'));

    gameInterval = setInterval(() => {
        if (gameState === "PLAYING") {
            survivalTime++;
            document.getElementById('time-display').innerText = survivalTime + "s";
            document.getElementById('hp-display').innerText = player.hp + "%";

            // Spawn cops and items infinitely around player's coordinates
            if (survivalTime % 5 === 0) {
                let angle = Math.random() * Math.PI * 2;
                let dist = 800 + Math.random() * 400;
                let type = Math.random() < 0.35 ? 'heavy' : (Math.random() < 0.6 ? 'fast' : 'cruiser');
                cops.push(createCop(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, type));
            }
            if (survivalTime % 8 === 0) spawnRoadblock();
            if (survivalTime % 12 === 0) spawnPowerup();
        }
    }, 1000);
});

function createCop(x, y, type) {
    let isHeavy = type === 'heavy';
    return {
        x: x,
        y: y,
        width: isHeavy ? 56 : 40,
        height: isHeavy ? 100 : 80,
        angle: 0,
        velocity: { x: 0, y: 0 },
        type: type,
        maxSpeed: type === 'fast' ? 10 : (isHeavy ? 6.5 : 8.5),
        acceleration: isHeavy ? 0.09 : 0.16,
        grip: isHeavy ? 0.25 : 0.18
    };
}

function spawnRoadblock() {
    let angle = Math.random() * Math.PI * 2;
    let dist = 500 + Math.random() * 300;
    roadblocks.push({
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        width: 160,
        height: 22,
        angle: Math.random() * Math.PI
    });
}

function spawnPowerup() {
    let angle = Math.random() * Math.PI * 2;
    let dist = 400 + Math.random() * 300;
    powerups.push({
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        type: Math.random() < 0.5 ? 'wrench' : 'nitro'
    });
}

function dropOilSlick() {
    oilSlicks.push({ x: player.x, y: player.y, radius: 35 });
}

function spawnDebris(x, y) {
    // Heavy car parts flying outward
    for (let i = 0; i < 8; i++) {
        debris.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 16,
            vy: (Math.random() - 0.5) * 16,
            size: 6 + Math.random() * 8,
            life: 80
        });
    }
}

function updateVehiclePhysics(vehicle, input) {
    let forwardX = Math.sin(vehicle.angle);
    let forwardY = -Math.cos(vehicle.angle);
    let rightX = Math.cos(vehicle.angle);
    let rightY = Math.sin(vehicle.angle);

    let forwardSpeed = vehicle.velocity.x * forwardX + vehicle.velocity.y * forwardY;
    let lateralSpeed = vehicle.velocity.x * rightX + vehicle.velocity.y * rightY;

    if (input.accelerating) {
        forwardSpeed += vehicle.acceleration;
    } else if (input.braking) {
        forwardSpeed -= vehicle.braking;
    } else {
        forwardSpeed *= vehicle.friction;
    }

    forwardSpeed = Math.max(-vehicle.maxSpeed * 0.4, Math.min(vehicle.maxSpeed, forwardSpeed));

    if (input.turningLeft && Math.abs(forwardSpeed) > 0.4) {
        vehicle.angle -= 0.06 * (forwardSpeed / vehicle.maxSpeed);
    }
    if (input.turningRight && Math.abs(forwardSpeed) > 0.4) {
        vehicle.angle += 0.06 * (forwardSpeed / vehicle.maxSpeed);
    }

    let currentGrip = input.handbraking ? vehicle.grip * 0.3 : vehicle.grip;
    lateralSpeed *= (1 - currentGrip);

    vehicle.velocity.x = forwardX * forwardSpeed + rightX * lateralSpeed;
    vehicle.velocity.y = forwardY * forwardSpeed + rightY * lateralSpeed;

    vehicle.x += vehicle.velocity.x;
    vehicle.y += vehicle.velocity.y;

    if ((input.handbraking || Math.abs(lateralSpeed) > 2) && Math.abs(forwardSpeed) > 2) {
        skidMarks.push({ x: vehicle.x, y: vehicle.y, life: 60 });
        if (skidMarks.length > 300) skidMarks.shift();
    }
}

function update() {
    if (gameState !== "PLAYING") return;

    let pInput = {
        accelerating: keys['KeyW'] || keys['ArrowUp'],
        braking: keys['KeyS'] || keys['ArrowDown'],
        turningLeft: keys['KeyA'] || keys['ArrowLeft'],
        turningRight: keys['KeyD'] || keys['ArrowRight'],
        handbraking: keys['Space']
    };

    updateVehiclePhysics(player, pInput);

    // Powerups collection
    powerups.forEach((p, index) => {
        if (Math.hypot(player.x - p.x, player.y - p.y) < 45) {
            if (p.type === 'wrench') {
                player.hp = Math.min(100, player.hp + 25);
            } else {
                player.velocity.x *= 1.4;
                player.velocity.y *= 1.4;
            }
            powerups.splice(index, 1);
            document.getElementById('hp-display').innerText = player.hp + "%";
        }
    });

    // Roadblock collision
    roadblocks.forEach((rb, index) => {
        if (Math.hypot(player.x - rb.x, player.y - rb.y) < 65) {
            player.hp -= 20;
            spawnDebris(player.x, player.y);
            player.velocity.x *= -0.4;
            player.velocity.y *= -0.4;
            roadblocks.splice(index, 1);
            document.getElementById('hp-display').innerText = Math.max(0, player.hp) + "%";
            if (player.hp <= 0) triggerGameOver();
        }
    });

    // Cops AI & Collision
    cops.forEach(cop => {
        let hitOil = oilSlicks.findIndex(o => Math.hypot(cop.x - o.x, cop.y - o.y) < o.radius + 15);
        if (hitOil !== -1) {
            cop.angle += Math.PI;
            oilSlicks.splice(hitOil, 1);
        }

        let dx = player.x - cop.x;
        let dy = player.y - cop.y;
        let targetAngle = Math.atan2(dx, -dy);
        let angleDiff = targetAngle - cop.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        cop.angle += angleDiff * 0.07;

        let copInput = {
            accelerating: true,
            braking: false,
            turningLeft: angleDiff < -0.05,
            turningRight: angleDiff > 0.05,
            handbraking: false
        };

        updateVehiclePhysics(cop, copInput);

        // Collision Check
        if (Math.hypot(player.x - cop.x, player.y - cop.y) < 60) {
            let damage = cop.type === 'heavy' ? 30 : 15;
            player.hp -= damage;
            spawnDebris(player.x, player.y);

            let tempVx = player.velocity.x;
            let tempVy = player.velocity.y;
            player.velocity.x = cop.velocity.x * 0.7;
            player.velocity.y = cop.velocity.y * 0.7;
            cop.velocity.x = tempVx * 0.4;
            cop.velocity.y = tempVy * 0.4;

            document.getElementById('hp-display').innerText = Math.max(0, player.hp) + "%";
            if (player.hp <= 0) triggerGameOver();
        }
    });

    debris.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        d.life--;
    });
    debris = debris.filter(d => d.life > 0);

    let speedMph = Math.round(Math.hypot(player.velocity.x, player.velocity.y) * 12);
    document.getElementById('speed-display').innerText = speedMph + " MPH";
}

function triggerGameOver() {
    gameState = "OVER";
    document.getElementById('game-over-screen').style.display = 'flex';
}

function draw() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // CAMERA LOCK ON PLAYER (True Infinite World Translation)
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Infinite Scrolling Asphalt Grid
    ctx.strokeStyle = '#141422';
    ctx.lineWidth = 2;
    let gridSize = 140;
    let startX = Math.floor((player.x - canvas.width) / gridSize) * gridSize;
    let endX = startX + canvas.width * 2;
    let startY = Math.floor((player.y - canvas.height) / gridSize) * gridSize;
    let endY = startY + canvas.height * 2;

    ctx.beginPath();
    for (let x = startX; x < endX; x += gridSize) {
        ctx.moveTo(x, startY); ctx.lineTo(x, endY);
    }
    for (let y = startY; y < endY; y += gridSize) {
        ctx.moveTo(startX, y); ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Skid marks
    skidMarks.forEach(sm => {
        ctx.fillStyle = 'rgba(4, 4, 8, 0.6)';
        ctx.fillRect(sm.x - 3, sm.y - 3, 6, 6);
        sm.life--;
    });
    skidMarks = skidMarks.filter(sm => sm.life > 0);

    if (gameState === "PLAYING") {
        oilSlicks.forEach(o => {
            ctx.fillStyle = 'rgba(8, 8, 14, 0.9)';
            ctx.beginPath();
            ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        powerups.forEach(p => {
            ctx.fillStyle = p.type === 'wrench' ? '#00ff66' : '#ffaa00';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 12;
            ctx.fillRect(p.x - 14, p.y - 14, 28, 28);
            ctx.shadowBlur = 0;
        });

        roadblocks.forEach(rb => {
            ctx.save();
            ctx.translate(rb.x, rb.y);
            ctx.rotate(rb.angle);
            ctx.fillStyle = '#ff2200';
            ctx.fillRect(-rb.width / 2, -rb.height / 2, rb.width, rb.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-rb.width / 2, -rb.height / 2 + 5, rb.width, 5);
            ctx.restore();
        });

        // Flying Debris (Broken car parts)
        debris.forEach(d => {
            ctx.fillStyle = '#ff4500';
            ctx.fillRect(d.x, d.y, d.size, d.size);
        });

        // Police Cars
        cops.forEach(cop => {
            ctx.save();
            ctx.translate(cop.x, cop.y);
            ctx.rotate(cop.angle);

            ctx.fillStyle = cop.type === 'heavy' ? '#1c1c28' : '#111118';
            ctx.fillRect(-cop.width / 2, -cop.height / 2, cop.width, cop.height);

            ctx.fillStyle = '#223344';
            ctx.fillRect(-cop.width / 2 + 4, -cop.height / 2 + 14, cop.width - 8, 18);

            let siren = Math.floor(Date.now() / 120) % 2 === 0 ? '#ff0000' : '#0066ff';
            ctx.fillStyle = siren;
            ctx.shadowColor = siren;
            ctx.shadowBlur = 14;
            ctx.fillRect(-5, -5, 10, 10);

            ctx.restore();
        });

        // Player Car
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);

        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 8;
        ctx.fillRect(-player.width / 2 + 5, player.height / 2 - 5, 6, 5);
        ctx.fillRect(player.width / 2 - 11, player.height / 2 - 5, 6, 5);

        ctx.fillStyle = player.hp < 40 ? '#aa0022' : '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 16;
        ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

        ctx.fillStyle = '#00f3ff';
        ctx.fillRect(-player.width / 2 + 6, -player.height / 2 + 16, player.width - 12, 22);

        ctx.restore();
    }

    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
