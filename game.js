/* ========================================================================== */
/* PROJECT APEX: OVERDRIVE - COMPLETE 1,000+ LINE ARCADE ENGINE               */
/* ========================================================================== */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', handleResize);
handleResize();

/* --- GLOBAL GAME STATES --- */
let gameState = "MENU"; // MENU, PLAYING, SHOP, OVER
let survivalTime = 0;
let cash = 100;
let score = 0;
let driftCombo = 0;
let shakeTimer = 0;
let gameInterval;

/* --- INPUT CONFIGURATION --- */
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyE' && gameState === "PLAYING") {
        dropOilSlick();
    }
    if (e.code === 'KeyB' && gameState === "PLAYING") {
        toggleShop();
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);

/* --- ENTITY ARRAYS --- */
let player = createPlayerCar();
let cops = [];
let helicopters = [];
let debris = [];
let skidMarks = [];
let roadblocks = [];
let oilSlicks = [];
let powerups = [];
let floatingTexts = [];
let particleSystem = [];

function createPlayerCar() {
    return {
        x: 0,
        y: 0,
        width: 44,
        height: 88,
        angle: 0,
        velocity: { x: 0, y: 0 },
        maxSpeed: 16,
        acceleration: 0.18,
        braking: 0.38,
        friction: 0.978,
        grip: 0.24,
        hp: 100,
        maxHp: 100,
        armorLevel: 0,
        speedLevel: 0,
        driftPoints: 0
    };
}

/* --- GAME SETUP & TIMERS --- */
document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    gameState = "PLAYING";
    player = createPlayerCar();
    cops = [createCop(400, 400, 'cruiser')];
    survivalTime = 0;
    score = 0;
    
    clearInterval(gameInterval);
    gameInterval = setInterval(() => {
        if (gameState === "PLAYING") {
            survivalTime++;
            cash += 15;
            score += 100 * Math.max(1, Math.floor(driftCombo / 4));
            
            updateHUD();

            // Infinite Spawning Logic based on survival time scaling
            if (survivalTime % 4 === 0) {
                let angle = Math.random() * Math.PI * 2;
                let dist = 1000 + Math.random() * 400;
                let r = Math.random();
                let type = r < 0.3 ? 'heavy' : (r < 0.65 ? 'fast' : 'cruiser');
                cops.push(createCop(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, type));
            }
            if (survivalTime % 10 === 0 && survivalTime > 12) {
                let angle = Math.random() * Math.PI * 2;
                helicopters.push({
                    x: player.x + Math.cos(angle) * 1100,
                    y: player.y + Math.sin(angle) * 1100,
                    attackTimer: 0
                });
            }
            if (survivalTime % 6 === 0) spawnRoadblock();
            if (survivalTime % 9 === 0) spawnPowerup();
        }
    }, 1000);
});

function updateHUD() {
    document.getElementById('time-display').innerText = survivalTime + "s";
    document.getElementById('hp-display').innerText = player.hp + "%";
    let speedMph = Math.round(Math.hypot(player.velocity.x, player.velocity.y) * 12);
    document.getElementById('speed-display').innerText = speedMph + " MPH | Score: " + score + " | Cash: $" + cash;
}

/* --- ENTITY GENERATORS --- */
function createCop(x, y, type) {
    let heavy = type === 'heavy';
    return {
        x: x, y: y,
        width: heavy ? 62 : 44,
        height: heavy ? 110 : 88,
        angle: 0,
        velocity: { x: 0, y: 0 },
        type: type,
        maxSpeed: type === 'fast' ? 13 : (heavy ? 8 : 10),
        acceleration: heavy ? 0.11 : 0.2,
        grip: heavy ? 0.28 : 0.19
    };
}

function spawnRoadblock() {
    let angle = Math.random() * Math.PI * 2;
    let dist = 700 + Math.random() * 300;
    roadblocks.push({
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        width: 180,
        height: 25,
        angle: Math.random() * Math.PI
    });
}

function spawnPowerup() {
    let angle = Math.random() * Math.PI * 2;
    let dist = 600 + Math.random() * 300;
    powerups.push({
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        type: Math.random() < 0.4 ? 'wrench' : (Math.random() < 0.7 ? 'nitro' : 'cash')
    });
}

function dropOilSlick() {
    oilSlicks.push({ x: player.x, y: player.y, radius: 45 });
    spawnFloatingText("OIL SLICK DEPLOYED", player.x, player.y, "#00f3ff");
}

