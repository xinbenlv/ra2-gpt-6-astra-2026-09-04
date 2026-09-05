import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, CATALOG } from '../src/game/data.ts';
import { getLocale, registerTranslations, setLocale, t } from '../src/i18n.ts';

test('English is the default and all country and production descriptions are translated', () => {
  assert.equal(getLocale(), 'en');
  for (const item of [...COUNTRIES, ...Object.values(CATALOG)]) {
    assert.doesNotMatch(t(item.description), /[\u3400-\u9fff]/, item.id);
  }
  registerTranslations({ '盟军基地车': 'Allied MCV', '发电厂': 'Power Plant' });
  assert.equal(t('选择 发电厂 的建造位置。右键取消。'), 'Choose a placement for Power Plant. Right-click to cancel.');
  assert.equal(t('发电厂已就绪，请选择放置位置。'), 'Power Plant ready. Select a placement location.');
  assert.equal(t('盟军基地车 · 100 / 100'), 'Allied MCV · 100 / 100');
  assert.equal(t('已选择 12 支部队'), '12 units selected');
  assert.equal(t('编队 4 已建立。'), 'Control group 4 created.');
  assert.equal(t('建筑已出售，回收 $400。'), 'Building sold. $400 refunded.');
});

test('Chinese is optional and switching back restores English without changing source messages', () => {
  setLocale('zh-CN');
  assert.equal(getLocale(), 'zh-CN');
  assert.equal(t('开始作战'), '开始作战');
  assert.equal(t('战场已就绪。选中基地车，按 D 或双击部署。'), '战场已就绪。选中基地车，按 D 或双击部署。');
  setLocale('en');
  assert.equal(t('开始作战'), 'Start Game');
  assert.equal(t('电力不足'), 'Low Power');
});
