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
let driftMultiplier = 1;
let gameInterval;

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 48,
    height: 90, // Substantially bigger car size
    angle: 0,
    speed: 0,
    maxSpeed: 14,
    acceleration: 0.2,
    friction: 0.97,
    turnSpeed: 0.08, // Snappy, lightning-fast turning
    driftFactor: 0.88,
    hp: 100
};

let cops = [];
let debris = [];
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
    
    cops.push(createCop('cruiser'), createCop('fast'));

    gameInterval = setInterval(() => {
        if (gameState === "PLAYING") {
            survivalTime++;
            document.getElementById('time-display').innerText = survivalTime + "s";
            document.getElementById('hp-display').innerText = player.hp + "%";

            if (survivalTime % 7 === 0) {
                let type = Math.random() < 0.4 ? 'heavy' : (Math.random() < 0.6 ? 'fast' : 'cruiser');
                cops.push(createCop(type));
            }
            if (survivalTime % 10 === 0) spawnRoadblock();
            if (survivalTime % 12 === 0) spawnPowerup();
        }
    }, 1000);
});

function createCop(type) {
    let isHeavy = type === 'heavy';
    return {
        x: Math.random() * canvas.width,
        y: Math.random() < 0.5 ? -100 : canvas.height + 100,
        width: isHeavy ? 64 : 48,
        height: isHeavy ? 110 : 90, // Massive police cars matching player scale
        angle: 0,
        type: type,
        speed: type === 'fast' ? 7.5 : (isHeavy ? 4 : 5.5),
        maxSpeed: type === 'fast' ? 11 : (isHeavy ? 7 : 9),
        turnSpeed: type === 'fast' ? 0.07 : (isHeavy ? 0.035 : 0.06)
    };
}

function spawnRoadblock() {
    roadblocks.push({
        x: Math.random() * (canvas.width - 200) + 100,
        y: Math.random() < 0.5 ? -100 : canvas.height + 100,
        width: 160,
        height: 24,
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
    oilSlicks.push({ x: player.x, y: player.y, radius: 35 });
}

function spawnDebris(x, y) {
    for (let i = 0; i < 5; i++) {
        debris.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12,
            size: 6 + Math.random() * 8,
            life: 60
        });
    }
}

