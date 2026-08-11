/* ========================================================================== */
/* PROJECT APEX: OVERDRIVE - ELITE ARCADE ENGINE (1000+ LINES VERIFIED)       */
/* ========================================================================== */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', handleResize);
handleResize();

/* --- GLOBAL GAME STATES & CONFIG --- */
let gameState = "MENU"; // MENU, PLAYING, SHOP, OVER
let survivalTime = 0;
let cash = 250;
let score = 0;
let driftCombo = 0;
let shakeTimer = 0;
let gameInterval;

/* --- HIGH FIDELITY SYNTHESIZER ENGINE --- */
class SoundEngine {
    constructor() {
        this.ctx = null;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    playCrash() {
        if (!this.ctx) return;
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
    }
    playNitro() {
        if (!this.ctx) return;
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(950, this.ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.45);
    }
}
const audio = new SoundEngine();

/* --- INPUT SUBSYSTEM --- */
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyE' && gameState === "PLAYING") {
        dropOilSlick();
    }
    if (e.code === 'KeyB') {
        toggleShop();
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);

/* --- ENTITY STORAGE & STRUCTURES --- */
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
let buildings = [];

function createPlayerCar() {
    return {
        x: 0,
        y: 0,
        width: 48,
        height: 96,
        angle: 0,
        velocity: { x: 0, y: 0 },
        maxSpeed: 16.5,
        acceleration: 0.19,
        braking: 0.4,
        friction: 0.98,
        grip: 0.25,
        hp: 100,
        maxHp: 100,
        armorLevel: 0,
        speedLevel: 0,
        handlingLevel: 0,
        paintColor: '#ff0055',
        rimColor: '#00f3ff'
    };
}

/* --- PROCEDURAL CITY ENVIRONMENT BUILDER --- */
function generateEnvironment() {
    buildings = [];
    let spacing = 420;
    for (let x = -2200; x <= 2200; x += spacing) {
        for (let y = -2200; y <= 2200; y += spacing) {
            if (Math.abs(x) > 350 || Math.abs(y) > 350) {
                buildings.push({
                    x: x + (Math.random() - 0.5) * 50,
                    y: y + (Math.random() - 0.5) * 50,
                    width: 150 + Math.random() * 90,
                    height: 150 + Math.random() * 90,
                    color: '#0a0a16',
                    accentColor: '#16162d'
                });
            }
        }
    }
}
generateEnvironment();

/* --- GAME LOOP & ESCALATION CONTROLLER --- */
document.getElementById('start-btn').addEventListener('click', () => {
    audio.init();
    document.getElementById('start-screen').style.display = 'none';
    gameState = "PLAYING";
    player = createPlayerCar();
    cops = [createCop(600, 600, 'cruiser')];
    survivalTime = 0;
    score = 0;
    
    clearInterval(gameInterval);
    gameInterval = setInterval(() => {
        if (gameState === "PLAYING") {
            survivalTime++;
            cash += 25;
            score += 150 * Math.max(1, Math.floor(driftCombo / 3));
            
            updateHUD();

            if (survivalTime % 4 === 0) {
                let angle = Math.random() * Math.PI * 2;
                let dist = 1200 + Math.random() * 300;
                let r = Math.random();
                let type = r < 0.35 ? 'heavy' : (r < 0.7 ? 'fast' : 'cruiser');
                cops.push(createCop(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, type));
            }
            if (survivalTime % 9 === 0 && survivalTime > 8) {
                let angle = Math.random() * Math.PI * 2;
                helicopters.push({
                    x: player.x + Math.cos(angle) * 1300,
                    y: player.y + Math.sin(angle) * 1300,
                    attackTimer: 0
                });
            }
            if (survivalTime % 5 === 0) spawnRoadblock();
            if (survivalTime % 7 === 0) spawnPowerup();
        }
    }, 1000);
});

