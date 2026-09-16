"""Freeze original identity/sequence evidence and local contact sheets for this batch."""
import pathlib,json,re,hashlib
from PIL import Image,ImageDraw
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE=pathlib.Path('/Users/zzn/ws/xinbenlv/ra2-gpt-6-astra-2026-09-04/.cache')
SRC=BASE/'ra2-assets-rebuild-result';RAW=BASE/'ra2-assets-rebuild-test/raw';OUT=ROOT/'.cache/batch-two/source'
OUT.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
records={};manifest=json.loads((SRC/'assets/manifest.json').read_text())
for id,rule,frame in [('cons','E2',4),('htnk','HTNK',24),('dest','DEST',24),('gapile','GAPILE',0)]:
 d=manifest['sprites'][id];file=SRC/d['src'].lstrip('/');records[id]={'rulesId':rule,'sprite':d,'atlasSha256':sha(file),'referenceFrame':frame}
 im=Image.open(file);w=d['frameWidth'];h=d['frameHeight'];c=d['columns']
 def crop(i):return im.crop((i%c*w,i//c*h,i%c*w+w,i//c*h+h))
 crop(frame).save(OUT/(id+'.png'))
 if id=='cons':
  actions={'ready':(0,1,1),'walk':(8,6,6),'fireup':(164,6,6),'crawl':(86,6,6),'fireprone':(212,6,6),'down':(260,2,2),'up':(276,2,2),'idle1':(56,15,0),'idle2':(71,14,0),'die1':(134,15,0),'die2':(149,15,0),'cheer':(293,8,0),'paradrop':(292,1,0)}
  records[id]['sequences']=actions
  for name,(start,n,stride) in actions.items():
   dirs=[0,2,4,6] if stride else [0];board=Image.new('RGBA',(n*w,len(dirs)*h))
   for y,dr in enumerate(dirs):
    for j in range(n):board.paste(crop(start+dr*stride+j),(j*w,y*h))
   board.save(OUT/('cons-'+name+'.png'))
for file,ids in [('rules.ini',['E2','HTNK','DEST','GAPILE','ASW','M1Carbine','120mm','155mm','ASWLauncher','ASWBomb']),('art.ini',['CONS','ConSequence','HTNK','DEST','ASW','GAPILE','GAPILE_A','GAPILE_AD'])]:
 text=(RAW/file).read_text(errors='replace');chunks=[]
 for id in ids:
  m=re.search(r'^\['+id+r'\].*?(?=^\[|\Z)',text,re.M|re.S|re.I)
  if m:chunks.append(m[0])
 (OUT/file).write_text('\n'.join(chunks))
sc=json.loads((SRC/'assets/scenery/manifest-scenery.json').read_text())['temperate:tree26'];p=SRC/sc['src'].lstrip('/');records['tree26']={'sprite':sc,'atlasSha256':sha(p),'shape':'tiered conical evergreen; botanical species unknown','temperateCatalogPlacements':175};Image.open(p).save(OUT/'tree26.png')
tiles=json.loads((SRC/'assets/terrain/manifest-tiles.json').read_text());meta=json.loads((SRC/'maps/terrain.json').read_text())['temperate'][211]
records['dirt-road']={'tileId':211,'metadata':meta,'subtiles':{k:v for k,v in tiles.items() if k.startswith('temperate:211:')},'adaptation':'Single-cell straight module with two grass shoulders; source palette, authored grid topology'}
records['sourceRoot']=str(SRC);records['rulesSha256']=sha(RAW/'rules.ini');records['artSha256']=sha(RAW/'art.ini')
(ROOT/'assets/hd/batch-two/source-record.json').write_text(json.dumps(records,indent=2)+'\n')
print('Source identities and 13 conscript action contact sheets saved')
