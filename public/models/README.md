# 모델 출처

`nuri.glb` — 주인공 누리. 이 프로젝트를 위해 새로 만든 오리지널 디자인.

1. 디자인 이미지: Higgsfield `gpt_image_2` (정면 A자 자세 전신)
2. 3D 메시: Higgsfield `sam_3_3d` (이미지 한 장 → 텍스처 있는 GLB)
3. 뼈대: Higgsfield `3d_rigging` (키 1.8m, 뼈 이름 Hips·Spine·Left/Right Arm·ForeArm·Hand·UpLeg·Leg·Foot 등)
4. 줄이기: 텍스처를 1024px JPEG로, 쓰지 않는 애니메이션·탄젠트 제거 (약 1MB)

발이 원점, 키 1.8m, 앞이 +z. 움직임은 파일에 없고 `src/hero.js`가 뼈를 직접 돌림.
