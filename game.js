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
let cash = 0;
let score = 0;
let driftCombo = 0;
let shakeTimer = 0;
let gameInterval;

// Player Car Configuration
const player = {
    x: 0,
    y: 0,
    width: 40,
    height: 80,
    angle: 0,
    velocity: { x: 0, y: 0 },
    maxSpeed: 14,
    acceleration: 0.16,
    braking: 0.32,
    friction: 0.975,
    grip: 0.22,
    hp: 100,
    maxHp: 100,
    armorLevel: 0,
    speedLevel: 0
};

let cops = [];
let helicopters = [];
let debris = [];
let skidMarks = [];
let roadblocks = [];
let oilSlicks = [];
let powerups = [];
let floatingTexts = [];

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
    
    cops.push(createCop(player.x + 400, player.y + 400, 'cruiser'));

    gameInterval = setInterval(() => {
        if (gameState === "PLAYING") {
            survivalTime++;
            cash += 10;
            score += 50 * Math.max(1, Math.floor(driftCombo / 5));
            
            document.getElementById('time-display').innerText = survivalTime + "s";
            document.getElementById('hp-display').innerText = player.hp + "%";

            // Spawn elements infinitely around player
            if (survivalTime % 4 === 0) {
                let angle = Math.random() * Math.PI * 2;
                let dist = 900 + Math.random() * 400;
                let typeRand = Math.random();
                let type = typeRand < 0.3 ? 'heavy' : (typeRand < 0.6 ? 'fast' : 'cruiser');
                cops.push(createCop(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, type));
            }
            if (survivalTime % 12 === 0 && survivalTime > 15) {
                let angle = Math.random() * Math.PI * 2;
                helicopters.push({
                    x: player.x + Math.cos(angle) * 1000,
                    y: player.y + Math.sin(angle) * 1000,
                    vx: 0, vy: 0,
                    attackTimer: 0
                });
            }
            if (survivalTime % 7 === 0) spawnRoadblock();
            if (survivalTime % 10 === 0) spawnPowerup();
        }
    }, 1000);
});

function createCop(x, y, type) {
    let isHeavy = type === 'heavy';
    return {
        x: x, y: y,
        width: isHeavy ? 56 : 40,
        height: isHeavy ? 100 : 80,
        angle: 0,
        velocity: { x: 0, y: 0 },
        type: type,
        maxSpeed: type === 'fast' ? 11 : (isHeavy ? 7 : 9),
        acceleration: isHeavy ? 0.1 : 0.18,
        grip: isHeavy ? 0.26 : 0.18
    };
}

function spawnRoadblock() {
    let angle = Math.random() * Math.PI * 2;
    let dist = 600 + Math.random() * 300;
    roadblocks.push({
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        width: 170,
        height: 24,
        angle: Math.random() * Math.PI
    });
}

function spawnPowerup() {
    let angle = Math.random() * Math.PI * 2;
    let dist = 500 + Math.random() * 300;
    powerups.push({
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        type: Math.random() < 0.4 ? 'wrench' : (Math.random() < 0.7 ? 'nitro' : 'cash')
    });
}

function dropOilSlick() {
    oilSlicks.push({ x: player.x, y: player.y, radius: 40 });
    addFloatingText("- Oil Dropped -", player.x, player.y, "#00f3ff");
}

function spawnDebris(x, y, color = '#ff4500') {
    shakeTimer = 12; // Trigger screen shake
    for (let i = 0; i < 10; i++) {
        debris.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 18,
            vy: (Math.random() - 0.5) * 18,
            size: 5 + Math.random() * 9,
            color: color,
            life: 70
        });
    }
}

