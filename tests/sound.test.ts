import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Assets, SoundSystem } from '../src/assets';

test('global mute stops current audio, blocks new playback and preserves sound preferences', () => {
  const audios: FakeAudio[] = [];
  class FakeAudio {
    paused = true; volume = 0; loop = false;
    constructor(public src: string) { audios.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  Object.defineProperty(globalThis, 'Audio', { value: FakeAudio, configurable: true });
  try {
    const assets = new Assets();
    assets.manifest = { sprites: {}, cameos: {}, sounds: { test: 'test.wav' }, music: { hm2: { src: 'test-music.wav' } } };
    const sound = new SoundSystem(assets);
    sound.setMusic(true);
    assert.ok(sound.play('test'));
    assert.equal(audios.filter(audio => !audio.paused).length, 2);
    sound.setMuted(true);
    assert.ok(audios.every(audio => audio.paused));
    assert.equal(sound.play('test'), false);
    sound.setMusic(true);
    assert.ok(audios.every(audio => audio.paused));
    assert.equal(sound.enabled, true);
    assert.equal(sound.musicEnabled, true);
    sound.setMuted(false);
    assert.equal(audios[0].paused, false);
    assert.ok(sound.play('test'));
    sound.enabled = false; sound.setMusic(false);
    sound.setMuted(true); sound.setMuted(false);
    assert.equal(sound.enabled, false);
    assert.equal(sound.musicEnabled, false);
    assert.ok(audios.every(audio => audio.paused));
  } finally {
    if (original) Object.defineProperty(globalThis, 'Audio', original);
    else Reflect.deleteProperty(globalThis, 'Audio');
  }
});
