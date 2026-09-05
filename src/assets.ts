import { CATALOG } from './game/data';
import { OriginalAssetsError } from './asset-setup';

export interface Sprite {
  src: string; width: number; height: number; frameWidth: number; frameHeight: number;
  frames: number; columns: number; anchorX: number; anchorY: number; remapMaskSrc?: string; sequences?: Record<string, [number,number,number]>; facings?: number; foundation?: [number,number]; kind?: string;
}
export interface TerrainSprite {src:string;x:number;y:number;width:number;height:number;anchorX:number;anchorY:number}
export interface AssetManifest {
  sprites: Record<string, Sprite>;
  overlays?: Record<string,Sprite>;
  cameos?: Record<string, Sprite | string>;
  images?: Record<string, Sprite | string>;
  ui?: Record<string, {src:string;width:number;height:number}>;
  sounds?: Record<string, string | string[] | {src:string}>;
  music?: string | string[] | Record<string,{src:string}>;
  soundEvents?: Record<string, string[]>;
  unitVoices?: Record<string, Partial<Record<'voiceselect' | 'voicemove' | 'voiceattack' | 'diesound' | 'movesound', string>>>;
  source?: unknown;
  [key: string]: unknown;
}
export class Assets {
  manifest: AssetManifest = { sprites: {} };
  images = new Map<string, HTMLImageElement>();
  failures: string[] = [];
  terrain: Record<string,TerrainSprite> = {};
  scenery: Record<string,Sprite> = {};
  async load(onProgress?: (n: number) => void) {
    this.images.clear();this.failures=[];
    try {
      const response = await fetch('/assets/manifest.json');
      if (!response.ok) throw new OriginalAssetsError('缺少原版素材清单。');
      this.manifest = await response.json();
      const terrain = await fetch('/assets/terrain/manifest-tiles.json');if(!terrain.ok)throw new OriginalAssetsError('缺少原版地形素材。');this.terrain=await terrain.json();
      const scenery = await fetch('/assets/scenery/manifest-scenery.json');if(!scenery.ok)throw new OriginalAssetsError('缺少原版场景素材。');this.scenery=await scenery.json();
      const urls = new Set<string>();
      for (const sprite of Object.values(this.scenery)) urls.add(sprite.src);
      for (const tile of Object.values(this.terrain)) urls.add(tile.src);
      for (const group of [this.manifest.sprites, this.manifest.cameos, this.manifest.images, this.manifest.ui, this.manifest.overlays]) {
        for (const entry of Object.values(group || {})) { urls.add(typeof entry === 'string' ? entry : entry.src); if(typeof entry !== 'string' && 'remapMaskSrc' in entry && entry.remapMaskSrc) urls.add(entry.remapMaskSrc as string); }
      }
      let loaded = 0;
      await Promise.all([...urls].map(src => new Promise<void>(resolve => {
        const image = new Image();
        image.onload = () => { this.images.set(src, image); onProgress?.(++loaded / urls.size); resolve(); };
        image.onerror = () => { this.failures.push(src); onProgress?.(++loaded / urls.size); resolve(); };
        image.src = src;
      })));
      if(this.failures.length)throw new OriginalAssetsError(`${this.failures.length} 个原版素材文件缺失或损坏，请重新准备素材。`);
    } catch (error) { throw error instanceof OriginalAssetsError?error:new OriginalAssetsError('原版素材无法读取，请重新准备素材。'); }
  }
  sprite(name: string): Sprite | undefined {
    const key = name.toLowerCase().replace(/\.(shp|vxl|png)$/, '');
    return this.manifest.sprites?.[key];
  }
  url(name: string): string | undefined {
    const raw = this.manifest.images?.[name] || this.manifest.cameos?.[name] || this.sprite(name);
    return typeof raw === 'string' ? raw : raw?.src;
  }
  draw(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, frame = 0, scale = 1): boolean {
    const sprite = this.sprite(name);
    if (!sprite) return false;
    const image = this.images.get(sprite.src);
    if (!image) return false;
    const fw = sprite.frameWidth || sprite.width, fh = sprite.frameHeight || sprite.height;
    const columns = sprite.columns || 1;
    frame = ((Math.floor(frame) % (sprite.frames || 1)) + (sprite.frames || 1)) % (sprite.frames || 1);
    ctx.drawImage(image, (frame % columns) * fw, Math.floor(frame / columns) * fh, fw, fh,
      x - (sprite.anchorX ?? fw / 2) * scale, y - (sprite.anchorY ?? fh) * scale, fw * scale, fh * scale);
    return true;
  }
}

export type VoiceAction = 'select' | 'move' | 'attack';

// A native rules identifier and its artwork can differ. In particular, MTNK is
// the Grizzly rules identifier but the Apocalypse artwork identifier.
const SPRITE_RULE_IDS: Record<string, string> = {
  gi: 'e1', cons: 'e2', rock: 'jumpjet', seal: 'ghost', trst: 'terror',
  gtnk: 'mtnk', rtnk: 'mgtk', mtnk: 'apoc', mcv: 'amcv',
  trucka: 'dtruck', falc: 'orca', trs: 'sapc',
};
const UNIT_RULE_IDS: Record<string, string> = {
  allied_engineer: 'engineer', soviet_engineer: 'sengineer',
  crazy_ivan: 'ivan', soviet_yuri: 'yuri',
};

