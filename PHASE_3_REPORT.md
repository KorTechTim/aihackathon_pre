# PIXEL PANIC Phase 3 결과 보고서

## 결과

Phase 3의 캐릭터·주민·고양이·VFX 제작과 Phaser 실사용 통합을 완료했다. Phase 2의 임시 로봇 이미지는 제거했으며, 모든 핵심 행동은 실제 스프라이트 애니메이션으로 재생된다.

## 제작 에셋

- 로봇 3종: 32×32 원본 프레임, `down/left/right/up` 4방향
- 공통 상태: idle 4프레임, walk 6프레임, celebrate 6프레임, fail 4프레임
- 역할 행동: AQUA extinguish 8프레임, FIX repair 8프레임, BUDDY rescue 8프레임
- BUDDY carry walk: 4방향×6프레임
- 주민 4종: idle, panic, evacuate walk, cheer
- 고양이: idle, meow, hop, rescued, carry socket
- 공통 캐릭터 요소: 그림자, 로봇별 선택 링, 상태 말풍선
- VFX 26종: 화재·연기·불티·물·증기·웅덩이·수리·구조·전기·복구·완료 효과

정확한 규격을 검사하는 항목은 총 69개다. 원화 보드는 `assets-src/pixel-panic/characters/reference`와 `assets-src/pixel-panic/fx/reference`에 보존했고, 런타임 시트는 `scripts/generate_phase3_4_assets.py`로 재생성할 수 있다.

## 이벤트와 런타임 연결

- AQUA: extinguish frame 2 `water-start`, frame 7 `water-end`
- FIX: repair frame 3·6 `impact`
- BUDDY: rescue frame 4 `carry-socket`
- 고양이: hop frame 3 `apex`, frame 5 `land`
- 발전기: 복구 첫 프레임부터 on 상태, 4프레임 점등 루프

Phaser 장면은 `fire`, `bridge`, `cat`, `generator`, `complete` 상태를 가지며 각 상태에서 전용 이동·행동·VFX·사건 해결 표시를 재생한다. 완료 상태에서는 세 로봇 celebrate, 주민 cheer, confetti가 동시에 재생된다.

## 검증

```text
Phase 3/4 asset verification PASSED
- exact character/FX sheets: 69
- placeholders: none
```

시트 원본은 하드 알파를 사용하고 런타임은 nearest-neighbor, `pixelArt`, `roundPixels`, `antialias: false`로 렌더링한다.
