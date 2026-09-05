"""Extract RA2 skirmish maps and exact TMP movement metadata from original MIX assets.

Usage: npm run assets:setup
The source package is recorded in public/maps/provenance.json. No game code is executed.
"""
import sys, re, json, struct, hashlib, configparser
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'assets'))
from mix_extract import Mix
from paths import ASSET_CACHE, PUBLIC_DIR

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ASSET_CACHE
OUT = PUBLIC_DIR / 'maps'
OUT.mkdir(parents=True, exist_ok=True)

def ini(data):
    obj = configparser.RawConfigParser(strict=False, inline_comment_prefixes=(';',), interpolation=None)
    obj.optionxform = str
    text = data.decode('cp1252') if isinstance(data, bytes) else data
    text = '\n'.join(line for line in text.splitlines() if '=' in line or line.strip().startswith(('[',';')))
    obj.read_string('[__root__]\n' + text)
    return obj

def csf(data):
    result, pos = {}, 24
    while pos + 12 <= len(data):
        if data[pos:pos+4] != b' LBL': break
        count, size = struct.unpack_from('<II', data, pos + 4); pos += 12
        label = data[pos:pos+size].decode('ascii').lower(); pos += size
        for _ in range(count):
            magic = data[pos:pos+4]; size = struct.unpack_from('<I', data, pos+4)[0]; pos += 8
            value = bytes(b ^ 255 for b in data[pos:pos+size*2]).decode('utf-16le'); pos += size*2
            result[label] = value
            if magic == b'WRTS':
                size = struct.unpack_from('<I', data, pos)[0]; pos += 4 + size
    return result

local = Mix(SOURCE / 'mixes/local.mix')
multi = Mix(SOURCE / 'game/multi.mix')
strings = csf(Mix(SOURCE / 'game/language.mix').get('ra2.csf'))
missions = ini(local.get('missions.pkt'))
names = re.findall(rb'([a-zA-Z0-9_-]+\.map)\x00', multi.get('local mix database.dat'))
catalog, raw_sources = [], []
ZH = {'mp22s8': '北极圈', 'mp32s8':'冰天雪地', 'mp27t8':'万里长征', 'mp15s4':'雪谷',
      'mp06t2':'城市突击', 'mp08t2':'湖泊之战', 'mp01t4':'南太平洋', 'mp05t4':'心脏地带',
      'mp13s4':'蒙大拿非军事区', 'mp23t4':'镰刀锤子', 'mp25t6':'防御区六', 'mp26s6':'白令海峡',
      'mp30s6':'西伯利亚荒原', 'mp18s3':'冷战', 'mp29u2':'阿拉莫', 'mp02t2':'战争岛',
      'mp03t4':'美国小镇', 'mp09t3':'峡谷饲料', 'mp10s4':'深水炸弹', 'mp11t2':'狭路相逢',
      'mp12s4':'闪电湖', 'mp14t2':'黄金国', 'mp16s4':'雪球的机会', 'mp17t6':'马里布悬崖',
      'mp19t4':'金州高速公路', 'mp20t6':'野生动物园', 'mp21s2':'阿拉斯加漏油事件',
      'mp31s2':'五一节', 'tsunami':'海啸', 'bayopigs':'猪猡湾', 'bermuda':'百慕大三角',
      'arena':'竞技场', 'tn04t2':'锦标赛地图 B', 'tn01t2':'锦标赛地图 A'}
