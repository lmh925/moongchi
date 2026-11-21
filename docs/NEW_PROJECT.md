# 멍뭉고치 2.0 — 새 프로젝트 구조

> 엔진: **Phaser 4 + TypeScript + Vite**, 앱 포장: **Capacitor 8 (안드로이드)**
> 지금의 멍뭉고치(`public/`, `server/`)는 테스트 버전으로 그대로 돌아가고, 새 게임은 `apps/meongmung`에서 만들어요.

## 폴더

```
apps/meongmung/          새 멍뭉고치 (Phaser 게임 + HTML 메뉴)
  src/main.ts            시작점: 폰트·소리·진동 준비, Phaser 실행
  src/game/RoomScene.ts  우리집 장면 (방 · 창밖 시간/날씨 · 강아지 · 효과)
  src/game/Dog.ts        강아지 (지금은 시안 그림 한 장 → 부품 그림이 오면 이 안만 바꿔요)
  src/game/room.ts       방 그리기 (벽지·바닥 무늬는 코드, 가구는 그림 파일로 바뀔 예정)
  src/ui/hud.ts          화면 메뉴: 상단 · 빠른 아이콘 · 게이지 · 돌봄 버튼 · 하단 메뉴 · 올라오는 창
  src/state.ts           강아지 상태 (지금은 기기 저장 → 다음 단계에서 서버 연결)
  src/bgm.json           배경음 목록과 한 바퀴 길이
  public/assets/bgm/     배경음 11곡 (OGG: 안드로이드·크롬 / MP3: 그 밖의 브라우저)
  android/               Capacitor가 만든 안드로이드 프로젝트 (패키지: biz.thel.meongmung)
packages/platform/       🧰 모든 게임이 같이 쓰는 기반 (게임 엔진과 무관)
  audio.ts               배경음(끊김 없는 반복·크로스페이드) + 합성 효과음 + 음량 설정
  device.ts              진동 · 광고 · 결제 · 알림 — 웹/앱 구현을 갈아 끼우는 자리
  clock.ts               한국 시간 낮·밤, 날짜별 날씨
  storage.ts             기기 저장소
tools/music/             작곡·렌더링 도구 (실제 악기 음원)
tools/art/               그림 시안 비교 도구
server/ shared/          기존 서버 — 새 게임도 이 서버(계정·친구·놀이터·안전장치)를 이어 써요
```

**새 게임을 만들 때:** `apps/새게임`을 만들고 `@platform`을 그대로 가져다 쓰면, 소리·진동·광고·결제·알림·저장은 이미 준비돼 있어요.

## 실행

```bash
cd apps/meongmung
npm install
npm run dev          # 개발 서버 (휴대폰에서 같은 와이파이로 접속 가능)
npm run build        # dist/ 에 웹 빌드
npm run android:sync # 빌드 → 안드로이드 프로젝트에 복사
```
- 시간·날씨 미리 보기: 주소 뒤에 `?hour=22&weather=snow` (weather: clear · snow · rain · petals · leaves)
- 처음 상태로: `?fresh`

### 안드로이드 APK 만들기
JDK 21 + Android SDK(플랫폼 36, 빌드 도구)가 필요해요.
```bash
cd apps/meongmung && npm run android:sync
cd android && ./gradlew assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
```

## 결정된 것
| 항목 | 값 | 비고 |
| --- | --- | --- |
| 패키지 이름 | `biz.thel.meongmung` | ⚠️ 플레이스토어에 처음 올린 뒤에는 바꿀 수 없어요. 첫 업로드 전에 확정 |
| 최소 안드로이드 | 7.0 (API 24) | Capacitor 8 기본값 |
| 화면 | 세로 고정, 스크롤 없는 한 화면 | 목록만 올라오는 창 안에서 스크롤 |
| 글꼴 | Jua (SIL OFL) | 둥글고 아이들에게 친숙 |
| 그림 | 시안 1 동글 일러스트, 부품(컷아웃) 애니메이션 | `docs/prompts/ART_GPT.md` |

## 다음 단계
1. 그림 1단계(코기 완성·부품·얼굴) 도착 → `Dog.ts`를 부품 애니메이션으로 교체 (걷기·앉기·뒹굴기·눈 깜빡임·표정)
2. 기존 서버 연결: 로그인(이어하기 코드) · 돌봄 · 코인 · 할 일
3. 꾸미기: 옷·소품 부착 (머리·목·얼굴·몸통 기준점)
4. 미니게임 이식: 멍뭉런 → 간식 받기 → 훈련
5. 광고(AdMob, 아동 설정) · 결제(Play Billing) · 로컬 알림 연결
6. 비공개 테스트 빌드 (조직 계정 준비되면)