function addFloatingText(text, x, y, color) {
    floatingTexts.push({ text: text, x: x, y: y, life: 50, color: color });
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
        vehicle.angle -= 0.065 * (forwardSpeed / vehicle.maxSpeed);
    }
    if (input.turningRight && Math.abs(forwardSpeed) > 0.4) {
        vehicle.angle += 0.065 * (forwardSpeed / vehicle.maxSpeed);
    }

    let currentGrip = input.handbraking ? vehicle.grip * 0.25 : vehicle.grip;
    lateralSpeed *= (1 - currentGrip);

    vehicle.velocity.x = forwardX * forwardSpeed + rightX * lateralSpeed;
    vehicle.velocity.y = forwardY * forwardSpeed + rightY * lateralSpeed;

    vehicle.x += vehicle.velocity.x;
    vehicle.y += vehicle.velocity.y;

    // Drift Detection for Player
    if (vehicle === player) {
        if (Math.abs(lateralSpeed) > 3.2 && Math.abs(forwardSpeed) > 4) {
            driftCombo++;
            if (driftCombo % 30 === 0) {
                cash += 25;
                addFloatingText("DRIFT BONUS +$25", player.x, player.y - 30, "#00ff66");
            }
            skidMarks.push({ x: vehicle.x, y: vehicle.y, life: 50 });
            if (skidMarks.length > 350) skidMarks.shift();
        } else {
            if (driftCombo > 10) {
                score += driftCombo * 10;
            }
            driftCombo = 0;
        }
    }
}

function update() {
    if (gameState !== "PLAYING") return;

    if (shakeTimer > 0) shakeTimer--;

    let pInput = {
        accelerating: keys['KeyW'] || keys['ArrowUp'],
        braking: keys['KeyS'] || keys['ArrowDown'],
        turningLeft: keys['KeyA'] || keys['ArrowLeft'],
        turningRight: keys['KeyD'] || keys['ArrowRight'],
        handbraking: keys['Space']
    };

    updateVehiclePhysics(player, pInput);

    // Powerups Collection
    powerups.forEach((p, index) => {
        if (Math.hypot(player.x - p.x, player.y - p.y) < 45) {
            if (p.type === 'wrench') {
                player.hp = Math.min(player.maxHp, player.hp + 30);
                addFloatingText("+30 HP REPAIR", p.x, p.y, "#00ff66");
            } else if (p.type === 'nitro') {
                player.velocity.x *= 1.6;
                player.velocity.y *= 1.6;
                addFloatingText("NITRO BOOST!", p.x, p.y, "#ffaa00");
            } else {
                cash += 100;
                addFloatingText("+$100 CASH", p.x, p.y, "#ffff00");
            }
            powerups.splice(index, 1);
            document.getElementById('hp-display').innerText = player.hp + "%";
        }
    });

    // Roadblock collision
    roadblocks.forEach((rb, index) => {
        if (Math.hypot(player.x - rb.x, player.y - rb.y) < 65) {
            let dmg = 20 - (player.armorLevel * 3);
            player.hp -= Math.max(8, dmg);
            spawnDebris(player.x, player.y, '#ff2200');
            addFloatingText("-" + Math.max(8, dmg) + " HP", player.x, player.y, "#ff0000");
            player.velocity.x *= -0.3;
            player.velocity.y *= -0.3;
            roadblocks.splice(index, 1);
            document.getElementById('hp-display').innerText = Math.max(0, player.hp) + "%";
            if (player.hp <= 0) triggerGameOver();
        }
    });

    // Cops AI & Collision
    cops.forEach(cop => {
        let hitOil = oilSlicks.findIndex(o => Math.hypot(cop.x - o.x, cop.y - o.y) < o.radius + 15);
        if (hitOil !== -1) {
            cop.angle += Math.PI * 1.2;
            oilSlicks.splice(hitOil, 1);
            addFloatingText("COP SPIN OUT!", cop.x, cop.y, "#00f3ff");
        }

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

        if (Math.hypot(player.x - cop.x, player.y - cop.y) < 60) {
            let damage = (cop.type === 'heavy' ? 35 : 15) - (player.armorLevel * 4);
            let finalDmg = Math.max(6, damage);
            player.hp -= finalDmg;
            spawnDebris(player.x, player.y, '#ff0055');
            addFloatingText("-" + finalDmg + " HP", player.x, player.y, "#ff0000");

            let tempVx = player.velocity.x;
            let tempVy = player.velocity.y;
            player.velocity.x = cop.velocity.x * 0.6;
            player.velocity.y = cop.velocity.y * 0.6;
            cop.velocity.x = tempVx * 0.4;
            cop.velocity.y = tempVy * 0.4;

            document.getElementById('hp-display').innerText = Math.max(0, player.hp) + "%";
            if (player.hp <= 0) triggerGameOver();
        }
    });

    // Helicopter Pursuit AI
    helicopters.forEach(heli => {
        let hdx = player.x - heli.x;
        let hdy = player.y - heli.y;
        heli.x += hdx * 0.015;
        heli.y += hdy * 0.015;

        heli.attackTimer++;
        if (heli.attackTimer > 180) {
            heli.attackTimer = 0;
            roadblocks.push({ x: heli.x, y: heli.y, width: 140, height: 20, angle: Math.random() * Math.PI });
            addFloatingText("HELI DROPPED SPIKES!", heli.x, heli.y, "#ff4500");
        }
    });

    debris.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        d.life--;
    });
    debris = debris.filter(d => d.life > 0);

    floatingTexts.forEach(ft => {
        ft.y -= 0.8;
        ft.life--;
    });
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);

    let speedMph = Math.round(Math.hypot(player.velocity.x, player.velocity.y) * 12);
    document.getElementById('speed-display').innerText = speedMph + " MPH | Score: " + score;
}