export class SoundSystem {
  enabled = true;
  musicEnabled = false;
  volume = 0.45;
  muted = false;
  private musicElement?: HTMLAudioElement;
  private musicSource?: string;
  private voiceElement?: HTMLAudioElement;
  private playing = new Set<HTMLAudioElement>();
  private lastPlayed = new Map<string, number>();
  private lastVoiceAt = -Infinity;
  constructor(private assets: Assets) {}

  /** Play a raw manifest sound key, including allied_/soviet_ EVA messages. */
  play(key: string): boolean {
    key = this.normalize(key);
    return this.start(key, this.soundSource(key), 500);
  }

  /** Resolve an original sound.ini event and choose one of its original clips. */
  playEvent(eventName: string): boolean {
    const event = this.normalize(eventName);
    const clip = this.eventClip(event);
    return clip ? this.start(`event:${event}`, this.soundSource(clip), 120) : false;
  }

  /**
   * Resolve a simulation unit id, native rules id, or artwork id. Native rules
   * ids take precedence for ambiguous bare names; sprite:mtnk explicitly names
   * Apocalypse artwork, while rule:mtnk explicitly names the Grizzly.
   * Prefer a simulation id such as "grizzly" or "apocalypse" at command hooks.
   */
  voice(spriteOrOriginalRuleId: string, action: VoiceAction = 'select'): boolean {
    const input = this.normalize(spriteOrOriginalRuleId).replace(/\.(shp|vxl|png)$/, '').replace(/-snow$/, '');
    const native = this.assets.manifest.unitVoices;
    if (!native) return false;
    let ruleId: string;
    if (input.startsWith('rule:')) ruleId = input.slice(5);
    else if (input.startsWith('sprite:')) {
      const sprite = input.slice(7); ruleId = SPRITE_RULE_IDS[sprite] ?? sprite;
    } else {
      const definition = CATALOG[input];
      ruleId = UNIT_RULE_IDS[input] ?? (definition
        ? SPRITE_RULE_IDS[definition.sprite] ?? definition.sprite
        : native[input] ? input : SPRITE_RULE_IDS[input] ?? input);
    }
    const event = native[ruleId]?.[`voice${action}`];
    const clip = event ? this.eventClip(event) : undefined;
    if (!clip) return false;
    // A selection can contain hundreds of units. One acknowledgement is enough,
    // and a subsequent command replaces the current voice instead of stacking it.
    const now = performance.now();
    if (now - this.lastVoiceAt < 160) return false;
    const started = this.start(`voice:${this.normalize(event!)}`, this.soundSource(clip), 350, true);
    if (started) this.lastVoiceAt = now;
    return started;
  }

  private normalize(key: string): string { return key.trim().replace(/^\$/, '').toLowerCase(); }

  private eventClip(eventName: string): string | undefined {
    const event = this.normalize(eventName);
    const clips = this.assets.manifest.soundEvents?.[event]?.filter(key => Boolean(this.assets.manifest.sounds?.[key]));
    if (clips?.length) return clips[Math.floor(Math.random() * clips.length)];
    return this.assets.manifest.sounds?.[event] ? event : undefined;
  }

  private soundSource(key: string): string | undefined {
    const entry = this.assets.manifest.sounds?.[key];
    if (!entry) return undefined;
    return Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : typeof entry === 'string' ? entry : entry.src;
  }

  private start(key: string, src: string | undefined, cooldown: number, voice = false): boolean {
    if (this.muted || !this.enabled || !src) return false;
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < cooldown) return false;
    this.lastPlayed.set(key, now);
    if (voice && this.voiceElement) this.release(this.voiceElement);
    if (this.playing.size >= 24) {
      const oldest = this.playing.values().next().value;
      if (oldest) this.release(oldest);
    }
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, this.volume));
    this.playing.add(audio);
    if (voice) this.voiceElement = audio;
    const finish = () => {
      this.playing.delete(audio);
      if (this.voiceElement === audio) this.voiceElement = undefined;
    };
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(finish);
    return true;
  }

  private release(audio: HTMLAudioElement) {
    audio.pause();
    this.playing.delete(audio);
    if (this.voiceElement === audio) this.voiceElement = undefined;
  }

  setMusic(enabled: boolean, track = 'hm2') {
    this.musicEnabled = enabled;
    if (this.muted || !enabled) { this.musicElement?.pause(); return; }
    const music = this.assets.manifest.music;
    if (!music) return;
    const src = Array.isArray(music) ? music[0] : typeof music === 'string' ? music : (music[track]?.src || music.hm2?.src || Object.values(music)[0]?.src);
    if (!src) return;
    if (!this.musicElement || this.musicSource !== src) {
      this.musicElement?.pause();
      this.musicElement = new Audio(src);
      this.musicSource = src;
      this.musicElement.loop = true;
    }
    this.musicElement.volume = Math.max(0, Math.min(1, this.volume * 0.55));
    this.musicElement.play().catch(() => {});
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stop();
    else if (this.musicEnabled) this.setMusic(true);
  }
  stop() {
    this.musicElement?.pause();
    for (const audio of this.playing) audio.pause();
    this.playing.clear(); this.voiceElement = undefined;
    this.lastPlayed.clear(); this.lastVoiceAt = -Infinity;
  }
}
