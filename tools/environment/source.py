"""Inventory original temperate references; all converted artwork stays in ignored cache."""
import json,pathlib,hashlib,re,collections,shutil
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=pathlib.Path('/Users/zzn/ws/xinbenlv/ra2-gpt-6-astra-2026-09-04/.cache/ra2-assets-rebuild-result')
OUT=ROOT/'.cache/environment/source';OUT.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
sc=json.loads((SOURCE/'assets/scenery/manifest-scenery.json').read_text())
tiles=json.loads((SOURCE/'assets/terrain/manifest-tiles.json').read_text())
meta=json.loads((SOURCE/'maps/terrain.json').read_text())['temperate']
counts=collections.Counter();maps=[]
for m in json.loads((SOURCE/'maps/catalog.json').read_text()):
 if m['theater']!='temperate':continue
 p=SOURCE/'maps'/m['filename'];match=re.search(r'\[Terrain\]\s*([^\[]*)',p.read_text(),re.I)
 if match:counts.update(x.split('=',1)[1].strip().lower() for x in match[1].splitlines() if '=' in x)
 maps.append({'file':m['filename'],'sha256':sha(p)})
records={}
for id in ['tree22','tree10']:
 s=sc['temperate:'+id];p=SOURCE/s['src'].lstrip('/');im=Image.open(p);im.save(OUT/(id+'.png'))
 records[id]={'source':s,'sourcePngSha256':sha(p),'mapPlacements':counts[id],'alphaBounds':im.getbbox(),'inference':'Hidden crown, back branches and exact depth are generated, not original geometry.'}
for id,tile in [('grass',0),('ocean',314),('ramp',29),('plateau',49)]:
 s=tiles[f'temperate:{tile}:0'];p=SOURCE/s['src'].lstrip('/');im=Image.open(p);im.crop((s['x'],s['y'],s['x']+s['width'],s['y']+s['height'])).save(OUT/(id+'.png'))
 records[id]={'tileId':tile,'subTile':0,'metadata':meta[tile],'atlas':s,'atlasSha256':sha(p),'referenceSha256':sha(OUT/(id+'.png')),'inference':'Parametric module topology derived for compatible edges; not recovered original mesh.'}
report={'description':'Original reference identity. Converted images remain local. Map count includes catalog variants.','sources':records,'temperateMaps':maps,'sourceRoot':str(SOURCE)}
(ROOT/'assets/hd/environment/source-record.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(records,indent=2))