function triggerGameOver() {
    gameState = "OVER";
    document.getElementById('game-over-screen').style.display = 'flex';
}

function draw() {
    ctx.save();
    
    // Screen Shake effect calculation
    if (shakeTimer > 0) {
        let shakeX = (Math.random() - 0.5) * 12;
        let shakeY = (Math.random() - 0.5) * 12;
        ctx.translate(shakeX, shakeY);
    }

    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // CAMERA LOCK ON PLAYER
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Infinite Scrolling Asphalt Grid
    ctx.strokeStyle = '#131322';
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
        ctx.fillStyle = 'rgba(3, 3, 6, 0.65)';
        ctx.fillRect(sm.x - 3, sm.y - 3, 6, 6);
        sm.life--;
    });
    skidMarks = skidMarks.filter(sm => sm.life > 0);

    if (gameState === "PLAYING") {
        oilSlicks.forEach(o => {
            ctx.fillStyle = 'rgba(6, 6, 12, 0.95)';
            ctx.beginPath();
            ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        powerups.forEach(p => {
            ctx.fillStyle = p.type === 'wrench' ? '#00ff66' : (p.type === 'nitro' ? '#ffaa00' : '#ffff00');
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 14;
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

        debris.forEach(d => {
            ctx.fillStyle = d.color;
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

        // Police Helicopters
        helicopters.forEach(heli => {
            ctx.save();
            ctx.translate(heli.x, heli.y);
            ctx.fillStyle = '#222233';
            ctx.beginPath();
            ctx.arc(0, 0, 32, 0, Math.PI * 2);
            ctx.fill();
            // Rotor blades animation
            ctx.fillStyle = '#ffffff';
            let rotLen = Math.floor(Date.now() / 40) % 2 === 0 ? 50 : 10;
            ctx.fillRect(-rotLen/2, -4, rotLen, 8);
            ctx.fillRect(-4, -rotLen/2, 8, rotLen);
            ctx.restore();
        });

        // Player Car
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);

        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.fillRect(-player.width / 2 + 5, player.height / 2 - 5, 6, 5);
        ctx.fillRect(player.width / 2 - 11, player.height / 2 - 5, 6, 5);

        ctx.fillStyle = player.hp < 40 ? '#aa0022' : '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 18;
        ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

        ctx.fillStyle = '#00f3ff';
        ctx.fillRect(-player.width / 2 + 6, -player.height / 2 + 16, player.width - 12, 22);

        ctx.restore();

        // Floating Damage & Score Popups
        floatingTexts.forEach(ft => {
            ctx.fillStyle = ft.color;
            ctx.font = "bold 16px monospace";
            ctx.fillText(ft.text, ft.x, ft.y);
        });
    }

    ctx.restore();
    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
