const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222233);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

const controls = new window.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 2;
controls.maxDistance = 10;

// カメラの初期向きを設定
const initialCameraDirection = new THREE.Vector3(0, 0, -1);
initialCameraDirection.applyEuler(new THREE.Euler(-Math.PI / 6, 0, 0));
camera.lookAt(initialCameraDirection);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

// 地面
const groundGeo = new THREE.PlaneGeometry(100, 100);
const groundMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// ターゲット
const targetGeo = new THREE.BoxGeometry(1, 1, 1);
const targetMat = new THREE.MeshPhongMaterial({ color: 0xff4444 });
const target = new THREE.Mesh(targetGeo, targetMat);
target.position.set(0, 0.5, -10);
scene.add(target);

// プレイヤー状態
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canShoot = true;
let weaponType = 0; // 0:アステロイド 1:バイパー 2:イーグレット
const weaponNames = ['アステロイド', 'バイパー', 'イーグレット'];

document.getElementById('weapon').textContent = `武器: ${weaponNames[weaponType]}`;

// 弾リスト
const bullets = [];

// マウス視点制御
let pitch = 0, yaw = 0;
let pointerLocked = false;
canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;

canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});

document.addEventListener('mousemove', (event) => {
  if (!pointerLocked) return;
  yaw -= event.movementX * 0.002;
  pitch -= event.movementY * 0.002;
  pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
});

document.addEventListener('keydown', (event) => {
  switch(event.code) {
    case 'KeyW': moveForward = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyD': moveRight = true; break;
    case 'Digit1': weaponType = 0; updateWeaponUI(); break;
    case 'Digit2': weaponType = 1; updateWeaponUI(); break;
    case 'Digit3': weaponType = 2; updateWeaponUI(); break;
  }
});
document.addEventListener('keyup', (event) => {
  switch(event.code) {
    case 'KeyW': moveForward = false; break;
    case 'KeyS': moveBackward = false; break;
    case 'KeyA': moveLeft = false; break;
    case 'KeyD': moveRight = false; break;
  }
});

function updateWeaponUI() {
  document.getElementById('weapon').textContent = `武器: ${weaponNames[weaponType]}`;
}

// 発射
document.addEventListener('mousedown', (event) => {
  if (!pointerLocked || event.button !== 0) return;
  if (!canShoot) return;
  shoot();
  canShoot = false;
  setTimeout(() => canShoot = true, 200); // 連射制限
});

function shoot() {
  // 武器ごとに弾の特性を変える
  let bullet;
  switch(weaponType) {
    case 0: // アステロイド: 直進弾
      bullet = createBullet(0xffcc00, camera.getWorldDirection(new THREE.Vector3()), 0.5, 0.2);
      break;
    case 1: // バイパー: 曲射（少し左右にランダム）
      const dir = camera.getWorldDirection(new THREE.Vector3());
      dir.x += (Math.random()-0.5)*0.2;
      dir.y += (Math.random()-0.5)*0.1;
      bullet = createBullet(0x00ffcc, dir, 0.4, 0.15);
      break;
    case 2: // イーグレット: 高速小弾
      bullet = createBullet(0x66aaff, camera.getWorldDirection(new THREE.Vector3()), 1.0, 0.1);
      break;
  }
  bullets.push(bullet);
  scene.add(bullet.mesh);
}

function createBullet(color, direction, speed, size) {
  const geo = new THREE.SphereGeometry(size, 8, 8);
  const mat = new THREE.MeshPhongMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(camera.position);
  return {
    mesh,
    direction: direction.clone().normalize(),
    speed,
    alive: true,
    life: 2 // 秒
  };
}

// メインループ
let prevTime = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  prevTime = time;

  // 移動
  direction.set(0, 0, 0);
  if (moveForward) direction.z -= 1;
  if (moveBackward) direction.z += 1;
  if (moveLeft) direction.x -= 1;
  if (moveRight) direction.x += 1;
  direction.normalize();

  // カメラの向きに合わせて移動
  const move = new THREE.Vector3(direction.x, 0, direction.z);
  move.applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
  camera.position.addScaledVector(move, delta * 5);

  // 視点
  camera.rotation.set(pitch, yaw, 0);

  // 弾の更新
  for (const bullet of bullets) {
    if (!bullet.alive) continue;
    bullet.mesh.position.addScaledVector(bullet.direction, bullet.speed);
    bullet.life -= delta;
    // ターゲットとの当たり判定
    if (bullet.mesh.position.distanceTo(target.position) < 0.7) {
      target.material.color.set(0x00ff00);
      bullet.alive = false;
      scene.remove(bullet.mesh);
      setTimeout(() => target.material.color.set(0xff4444), 300);
    }
    if (bullet.life < 0) {
      bullet.alive = false;
      scene.remove(bullet.mesh);
    }
  }

  controls.update(); // OrbitControlsの更新
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});