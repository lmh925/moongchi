# 🎨 멍뭉고치 그림 제작 가이드 v2 (시안 1 확정)

> 확정 그림체: **시안 1 — 동글동글 2D 일러스트** (`style_1_chibi.png`, 코기 3단계)
> 이 문서의 프롬프트를 순서대로 ChatGPT에 넣고, 결과 PNG를 파일명대로 저장해서 보내 주세요.

---

## 0. 꼭 지켜 주세요 (모든 단계 공통)

1. **한 대화(또는 한 프로젝트) 안에서 계속** 만들어요. 대화가 길어져 느려지면 새 대화를 열고 `style_1_chibi.png`와 직전 결과를 다시 첨부해요.
2. 매번 **`style_1_chibi.png`를 첨부**해요 (그림체 기준). 단계별로 추가 첨부할 그림은 각 프롬프트에 적혀 있어요.
3. 결과는 **투명 배경 PNG**로 받아요. webp나 흰 배경으로 나오면 *"transparent background PNG로 다시 저장해 줘"* 라고 해요.
4. 프롬프트는 영어 그대로 복사해요. `{ }` 부분만 바꿔요.
5. 마음에 안 들면 *"같은 그림체로 다시, ○○만 고쳐 줘"* 처럼 고칠 점만 말해요.
6. 보내실 때 **파일명을 표의 이름으로** 바꿔 주세요. 한 번에 여러 장 보내셔도 돼요.

### 그림체 문장 (아래 프롬프트의 `{STYLE}` 자리에 이미 들어 있어요)
```
Style: cute chibi 2D mobile-game illustration exactly like the attached reference — thick rounded dark-brown outlines, flat warm pastel colors with one soft cel-shading step, big round head (about 45% of body height), big glossy dark-brown eyes with white highlights, small pink blush, clean vector-like edges, no texture, no gradients, no shadows on the ground.
```

---

## 1단계 — 기준 강아지: 어른 코기 (가장 먼저! 3장)

이 3장을 먼저 보내 주시면 제가 게임 안에서 실제로 움직여 보고, 이 방식이 잘 되는지 확인한 다음 나머지를 진행해요.

### 1-1. 완성 그림 (기준 자세) — `corgi_adult_full.png`
첨부: `style_1_chibi.png`
```
Using the attached image as the exact style and character reference, draw the ADULT corgi (the rightmost one) standing on all four legs in a calm neutral pose, three-quarter view facing right, all four legs visible and slightly apart, tail visible, mouth closed in a small smile, eyes open.
One character only, centered, large, with empty space around it.
Style: cute chibi 2D mobile-game illustration exactly like the attached reference — thick rounded dark-brown outlines, flat warm pastel colors with one soft cel-shading step, big round head (about 45% of body height), big glossy dark-brown eyes with white highlights, small pink blush, clean vector-like edges, no texture, no gradients, no shadows on the ground.
Transparent background PNG. No text.
```

### 1-2. 움직이기용 부품 — `corgi_adult_parts.png`
첨부: `style_1_chibi.png` + **방금 만든 `corgi_adult_full.png`**
```
Take the attached standing corgi (corgi_adult_full) and split it into separate pieces for 2D cutout animation, like a paper doll. Keep every piece EXACTLY the same size, angle and colors as in the full picture — do not redraw or resize.
Pieces (spread out in a grid with lots of empty space between them, nothing touching):
1. head WITHOUT eyes, eyebrows and mouth (keep nose, cheek blush and face markings; leave the face area blank fur), WITHOUT ears
2. far ear (the one behind)
3. near ear (the one in front)
4. torso only (no head, no legs, no tail) — a simple bean shape
5. front near leg, 6. front far leg, 7. back near leg, 8. back far leg — each leg as one piece with a rounded top end; draw the top part fully even where it was hidden by the body
9. tail
Style: same as the attached reference — thick rounded dark-brown outlines, flat warm pastel colors, clean edges.
Transparent background PNG. No text, no numbers, no labels.
```

### 1-3. 얼굴 부품 (모든 견종 공용) — `face_parts.png`
첨부: `style_1_chibi.png` + `corgi_adult_full.png`
```
Draw a FACE PARTS sheet for the attached corgi, at exactly the size the eyes and mouth appear on its face, three-quarter view facing right. Each item is a separate small piece, arranged in neat rows with plenty of empty space between pieces:
EYES (each pair of eyes as one piece, keep the same spacing between the two eyes as on the corgi):
 a) normal open, b) blink half-closed, c) closed happy (^ ^), d) sleeping closed (gentle curved lines), e) sad (droopy, with small eyebrows), f) surprised (round), g) sparkly excited (star highlights), h) wink
MOUTHS: i) small closed smile, j) open happy with tongue, k) wide open laughing, l) eating (round "o"), m) pout/sad, n) chewing (wavy)
EXTRAS: o) pink blush pair, p) sweat drop, q) single tear, r) small anger mark, s) three little "z" letters for sleeping, t) small pink heart
Style: same as the attached reference — thick rounded dark-brown outlines, flat colors, clean edges.
Transparent background PNG. No labels, no letters except the "z" pieces.
```

