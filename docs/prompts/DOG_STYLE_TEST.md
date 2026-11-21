# 🐶 강아지 그림체 테스트 (방·아이콘과 같은 그림체로)

마음에 드신 **방과 아이콘**(`style_reference.png`)을 그림체 기준으로 삼아, 강아지만 AI로 그려 봐요.
같은 프롬프트를 **Gemini**와 **ChatGPT**에 각각 넣어 보고 결과를 보내 주세요.
**Gemini가 참고 그림의 그림체를 유지하는 데 더 강하다고 알려져 있어요.**

## 공통 규칙
- 매번 `style_reference.png`를 첨부해요.
- 결과는 투명 배경 PNG. 흰 배경이면 "투명 배경 PNG로 다시"라고 해요.
- 파일명: `test_{엔진}_{번호}.png` (예: `test_gemini_1.png`)

## "AI 같은" 그림을 피하는 문장 (모든 프롬프트에 이미 들어 있어요)
```
Avoid: big glossy anime eyes, large eye highlights, sparkles, airbrushed blush, gradients, glossy 3D shading, thick black outlines, overly perfect symmetry, generic "kawaii mascot" look.
```

---

### 테스트 1 — 종이 인형 (방과 똑같은 평면 그림체)
```
Use the attached image ONLY as the art-style reference: flat paper-cut vector illustration, no outlines, flat warm colors, one slightly darker flat shadow shape per part, simple rounded geometric shapes, tiny solid dot eyes, a soft drop shadow like layered paper.
Draw a Welsh Corgi puppy standing on all four legs, three-quarter view facing right, calm happy face with a small smile. Short stubby legs, long bean-shaped body, big upright ears, white chest and white socks, fluffy little tail.
Charming, a little quirky and hand-made, like a picture book for young children. One character only, centered, large.
Avoid: big glossy anime eyes, large eye highlights, sparkles, airbrushed blush, gradients, glossy 3D shading, thick black outlines, overly perfect symmetry, generic "kawaii mascot" look.
Transparent background PNG. No text.
```

### 테스트 2 — 펠트 공예 느낌 (손으로 만든 느낌 강조)
테스트 1에서 첫 문장을 아래로 바꿔요.
```
Use the attached image ONLY as the color palette and shape reference, but render the dog as a flat felt-craft illustration: shapes look cut from soft felt fabric, subtle felt texture, tiny stitched edges, flat colors, no outlines, tiny dot eyes made of small black buttons.
```

### 테스트 3 — 크레용 그림책
테스트 1에서 첫 문장을 아래로 바꿔요.
```
Use the attached image ONLY as the color palette and shape reference, but render the dog as a children's picture-book illustration in soft crayon and colored pencil: flat color areas with gentle crayon texture at the edges, no hard outlines, tiny dot eyes, warm and hand-drawn.
```

---

## 보내 주시면 제가 하는 일
1. 각 결과를 **실제 방 장면 안에** 넣어서 나란히 비교 이미지를 만들어 드려요 (방·아이콘과 어울리는지가 핵심).
2. 고른 그림체로 "강아지 그림체 규칙"(모양·비율·색·눈 모양)을 정리해요.
3. 그다음부터는 Gemini API를 연결해서 **제가 직접 생성 → 확인 → 다듬기**를 반복해요. 복사·붙여넣기는 이 테스트까지만이에요.
