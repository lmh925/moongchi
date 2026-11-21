# 🎼 배경음 작곡 · 렌더링 도구

`songs.py`에 악보(코드 진행 + 멜로디 + 악기 편성)를 적으면, `compose.py`가 연주를 만들어
**실제 악기 녹음 음원**(GeneralUser GS 사운드폰트)으로 렌더링해요.

## 준비 (한 번만)
```bash
apt-get install -y fluidsynth ffmpeg
pip install mido
git clone --depth 1 https://github.com/mrbumpy409/GeneralUser-GS.git /tmp/gugs
```

## 만들기
```bash
cd tools/music
python3 compose.py bgm_home_day out /tmp/gugs/GeneralUser-GS.sf2   # 한 곡
python3 compose.py all out /tmp/gugs/GeneralUser-GS.sf2            # 전부
```
곡마다 다음 파일이 나와요.

| 파일 | 용도 |
| --- | --- |
| `이름.wav` | 원본 (반복 한 바퀴) |
| `이름.ogg` | 게임용 (끊김 없이 반복돼요) |
| `이름.preview.m4a` | 들어 보기용 (두 바퀴 이어 붙임, 이음새 확인) |
| `이름.mid` | 악보 파일 (다른 음원으로 다시 렌더링할 때) |

## 이렇게 만들어져요
- **끊김 없는 반복:** 곡을 두 번 연주해 녹음하고 두 번째 바퀴만 잘라요. 첫 바퀴의 울림이 이음새를 자연스럽게 덮어요.
- **사람이 연주한 느낌:** 박자·세기를 아주 조금씩 흔들고, 기타 코드는 줄마다 시간차를 두고 쳐요.
- **음량:** 모든 곡을 -16 LUFS로 맞춰요 (곡이 바뀌어도 소리 크기가 같아요).

## 라이선스
GeneralUser GS v2.0.3: "개인적·상업적 음악 제작에 제한 없이 사용 가능"
(`documentation/LICENSE.txt`). 렌더링된 음악 파일은 앱에 넣어 판매해도 돼요.
작곡(멜로디·편곡)은 이 프로젝트의 창작물이에요.
