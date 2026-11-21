"""멍뭉고치 배경음 악보

각 곡:
- sections: 코드 진행('|'로 마디, ','로 반 마디)과 멜로디('음:박' 띄어쓰기, '-'는 쉼표)
- parts: 악기 (program = General MIDI 악기 번호, 0부터)
- form: 구간 순서. play = 그 구간에 연주할 파트 (편곡 변화로 반복이 지루하지 않게)
"""

SONGS = {}

# ───────────────────────────── 타이틀: 오르골 왈츠 (3/4, C장조) ─────────────────────────────
SONGS['bgm_title'] = {
    'bpm': 96, 'meter': 3, 'gain': 0.55, 'master': 1.5,
    'room': {'size': 0.75, 'level': 0.75, 'damp': 0.3},
    'sections': {
        'A': {
            'chords': 'C | Am | F | G | Em | Am | Dm | G',
            'melody': 'E5:1 G5:1 C6:1  B5:2 A5:1  A5:1 C6:1 F6:1  E6:2 D6:1  G5:1 B5:1 E6:1  D6:2 C6:1  F5:1 A5:1 D6:1  D6:1 B5:1 G5:1',
        },
        'A2': {
            'chords': 'C | Am | F | G | Em | Am | G | C',
            'melody': 'E5:1 G5:1 C6:1  B5:2 A5:1  A5:1 C6:1 F6:1  E6:2 D6:1  G5:1 B5:1 E6:1  D6:2 C6:1  D6:1 B5:1 G5:1  C6:3',
        },
        'B': {
            'chords': 'F | G | Em | Am | F | G | C | C',
            'melody': 'C6:2 A5:1  B5:2 G5:1  G5:1 B5:1 E6:1  E6:2 C6:1  A5:1 C6:1 F6:1  F6:1 E6:1 D6:1  E6:1 D6:1 C6:1  C6:2 -:1',
        },
    },
    'parts': {
        'box': {'kind': 'melody', 'ch': 0, 'program': 10, 'vel': 92, 'volume': 105, 'pan': 58, 'reverb': 70, 'legato': 1.4},
        'celesta': {'kind': 'melody', 'ch': 1, 'program': 8, 'vel': 70, 'volume': 90, 'pan': 76, 'reverb': 70, 'oct': -12},
        'harp': {'kind': 'arp', 'ch': 2, 'program': 46, 'rate': 1, 'pattern': [None, 1, 2], 'lo': 60, 'vel': 62, 'volume': 92, 'pan': 44, 'reverb': 60},
        'bass': {'kind': 'bass', 'ch': 3, 'program': 45, 'style': 'waltz', 'lo': 36, 'vel': 80, 'volume': 96, 'reverb': 40},  # 피치카토 현
        'strings': {'kind': 'pad', 'ch': 4, 'program': 49, 'lo': 55, 'vel': 40, 'volume': 82, 'reverb': 80, 'chorus': 30},
    },
    'form': [
        {'sec': 'A', 'play': ['box', 'harp', 'bass']},
        {'sec': 'A2', 'play': ['box', 'harp', 'bass', 'strings']},
        {'sec': 'B', 'play': ['box', 'celesta', 'harp', 'bass', 'strings']},
        {'sec': 'A2', 'play': ['box', 'celesta', 'harp', 'bass', 'strings']},
    ],
}

