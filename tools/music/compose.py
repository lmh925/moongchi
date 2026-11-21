#!/usr/bin/env python3
"""멍뭉고치 배경음 작곡기

곡을 코드 진행 + 멜로디 문자열로 적으면, 악기별 연주(스트럼 · 아르페지오 · 베이스 · 드럼)를
만들어 MIDI로 쓰고, 실제 악기 녹음 음원(GeneralUser GS 사운드폰트)으로 렌더링해요.

끊김 없는 반복(루프): 곡을 두 번 연주해서 녹음한 뒤 두 번째 바퀴만 잘라요.
그러면 첫 바퀴의 울림(리버브 꼬리)이 두 번째 바퀴 시작에 자연스럽게 겹쳐서 이음새가 안 들려요.

사용법: python3 compose.py <곡 이름|all> <출력 폴더> [사운드폰트 경로]
"""
import math
import os
import random
import subprocess
import sys

import mido

from songs import SONGS

TPB = 480
TARGET_LUFS = -16.0
SEMI = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
QUALITY = {
    '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
    'sus4': [0, 5, 7], 'sus2': [0, 2, 7], 'dim': [0, 3, 6], 'add9': [0, 4, 7, 14], '6': [0, 4, 7, 9],
}
DRUM = {
    'kick': 36, 'stick': 37, 'snare': 38, 'clap': 39, 'snare2': 40, 'hat': 42, 'phat': 44, 'ohat': 46,
    'crash': 49, 'ride': 51, 'tamb': 54, 'cabasa': 69, 'maracas': 70, 'conga_hi': 63, 'conga_lo': 64,
    'bongo_hi': 60, 'bongo_lo': 61, 'wood': 76, 'triangle': 81, 'shaker': 82, 'jingle': 83, 'tom_lo': 45, 'tom_hi': 50,
}


def midi_of(name):
    letter, rest = name[0], name[1:]
    acc = 0
    if rest and rest[0] in '#b':
        acc = 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return (int(rest) + 1) * 12 + SEMI[letter] + acc


def chord_of(sym):
    letter, rest = sym[0], sym[1:]
    acc = 0
    if rest and rest[0] in '#b':
        acc = 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return (SEMI[letter] + acc) % 12, QUALITY.get(rest, QUALITY[''])


def at_least(pc, lo):
    """음이름(pc)을 lo 이상에서 가장 낮은 음으로"""
    return lo + ((pc - lo) % 12)


def parse_line(s):
    out = []
    for tok in s.split():
        n, _, l = tok.partition(':')
        out.append((None if n == '-' else midi_of(n), float(l or 1)))
    return out


