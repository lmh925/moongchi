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