# ───────────────────────────── 우리집 (낮): 느긋한 어쿠스틱 (F장조) ─────────────────────────────
_HOME_A = 'A4:1 C5:1 F5:1.5 E5:0.5  E5:1 D5:0.5 C5:0.5 G4:2  A4:1 D5:1 F5:1.5 A5:0.5  G5:1 F5:0.5 D5:0.5 F5:2  A4:1 C5:1 F5:1.5 E5:0.5  E5:1 G5:0.5 E5:0.5 C5:2'
SONGS['bgm_home_day'] = {
    'bpm': 94, 'swing': 0.07, 'gain': 0.5, 'master': 1.6,
    'room': {'size': 0.5, 'level': 0.55, 'damp': 0.4},
    'sections': {
        'A': {
            'chords': 'F | C | Dm | Bb | F | C | Bb | C',
            'melody': _HOME_A + '  D5:1 F5:1 A5:1 G5:0.5 F5:0.5  E5:2 G5:2',
        },
        'A2': {
            'chords': 'F | C | Dm | Bb | F | C | Bb,C | F',
            'melody': _HOME_A + '  D5:1 F5:1 E5:1 G5:1  F5:3 -:1',
        },
        'B': {
            'chords': 'Dm | Am | Bb | F | Dm | Am | Gm | C7',
            'melody': 'F5:1.5 E5:0.5 D5:1 A4:1  C5:1 E5:1 A5:2  G5:1 F5:1 D5:1 Bb4:1  C5:2 A4:2  D5:1 F5:1 A5:1.5 G5:0.5  E5:1 A5:1 C6:2  Bb5:1 A5:1 G5:1 D5:1  E5:1 G5:1 Bb5:1 G5:0.5 E5:0.5',
        },
    },
    'parts': {
        'piano': {'kind': 'melody', 'ch': 0, 'program': 0, 'vel': 84, 'volume': 100, 'pan': 54, 'reverb': 55, 'legato': 1.1},
        'flute': {'kind': 'melody', 'ch': 1, 'program': 73, 'vel': 86, 'volume': 92, 'pan': 74, 'reverb': 60, 'legato': 0.9},
        'clarinet': {'kind': 'melody', 'ch': 2, 'program': 71, 'vel': 84, 'volume': 92, 'pan': 70, 'reverb': 55},
        'guitar': {'kind': 'strum', 'ch': 3, 'program': 24, 'pattern': 'D-DU-UDU', 'lo': 52, 'strings': 5, 'vel': 62, 'volume': 96, 'pan': 40, 'reverb': 40, 'spread': 0.02},
        'epiano': {'kind': 'arp', 'ch': 4, 'program': 4, 'rate': 0.5, 'pattern': [0, 2, 1, 3, 2, 1, 0, 2], 'lo': 57, 'vel': 54, 'volume': 88, 'pan': 44, 'reverb': 55},
        'bass': {'kind': 'bass', 'ch': 5, 'program': 32, 'style': 'half', 'lo': 36, 'vel': 90, 'volume': 104, 'reverb': 25},
        'walkbass': {'kind': 'bass', 'ch': 5, 'program': 32, 'style': 'walk', 'lo': 36, 'vel': 88, 'volume': 104, 'reverb': 25},
        'glock': {'kind': 'sparkle', 'ch': 6, 'program': 9, 'lo': 79, 'vel': 52, 'volume': 84, 'pan': 92, 'reverb': 75},
        'strings': {'kind': 'pad', 'ch': 7, 'program': 49, 'lo': 53, 'vel': 34, 'volume': 80, 'reverb': 80, 'chorus': 30},
        'shaker': {'kind': 'drums', 'kit': 40, 'vel': 70, 'patterns': {'cabasa': '..x...x...x...x.'}, 'volume': 90},
        'brush': {'kind': 'drums', 'kit': 40, 'vel': 74, 'volume': 90, 'reverb': 35,
                  'patterns': {'kick': 'x-------x-------', 'snare': '----x-------x---', 'cabasa': '..x...x...x...x.'},
                  'mix': {'kick': 0.85, 'snare': 0.6, 'cabasa': 0.8}},
    },
    'form': [
        {'sec': 'A', 'play': ['piano', 'guitar', 'bass', 'glock', 'shaker']},
        {'sec': 'A2', 'play': ['flute', 'guitar', 'bass', 'glock', 'brush', 'strings']},
        {'sec': 'B', 'play': ['clarinet', 'epiano', 'walkbass', 'brush', 'strings']},
        {'sec': 'A2', 'play': ['flute', 'piano', 'guitar', 'bass', 'glock', 'brush', 'strings']},
    ],
}