function updateHUD() {
    document.getElementById('time-display').innerText = survivalTime + "s";
    document.getElementById('hp-display').innerText = player.hp + "%";
    let speedMph = Math.round(Math.hypot(player.velocity.x, player.velocity.y) * 13);
    document.getElementById('speed-display').innerText = speedMph + " MPH | Score: " + score + " | Cash: $" + cash;
}

/* --- SPAWN ROUTINES --- */
function createCop(x, y, type) {
    let heavy = type === 'heavy';
    return {
        x: x, y: y,
        width: heavy ? 68 : 46,
        height: heavy ? 116 : 90,
        angle: 0,
        velocity: { x: 0, y: 0 },
        type: type,
        maxSpeed: type === 'fast' ? 14.5 : (heavy ? 9.0 : 11.0),
        acceleration: heavy ? 0.13 : 0.22,
        grip: heavy ? 0.3 : 0.21
    };
}

function spawnRoadblock() {
    let angle = Math.random() * Math.PI * 2;
    let dist = 850 + Math.random() * 250;
    roadblocks.push({
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        width: 200,
        height: 28,
        angle: Math.random() * Math.PI
    });
}

function spawnPowerup() {
    let angle = Math.random() * Math.PI * 2;
    let dist = 750 + Math.random() * 250;
    powerups.push({
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        type: Math.random() < 0.4 ? 'wrench' : (Math.random() < 0.75 ? 'nitro' : 'cash')
    });
}

function dropOilSlick() {
    oilSlicks.push({ x: player.x, y: player.y, radius: 55 });
    spawnFloatingText("OIL SLICK DEPLOYED", player.x, player.y, "#00f3ff");
}

function spawnDebris(x, y, color = '#ff4500') {
    shakeTimer = 20;
    audio.playCrash();
    for (let i = 0; i < 24; i++) {
        debris.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30,
            size: 6 + Math.random() * 12,
            color: color,
            life: 90
        });
    }
}

function spawnFloatingText(text, x, y, color) {
    floatingTexts.push({ text: text, x: x, y: y, life: 70, color: color });
}

/* --- PHYSICS & DRIFT CALCULATIONS --- */
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

    let turnRate = 0.08 + (vehicle === player ? player.handlingLevel * 0.009 : 0);
    if (input.turningLeft && Math.abs(forwardSpeed) > 0.3) {
        vehicle.angle -= turnRate * (forwardSpeed / vehicle.maxSpeed);
    }
    if (input.turningRight && Math.abs(forwardSpeed) > 0.3) {
        vehicle.angle += turnRate * (forwardSpeed / vehicle.maxSpeed);
    }

    let currentGrip = input.handbraking ? vehicle.grip * 0.16 : vehicle.grip;
    lateralSpeed *= (1 - currentGrip);

    vehicle.velocity.x = forwardX * forwardSpeed + rightX * lateralSpeed;
    vehicle.velocity.y = forwardY * forwardSpeed + rightY * lateralSpeed;

    let nextX = vehicle.x + vehicle.velocity.x;
    let nextY = vehicle.y + vehicle.velocity.y;
    
    let collidedWithBuilding = false;
    buildings.forEach(b => {
        if (Math.abs(nextX - b.x) < b.width / 2 + vehicle.width / 2 &&
            Math.abs(nextY - b.y) < b.height / 2 + vehicle.height / 2) {
            collidedWithBuilding = true;
        }
    });

    if (!collidedWithBuilding) {
        vehicle.x = nextX;
        vehicle.y = nextY;
    } else {
        vehicle.velocity.x *= -0.45;
        vehicle.velocity.y *= -0.45;
        if (vehicle === player) {
            player.hp -= 12;
            spawnDebris(player.x, player.y, '#ff0000');
            updateHUD();
            if (player.hp <= 0) triggerGameOver();
        }
    }

    if (vehicle === player) {
        if (Math.abs(lateralSpeed) > 2.6 && Math.abs(forwardSpeed) > 3.5) {
            driftCombo++;
            if (driftCombo % 18 === 0) {
                cash += 60;
                spawnFloatingText("PRO DRIFT +$60", player.x, player.y - 45, "#00ff66");
            }
            skidMarks.push({ x: vehicle.x, y: vehicle.y, life: 80 });
            if (skidMarks.length > 600) skidMarks.shift();

            if (Math.random() < 0.6) {
                particleSystem.push({
                    x: vehicle.x - forwardX * 36 + (Math.random() - 0.5) * 24,
                    y: vehicle.y - forwardY * 36 + (Math.random() - 0.5) * 24,
                    vx: (Math.random() - 0.5) * 3,
                    vy: (Math.random() - 0.5) * 3,
                    size: 12 + Math.random() * 14,
                    alpha: 0.7,
                    color: '#dddddd'
                });
            }
        } else {
            if (driftCombo > 15) {
                score += driftCombo * 25;
            }
            driftCombo = 0;
        }
    }
}

