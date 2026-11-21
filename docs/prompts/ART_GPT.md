# 🎨 멍뭉고치 아트 제작 가이드 (ChatGPT 이미지 생성)

## 먼저 알아 두기
- **한 대화(또는 한 프로젝트) 안에서 계속** 만들어 주세요. 같은 대화에서 이전 결과를 기준으로 삼아야 그림체가 일정해요.
- 2단계부터는 **확정된 그림을 매번 첨부**하고 "이 그림과 같은 그림체·비율로"라고 붙여요.
- 모든 캐릭터·소품은 **투명 배경 PNG**로 받아요. 배경이 하얗게 나오면 "transparent background PNG로 다시"라고 요청해 주세요.
- 실존 게임·캐릭터 이름(포켓몬, 동물의 숲 등)은 넣지 않아요. 비슷하게 베낀 그림은 스토어 심사와 저작권에서 문제가 돼요.
- 프롬프트는 영어가 결과가 더 안정적이에요. 그대로 복사해서 쓰세요.
- **보내실 때:** 파일 이름을 각 단계의 **파일명**으로 바꿔 주세요.

---

## 1단계 — 스타일 시안 2종 (하나 고르기)

같은 웰시코기를 두 가지 그림체로 그려 보고 비교해요. 도트(픽셀)는 빼고, **아이들에게 친숙하고 개발하기 쉬운 둥근 일러스트**를 기본으로 해요.
각각 따로 요청하세요. (ChatGPT로 그림체가 들쭉날쭉하면 Gemini 이미지 생성으로 같은 프롬프트를 써 봐도 좋아요. 같은 캐릭터를 유지하며 고치는 데 강해요.)

### 시안 1 (추천): 동글동글 2D 일러스트 — 부품 애니메이션에 가장 잘 맞아요
```
Game character design: a cute Welsh Corgi puppy mascot for a cozy pet-raising mobile game.
Show the SAME corgi in three growth stages side by side, left to right: baby (tiny, round, oversized head), kid (slightly taller), adult (full size but still cute).
Each in a happy sitting pose, three-quarter view facing right.
Style: cute chibi 2D illustration, thick rounded dark-brown outlines, flat pastel colors with soft simple cel shading, head about 45% of body height, big glossy eyes, small blush on cheeks, clean vector-like edges, soft and friendly, mobile game character art.
Transparent background, PNG, no text, no frame.
```
파일명: `style_1_chibi.png`

### 시안 2: 파스텔 동화책 그림
```
Game character design: a cute Welsh Corgi puppy mascot for a cozy pet-raising mobile game.
Show the SAME corgi in three growth stages side by side, left to right: baby (tiny, round, oversized head), kid (slightly taller), adult (full size but still cute).
Each in a happy sitting pose, three-quarter view facing right.
Style: soft storybook illustration, gentle watercolor-like texture but clean readable edges, warm pastel palette, thin brown outlines, chibi proportions, big gentle eyes, cozy and heartwarming.
Transparent background, PNG, no text, no frame.
```
파일명: `style_2_storybook.png`

> 두 장을 보내 주시면 게임 화면 크기에서 어떻게 보이는지 제가 합성해서 비교 이미지를 드릴게요.

---

## 2단계 — 기준 캐릭터: 코기 전체 세트 (고른 스타일로)

아래 `{STYLE}` 자리에는 1단계에서 고른 시안의 "Style:" 문장을 그대로 넣고, **고른 시안 그림을 첨부**하세요.

### 2-1. 돌려 보기 (턴어라운드) — 어른 코기
```
Using the attached corgi as the exact reference (same colors, proportions and line style), create a character turnaround sheet of the ADULT corgi:
front view, three-quarter view facing right, side view facing right, back view. All standing, neutral happy expression, same scale, evenly spaced, nothing overlapping.
{STYLE}
Transparent background, PNG, no text.
```
파일명: `corgi_turnaround.png`

### 2-2. 움직이기용 부품 (가장 중요!)
```
Using the attached corgi as the exact reference, create a 2D cutout-animation PARTS SHEET of the ADULT corgi in SIDE VIEW facing right.
Draw every part as a separate piece, spread out on the canvas with generous empty space between pieces (no overlapping, no touching):
- head without ears
- left ear, right ear
- torso (body only)
- front-left leg, front-right leg, back-left leg, back-right leg (each leg as one piece, top end rounded so it can rotate at the joint)
- tail
Draw hidden areas fully (e.g. the full top of each leg) so pieces can overlap when assembled.
Same scale for all pieces. {STYLE}
Transparent background, PNG, no text, no labels.
```
파일명: `corgi_parts_side.png`

```
Using the attached corgi as the exact reference, create a PARTS SHEET of the ADULT corgi in FRONT VIEW (facing the viewer), sitting:
separate pieces with space between them: head without ears, left ear, right ear, body, left front paw, right front paw, tail.
{STYLE}
Transparent background, PNG, no text, no labels.
```
파일명: `corgi_parts_front.png`

### 2-3. 표정 부품
```
Using the attached corgi as the exact reference, create a FACE PARTS SHEET for 2D animation, drawn at the size they appear on the corgi's face:
EYES (each pair as one piece): normal open, happy closed (^ ^), sleeping closed, sad, surprised, wink.
MOUTHS: small smile, open happy, tongue out, eating (round "o"), pouty/sad.
EXTRAS: blush cheeks, sweat drop.
Arrange in neat rows with space between pieces. {STYLE}
Transparent background, PNG, no text, no labels.
```
파일명: `corgi_face_parts.png`