# ───────────────────────────── 멍뭉런 ① 초록 들판 (F장조, 신나게) ─────────────────────────────
SONGS['bgm_run_meadow'] = {
    'bpm': 144, 'gain': 0.5, 'master': 1.5,
    'room': {'size': 0.4, 'level': 0.45, 'damp': 0.45},
    'sections': {
        'A': {
            'chords': 'F | F | Gm | C | F,Dm | Bb,C | F,C | F',
            'melody': 'F5:0.5 A5:0.5 C6:0.5 A5:0.5 F5:0.5 C6:0.5 D6:1  C6:0.5 A5:0.5 G5:0.5 A5:0.5 F5:2  G5:0.5 A5:0.5 A#5:0.5 C6:0.5 D6:0.5 C6:0.5 A#5:0.5 A5:0.5  G5:0.5 E5:0.5 F5:0.5 G5:0.5 C6:1 -:1  A5:0.5 C6:0.5 F6:0.5 C6:0.5 D6:0.5 C6:0.5 A5:1  A#5:0.5 A5:0.5 G5:0.5 F5:0.5 G5:2  F5:0.5 G5:0.5 A5:0.5 C6:0.5 A#5:0.5 A5:0.5 G5:0.5 E5:0.5  F5:1 C5:0.5 F5:0.5 F5:1 -:1',
        },
        'B': {
            'chords': 'Bb | C | Am | Dm | Bb | C | Gm7 | C7',
            'melody': 'D6:0.5 C6:0.5 Bb5:0.5 D6:0.5 F6:1 D6:1  E6:0.5 D6:0.5 C6:0.5 E6:0.5 G6:2  C6:0.5 A5:0.5 E5:0.5 A5:0.5 C6:1 E6:1  F6:1 E6:0.5 D6:0.5 A5:2  Bb5:0.5 D6:0.5 F6:0.5 D6:0.5 Bb5:1 F5:1  G5:0.5 C6:0.5 E6:0.5 C6:0.5 G5:1 E5:1  F5:0.5 G5:0.5 Bb5:0.5 D6:0.5 F6:1 D6:1  E6:1 C6:0.5 Bb5:0.5 G5:1 -:1',
        },
    },
    'parts': {
        'whistle': {'kind': 'melody', 'ch': 0, 'program': 78, 'vel': 92, 'volume': 98, 'pan': 60, 'reverb': 45, 'oct': -12},
        'piccolo': {'kind': 'melody', 'ch': 1, 'program': 72, 'vel': 70, 'volume': 80, 'pan': 76, 'reverb': 45},
        'fiddle': {'kind': 'melody', 'ch': 2, 'program': 40, 'vel': 88, 'volume': 92, 'pan': 66, 'reverb': 45, 'oct': -12},
        'banjo': {'kind': 'arp', 'ch': 3, 'program': 105, 'rate': 0.25, 'pattern': [0, 1, 4, 2, 0, 4, 1, 2], 'lo': 60, 'vel': 56, 'volume': 84, 'pan': 30, 'reverb': 30},
        'guitar': {'kind': 'strum', 'ch': 4, 'program': 25, 'pattern': 'D-DUxUDU', 'lo': 50, 'strings': 5, 'vel': 64, 'volume': 92, 'pan': 96, 'reverb': 30, 'spread': 0.012, 'ring': 1.2},
        'bass': {'kind': 'bass', 'ch': 5, 'program': 33, 'style': 'bounce', 'lo': 36, 'vel': 96, 'volume': 106, 'reverb': 20},
        'glock': {'kind': 'sparkle', 'ch': 6, 'program': 9, 'lo': 84, 'vel': 56, 'volume': 82, 'pan': 100, 'reverb': 60},
        'strings': {'kind': 'pad', 'ch': 7, 'program': 48, 'lo': 55, 'vel': 40, 'volume': 78, 'reverb': 70, 'chorus': 20},
        'drums': {'kind': 'drums', 'kit': 0, 'vel': 92, 'volume': 100, 'reverb': 25, 'fills': ['snare', 'snare', 'tom_hi', 'tom_lo'],
                  'patterns': {'kick': 'X-----x-X-------', 'snare': '----X-------X---', 'hat': 'x-x-x-x-x-x-x-x-'},
                  'mix': {'hat': 0.55, 'snare': 0.85}},
        'tamb': {'kind': 'drums', 'kit': 0, 'vel': 70, 'patterns': {'tamb': '..x...x...x...x.'}},
    },
    'form': [
        {'sec': 'A', 'crash': True, 'play': ['whistle', 'banjo', 'guitar', 'bass', 'drums']},
        {'sec': 'A', 'play': ['whistle', 'piccolo', 'banjo', 'guitar', 'bass', 'drums', 'glock']},
        {'sec': 'B', 'crash': True, 'play': ['fiddle', 'guitar', 'bass', 'drums', 'tamb', 'strings']},
        {'sec': 'A', 'crash': True, 'play': ['whistle', 'piccolo', 'banjo', 'guitar', 'bass', 'drums', 'tamb', 'glock', 'strings']},
    ],
}


# ═════════════════════════════ 2차: 멍뭉런 스테이지 · 밤 · 마을 · 놀이터 · 학교 · 미니게임 ═════════════════════════════
def _kit(kit=0, vel=92, fills=None, mix=None, **patterns):
    return {'kind': 'drums', 'kit': kit, 'vel': vel, 'volume': 100, 'reverb': 25, 'fills': fills, 'patterns': patterns, 'mix': mix or {}}


# ───────── 멍뭉런 ② 햇살 바닷가: 스틸드럼 칼립소 (G장조, 원래 멍뭉런 멜로디) ─────────
SONGS['bgm_run_beach'] = {
    'bpm': 132, 'swing': 0.05, 'gain': 0.5, 'master': 1.5, 'seed': 11,
    'room': {'size': 0.45, 'level': 0.5, 'damp': 0.4},
    'sections': {
        'A': {
            'chords': 'G | C | Am7 | D | G | C | D7 | G',
            'melody': 'D5:0.5 G5:1 B5:0.5 -:0.5 A5:0.5 G5:1  E5:0.5 G5:1 A5:0.5 -:0.5 B5:1.5  C6:0.5 B5:0.5 A5:0.5 G5:1 E5:0.5 D5:1  E5:0.5 F#5:0.5 G5:0.5 A5:0.5 D5:2  D5:0.5 G5:1 B5:0.5 -:0.5 D6:0.5 B5:1  C6:0.5 E6:1 C6:0.5 -:0.5 B5:1.5  A5:0.5 B5:0.5 C6:0.5 B5:0.5 A5:0.5 F#5:0.5 D5:1  G5:1.5 B4:0.5 G5:1 -:1',
        },
        'B': {
            'chords': 'C | D | Bm | Em | C | D | Am7,D | G',
            'melody': 'E5:0.5 G5:0.5 C6:0.5 E6:1 D6:0.5 C6:1  D6:0.5 C6:0.5 A5:0.5 F#5:1 A5:0.5 D6:1  B5:1 F#5:0.5 D5:0.5 F#5:1 B5:1  G5:1.5 E5:0.5 B4:2  E5:0.5 G5:0.5 C6:0.5 E6:0.5 G6:1 E6:1  F#6:0.5 E6:0.5 D6:0.5 A5:0.5 F#5:1 A5:1  C6:1 B5:0.5 A5:0.5 F#5:1 D5:1  G5:2 -:2',
        },
    },
    'parts': {
        'steel': {'kind': 'melody', 'ch': 0, 'program': 114, 'vel': 96, 'volume': 104, 'pan': 58, 'reverb': 45},
        'flute': {'kind': 'melody', 'ch': 1, 'program': 73, 'vel': 70, 'volume': 80, 'pan': 80, 'reverb': 50, 'oct': 12},
        'marimba': {'kind': 'arp', 'ch': 2, 'program': 12, 'rate': 0.5, 'pattern': [0, 2, 1, 2, 3, 2, 1, 2], 'lo': 55, 'vel': 62, 'volume': 90, 'pan': 36, 'reverb': 35},
        'guitar': {'kind': 'strum', 'ch': 3, 'program': 24, 'pattern': '-xD--UD--xD--UD-', 'lo': 60, 'strings': 4, 'vel': 60, 'volume': 88, 'pan': 96, 'reverb': 30, 'spread': 0.012, 'ring': 1.4},
        'bass': {'kind': 'bass', 'ch': 5, 'program': 32, 'style': 'bounce', 'lo': 36, 'vel': 94, 'volume': 104, 'reverb': 20},
        'strings': {'kind': 'pad', 'ch': 7, 'program': 48, 'lo': 55, 'vel': 36, 'volume': 76, 'reverb': 70},
        'drums': _kit(0, 88, ['conga_hi', 'conga_hi', 'conga_lo', 'conga_lo'], {'hat': 0.5, 'clap': 0.7},
                      kick='X---x---X---x---', clap='------x-------x-', hat='x-x-x-x-x-x-x-x-',
                      conga_hi='--x--x----x--x--', conga_lo='x------x--x-----'),
        'congas': _kit(0, 80, None, None, conga_hi='--x--x----x--x--', conga_lo='x------x--x-----', shaker='.x.x.x.x.x.x.x.x'),
    },
    'form': [
        {'sec': 'A', 'play': ['steel', 'marimba', 'bass', 'congas']},
        {'sec': 'A', 'crash': True, 'play': ['steel', 'marimba', 'guitar', 'bass', 'drums']},
        {'sec': 'B', 'play': ['flute', 'steel', 'guitar', 'bass', 'drums', 'strings']},
        {'sec': 'A', 'crash': True, 'play': ['steel', 'flute', 'marimba', 'guitar', 'bass', 'drums', 'strings']},
    ],
}

