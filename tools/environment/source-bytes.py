"""Hash exact original MIX entries without publishing raw game files."""
import sys,pathlib,json,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/assets'))
from mix_extract import Mix
cache=pathlib.Path('/Users/zzn/ws/xinbenlv/ra2-gpt-6-astra-2026-09-04/.cache/ra2-assets-rebuild-test')
p=ROOT/'assets/hd/environment/source-record.json';d=json.loads(p.read_text());names={'tree22':'tree22.tem','tree10':'tree10.tem','grass':'clear01.tem','ocean':'water01.tem','plateau':'cliff01.tem','ramp':'slope01.tem'}
for file in sorted((cache/'mixes').glob('*.mix')):
 m=Mix(file)
 for id,name in names.items():
  if 'rawEntry' in d['sources'][id]:continue
  b=m.get(name)
  if b:d['sources'][id]['rawEntry']={'file':name,'archive':str(file),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
for id in names:
 assert 'rawEntry' in d['sources'][id],id
p.write_text(json.dumps(d,indent=2)+'\n');print('Exact original entry hashes found for all six sources')