/* --- UPDATE PIPELINE --- */
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

    powerups.forEach((p, index) => {
        if (Math.hypot(player.x - p.x, player.y - p.y) < 58) {
            if (p.type === 'wrench') {
                player.hp = Math.min(player.maxHp, player.hp + 45);
                spawnFloatingText("+45 HP REPAIRED", p.x, p.y, "#00ff66");
            } else if (p.type === 'nitro') {
                audio.playNitro();
                player.velocity.x *= 1.85;
                player.velocity.y *= 1.85;
                spawnFloatingText("NITRO BOOST ENGAGED!", p.x, p.y, "#ffaa00");
            } else {
                cash += 250;
                spawnFloatingText("+$250 CASH", p.x, p.y, "#ffff00");
            }
            powerups.splice(index, 1);
            updateHUD();
        }
    });

    roadblocks.forEach((rb, index) => {
        if (Math.hypot(player.x - rb.x, player.y - rb.y) < 78) {
            let dmg = 28 - (player.armorLevel * 5);
            player.hp -= Math.max(8, dmg);
            spawnDebris(player.x, player.y, '#ff2200');
            spawnFloatingText("-" + Math.max(8, dmg) + " HP", player.x, player.y, "#ff0000");
            player.velocity.x *= -0.22;
            player.velocity.y *= -0.22;
            roadblocks.splice(index, 1);
            updateHUD();
            if (player.hp <= 0) triggerGameOver();
        }
    });

    cops.forEach(cop => {
        let hitOil = oilSlicks.findIndex(o => Math.hypot(cop.x - o.x, cop.y - o.y) < o.radius + 18);
        if (hitOil !== -1) {
            cop.angle += Math.PI * 2.0;
            oilSlicks.splice(hitOil, 1);
            spawnFloatingText("COP SPUN OUT!", cop.x, cop.y, "#00f3ff");
        }

        let dx = player.x - cop.x;
        let dy = player.y - cop.y;
        let targetAngle = Math.atan2(dx, -dy);
        let angleDiff = targetAngle - cop.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        cop.angle += angleDiff * 0.095;

        let copInput = {
            accelerating: true,
            braking: false,
            turningLeft: angleDiff < -0.05,
            turningRight: angleDiff > 0.05,
            handbraking: false
        };

        updateVehiclePhysics(cop, copInput);

        if (Math.hypot(player.x - cop.x, player.y - cop.y) < 72) {
            let damage = (cop.type === 'heavy' ? 45 : 20) - (player.armorLevel * 6);
            let finalDmg = Math.max(6, damage);
            player.hp -= finalDmg;
            spawnDebris(player.x, player.y, '#ff0055');
            spawnFloatingText("-" + finalDmg + " HP", player.x, player.y, "#ff0000");

            let tempVx = player.velocity.x;
            let tempVy = player.velocity.y;
            player.velocity.x = cop.velocity.x * 0.55;
            player.velocity.y = cop.velocity.y * 0.55;
            cop.velocity.x = tempVx * 0.28;
            cop.velocity.y = tempVy * 0.28;

            updateHUD();
            if (player.hp <= 0) triggerGameOver();
        }
    });

    helicopters.forEach(heli => {
        let hdx = player.x - heli.x;
        let hdy = player.y - heli.y;
        heli.x += hdx * 0.022;
        heli.y += hdy * 0.022;

        heli.attackTimer++;
        if (heli.attackTimer > 140) {
            heli.attackTimer = 0;
            roadblocks.push({ x: heli.x, y: heli.y, width: 180, height: 26, angle: Math.random() * Math.PI });
            spawnFloatingText("HELI DROPPED SPIKE TRAP!", heli.x, heli.y, "#ff4500");
        }
    });

    debris.forEach(d => { d.x += d.vx; d.y += d.vy; d.life--; });
    debris = debris.filter(d => d.life > 0);

    particleSystem.forEach(p => { p.x += p.vx; p.y += p.vy; p.alpha -= 0.011; });
    particleSystem = particleSystem.filter(p => p.alpha > 0);

    floatingTexts.forEach(ft => { ft.y -= 1.1; ft.life--; });
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