# ───────── 멍뭉런 ③ 눈꽃 마을: 썰매 방울 · 첼레스타 · 오펌파 (C장조, 새 멜로디) ─────────
SONGS['bgm_run_snow'] = {
    'bpm': 138, 'gain': 0.5, 'master': 1.5, 'seed': 13,
    'room': {'size': 0.65, 'level': 0.6, 'damp': 0.3},
    'sections': {
        'A': {
            'chords': 'C | Am | F | G | C | Am | Dm7,G | C',
            'melody': 'G5:0.5 C6:0.5 E6:0.5 G6:0.5 E6:1 C6:1  A5:0.5 C6:0.5 E6:0.5 A6:0.5 G6:1 E6:1  F6:0.5 E6:0.5 D6:0.5 C6:0.5 A5:1 C6:1  B5:0.5 D6:0.5 G6:1 F6:0.5 D6:0.5 B5:1  C6:0.5 E6:0.5 G6:0.5 C7:0.5 B6:1 G6:1  A6:0.5 G6:0.5 E6:0.5 C6:0.5 E6:2  F6:1 E6:0.5 D6:0.5 B5:1 D6:1  C6:2 -:2',
        },
        'B': {
            'chords': 'F | G | Em | Am | Dm | G | Em,Am | Dm7,G',
            'melody': 'A5:1 C6:1 F6:1.5 E6:0.5  D6:1 B5:1 G5:2  G5:0.5 B5:0.5 E6:0.5 G6:0.5 E6:1 B5:1  C6:1 E6:1 A6:2  F6:0.5 E6:0.5 D6:0.5 A5:0.5 F5:1 A5:1  B5:0.5 C6:0.5 D6:0.5 G6:0.5 F6:1 D6:1  E6:1 G6:1 A6:1 E6:1  D6:1 F6:0.5 E6:0.5 D6:1 B5:1',
        },
    },
    'parts': {
        'celesta': {'kind': 'melody', 'ch': 0, 'program': 8, 'vel': 100, 'volume': 108, 'pan': 58, 'reverb': 60, 'oct': -12},
        'glock': {'kind': 'melody', 'ch': 1, 'program': 9, 'vel': 72, 'volume': 82, 'pan': 82, 'reverb': 65},
        'horn': {'kind': 'melody', 'ch': 2, 'program': 60, 'vel': 84, 'volume': 92, 'pan': 52, 'reverb': 55, 'oct': -12},
        'pizz': {'kind': 'arp', 'ch': 3, 'program': 45, 'rate': 0.5, 'pattern': [0, 2, 1, 2], 'lo': 55, 'vel': 70, 'volume': 92, 'pan': 38, 'reverb': 50},
        'tuba': {'kind': 'bass', 'ch': 5, 'program': 58, 'style': 'country', 'lo': 33, 'vel': 92, 'volume': 100, 'reverb': 30},
        'strings': {'kind': 'pad', 'ch': 7, 'program': 48, 'lo': 55, 'vel': 40, 'volume': 80, 'reverb': 75, 'chorus': 20},
        'drums': _kit(0, 90, ['snare', 'snare', 'snare', 'snare'], {'jingle': 0.75, 'snare': 0.8},
                      kick='X---x---X---x---', snare='----X-------X---', jingle='x.x.x.x.x.x.x.x.'),
        'bells': _kit(0, 80, None, None, jingle='x.x.x.x.x.x.x.x.', triangle='x---------------'),
    },
    'form': [
        {'sec': 'A', 'play': ['celesta', 'pizz', 'tuba', 'bells']},
        {'sec': 'A', 'crash': True, 'play': ['celesta', 'glock', 'pizz', 'tuba', 'drums']},
        {'sec': 'B', 'play': ['horn', 'pizz', 'tuba', 'drums', 'strings']},
        {'sec': 'A', 'crash': True, 'play': ['celesta', 'glock', 'pizz', 'tuba', 'drums', 'strings']},
    ],
}