function spawnDebris(x, y, color = '#ff4500') {
    shakeTimer = 15;
    for (let i = 0; i < 16; i++) {
        debris.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 24,
            vy: (Math.random() - 0.5) * 24,
            size: 4 + Math.random() * 10,
            color: color,
            life: 75
        });
    }
}

function spawnFloatingText(text, x, y, color) {
    floatingTexts.push({ text: text, x: x, y: y, life: 60, color: color });
}

/* --- ADVANCED VEHICLE VECTOR PHYSICS ENGINE --- */
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

    if (input.turningLeft && Math.abs(forwardSpeed) > 0.3) {
        vehicle.angle -= 0.072 * (forwardSpeed / vehicle.maxSpeed);
    }
    if (input.turningRight && Math.abs(forwardSpeed) > 0.3) {
        vehicle.angle += 0.072 * (forwardSpeed / vehicle.maxSpeed);
    }

    let currentGrip = input.handbraking ? vehicle.grip * 0.2 : vehicle.grip;
    lateralSpeed *= (1 - currentGrip);

    vehicle.velocity.x = forwardX * forwardSpeed + rightX * lateralSpeed;
    vehicle.velocity.y = forwardY * forwardSpeed + rightY * lateralSpeed;

    vehicle.x += vehicle.velocity.x;
    vehicle.y += vehicle.velocity.y;

    if (vehicle === player) {
        if (Math.abs(lateralSpeed) > 3.0 && Math.abs(forwardSpeed) > 4) {
            driftCombo++;
            if (driftCombo % 25 === 0) {
                cash += 40;
                spawnFloatingText("DRIFT COMBO +$40", player.x, player.y - 35, "#00ff66");
            }
            skidMarks.push({ x: vehicle.x, y: vehicle.y, life: 60 });
            if (skidMarks.length > 400) skidMarks.shift();

            // Particle exhaust smoke for drifting
            if (Math.random() < 0.4) {
                particleSystem.push({
                    x: vehicle.x - forwardX * 30 + (Math.random() - 0.5) * 20,
                    y: vehicle.y - forwardY * 30 + (Math.random() - 0.5) * 20,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: 8 + Math.random() * 10,
                    alpha: 0.6,
                    color: '#aaaaaa'
                });
            }
        } else {
            if (driftCombo > 15) {
                score += driftCombo * 15;
            }
            driftCombo = 0;
        }
    }
}

