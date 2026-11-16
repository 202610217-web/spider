import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc3e6);
scene.fog = new THREE.Fog(0x9cc3e6, 800, 2000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x667755, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(300, 500, 200);
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshLambertMaterial({ color: 0x8a9a7a }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(60, 1, 1, 5000);
camera.position.set(0, 400, 600);
const controls = new OrbitControls(camera, renderer.domElement); // 마우스 + 터치(한 손가락 회전, 두 손가락 줌/이동)
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05;

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const { buildings } = await (await fetch('/data/test.json')).json();
const geoms = buildings.map(({ h, ring }) => {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y))), { depth: h, bevelEnabled: false });
  return g.rotateX(-Math.PI / 2); // 바닥(x, 북) → (x, -z), 돌출 → +y
});
scene.add(new THREE.Mesh(mergeGeometries(geoms), new THREE.MeshLambertMaterial({ color: 0xd8d2c4 })));

renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