# ───────── 멍뭉런 ④ 사탕 나라: 통통 신스팝 (E장조, 원래 멍뭉런 멜로디) ─────────
SONGS['bgm_run_candy'] = {
    'bpm': 152, 'gain': 0.5, 'master': 1.5, 'seed': 17,
    'room': {'size': 0.4, 'level': 0.45, 'damp': 0.5},
    'sections': {
        'A': {
            'chords': 'E | A,B | B7 | B,E | E,C#m | A,B | A,B | E',
            'melody': 'B5:0.5 G#5:0.5 E5:0.5 G#5:0.5 B5:0.5 E6:0.5 D#6:0.5 B5:0.5  C#6:0.5 B5:0.5 A5:0.5 G#5:0.5 F#5:2  A5:0.5 F#5:0.5 D#5:0.5 F#5:0.5 A5:0.5 D#6:0.5 C#6:0.5 A5:0.5  B5:0.5 A5:0.5 G#5:0.5 F#5:0.5 E5:2  E6:0.5 B5:0.5 G#5:0.5 B5:0.5 E6:0.5 F#6:0.5 G#6:1  F#6:0.5 E6:0.5 D#6:0.5 C#6:0.5 B5:2  C#6:0.5 D#6:0.5 E6:0.5 C#6:0.5 B5:0.5 A5:0.5 G#5:0.5 F#5:0.5  E5:1 B4:0.5 E5:0.5 E5:1 -:1',
        },
        'B': {
            'chords': 'A | B | G#m | C#m | A | B | F#m7,B | E',
            'melody': 'C#6:0.5 E6:0.5 A6:1 G#6:0.5 F#6:0.5 E6:1  D#6:0.5 F#6:0.5 B6:1 A6:0.5 G#6:0.5 F#6:1  G#6:1 D#6:0.5 B5:0.5 G#5:1 B5:1  C#6:0.5 D#6:0.5 E6:0.5 G#6:0.5 E6:2  A5:0.5 C#6:0.5 E6:0.5 C#6:0.5 A6:1 E6:1  F#6:0.5 D#6:0.5 B5:0.5 D#6:0.5 F#6:1 B6:1  A6:1 G#6:0.5 F#6:0.5 E6:1 D#6:1  E6:2 -:2',
        },
    },
    'parts': {
        'synth': {'kind': 'melody', 'ch': 0, 'program': 80, 'vel': 78, 'volume': 82, 'pan': 58, 'reverb': 40, 'oct': -12, 'legato': 0.7},
        'toy': {'kind': 'melody', 'ch': 1, 'program': 10, 'vel': 90, 'volume': 96, 'pan': 72, 'reverb': 45},
        'xylo': {'kind': 'arp', 'ch': 2, 'program': 13, 'rate': 0.5, 'pattern': [0, 1, 2, 3, 2, 1, 0, 2], 'lo': 64, 'vel': 62, 'volume': 88, 'pan': 36, 'reverb': 30},
        'bass': {'kind': 'bass', 'ch': 5, 'program': 38, 'style': 'octave', 'lo': 36, 'vel': 92, 'volume': 100, 'reverb': 15},
        'pad': {'kind': 'pad', 'ch': 7, 'program': 89, 'lo': 56, 'vel': 40, 'volume': 76, 'reverb': 60, 'chorus': 50},
        'drums': _kit(25, 96, ['clap', 'clap', 'clap', 'clap'], {'hat': 0.6},
                      kick='X---X---X---X---', clap='----X-------X---', hat='--x---x---x---x-'),
        'light': _kit(25, 80, None, None, kick='X-------X-------', hat='--x---x---x---x-'),
    },
    'form': [
        {'sec': 'A', 'play': ['toy', 'xylo', 'bass', 'light']},
        {'sec': 'A', 'crash': True, 'play': ['synth', 'toy', 'xylo', 'bass', 'drums']},
        {'sec': 'B', 'play': ['synth', 'xylo', 'bass', 'drums', 'pad']},
        {'sec': 'A', 'crash': True, 'play': ['synth', 'toy', 'xylo', 'bass', 'drums', 'pad']},
    ],
}