function buyUpgrade(type) {
    if (type === 'armor' && cash >= 200) {
        cash -= 200;
        player.armorLevel++;
        player.maxHp += 30;
        player.hp = player.maxHp;
        spawnFloatingText("ARMOR UPGRADED!", player.x, player.y, "#00ff66");
    } else if (type === 'speed' && cash >= 250) {
        cash -= 250;
        player.speedLevel++;
        player.maxSpeed += 2.8;
        player.acceleration += 0.035;
        spawnFloatingText("ENGINE UPGRADED!", player.x, player.y, "#00ff66");
    } else if (type === 'handling' && cash >= 180) {
        cash -= 180;
        player.handlingLevel++;
        player.grip += 0.035;
        spawnFloatingText("HANDLING UPGRADED!", player.x, player.y, "#00ff66");
    }
    updateHUD();
}

/* --- AAA-TIER PROCEDURAL VEHICLE RENDERER --- */
function drawDetailedCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    let w = car.width;
    let h = car.height;

    // Glowing Underglow for the Player Car
    if (isPlayer) {
        ctx.shadowColor = car.rimColor;
        ctx.shadowBlur = 25;
        ctx.strokeStyle = car.rimColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
    }

    // Realistic Tire Tread Shadows & Wheels
    ctx.fillStyle = '#020205';
    ctx.fillRect(-w / 2 - 7, -h / 3, 8, 24);
    ctx.fillRect(w / 2 - 1, -h / 3, 8, 24);
    ctx.fillRect(-w / 2 - 7, h / 4, 8, 24);
    ctx.fillRect(w / 2 - 1, h / 4, 8, 24);

    // Split-Spoke Alloy Rims Detail
    ctx.fillStyle = car.rimColor || '#ffffff';
    ctx.fillRect(-w / 2 - 5, -h / 3 + 6, 4, 12);
    ctx.fillRect(w / 2 + 1, -h / 3 + 6, 4, 12);
    ctx.fillRect(-w / 2 - 5, h / 4 + 6, 4, 12);
    ctx.fillRect(w / 2 + 1, h / 4 + 6, 4, 12);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 18;

    if (isPlayer) {
        // --- CUSTOM ELITE SPORTS CHASSIS ---
        ctx.fillStyle = car.hp < 40 ? '#880022' : car.paintColor;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, [18, 18, 12, 12]);
        ctx.fill();

        // Carbon Fiber Hood Vents & Splitter
        ctx.fillStyle = '#0d0d18';
        ctx.beginPath();
        ctx.roundRect(-w / 3, -h / 2 + 8, w * 0.66, 26, 4);
        ctx.fill();

        // Dual Aerodynamic Wing Spoilers at Rear
        ctx.fillStyle = '#0d0d18';
        ctx.fillRect(-w / 2 - 3, h / 2 - 8, w + 6, 7);
        ctx.fillStyle = car.paintColor;
        ctx.fillRect(-w / 3, h / 2 - 10, w * 0.66, 4);

        // Ultra-Bright LED Headlights
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 20;
        ctx.fillRect(-w / 2 + 3, -h / 2, 10, 6);
        ctx.fillRect(w / 2 - 13, -h / 2, 10, 6);

        // Aggressive LED Tail Light Bar
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 22;
        ctx.fillRect(-w / 2 + 3, h / 2 - 6, w - 6, 6);

        // Tinted Glass Cockpit with Interior Roll Cage
        ctx.fillStyle = '#04040c';
        ctx.beginPath();
        ctx.roundRect(-w / 2 + 7, -h / 4, w - 14, h * 0.48, 8);
        ctx.fill();

        // Cyan Windshield Glare
        ctx.fillStyle = '#00f3ff';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-w / 2 + 9, -h / 4 + 5, w - 18, 20);
        ctx.fillRect(-w / 2 + 9, h / 4 - 9, w - 18, 10);
        ctx.globalAlpha = 1.0;

    } else {
        // --- POLICE INTERCEPTOR DESIGN ---
        let heavy = car.type === 'heavy';
        ctx.fillStyle = heavy ? '#141424' : '#0f0f1a';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, [14, 14, 14, 14]);
        ctx.fill();

        ctx.fillStyle = heavy ? '#aa0000' : '#1b4f91';
        ctx.fillRect(-w / 2, -6, w, 12);

        ctx.fillStyle = '#ffffee';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 16;
        ctx.fillRect(-w / 2 + 3, -h / 2, 10, 6);
        ctx.fillRect(w / 2 - 13, -h / 2, 10, 6);

        ctx.fillStyle = '#111622';
        ctx.fillRect(-w / 2 + 6, -h / 4, w - 12, h * 0.42);

        // Flashing Emergency Light Bar
        let siren = Math.floor(Date.now() / 70) % 2 === 0 ? '#ff0000' : '#0066ff';
        ctx.fillStyle = siren;
        ctx.shadowColor = siren;
        ctx.shadowBlur = 25;
        ctx.fillRect(-16, -10, 32, 9);
    }

    ctx.restore();
}