class Song:
    def __init__(self, spec, seed=7):
        self.s = spec
        self.meter = spec.get('meter', 4)
        self.swing = spec.get('swing', 0.0)
        self.rng = random.Random(seed)
        self.events = []  # (beat, channel, note, vel, length_beats)
        self.cc = []

    def sw(self, b):
        # 8분음표 엇박을 살짝 뒤로 (스윙)
        f = b % 1
        if abs(f - 0.5) < 1e-6:
            return b + self.swing
        return b

    def human(self, b, amt=0.012):
        return b + self.rng.uniform(-amt, amt)

    def vel(self, v, spread=8):
        return max(1, min(127, int(v + self.rng.uniform(-spread, spread))))

    def note(self, b, ch, m, v, l, human=True):
        # 드럼은 박자가 흔들리면 엉성하게 들려서 아주 조금만 흔들어요
        bb = self.human(self.sw(b), 0.004 if ch == 9 else 0.012) if human else self.sw(b)
        self.events.append((max(0.0, bb), ch, m, self.vel(v) if human else v, max(0.05, l)))

    # ---------- 파트별 생성 ----------
    def part_melody(self, part, sec, bar0, mel, shift=0):
        b = bar0 * self.meter
        for m, l in parse_line(mel):
            if m is not None:
                self.note(b, part['ch'], m + shift + part.get('oct', 0), part.get('vel', 90), l * part.get('legato', 0.92))
                if part.get('double'):
                    self.note(b, part['ch'], m + shift + part.get('oct', 0) + part['double'], part.get('vel', 90) - 18, l * 0.9)
            b += l

    def chords_in(self, sec):
        bars = [[c.strip() for c in bar.split(',')] for bar in sec['chords'].split('|')]
        for bi, chs in enumerate(bars):
            per = self.meter / len(chs)
            for ci, sym in enumerate(chs):
                yield bi, ci * per, per, sym

    def part_strum(self, part, sec, bar0):
        # 기타·우쿨렐레 스트럼: 패턴의 D(내려치기)/U(올려치기)/x(뮤트)/-(쉼)
        pat = part.get('pattern', 'D-DU-UDU')
        step = self.meter / len(pat) if part.get('per_bar', True) else 0.5
        lo = part.get('lo', 52)
        for bi, off, per, sym in self.chords_in(sec):
            root, ivs = chord_of(sym)
            base = at_least(root, lo)
            voicing = sorted({base + iv for iv in ivs} | {base + 12})[:part.get('strings', 5)]
            k = 0
            t = 0.0
            while t < per - 1e-6:
                ch = pat[int(round((off + t) / step)) % len(pat)]
                bt = (bar0 + bi) * self.meter + off + t
                if ch in 'DU':
                    order = voicing if ch == 'D' else list(reversed(voicing))
                    v = part.get('vel', 70) * (1.0 if ch == 'D' else 0.78)
                    for i, m in enumerate(order):
                        self.note(bt + i * part.get('spread', 0.018), part['ch'], m, v, step * part.get('ring', 1.8))
                elif ch == 'x':
                    for m in voicing[:3]:
                        self.note(bt, part['ch'], m, 30, 0.06)
                t += step
                k += 1

    def part_arp(self, part, sec, bar0):
        rate = part.get('rate', 0.5)
        pat = part.get('pattern', [0, 1, 2, 1])
        lo = part.get('lo', 60)
        for bi, off, per, sym in self.chords_in(sec):
            root, ivs = chord_of(sym)
            base = at_least(root, lo)
            tones = [base + iv for iv in ivs] + [base + 12, base + ivs[1] + 12]
            n = int(round(per / rate))
            for k in range(n):
                idx = pat[k % len(pat)]
                if idx is None:
                    continue
                v = part.get('vel', 60) * (1.0 if k % 2 == 0 else 0.82)
                self.note((bar0 + bi) * self.meter + off + k * rate, part['ch'], tones[idx % len(tones)], v, rate * part.get('ring', 1.5))

    def part_pad(self, part, sec, bar0):
        lo = part.get('lo', 53)
        for bi, off, per, sym in self.chords_in(sec):
            root, ivs = chord_of(sym)
            base = at_least(root, lo)
            for iv in ivs[:4]:
                self.note((bar0 + bi) * self.meter + off, part['ch'], base + iv, part.get('vel', 50), per * 0.98, human=False)

    def part_bass(self, part, sec, bar0):
        style = part.get('style', 'root')
        lo = part.get('lo', 36)
        chords = list(self.chords_in(sec))
        for i, (bi, off, per, sym) in enumerate(chords):
            root, ivs = chord_of(sym)
            r = at_least(root, lo)
            fifth = r + 7 if r + 7 <= lo + 14 else r - 5
            third = r + ivs[1]
            nxt = chords[(i + 1) % len(chords)]
            nr = at_least(chord_of(nxt[3])[0], lo)
            b0 = (bar0 + bi) * self.meter + off
            v = part.get('vel', 92)
            if style == 'root':
                self.note(b0, part['ch'], r, v, per * 0.9)
            elif style == 'half':
                h = per / 2
                self.note(b0, part['ch'], r, v, h * 0.9)
                self.note(b0 + h, part['ch'], fifth, v - 10, h * 0.85)
            elif style == 'country':  # 붐-칙: 1·3박 근음/5음
                for k in range(int(per)):
                    self.note(b0 + k, part['ch'], r if k % 2 == 0 else fifth, v - (0 if k % 2 == 0 else 8), 0.7)
            elif style == 'walk':  # 4분음표 걷는 베이스, 마지막 박은 다음 코드로 이어지는 반음
                notes = [r, third, fifth, nr - 1 if nr > r else nr + 1]
                for k in range(int(per)):
                    self.note(b0 + k, part['ch'], notes[k % 4] if per >= 4 else (r if k == 0 else fifth), v - (k % 2) * 8, 0.85)
            elif style == 'octave':
                for k in range(int(per * 2)):
                    self.note(b0 + k * 0.5, part['ch'], r + (12 if k % 2 else 0), v - (k % 2) * 10, 0.42)
            elif style == 'bounce':  # 8분음표 통통 (1, 2&, 3, 4)
                for o, m in [(0, r), (1.5, r), (2, fifth), (3, r + 12)]:
                    if o < per:
                        self.note(b0 + o, part['ch'], m, v - (0 if o in (0, 2) else 10), 0.45)
            elif style == 'waltz':
                self.note(b0, part['ch'], r, v, 0.9)

    def part_drums(self, part, sec, bar0, bars):
        steps = self.meter * 4
        pats = part['patterns']
        for bi in range(bars):
            for name, pat in pats.items():
                for s in range(steps):
                    c = pat[s % len(pat)]
                    if c == '-':
                        continue
                    acc = {'X': 1.0, 'x': 0.78, '.': 0.5}.get(c, 0.78)
                    self.note((bar0 + bi) * self.meter + s / 4, 9, DRUM[name], part.get('vel', 100) * acc * part.get('mix', {}).get(name, 1.0), 0.1)
            # 마디 끝 필인 (4마디마다)
            if part.get('fills') and (bi + 1) % 4 == 0:
                for k, nm in enumerate(part['fills']):
                    self.note((bar0 + bi) * self.meter + self.meter - 1 + k * 0.25, 9, DRUM[nm], part.get('vel', 100) * 0.8, 0.1)

    def part_sparkle(self, part, sec, bar0):
        # 글로켄슈필 반짝: 두 마디마다 마지막 박에 코드음 셋을 톡톡톡
        for bi, off, per, sym in self.chords_in(sec):
            if off != 0 or bi % 2 == 0:
                continue
            root, ivs = chord_of(sym)
            base = at_least(root, part.get('lo', 79))
            for k, iv in enumerate(ivs[:3]):
                self.note((bar0 + bi) * self.meter + self.meter - 1 + k * 0.33, part['ch'], base + iv, part.get('vel', 60), 0.6)

    # ---------- 곡 전체 ----------
    def build(self):
        parts = self.s['parts']
        bar0 = 0
        for entry in self.s['form']:
            sec_name = entry if isinstance(entry, str) else entry['sec']
            opts = {} if isinstance(entry, str) else entry
            sec = self.s['sections'][sec_name]
            bars = len(sec['chords'].split('|'))
            play = opts.get('play')  # 이 구간에 연주할 파트 이름들 (없으면 전부)
            for pname, part in parts.items():
                if play is not None and pname not in play:
                    continue
                kind = part['kind']
                if kind == 'melody':
                    mel = sec.get(part.get('line', 'melody'))
                    if mel and (part.get('lead_in') is None or sec_name in part['lead_in']):
                        self.part_melody(part, sec, bar0, mel)
                elif kind == 'strum':
                    self.part_strum(part, sec, bar0)
                elif kind == 'arp':
                    self.part_arp(part, sec, bar0)
                elif kind == 'pad':
                    self.part_pad(part, sec, bar0)
                elif kind == 'bass':
                    self.part_bass(part, sec, bar0)
                elif kind == 'drums':
                    self.part_drums(part, sec, bar0, bars)
                elif kind == 'sparkle':
                    self.part_sparkle(part, sec, bar0)
            # 구간 시작 크래시
            if opts.get('crash'):
                self.note(bar0 * self.meter, 9, DRUM['crash'], 80, 1)
            bar0 += bars
        self.bars = bar0
        return self

    def check(self):
        errs = []
        for name, sec in self.s['sections'].items():
            bars = len(sec['chords'].split('|'))
            for key in [k for k in sec if k != 'chords']:
                total = sum(l for _, l in parse_line(sec[key]))
                if abs(total - bars * self.meter) > 1e-6:
                    errs.append(f"{name}.{key}: 멜로디 {total}박 ≠ {bars}마디×{self.meter}박")
        return errs

    def to_midi(self, path, passes=2, tail_beats=8):
        loop_beats = self.bars * self.meter
        mid = mido.MidiFile(ticks_per_beat=TPB)
        msgs = []  # (tick, order, msg)
        msgs.append((0, 0, mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.s['bpm']))))
        msgs.append((0, 0, mido.MetaMessage('time_signature', numerator=self.meter, denominator=4)))
        for pname, part in self.s['parts'].items():
            ch = part.get('ch', 9)
            if part['kind'] == 'drums':
                msgs.append((0, 1, mido.Message('program_change', channel=9, program=part.get('kit', 0))))
            else:
                msgs.append((0, 1, mido.Message('program_change', channel=ch, program=part['program'])))
            for cc, val in ((7, part.get('volume', 100)), (10, part.get('pan', 64)), (91, part.get('reverb', 50)), (93, part.get('chorus', 0))):
                msgs.append((0, 1, mido.Message('control_change', channel=ch, control=cc, value=val)))
        for p in range(passes):
            for b, ch, m, v, l in self.events:
                if not 0 <= m <= 127:
                    continue
                on = int(round((b + p * loop_beats) * TPB)) + TPB  # 앞에 한 박 여유
                off = on + max(1, int(round(l * TPB)))
                msgs.append((on, 3, mido.Message('note_on', channel=ch, note=m, velocity=v)))
                msgs.append((off, 2, mido.Message('note_off', channel=ch, note=m, velocity=0)))
        end = int((passes * loop_beats + tail_beats) * TPB) + TPB
        msgs.append((end, 9, mido.MetaMessage('end_of_track')))
        msgs.sort(key=lambda x: (x[0], x[1]))
        tr = mido.MidiTrack()
        last = 0
        for t, _, msg in msgs:
            msg.time = t - last
            last = t
            tr.append(msg)
        mid.tracks.append(tr)
        mid.save(path)
        sec_per_beat = 60 / self.s['bpm']
        return {'lead': sec_per_beat, 'loop': loop_beats * sec_per_beat}