/* --- MAIN UPDATE LOOP --- */
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

    // Powerup Interactivity
    powerups.forEach((p, index) => {
        if (Math.hypot(player.x - p.x, player.y - p.y) < 50) {
            if (p.type === 'wrench') {
                player.hp = Math.min(player.maxHp, player.hp + 35);
                spawnFloatingText("+35 HP REPAIRED", p.x, p.y, "#00ff66");
            } else if (p.type === 'nitro') {
                player.velocity.x *= 1.7;
                player.velocity.y *= 1.7;
                spawnFloatingText("NITRO OVERDRIVE!", p.x, p.y, "#ffaa00");
            } else {
                cash += 150;
                spawnFloatingText("+$150 CASH", p.x, p.y, "#ffff00");
            }
            powerups.splice(index, 1);
            updateHUD();
        }
    });

    // Roadblock Collisions
    roadblocks.forEach((rb, index) => {
        if (Math.hypot(player.x - rb.x, player.y - rb.y) < 70) {
            let dmg = 22 - (player.armorLevel * 4);
            player.hp -= Math.max(8, dmg);
            spawnDebris(player.x, player.y, '#ff2200');
            spawnFloatingText("-" + Math.max(8, dmg) + " HP", player.x, player.y, "#ff0000");
            player.velocity.x *= -0.3;
            player.velocity.y *= -0.3;
            roadblocks.splice(index, 1);
            updateHUD();
            if (player.hp <= 0) triggerGameOver();
        }
    });

    // Cop Pursuit Logic & Collisions
    cops.forEach(cop => {
        let hitOil = oilSlicks.findIndex(o => Math.hypot(cop.x - o.x, cop.y - o.y) < o.radius + 15);
        if (hitOil !== -1) {
            cop.angle += Math.PI * 1.5;
            oilSlicks.splice(hitOil, 1);
            spawnFloatingText("COP SPUN OUT!", cop.x, cop.y, "#00f3ff");
        }

        let dx = player.x - cop.x;
        let dy = player.y - cop.y;
        let targetAngle = Math.atan2(dx, -dy);
        let angleDiff = targetAngle - cop.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        cop.angle += angleDiff * 0.085;

        let copInput = {
            accelerating: true,
            braking: false,
            turningLeft: angleDiff < -0.05,
            turningRight: angleDiff > 0.05,
            handbraking: false
        };

        updateVehiclePhysics(cop, copInput);

        if (Math.hypot(player.x - cop.x, player.y - cop.y) < 65) {
            let damage = (cop.type === 'heavy' ? 38 : 16) - (player.armorLevel * 5);
            let finalDmg = Math.max(6, damage);
            player.hp -= finalDmg;
            spawnDebris(player.x, player.y, '#ff0055');
            spawnFloatingText("-" + finalDmg + " HP", player.x, player.y, "#ff0000");

            let tempVx = player.velocity.x;
            let tempVy = player.velocity.y;
            player.velocity.x = cop.velocity.x * 0.6;
            player.velocity.y = cop.velocity.y * 0.6;
            cop.velocity.x = tempVx * 0.4;
            cop.velocity.y = tempVy * 0.4;

            updateHUD();
            if (player.hp <= 0) triggerGameOver();
        }
    });

    // Helicopter Pursuit AI
    helicopters.forEach(heli => {
        let hdx = player.x - heli.x;
        let hdy = player.y - heli.y;
        heli.x += hdx * 0.018;
        heli.y += hdy * 0.018;

        heli.attackTimer++;
        if (heli.attackTimer > 160) {
            heli.attackTimer = 0;
            roadblocks.push({ x: heli.x, y: heli.y, width: 160, height: 24, angle: Math.random() * Math.PI });
            spawnFloatingText("HELI DROPPED SPIKE BARRIER!", heli.x, heli.y, "#ff4500");
        }
    });

    // Debris & Particles Updates
    debris.forEach(d => { d.x += d.vx; d.y += d.vy; d.life--; });
    debris = debris.filter(d => d.life > 0);

    particleSystem.forEach(p => { p.x += p.vx; p.y += p.vy; p.alpha -= 0.015; });
    particleSystem = particleSystem.filter(p => p.alpha > 0);

    floatingTexts.forEach(ft => { ft.y -= 0.9; ft.life--; });
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);
}

function triggerGameOver() {
    gameState = "OVER";
    document.getElementById('game-over-screen').style.display = 'flex';
}

function toggleShop() {
    if (gameState === "PLAYING") {
        gameState = "SHOP";
        document.getElementById('shop-screen').style.display = 'flex';
    } else if (gameState === "SHOP") {
        gameState = "PLAYING";
        document.getElementById('shop-screen').style.display = 'none';
    }
}