# ───────── 우리집 (밤): 오르골 자장가 (C장조, 66bpm, 드럼 없음) ─────────
SONGS['bgm_home_night'] = {
    'bpm': 66, 'gain': 0.55, 'master': 1.5, 'seed': 19,
    'room': {'size': 0.8, 'level': 0.8, 'damp': 0.25},
    'sections': {
        'A': {
            'chords': 'C | Em | F | C | Am | Dm | G | C',
            'melody': 'E5:2 G5:2  G5:1 E5:1 B4:2  A4:1 C5:1 F5:2  E5:4  C5:1 E5:1 A5:2  F5:1 E5:1 D5:2  B4:1 D5:1 G5:1 F5:1  E5:2 C5:2',
        },
        'B': {
            'chords': 'F | C | F | C | Dm | Am | F,G | C',
            'melody': 'A5:2 C6:2  G5:2 E5:2  F5:1 A5:1 C6:1 A5:1  G5:4  F5:2 D5:2  E5:2 C5:2  A4:2 B4:2  C5:4',
        },
    },
    'parts': {
        'box': {'kind': 'melody', 'ch': 0, 'program': 10, 'vel': 84, 'volume': 104, 'pan': 60, 'reverb': 80, 'oct': 12, 'legato': 1.5},
        'flute': {'kind': 'melody', 'ch': 1, 'program': 73, 'vel': 62, 'volume': 84, 'pan': 70, 'reverb': 80},
        'harp': {'kind': 'arp', 'ch': 2, 'program': 46, 'rate': 0.5, 'pattern': [0, 1, 2, 3, 2, 1, 0, 1], 'lo': 55, 'vel': 48, 'volume': 88, 'pan': 44, 'reverb': 75},
        'piano': {'kind': 'bass', 'ch': 3, 'program': 0, 'style': 'root', 'lo': 40, 'vel': 56, 'volume': 90, 'reverb': 70},
        'strings': {'kind': 'pad', 'ch': 7, 'program': 49, 'lo': 53, 'vel': 34, 'volume': 82, 'reverb': 85, 'chorus': 30},
    },
    'form': [
        {'sec': 'A', 'play': ['box', 'harp', 'piano']},
        {'sec': 'B', 'play': ['box', 'harp', 'piano', 'strings']},
        {'sec': 'A', 'play': ['flute', 'harp', 'piano', 'strings']},
        {'sec': 'B', 'play': ['box', 'flute', 'harp', 'piano', 'strings']},
    ],
}

# ───────── 마을 산책: 아코디언 · 마림바 · 기타 (D장조, 108bpm) ─────────
SONGS['bgm_village'] = {
    'bpm': 108, 'swing': 0.06, 'gain': 0.5, 'master': 1.5, 'seed': 23,
    'room': {'size': 0.5, 'level': 0.5, 'damp': 0.4},
    'sections': {
        'A': {
            'chords': 'D | G | D | A | D | G | Em7,A | D',
            'melody': 'F#5:1 A5:0.5 F#5:0.5 D5:1 E5:1  G5:1.5 B5:0.5 A5:1 G5:1  F#5:0.5 G5:0.5 A5:1 D6:1 A5:1  G5:1 F#5:0.5 E5:0.5 E5:2  F#5:1 A5:0.5 F#5:0.5 D5:1 E5:1  G5:1.5 B5:0.5 D6:1 B5:1  A5:1 G5:0.5 E5:0.5 C#5:1 E5:1  D5:2 -:2',
        },
        'B': {
            'chords': 'Bm | G | D | A | Bm | G | Em | A7',
            'melody': 'D6:1 C#6:0.5 B5:0.5 F#5:2  G5:0.5 A5:0.5 B5:1 D6:1 B5:1  A5:1.5 F#5:0.5 D5:2  E5:0.5 F#5:0.5 G5:0.5 A5:0.5 C#6:2  D6:1 F#6:0.5 E6:0.5 D6:1 B5:1  B5:1 D6:0.5 B5:0.5 G5:2  G5:0.5 F#5:0.5 E5:0.5 G5:0.5 B5:1 E6:1  C#6:1 E6:1 G5:1 A5:1',
        },
    },
    'parts': {
        'marimba': {'kind': 'melody', 'ch': 0, 'program': 12, 'vel': 100, 'volume': 104, 'pan': 54, 'reverb': 40},
        'accordion': {'kind': 'melody', 'ch': 1, 'program': 21, 'vel': 76, 'volume': 88, 'pan': 70, 'reverb': 45},
        'whistle': {'kind': 'melody', 'ch': 2, 'program': 78, 'vel': 84, 'volume': 90, 'pan': 62, 'reverb': 50, 'oct': -12},
        'guitar': {'kind': 'strum', 'ch': 3, 'program': 25, 'pattern': 'D-DU-UDU', 'lo': 52, 'strings': 5, 'vel': 58, 'volume': 90, 'pan': 36, 'reverb': 35, 'spread': 0.016},
        'bass': {'kind': 'bass', 'ch': 5, 'program': 32, 'style': 'country', 'lo': 36, 'vel': 90, 'volume': 104, 'reverb': 20},
        'glock': {'kind': 'sparkle', 'ch': 6, 'program': 9, 'lo': 81, 'vel': 52, 'volume': 80, 'pan': 96, 'reverb': 65},
        'drums': _kit(0, 80, None, {'stick': 0.7, 'shaker': 0.6}, kick='x-------x-------', stick='----x-------x---', shaker='..x...x...x...x.'),
    },
    'form': [
        {'sec': 'A', 'play': ['marimba', 'guitar', 'bass', 'drums']},
        {'sec': 'A', 'play': ['accordion', 'marimba', 'guitar', 'bass', 'drums', 'glock']},
        {'sec': 'B', 'play': ['whistle', 'guitar', 'bass', 'drums']},
        {'sec': 'A', 'play': ['accordion', 'guitar', 'bass', 'drums', 'glock']},
    ],
}

