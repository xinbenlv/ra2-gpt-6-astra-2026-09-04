"""Read original MIX parts and building SHP layers without modifying source archives."""
import os,sys,pathlib,hashlib,json,math
ROOT=pathlib.Path(__file__).resolve().parents[2]
os.environ['RA2_ASSET_CACHE']='/Users/zzn/ws/xinbenlv/ra2-gpt-6-astra-2026-09-04/.cache/ra2-assets-rebuild-test'
os.environ['RA2_PUBLIC_DIR']=str(ROOT/'.cache/batch-two/extract')
sys.path.insert(0,str(ROOT/'scripts/assets'))
from export_assets import find,shp_frames,palette,colorize
from PIL import Image
out=ROOT/'.cache/batch-two/source';records={}
for name in ['htnk.vxl','htnk.hva','htnktur.vxl','htnktur.hva','htnkbarl.vxl','htnkbarl.hva','dest.vxl','dest.hva','destwo.vxl','destwo.hva','asw.vxl','asw.hva','ggpile.shp','ggpile_a.shp','ggpile_ad.shp','ggpilemk.shp','cons.shp','tree26.tem']:
 b=find(name)
 if not b:records[name]={'found':False};continue
 (out/name).write_bytes(b);records[name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
 if name.startswith('ggpile'):
  frames=shp_frames(b);count=len(frames)//2;records[name]['framesIncludingShadow']=len(frames);ids=list(range(count)) if count<=12 else list(range(0,count,max(1,count//12)))
  w,h=frames[0].size;board=Image.new('RGBA',(min(4,len(ids))*w,math.ceil(len(ids)/4)*h))
  for j,i in enumerate(ids):board.paste(colorize(frames[i],palette('unittem')),(j%4*w,j//4*h))
  board.save(out/(name+'-contact.png'))
(ROOT/'assets/hd/batch-two/source-parts.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps(records,indent=2))