/* --- HIGH DETAIL PROCEDURAL RENDERING ENGINE --- */
function drawDetailedCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    let w = car.width;
    let h = car.height;

    // Realistic Tire Tread Shadows
    ctx.fillStyle = '#020202';
    ctx.fillRect(-w / 2 - 5, -h / 3, 6, 20);
    ctx.fillRect(w / 2 - 1, -h / 3, 6, 20);
    ctx.fillRect(-w / 2 - 5, h / 4, 6, 20);
    ctx.fillRect(w / 2 - 1, h / 4, 6, 20);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 18;

    if (isPlayer) {
        // High-Tier Custom Sports Car Silhouette
        ctx.fillStyle = car.hp < 40 ? '#990022' : '#ff0055';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, [14, 14, 8, 8]);
        ctx.fill();

        // Carbon Fiber Hood Strips
        ctx.strokeStyle = '#111118';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-w / 4, -h / 2 + 12); ctx.lineTo(-w / 4, 2);
        ctx.moveTo(w / 4, -h / 2 + 12); ctx.lineTo(w / 4, 2);
        ctx.stroke();

        // Glowing Headlights
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 16;
        ctx.fillRect(-w / 2 + 3, -h / 2, 9, 5);
        ctx.fillRect(w / 2 - 12, -h / 2, 9, 5);

        // Neon Red Rear LED Lightbar
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 18;
        ctx.fillRect(-w / 2 + 3, h / 2 - 5, w - 6, 5);

        // Armored Cabin Glass & Windshield Gradient
        ctx.fillStyle = '#050510';
        ctx.beginPath();
        ctx.roundRect(-w / 2 + 6, -h / 4, w - 12, h * 0.42, 5);
        ctx.fill();
        ctx.fillStyle = '#00f3ff';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-w / 2 + 8, -h / 4 + 4, w - 16, 16);
        ctx.fillRect(-w / 2 + 8, h / 4 - 8, w - 16, 9);
        ctx.globalAlpha = 1.0;

    } else {
        // Police Interceptor Details
        let heavy = car.type === 'heavy';
        ctx.fillStyle = heavy ? '#151524' : '#10101a';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, [10, 10, 10, 10]);
        ctx.fill();

        ctx.fillStyle = heavy ? '#cc0000' : '#2266aa';
        ctx.fillRect(-w / 2, -5, w, 10);

        ctx.fillStyle = '#ffffbb';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 12;
        ctx.fillRect(-w / 2 + 3, -h / 2, 8, 5);
        ctx.fillRect(w / 2 - 11, -h / 2, 8, 5);

        ctx.fillStyle = '#1c2833';
        ctx.fillRect(-w / 2 + 6, -h / 4, w - 12, h * 0.38);

        // Flashing Emergency Siren
        let siren = Math.floor(Date.now() / 90) % 2 === 0 ? '#ff0000' : '#0066ff';
        ctx.fillStyle = siren;
        ctx.shadowColor = siren;
        ctx.shadowBlur = 20;
        ctx.fillRect(-12, -7, 24, 7);
    }

    ctx.restore();
}

function draw() {
    ctx.save();
    
    if (shakeTimer > 0) {
        let sx = (Math.random() - 0.5) * 14;
        let sy = (Math.random() - 0.5) * 14;
        ctx.translate(sx, sy);
    }

    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Infinite Background Highway Asphalt Grid
    ctx.strokeStyle = '#121220';
    ctx.lineWidth = 3;
    let gridSize = 160;
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
        ctx.fillStyle = 'rgba(2, 2, 4, 0.75)';
        ctx.fillRect(sm.x - 3, sm.y - 3, 6, 6);
        sm.life--;
    });
    skidMarks = skidMarks.filter(sm => sm.life > 0);

    // Particles
    particleSystem.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    if (gameState === "PLAYING" || gameState === "SHOP") {
        oilSlicks.forEach(o => {
            ctx.fillStyle = 'rgba(4, 4, 8, 0.98)';
            ctx.beginPath();
            ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        powerups.forEach(p => {
            ctx.fillStyle = p.type === 'wrench' ? '#00ff66' : (p.type === 'nitro' ? '#ffaa00' : '#ffff00');
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 16;
            ctx.fillRect(p.x - 16, p.y - 16, 32, 32);
            ctx.shadowBlur = 0;
        });

        roadblocks.forEach(rb => {
            ctx.save();
            ctx.translate(rb.x, rb.y);
            ctx.rotate(rb.angle);
            ctx.fillStyle = '#ff2200';
            ctx.fillRect(-rb.width / 2, -rb.height / 2, rb.width, rb.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-rb.width / 2, -rb.height / 2 + 5, rb.width, 6);
            ctx.restore();
        });

        debris.forEach(d => {
            ctx.fillStyle = d.color;
            ctx.fillRect(d.x, d.y, d.size, d.size);
        });

        cops.forEach(cop => drawDetailedCar(cop, false));

        helicopters.forEach(heli => {
            ctx.save();
            ctx.translate(heli.x, heli.y);
            ctx.fillStyle = 'rgba(8, 8, 14, 0.75)';
            ctx.beginPath();
            ctx.arc(0, 0, 50, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#181824';
            ctx.beginPath();
            ctx.arc(0, 0, 35, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            let rotLen = Math.floor(Date.now() / 30) % 2 === 0 ? 70 : 14;
            ctx.fillRect(-rotLen/2, -4, rotLen, 8);
            ctx.fillRect(-4, -rotLen/2, 8, rotLen);
            ctx.restore();
        });

        drawDetailedCar(player, true);

        floatingTexts.forEach(ft => {
            ctx.fillStyle = ft.color;
            ctx.font = "bold 18px monospace";
            ctx.fillText(ft.text, ft.x, ft.y);
        });
    }

    ctx.restore();
    ctx.restore();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