### 2-4. 아기 · 꼬마 단계 부품
2-2 프롬프트에서 `ADULT`를 `BABY (tiny round puppy, oversized head, short stubby legs)`로, 다음엔 `KID (young puppy, slightly longer legs)`로 바꿔서 한 번씩 더 만들어 주세요.
파일명: `corgi_parts_side_baby.png`, `corgi_parts_side_kid.png`

> 2단계 결과를 받으면 제가 게임에 넣어 **숨쉬기 · 걷기 · 꼬리 흔들기 · 앉기 · 뒹굴기 · 밥 먹기**를 움직여 보고, 부족한 부품이 있으면 추가 프롬프트를 드릴게요.

---

## 3단계 — 나머지 견종 7종

**코기 부품 그림을 첨부**하고, 아래에서 견종 설명만 바꿔 2-1 ~ 2-4를 반복해요.
```
Using the attached corgi sheet ONLY as the reference for proportions, line style, and shading (keep the exact same art style and body proportions), draw the same sheet for a different breed: {BREED}.
```

| 견종 | {BREED} 에 넣을 문장 | 파일명 앞부분 |
| --- | --- | --- |
| 비숑 | `a Bichon Frise, fluffy round white cotton-ball fur, round fluffy head, black button eyes and nose` | `bichon_` |
| 포메라니안 | `a Pomeranian, orange fluffy fur, big fluffy neck ruff, small pointy ears, plume tail curled over the back` | `pomeranian_` |
| 토이 푸들 | `a Toy Poodle, apricot brown curly fur, curly floppy ears, round fluffy muzzle` | `poodle_` |
| 말티즈 | `a Maltese, long silky white fur, floppy ears with long hair, small pink bow on top of the head` | `maltese_` |
| 시바견 | `a Shiba Inu, red-orange fur with cream face and chest (urajiro), triangle ears, curled tail` | `shiba_` |
| 진돗개 (백구) | `a Korean Jindo dog, pure white coat, upright triangle ears, curled tail, gentle loyal face` | `jindo_` |
| 치와와 | `a Chihuahua, light tan short fur, very large upright ears, big round eyes, tiny body` | `chihuahua_` |

---

## 4단계 — 옷 · 소품 (출시 40개)

**어른 코기 옆모습 그림을 첨부**해서 크기를 맞춰요. 한 장에 4~6개씩 묶어서 요청하면 그림체가 같아져요.
```
Using the attached corgi (side view facing right) only as a SIZE reference, draw these wearable accessories as separate items, sized to fit this corgi, each shown from the side angle as worn, spread apart with space between them:
{ITEMS}
Do not draw the dog. {STYLE}
Transparent background, PNG, no text, no labels.
```
{ITEMS} 예시 (머리 소품 1묶음):
`red ribbon bow, strawberry hat, yellow crown, wizard hat, bunny ear headband, flower crown`

> 아이템 목록 40개는 1단계 시안을 고른 뒤 정해서 드릴게요 (지금 있는 아이템 중 인기 있는 것 위주로).

---

## 5단계 — 방 · 가구

### 5-1. 빈 방 (세로 화면용)
```
A cozy empty room background for a vertical mobile pet game, portrait orientation (2:3).
Top-down three-quarter view: back wall with one window in the upper middle, wooden floor taking the lower 60%.
No furniture, no characters, warm afternoon light, simple and clean so items can be placed on top.
{STYLE (배경용으로 outline 굵기만 조금 얇게)}
No text.
```
파일명: `room_empty_day.png` (창밖이 밤인 버전 `room_empty_night.png`도 한 장)

### 5-2. 가구 (한 장에 4~6개)
```
Draw these furniture items for the attached room, same perspective (top-down three-quarter view), each separate with space between them:
{FURNITURE}
{STYLE}
Transparent background, PNG, no text.
```
{FURNITURE} 예시: `round pink dog bed, food bowl (empty), food bowl (full of kibble), rope toy, small bookshelf with plants, soft round rug`

---

## 6단계 — UI · 스토어 그림

### 6-1. 아이콘 세트
```
A set of cute mobile game UI icons, same size, each separate on transparent background with space between them:
food bowl, brush, heart, star, bone-shaped coin, pink heart point, envelope mail, gear settings, house, map, clothes hanger, game controller, diary book, gift box, shopping bag, calendar.
{STYLE}
Transparent background, PNG, no text.
```
파일명: `ui_icons.png`

### 6-2. 앱 아이콘 (512×512)
```
Mobile app icon for a cute puppy-raising game called "Meongmung Gochi": the adult corgi's happy face, centered, on a soft warm pastel background with a subtle paw pattern. Bold, readable at small size, no text.
{STYLE}
Square 1:1.
```
파일명: `app_icon.png`

### 6-3. 스토어 대표 그래픽 (1024×500)
```
Wide banner illustration for a mobile game store page: several cute puppies (corgi, bichon, shiba, maltese, poodle) playing together in a cozy sunny village plaza with a cafe and trees. Leave empty space on the left third for a title. No text.
{STYLE}
Wide 2:1 ratio.
```
파일명: `store_feature.png`

---

## 진행 순서 요약
1. 1단계 시안 2장 → 저에게 보내기 → 같이 고르기
2. 2단계 코기 세트 → 제가 게임에 넣어 움직여 보기 → 보완
3. 3단계 7종 → 4단계 소품 → 5단계 방 → 6단계 UI/스토어
