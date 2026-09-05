"""Export original terrain objects, walls, resources and overlay bridge segments."""
import export_assets as e
import json,struct
from pathlib import Path
from PIL import Image

def main():
 e.manifest=json.loads((e.OUT/'manifest.json').read_text());e.manifest.setdefault('overlays',{})
 specs=json.loads((e.PUBLIC_DIR/'maps/overlays.json').read_text());names=[r['name'].lower() for r in specs]
 names+=['bridge','bridgb','lobrdg','lobrdgb']+[f'tree{i:02}' for i in range(1,31)]
 for theater,ext,palname in [('temperate','tem','isotem'),('snow','sno','isosno'),('urban','urb','isourb')]:
  pal=e.palette(palname)
  for name in names:
   b=e.find(name+'.'+ext)
   if not b:continue
   try:
    W,H=struct.unpack_from('<HH',b,2);key=theater+'-'+name
    # Overlay data encodes the frame directly; retain original empty frames and shadows.
    resource=name.startswith(('tib','gem'));drawpal=e.palette({'temperate':'temperat','snow':'snow','urban':'urban'}[theater]) if resource else pal
    entry=e.export(key,b,drawpal,kind='overlays',maxframes=96,shadow=name.startswith('tree'),anchor=(W/2,H-15 if resource else H/2));entry.update(originalFile=name+'.'+ext,theater=theater)
    if name.startswith('tree'):entry['anchorY']=H-15
   except Exception as ex:print('skip',name,str(ex))
  for spec in specs:
   n=spec['name'].lower();key=theater+'-'+n
   if key in e.manifest['overlays']:e.manifest['overlays'][theater+':'+str(spec['id'])]=dict(e.manifest['overlays'][key])
 (e.OUT/'manifest.json').write_text(json.dumps(e.manifest,indent=2));print('overlay entries',len(e.manifest['overlays']))
if __name__=='__main__':main()