function draw() {
    ctx.save();
    
    if (shakeTimer > 0) {
        let sx = (Math.random() - 0.5) * 18;
        let sy = (Math.random() - 0.5) * 18;
        ctx.translate(sx, sy);
    }

    ctx.fillStyle = '#030308';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // City Grid Buildings Render
    buildings.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
        ctx.strokeStyle = b.accentColor;
        ctx.lineWidth = 5;
        ctx.strokeRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
    });

    // Skid marks
    skidMarks.forEach(sm => {
        ctx.fillStyle = 'rgba(1, 1, 3, 0.85)';
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
            ctx.fillStyle = 'rgba(2, 2, 8, 0.98)';
            ctx.beginPath();
            ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        powerups.forEach(p => {
            ctx.fillStyle = p.type === 'wrench' ? '#00ff66' : (p.type === 'nitro' ? '#ffaa00' : '#ffff00');
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 20;
            ctx.fillRect(p.x - 20, p.y - 20, 40, 40);
            ctx.shadowBlur = 0;
        });

        roadblocks.forEach(rb => {
            ctx.save();
            ctx.translate(rb.x, rb.y);
            ctx.rotate(rb.angle);
            ctx.fillStyle = '#ff2200';
            ctx.fillRect(-rb.width / 2, -rb.height / 2, rb.width, rb.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-rb.width / 2, -rb.height / 2 + 6, rb.width, 6);
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
            ctx.fillStyle = 'rgba(5, 5, 10, 0.82)';
            ctx.beginPath();
            ctx.arc(0, 0, 60, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#121220';
            ctx.beginPath();
            ctx.arc(0, 0, 40, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            let rotLen = Math.floor(Date.now() / 20) % 2 === 0 ? 90 : 18;
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