def render(name, out_dir, sf2):
    spec = SONGS[name]
    song = Song(spec, seed=spec.get('seed', 7))
    errs = song.check()
    if errs:
        raise SystemExit('\n'.join(errs))
    song.build()
    os.makedirs(out_dir, exist_ok=True)
    mid_path = os.path.join(out_dir, f'{name}.mid')
    raw = os.path.join(out_dir, f'{name}.raw.wav')
    t = song.to_midi(mid_path)
    rv = spec.get('room', {})
    subprocess.run([
        'fluidsynth', '-ni', '-q', '-g', str(spec.get('gain', 0.5)), '-r', '44100', '-F', raw,
        '-o', f"synth.reverb.room-size={rv.get('size', 0.55)}",
        '-o', f"synth.reverb.level={rv.get('level', 0.6)}",
        '-o', f"synth.reverb.damp={rv.get('damp', 0.35)}",
        '-o', f"synth.reverb.width={rv.get('width', 0.9)}",
        '-o', 'synth.chorus.active=1',
        sf2, mid_path,
    ], check=True)
    # 두 바퀴 전체에 음량 정리(컴프레서 + 리미터)를 먼저 걸고, 두 번째 바퀴만 잘라요
    start = t['lead'] + t['loop']
    loop_wav = os.path.join(out_dir, f'{name}.wav')
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
        '-af', f"highpass=f=35,acompressor=threshold=-18dB:ratio=2.5:attack=15:release=250:makeup=2,volume={spec.get('master', 1.6)},alimiter=limit=0.89,atrim=start={start:.6f}:duration={t['loop']:.6f},asetpts=N/SR/TB",
        loop_wav,
    ], check=True)
    os.remove(raw)
    # 모든 곡의 체감 음량을 같게 (-16 LUFS). 고정 음량만 바꿔서 반복 이음새는 그대로예요
    meas = subprocess.run(['ffmpeg', '-hide_banner', '-i', loop_wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    lufs = float(meas.rsplit('I:', 1)[1].split('LUFS')[0])
    peak = float(meas.rsplit('Peak:', 1)[1].split('dBFS')[0])
    gain = min(TARGET_LUFS - lufs, -1.0 - peak)
    tmp = loop_wav + '.tmp.wav'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', loop_wav, '-af', f'volume={gain:.2f}dB', tmp], check=True)
    os.replace(tmp, loop_wav)
    # 들어 보기용: 반복 이음새가 들리도록 두 바퀴 이어 붙인 m4a
    preview = os.path.join(out_dir, f'{name}.preview.m4a')
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-stream_loop', '1', '-i', loop_wav,
        '-c:a', 'aac', '-b:a', '192k', preview,
    ], check=True)
    # 게임용: OGG (웹에서 끊김 없이 반복돼요)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', loop_wav, '-c:a', 'libvorbis', '-q:a', '5', os.path.join(out_dir, f'{name}.ogg')], check=True)
    return {'name': name, 'bars': song.bars, 'loop_sec': round(t['loop'], 2), 'notes': len(song.events), 'gain_db': round(gain, 1)}


if __name__ == '__main__':
    target, out = sys.argv[1], sys.argv[2]
    sf2 = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('SF2', 'GeneralUser-GS.sf2')
    names = list(SONGS) if target == 'all' else target.split(',')
    for n in names:
        print(render(n, out, sf2))