function update() {
    if (gameState !== "PLAYING") return;

    if (keys['KeyW'] || keys['ArrowUp']) player.speed += player.acceleration;
    if (keys['KeyS'] || keys['ArrowDown']) player.speed -= player.acceleration * 1.5;

    player.speed *= player.friction;
    player.speed = Math.max(-player.maxSpeed / 3, Math.min(player.maxSpeed, player.speed));

    let currentTurn = player.turnSpeed * (player.speed / player.maxSpeed);
    if (keys['KeyA'] || keys['ArrowLeft']) player.angle -= currentTurn;
    if (keys['KeyD'] || keys['ArrowRight']) player.angle += currentTurn;

    let frictionMultiplier = keys['Space'] ? player.driftFactor : 0.95;
    
    player.x += Math.sin(player.angle) * player.speed * frictionMultiplier;
    player.y -= Math.cos(player.angle) * player.speed * frictionMultiplier;

    if (player.x < 0) player.x = canvas.width;
    if (player.x > canvas.width) player.x = 0;
    if (player.y < 0) player.y = canvas.height;
    if (player.y > canvas.height) player.y = 0;

    if (keys['Space'] && Math.abs(player.speed) > 4) {
        driftMultiplier = Math.min(5, driftMultiplier + 0.02);
    } else {
        driftMultiplier = 1;
    }

    powerups.forEach((p, index) => {
        if (Math.hypot(player.x - p.x, player.y - p.y) < 45) {
            if (p.type === 'wrench') {
                player.hp = Math.min(100, player.hp + 25);
            } else {
                player.speed = player.maxSpeed * 1.4;
            }
            powerups.splice(index, 1);
            document.getElementById('hp-display').innerText = player.hp + "%";
        }
    });

    roadblocks.forEach((rb, index) => {
        if (Math.hypot(player.x - rb.x, player.y - rb.y) < 65) {
            player.hp -= 15;
            spawnDebris(player.x, player.y);
            player.speed *= -0.3;
            roadblocks.splice(index, 1);
            document.getElementById('hp-display').innerText = Math.max(0, player.hp) + "%";
            if (player.hp <= 0) triggerGameOver();
        }
    });

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
        cop.angle += angleDiff * 0.06;

        cop.x += Math.sin(cop.angle) * cop.speed;
        cop.y -= Math.cos(cop.angle) * cop.speed;

        if (Math.hypot(player.x - cop.x, player.y - cop.y) < 60) {
            let damage = cop.type === 'heavy' ? 30 : 12;
            player.hp -= damage;
            spawnDebris(player.x, player.y);
            player.speed *= -0.5;
            cop.x -= Math.sin(cop.angle) * 40;
            cop.y += Math.cos(cop.angle) * 40;
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

    document.getElementById('speed-display').innerText = Math.abs(Math.round(player.speed * 10)) + " MPH";
}

function triggerGameOver() {
    gameState = "OVER";
    document.getElementById('game-over-screen').style.display = 'flex';
}

function draw() {
    ctx.fillStyle = '#0f0f1c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#18182c';
    ctx.lineWidth = 1;
    let gridSize = 100;
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

    if (gameState !== "PLAYING") return;

    oilSlicks.forEach(o => {
        ctx.fillStyle = 'rgba(15, 15, 25, 0.85)';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    powerups.forEach(p => {
        ctx.fillStyle = p.type === 'wrench' ? '#00ff66' : '#ffaa00';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
        ctx.shadowBlur = 0;
    });

    roadblocks.forEach(rb => {
        ctx.save();
        ctx.translate(rb.x, rb.y);
        ctx.rotate(rb.angle);
        ctx.fillStyle = '#ff3300';
        ctx.fillRect(-rb.width / 2, -rb.height / 2, rb.width, rb.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-rb.width / 2, -rb.height / 2 + 5, rb.width, 6);
        ctx.restore();
    });

    debris.forEach(d => {
        ctx.fillStyle = '#ff5500';
        ctx.fillRect(d.x, d.y, d.size, d.size);
    });

    cops.forEach(cop => {
        ctx.save();
        ctx.translate(cop.x, cop.y);
        ctx.rotate(cop.angle);

        if (cop.type === 'heavy') {
            ctx.fillStyle = '#222233';
            ctx.fillRect(-cop.width / 2, -cop.height / 2, cop.width, cop.height);
            ctx.fillStyle = '#445566';
            ctx.fillRect(-cop.width / 3, -cop.height / 3, cop.width / 1.5, cop.height / 1.5);
        } else if (cop.type === 'fast') {
            ctx.fillStyle = '#0044cc';
            ctx.fillRect(-cop.width / 2, -cop.height / 2, cop.width, cop.height);
        } else {
            ctx.fillStyle = '#111118';
            ctx.fillRect(-cop.width / 2, -cop.height / 2, cop.width, cop.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-cop.width / 3, -cop.height / 3, cop.width / 1.5, cop.height / 1.5);
        }

        let sirenColor = Math.floor(Date.now() / 150) % 2 === 0 ? '#ff0000' : '#00ffff';
        ctx.fillStyle = sirenColor;
        ctx.shadowColor = sirenColor;
        ctx.shadowBlur = 15;
        ctx.fillRect(-6, -6, 12, 12);

        ctx.restore();
    });

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    if (keys['Space'] && Math.abs(player.speed) > 3) {
        ctx.fillStyle = 'rgba(0, 243, 255, 0.4)';
        ctx.fillRect(-player.width / 2 - 6, player.height / 2 - 6, 8, 14);
        ctx.fillRect(player.width / 2 - 2, player.height / 2 - 6, 8, 14);
    }

    ctx.fillStyle = player.hp < 40 ? '#aa0033' : '#ff0055';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 15;
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(-player.width / 2 + 6, -player.height / 2 + 14, player.width - 12, 20);

    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
