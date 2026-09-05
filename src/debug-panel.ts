import type { GameEngine } from './game';
import type { SoundSystem } from './assets';
import { localizeElement, registerTranslations } from './i18n';

registerTranslations({
  '调试面板': 'Debug Panel',
  '增加 10,000 金币': 'Add 10,000 credits',
  '地图全开': 'Reveal entire map',
  '瞬间建造和雇佣': 'Instant construction & recruitment',
  '关闭所有声音': 'Mute all audio',
  '当前玩家；建造仍需资金、前置建筑和放置位置。': 'Current player only. Production still requires credits, prerequisites and building placement.',
  '本场战斗已结束，开始新游戏后可使用调试选项。': 'This battle has ended. Start a new game to use the debug options.',
});

export function mountDebugPanel(root: HTMLElement, game: GameEngine, sound: SoundSystem, onChange: () => void): void {
  const panel = document.createElement('details');
  panel.className = 'debug-panel';
  panel.innerHTML = `<summary>调试面板</summary><div class="debug-controls">
    <p>当前玩家；建造仍需资金、前置建筑和放置位置。</p>
    <button type="button" data-debug="credits">增加 10,000 金币</button>
    <label><input type="checkbox" data-debug="reveal" ${game.debugRevealMap ? 'checked' : ''}>地图全开</label>
    <label><input type="checkbox" data-debug="instant" ${game.debugInstantProduction ? 'checked' : ''}>瞬间建造和雇佣</label>
    <label><input type="checkbox" data-debug="mute" ${sound.muted ? 'checked' : ''}>关闭所有声音</label>
    <p data-debug-status role="status" hidden></p>
  </div>`;
  root.append(panel);
  const active = () => {
    if (game.status === 'playing' && !game.getPlayer()?.defeated) return true;
    const status = panel.querySelector<HTMLElement>('[data-debug-status]')!;
    status.hidden = false;
    status.textContent = '本场战斗已结束，开始新游戏后可使用调试选项。';
    localizeElement(panel);
    return false;
  };
  panel.querySelector<HTMLButtonElement>('[data-debug="credits"]')!.onclick = () => {
    if (active()) { game.grantDebugCredits(); onChange(); }
  };
  panel.querySelectorAll<HTMLInputElement>('input[data-debug]').forEach(input => {
    input.onchange = () => {
      if (input.dataset.debug === 'mute') sound.setMuted(input.checked);
      else if (!active()) { input.checked = !input.checked; return; }
      else if (input.dataset.debug === 'reveal') game.debugRevealMap = input.checked;
      else game.setDebugInstantProduction(input.checked);
      onChange();
    };
  });
  // Controls retain normal keyboard navigation without issuing battlefield shortcuts.
  panel.addEventListener('keydown', event => event.stopPropagation());
  panel.addEventListener('keyup', event => event.stopPropagation());
  localizeElement(panel);
}
