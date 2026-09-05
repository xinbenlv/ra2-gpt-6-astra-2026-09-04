"""Export original scenery referenced by the bundled skirmish maps.
Run after original MIX extraction. Writes a separate manifest for renderer use.
"""
import sys,json,re,struct
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'assets'))
import export_assets as e
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
e.OUT=e.PUBLIC_DIR/'assets'
e.manifest={'scenery':{}}
catalog=json.loads((e.PUBLIC_DIR/'maps/catalog.json').read_text())
references={}
for mapdef in catalog:
    ini=e.read_ini((e.PUBLIC_DIR/'maps'/mapdef['filename']).read_bytes())
    theater=mapdef['theater'];types=references.setdefault(theater,{'structures':set(),'terrain':set()})
    for value in ini.get('structures',{}).values():
        parts=value.split(',')
        if len(parts)>1:types['structures'].add(parts[1].lower())
    for value in ini.get('terrain',{}).values():types['terrain'].add(value.lower())

def lookup(ident,theater,terrain=False):
    if terrain:
        extension={'snow':'sno','temperate':'tem','urban':'urb'}[theater]
        for name in [ident+'.'+extension,ident+'.shp']:
            data=e.find(name)
            if data:return data,name
    else:
        char={'snow':'a','temperate':'t','urban':'u'}[theater]
        names=[ident[:1]+char+ident[2:],ident[:1]+'g'+ident[2:],ident]
        for name in dict.fromkeys(names):
            data=e.find(name+'.shp')
            if data:return data,name+'.shp'
    return None,None

missing=[];result={}
for theater,groups in references.items():
    unitpal=e.palette('unitsno' if theater=='snow' else 'unittem')
    terrainpal=e.palette({'snow':'isosno','temperate':'isotem','urban':'isourb'}[theater])
    for kind,types in groups.items():
        for typename in sorted(types):
            terrain=kind=='terrain';rules=e.RULES.get(typename,{})
            # Invisible lamps only change lighting in the original engine.
            if 'lamp' in typename or typename.startswith('in') or rules.get('invisibleinGame','').lower()=='yes':continue
            image_id=rules.get('image',typename).lower()
            art=e.ART.get(image_id,{})
            image_id=art.get('image',image_id).lower()
            data,filename=lookup(image_id,theater,terrain)
            if not data:
                missing.append({'theater':theater,'type':typename,'image':image_id,'kind':kind});continue
            try:
                width,height=struct.unpack_from('<HH',data,2)
                foundation=re.match(r'(\d+)x(\d+)',art.get('foundation','1x1'))
                fx,fy=map(int,foundation.groups()) if foundation else (1,1)
                anchor=(width/2,height-15) if terrain else (width/2,height-(fx+fy)*7.5)
                pal=terrainpal if terrain or art.get('terrainpalette','').lower()=='yes' else unitpal
                key=theater+'-'+typename
                entry=e.export(key,data,pal,kind='scenery',maxframes=1,anchor=anchor)
                entry.update(theater=theater,nativeType=typename,originalFile=filename,kind=kind,foundation=[fx,fy])
                if not terrain:
                    image_path=e.OUT/'scenery'/(key+'.png');composed=Image.open(image_path).convert('RGBA');layers=[]
                    for field in ['idleanim','activeanim','activeanimtwo','activeanimthree','activeanimfour']:
                        anim=art.get(field,'').lower()
                        if not anim:continue
                        definition=e.ART.get(anim,{});animdata,animfile=lookup(definition.get('image',anim).lower(),theater)
                        if not animdata:continue
                        frames=e.shp_frames(animdata);index=int(definition.get('start','0'))
                        if index>=len(frames):continue
                        frame=e.colorize(frames[index],pal)
                        composed.alpha_composite(frame,((width-frame.width)//2,(height-frame.height)//2));layers.append(animfile)
                    if layers:composed.save(image_path);entry['bakedAnimations']=layers
                result[theater+':'+typename]=entry
            except Exception as error:missing.append({'theater':theater,'type':typename,'error':str(error)})
    print(theater,len([k for k in result if k.startswith(theater+':')]),'sprites',flush=True)
out=e.OUT/'scenery';out.mkdir(exist_ok=True)
(out/'manifest-scenery.json').write_text(json.dumps(result,separators=(',',':')))
(out/'missing.json').write_text(json.dumps(missing,indent=2))
print('Original scenery sprites:',len(result),'missing:',len(missing))
