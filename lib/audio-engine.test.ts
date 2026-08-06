import test from "node:test";
import assert from "node:assert/strict";
import { BGM_BASS, BGM_CHORDS, BGM_MELODY, midiToFrequency } from "./audio-engine";

test("오리지널 BGM 패턴은 완전한 32스텝 루프와 4개 화음을 가진다", () => {
  assert.equal(BGM_MELODY.length, 32);
  assert.equal(BGM_BASS.length, 8);
  assert.equal(BGM_CHORDS.length, 4);
  assert.equal(BGM_MELODY.some((note) => note === null), true);
});

test("MIDI 음높이를 Web Audio 주파수로 정확히 변환한다", () => {
  assert.equal(midiToFrequency(69), 440);
  assert.equal(Math.round(midiToFrequency(60) * 100) / 100, 261.63);
});