SPECIAL = {
    'mp13s4mw': {'specialMode':'unfinished', 'notes':'原厂档案中的未完成变体：四个出生点相距仅两格，基地会重叠。保留查看和导入，不能直接开始遭遇战。'},
    'mp30s8': {'specialMode':'unfinished', 'notes':'原厂档案中的 Polar Cap 草稿：没有矿石、宝石或油井，无法持续发展经济。保留查看和导入，不能直接开始遭遇战。'},
    'tn03mw': {'specialMode':'megawealth', 'modes':['megawealth'], 'notes':'巨富模式：原图没有矿石，以工程师占领科技油井获得持续收入。'},
    'mp20mw': {'specialMode':'megawealth', 'modes':['megawealth'], 'name':'野生动物园（巨富）', 'nameEn':'Wild Animal Park (MegaWealth)', 'notes':'巨富模式：以工程师占领原图的 36 座科技油井获得持续收入，只有少量残留矿石。'}
}
for encoded in names:
    filename = encoded.decode('ascii').lower(); key = filename[:-4]
    if re.match(r'c\dm\d', key): continue
    data = multi.get(filename)
    if data is None: continue
    (OUT / filename).write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    raw_sources.append({'file':filename, 'sha256':digest, 'archive':'multi.mix'})
    mission_key = next((name for name in missions.sections() if name.lower() == key), None)
    entry = missions[mission_key] if mission_key else {}
    modes = [value.strip() for value in entry.get('GameMode', 'standard').split(',')]
    if all(mode in ['megawealth', 'duel', 'cooperative'] for mode in modes): continue
    data_ini = ini(data)
    size = [int(value) for value in data_ini['Map']['Size'].split(',')]
    preview = [int(value) for value in data_ini['Preview']['Size'].split(',')] if 'Preview' in data_ini else [0,0,0,0]
    name = strings.get(entry.get('Description', '').lower(), '') or strings.get('desc:'+key, '') or data_ini['Basic'].get('Name', data_ini['Basic'].get('UIName',key.upper()))
    name = re.sub(r'\s*\(\d+(?:-\d+)?\)\s*$', '', name)
    players = int(entry.get('MaxPlayers', '0')) or min(8, len([x for x in data_ini['Waypoints'] if x.isdigit() and int(x)<8]))
    catalog.append({'id':key, 'name':ZH.get(key, name), 'nameEn':name, 'width':size[2], 'height':size[3],
                    'players':players, 'theater':data_ini['Map']['Theater'].lower(), 'filename':filename,
                    'preview':f'/maps/previews/{key}.png', 'previewWidth':preview[2], 'previewHeight':preview[3],
                    'modes':modes, 'official':True, 'source':'Westwood Studios / XWIS original assets', 'sha256':digest, **SPECIAL.get(key,{})})
catalog.sort(key=lambda item:(item['id']!='mp22s8', item['players'], item['nameEn']))
(OUT / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2))

terrain = {}
for theater, ini_name, archive, extension in [('snow','snow.ini','isosnow.mix','sno'), ('temperate','temperat.ini','isotemp.mix','tem'), ('urban','urban.ini','isourb.mix','urb')]:
    definitions = ini(local.get(ini_name)); tiles = []; mix = Mix(SOURCE / 'mixes' / archive)
    set_id = 0
    while f'TileSet{set_id:04d}' in definitions:
        values = definitions[f'TileSet{set_id:04d}']; total = int(values.get('TilesInSet','0'))
        for sequence in range(1,total+1):
            filename = f"{values.get('FileName')}{sequence:02d}.{extension}".lower()
            data = mix.get(filename); subtiles = []
            if data:
                width, height, _, _ = struct.unpack_from('<IIII', data)
                for i in range(width*height):
                    offset = struct.unpack_from('<I',data,16+i*4)[0]
                    if offset:
                        subtiles.append([data[offset+41], data[offset+40], data[offset+42],
                                         list(data[offset+43:offset+46]), list(data[offset+46:offset+49])])
                    else: subtiles.append(None)
            tiles.append({'file':filename, 'set':set_id, 'name':values.get('SetName',''), 'subtiles':subtiles})
        set_id += 1
    terrain[theater] = tiles
    print(theater,len(tiles),'tiles',sum(len(t['subtiles']) for t in tiles),'subtiles')
(OUT / 'terrain.json').write_text(json.dumps(terrain, ensure_ascii=False, separators=(',',':')))
rules = ini(local.get('rules.ini'))
overlays = []
for index, name in enumerate(rules['OverlayTypes'].values()):
    values = rules[name] if name in rules else {}
    overlays.append({'id':int(index), 'name':name, 'wall':values.get('Wall','no').lower()=='yes',
                     'ore':values.get('Tiberium','no').lower()=='yes', 'land':values.get('Land','')})
(OUT / 'overlays.json').write_text(json.dumps(overlays,separators=(',',':')))
(OUT / 'provenance.json').write_text(json.dumps({'download':'https://archive.org/download/red-alert-2-multiplayer/Red-Alert-2-Multiplayer.exe',
    'archiveItem':'https://archive.org/details/red-alert-2-multiplayer','downloaded':'2026-09-04',
    'description':'Original Westwood RA2 maps, including official map packs, extracted from XWIS distribution. No Yuri faction or cooperative scenarios included.',
    'mapCount':len(catalog),'rawMapCount':len(raw_sources),'files':raw_sources},indent=2))
print('Exported',len(catalog),'catalog maps and',len(raw_sources),'raw skirmish maps')