# ───────── 멍뭉 놀이터: 통통 셔플 (G장조, 118bpm) ─────────
SONGS['bgm_plaza'] = {
    'bpm': 118, 'swing': 0.14, 'gain': 0.5, 'master': 1.5, 'seed': 29,
    'room': {'size': 0.45, 'level': 0.45, 'damp': 0.45},
    'sections': {
        'A': {
            'chords': 'G | Em | C | D | G | Em | C,D | G',
            'melody': 'D5:0.5 G5:0.5 B5:1 A5:0.5 G5:0.5 D5:1  E5:0.5 G5:0.5 B5:1 G5:1 E5:1  E5:0.5 G5:0.5 C6:1 B5:0.5 A5:0.5 G5:1  F#5:1 A5:1 D5:2  D5:0.5 G5:0.5 B5:1 D6:1 B5:1  E6:1 D6:0.5 B5:0.5 G5:2  E5:1 G5:1 F#5:1 A5:1  G5:2 -:2',
        },
        'B': {
            'chords': 'C | D | Bm | Em | Am | D | G,Em | Am,D',
            'melody': 'E5:1 G5:0.5 E5:0.5 C5:2  F#5:1 A5:0.5 F#5:0.5 D5:2  B4:0.5 D5:0.5 F#5:1 B5:1 A5:1  G5:1 E5:1 B4:2  C5:0.5 E5:0.5 A5:1 G5:0.5 E5:0.5 C5:1  D5:0.5 F#5:0.5 A5:1 C6:1 A5:1  B5:1 G5:1 E5:1 G5:1  A5:1 C6:1 B5:0.5 A5:0.5 F#5:1',
        },
    },
    'parts': {
        'whistle': {'kind': 'melody', 'ch': 0, 'program': 78, 'vel': 88, 'volume': 96, 'pan': 60, 'reverb': 40, 'oct': -12},
        'toy': {'kind': 'melody', 'ch': 1, 'program': 8, 'vel': 86, 'volume': 92, 'pan': 74, 'reverb': 45},
        'clarinet': {'kind': 'melody', 'ch': 2, 'program': 71, 'vel': 84, 'volume': 92, 'pan': 66, 'reverb': 45},
        'uke': {'kind': 'strum', 'ch': 3, 'program': 24, 'pattern': 'D-DU-UDU', 'lo': 62, 'strings': 4, 'vel': 62, 'volume': 92, 'pan': 34, 'reverb': 30, 'spread': 0.01, 'ring': 1.2},
        'bass': {'kind': 'bass', 'ch': 5, 'program': 32, 'style': 'walk', 'lo': 36, 'vel': 92, 'volume': 104, 'reverb': 20},
        'drums': _kit(0, 86, ['tom_hi', 'tom_hi', 'tom_lo', 'tom_lo'], {'hat': 0.5, 'clap': 0.8},
                      kick='x-----x-x-------', clap='----x-------x---', hat='x.x.x.x.x.x.x.x.'),
    },
    'form': [
        {'sec': 'A', 'play': ['whistle', 'uke', 'bass', 'drums']},
        {'sec': 'B', 'play': ['clarinet', 'uke', 'bass', 'drums']},
        {'sec': 'A', 'crash': True, 'play': ['whistle', 'toy', 'uke', 'bass', 'drums']},
        {'sec': 'B', 'play': ['toy', 'clarinet', 'uke', 'bass', 'drums']},
    ],
}