> **여기서 잠깐!** 1-1 ~ 1-3을 먼저 보내 주세요. 제가 움직여 본 뒤 "계속 진행" 또는 "부품을 이렇게 고쳐 주세요"를 알려 드릴게요.

---

## 2단계 — 코기 아기 · 꼬마

1-1과 1-2를 단계만 바꿔 반복해요. 1-1의 첫 줄에서 `ADULT corgi (the rightmost one)`를 아래처럼 바꿔요.

| 단계 | 바꿀 문장 | 파일명 |
| --- | --- | --- |
| 아기 | `BABY corgi (the leftmost one: tiny, very round, oversized head, short stubby legs)` | `corgi_baby_full.png`, `corgi_baby_parts.png` |
| 꼬마 | `KID corgi (the middle one: young puppy, slightly longer legs than the baby)` | `corgi_kid_full.png`, `corgi_kid_parts.png` |

---

## 3단계 — 나머지 견종 7종 (각 3단계)

첨부: `style_1_chibi.png` + `corgi_adult_full.png` (아기·꼬마 단계일 땐 그 단계의 코기 그림)
1-1의 첫 문장을 아래로 바꿔서 완성 그림을 만들고, 이어서 1-2(부품)를 똑같이 진행해요.
```
Using the attached corgi ONLY as the reference for art style, body proportions, pose, angle and size (keep them identical), draw a {BREED} instead, {STAGE}.
```
- `{STAGE}` 자리: `as an ADULT dog` / `as a BABY puppy (tiny, very round, oversized head, short stubby legs)` / `as a KID puppy`

| 견종 | `{BREED}` 에 넣을 문장 | 파일명 앞부분 |
| --- | --- | --- |
| 비숑 | `Bichon Frise — fluffy round white cotton-ball fur, round fluffy head, black button nose` | `bichon_` |
| 포메라니안 | `Pomeranian — orange fluffy fur, big fluffy neck ruff, small pointy ears, plume tail curled up over the back` | `pomeranian_` |
| 토이 푸들 | `Toy Poodle — apricot curly fur, curly floppy ears, round fluffy muzzle` | `poodle_` |
| 말티즈 | `Maltese — long silky white fur, floppy ears with long hair` | `maltese_` |
| 시바견 | `Shiba Inu — red-orange fur with cream cheeks, chest and belly, small triangle ears, curled tail` | `shiba_` |
| 진돗개 백구 | `Korean Jindo dog — pure white coat, upright triangle ears, curled tail, gentle face` | `jindo_` |
| 치와와 | `Chihuahua — light tan short fur, very large upright ears, big round eyes, tiny body` | `chihuahua_` |

파일명 예: `shiba_adult_full.png`, `shiba_adult_parts.png`, `shiba_baby_full.png` …

---

## 4단계 — 옷 · 소품 40개

첨부: `style_1_chibi.png` + `corgi_adult_full.png` + `corgi_adult_parts.png`
한 장에 **4~5개씩** 묶어서 요청해요 (그림체가 같아져요).

### 4-1. 머리 소품 15개
```
Draw these HEADWEAR items for the attached corgi, each sized and angled to sit on its head piece (three-quarter view facing right), drawn ALONE without the dog, spread apart with space between them:
{ITEMS}
Style: same as the attached reference — thick rounded dark-brown outlines, flat warm pastel colors, clean edges.
Transparent background PNG. No text, no labels.
```
| 묶음 | `{ITEMS}` | 파일명 |
| --- | --- | --- |
| 머리 A | `1) pink ribbon bow, 2) small green sprout hair clip, 3) strawberry hat, 4) bear-ear knit hat, 5) cat ear headband` | `head_a.png` |
| 머리 B | `1) bunny ear headband, 2) flower crown, 3) straw hat with red ribbon, 4) purple wizard hat with stars, 5) small golden crown` | `head_b.png` |
| 머리 C | `1) pirate captain hat, 2) golden angel halo, 3) four-leaf clover hair clip, 4) striped birthday party cone hat, 5) graduation cap` | `head_c.png` |

### 4-2. 목 소품 8개
`Draw these NECK items` 로 시작하고 `sized to wrap around the neck where the head meets the torso`를 넣어 4-1과 같이 요청해요.
| 묶음 | `{ITEMS}` | 파일명 |
| --- | --- | --- |
| 목 A | `1) baby bib with a paw print, 2) golden jingle bell collar, 3) blue knitted scarf, 4) red bandana` | `neck_a.png` |
| 목 B | `1) pearl necklace, 2) red bow tie, 3) gold medal on a ribbon, 4) pink heart scarf` | `neck_b.png` |

