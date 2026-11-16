import * as THREE from 'three';

// 오리지널 주인공 "누리": 남색 슈트, 민트색 띠, 둥근 헬멧에 가로 바이저 하나
export function createHero() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 4, 8), mat(0x1f2a44));
  body.position.y = 0.1;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 12), mat(0x3fe0c5));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), mat(0xf2f2f2));
  head.position.y = 0.75;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.1), mat(0x3fe0c5));
  visor.position.set(0, 0.78, 0.21);
  g.add(body, belt, head, visor);
  return g;
}