# ───────── 학교 · 훈련: 꼬마 행진곡 (D장조, 116bpm) ─────────
SONGS['bgm_school'] = {
    'bpm': 116, 'gain': 0.5, 'master': 1.5, 'seed': 31,
    'room': {'size': 0.55, 'level': 0.5, 'damp': 0.4},
    'sections': {
        'A': {
            'chords': 'D | A | D | G,A | D | Bm | Em,A | D',
            'melody': 'A4:1 D5:1 F#5:1 A5:1  E5:1.5 C#5:0.5 A4:2  F#5:1 A5:1 D6:1.5 A5:0.5  B5:1 G5:1 E5:1 C#5:1  D5:1 F#5:0.5 A5:0.5 D6:1 A5:1  B5:1.5 A5:0.5 F#5:1 D5:1  G5:1 B5:1 A5:1 C#6:1  D6:2 -:2',
        },
        'B': {
            'chords': 'G | D | A | D | G | D | Em | A',
            'melody': 'B5:1 G5:1 D5:2  A5:1 F#5:1 D5:2  C#5:1 E5:1 A5:2  F#5:1 A5:0.5 F#5:0.5 D5:2  G5:0.5 A5:0.5 B5:1 D6:1 B5:1  A5:1 F#5:1 D5:1 F#5:1  G5:1 B5:1 E5:1 G5:1  A5:2 E5:2',
        },
    },
    'parts': {
        'clarinet': {'kind': 'melody', 'ch': 0, 'program': 71, 'vel': 92, 'volume': 100, 'pan': 56, 'reverb': 45},
        'flute': {'kind': 'melody', 'ch': 1, 'program': 73, 'vel': 76, 'volume': 88, 'pan': 74, 'reverb': 50, 'oct': 12},
        'trumpet': {'kind': 'melody', 'ch': 2, 'program': 56, 'vel': 80, 'volume': 88, 'pan': 62, 'reverb': 45},
        'pizz': {'kind': 'arp', 'ch': 3, 'program': 45, 'rate': 1, 'pattern': [None, 1, None, 2], 'lo': 57, 'vel': 72, 'volume': 92, 'pan': 40, 'reverb': 45},
        'tuba': {'kind': 'bass', 'ch': 5, 'program': 58, 'style': 'country', 'lo': 33, 'vel': 92, 'volume': 102, 'reverb': 30},
        'glock': {'kind': 'sparkle', 'ch': 6, 'program': 9, 'lo': 81, 'vel': 54, 'volume': 80, 'pan': 96, 'reverb': 60},
        'drums': _kit(48, 86, ['snare', 'snare', 'snare', 'snare'], {'snare': 0.75}, kick='x-------x-------', snare='----x--.----x.xx'),
    },
    'form': [
        {'sec': 'A', 'play': ['clarinet', 'pizz', 'tuba', 'drums']},
        {'sec': 'B', 'play': ['flute', 'clarinet', 'pizz', 'tuba', 'drums', 'glock']},
        {'sec': 'A', 'crash': True, 'play': ['trumpet', 'clarinet', 'pizz', 'tuba', 'drums', 'glock']},
        {'sec': 'B', 'play': ['flute', 'pizz', 'tuba', 'drums']},
    ],
}

# ───────── 미니게임 (간식 · 줄넘기 · 협동): 신나는 업템포 (C장조, 140bpm) ─────────
SONGS['bgm_minigame'] = {
    'bpm': 140, 'gain': 0.5, 'master': 1.5, 'seed': 37,
    'room': {'size': 0.4, 'level': 0.45, 'damp': 0.45},
    'sections': {
        'A': {
            'chords': 'C | F,G | Am,Em | G,C',
            'melody': 'C5:0.5 E5:0.5 G5:0.5 E5:0.5 C6:1 G5:1  A5:0.5 G5:0.5 F5:0.5 E5:0.5 D5:2  E5:0.5 F5:0.5 G5:0.5 A5:0.5 G5:1 E5:1  F5:0.5 E5:0.5 D5:0.5 B4:0.5 C5:2',
        },
        'B': {
            'chords': 'F | G | Em | Am | F | G | C | C',
            'melody': 'A5:0.5 C6:0.5 A5:0.5 F5:0.5 C6:1 A5:1  B5:0.5 D6:0.5 B5:0.5 G5:0.5 D6:2  G5:0.5 B5:0.5 E6:1 D6:0.5 B5:0.5 G5:1  A5:0.5 C6:0.5 E6:1 C6:1 A5:1  F5:0.5 A5:0.5 C6:0.5 A5:0.5 F5:1 C6:1  D6:1 B5:1 G5:1 D6:1  E6:1 C6:0.5 G5:0.5 E5:1 G5:1  C6:2 -:2',
        },
    },
    'parts': {
        'xylo': {'kind': 'melody', 'ch': 0, 'program': 13, 'vel': 100, 'volume': 104, 'pan': 56, 'reverb': 35},
        'trumpet': {'kind': 'melody', 'ch': 1, 'program': 56, 'vel': 84, 'volume': 90, 'pan': 68, 'reverb': 40, 'oct': -12},
        'guitar': {'kind': 'strum', 'ch': 3, 'program': 25, 'pattern': 'D-DUxUDU', 'lo': 52, 'strings': 5, 'vel': 62, 'volume': 90, 'pan': 36, 'reverb': 30, 'spread': 0.012, 'ring': 1.2},
        'bass': {'kind': 'bass', 'ch': 5, 'program': 33, 'style': 'octave', 'lo': 36, 'vel': 92, 'volume': 102, 'reverb': 15},
        'glock': {'kind': 'sparkle', 'ch': 6, 'program': 9, 'lo': 84, 'vel': 56, 'volume': 80, 'pan': 96, 'reverb': 55},
        'drums': _kit(0, 92, ['snare', 'snare', 'tom_hi', 'tom_lo'], {'hat': 0.55},
                      kick='X---x---X---x---', snare='----X-------X---', hat='--x---x---x---x-', tamb='..x...x...x...x.'),
    },
    'form': [
        {'sec': 'A', 'crash': True, 'play': ['xylo', 'guitar', 'bass', 'drums']},
        {'sec': 'A', 'play': ['xylo', 'guitar', 'bass', 'drums', 'glock']},
        {'sec': 'B', 'crash': True, 'play': ['trumpet', 'xylo', 'guitar', 'bass', 'drums']},
        {'sec': 'A', 'crash': True, 'play': ['xylo', 'trumpet', 'guitar', 'bass', 'drums', 'glock']},
    ],
}