### 4-3. 얼굴 소품 4개
`Draw these EYEWEAR items ... sized to sit over the eyes on the head piece` 로 요청해요.
| 묶음 | `{ITEMS}` | 파일명 |
| --- | --- | --- |
| 얼굴 | `1) round glasses, 2) pink heart-shaped glasses, 3) yellow star-shaped glasses, 4) cool black sunglasses` | `face_a.png` |

### 4-4. 옷 13개 (가장 중요: 몸통 부품에 꼭 맞게)
```
Draw these OUTFITS as separate clothing pieces that fit EXACTLY over the attached corgi's TORSO piece (same outline shape, same size and angle), like a sticker that covers the torso. Draw only the clothing — no dog, no legs, no head. Spread apart with space between them:
{ITEMS}
Style: same as the attached reference — thick rounded dark-brown outlines, flat warm pastel colors, clean edges.
Transparent background PNG. No text, no labels.
```
| 묶음 | `{ITEMS}` | 파일명 |
| --- | --- | --- |
| 옷 A | `1) red-and-white striped T-shirt, 2) strawberry-milk pink hoodie, 3) yellow raincoat, 4) blue denim overalls` | `body_a.png` |
| 옷 B | `1) snowflake knit sweater, 2) flower-pattern dress, 3) pink ballet tutu, 4) colorful Korean hanbok top (saekdong stripes)` | `body_b.png` |
| 옷 C | `1) little black tuxedo with bow, 2) princess dress with lace, 3) bumblebee costume with tiny wings, 4) green dinosaur costume with back spikes, 5) red superhero cape` | `body_c.png` |

---

## 5단계 — 방 (벽지·바닥 무늬는 제가 코드로 그려요)

첨부: `style_1_chibi.png` + `corgi_adult_full.png` (크기 비교용)
```
Draw these ROOM OBJECTS for a cozy pet room, seen from a slightly high front view (like a dollhouse), sized to match the attached corgi, each separate with plenty of space between them:
{ITEMS}
Style: same as the attached reference — thick rounded dark-brown outlines, flat warm pastel colors, clean edges, no floor shadows.
Transparent background PNG. No text, no labels.
```
| 묶음 | `{ITEMS}` | 파일명 |
| --- | --- | --- |
| 기본 | `1) a window frame with curtains, with the glass area left EMPTY/TRANSPARENT, 2) empty dog food bowl, 3) the same bowl full of kibble, 4) water bowl` | `room_base.png` |
| 침대 | `1) woven basket bed, 2) round floor cushion, 3) fluffy cloud bed, 4) little red-roof dog house, 5) camping tent bed` | `room_bed.png` |
| 러그 | `1) pink round rug, 2) red check rug, 3) rainbow rug, 4) paw-print rug` (러그는 바닥에 깔린 모양) | `room_rug.png` |
| 가구 | `1) soft sofa, 2) small bookshelf with books, 3) standing lamp, 4) big potted plant` | `room_furni.png` |
| 벽 장식 | `1) paw-print picture frame, 2) colorful bunting garland, 3) cuckoo clock, 4) string of fairy lights` | `room_deco.png` |
| 장난감 | `1) bouncy ball, 2) bone plush toy, 3) rubber duck, 4) teddy bear plush` | `room_toy.png` |

---

## 6단계 — UI · 스토어 (마지막)

### 6-1. 아이콘 — `ui_icons.png`
```
A set of 16 cute mobile-game UI icons in the attached art style, all the same size, arranged in a 4x4 grid with space between them:
food bowl, brush, heart, star, bone-shaped coin, pink heart point, envelope, gear, house, map, clothes hanger, game controller, diary book, gift box, shopping bag, calendar.
Thick rounded dark-brown outlines, flat warm pastel colors. Transparent background PNG. No text.
```
### 6-2. 앱 아이콘 — `app_icon.png`
```
Mobile app icon: the attached adult corgi's happy face (eyes closed happy, tongue out), centered and large, on a soft warm cream background with a subtle paw pattern, rounded and bold, readable at small size. Same art style as attached. Square 1:1. No text.
```
### 6-3. 스토어 대표 그래픽 — `store_feature.png`
```
Wide banner illustration in the attached art style: a corgi, a bichon, a shiba and a maltese puppy playing together in a cozy sunny little village plaza with a cafe and round trees. Leave empty space on the left third for a title. Wide 2:1. No text.
```

---

## 보내 주실 순서 (체크리스트)
- [ ] **1단계** `corgi_adult_full` · `corgi_adult_parts` · `face_parts` ← **이것 먼저**
- [ ] 2단계 코기 아기·꼬마 4장
- [ ] 3단계 견종 7종 × (완성+부품) × 3단계 = 42장 (견종 하나씩 끝내고 보내도 돼요)
- [ ] 4단계 옷·소품 9장
- [ ] 5단계 방 6장
- [ ] 6단계 UI·스토어 3장
