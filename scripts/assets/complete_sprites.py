"""Complete all playable entity graphics, original structure layers, and palette masks."""
import export_assets as e
from pathlib import Path
from PIL import Image, ImageChops
import json,struct,re

def main():
 e.manifest=json.loads((e.OUT/'manifest.json').read_text());up=e.palette('unittem');sp=e.palette('unitsno');cp=e.palette('cameo')
 # Use original image identifiers. Structure animations share canvas alignment and are
 # composited at frame 0, preserving all of the original machinery and roofs.
 buildings=['gacnst','gapowr','gapile','garefn','gaweap','gadept','gaairc','gapill','nasam','gatech','gagap','gacsph','nacnst','napowr','nahand','narefn','naweap','naradr','naflak','nalasr','natech','nanrct','namisl','nairon','gagcan','gaorep','nayard','gayard','nadept','gaweth','natsla','gapris','gaspst']
 for ident in buildings:
  art=e.ART.get(ident,{});fnd=re.match(r'(\d+)x(\d+)',art.get('foundation','3x3'));fx,fy=(int(fnd[1]),int(fnd[2])) if fnd else (3,3)
  for theater,pal in [('temperate',up),('snow',sp)]:
   def lookup(name):
    name=name.lower();archive='snow' if theater=='snow' else 'generic';file=name if theater=='snow' else name[:1]+'g'+name[2:]
    b=e.M[archive].get(file+'.shp') or e.M['conquer'].get(name+'.shp') or e.M['generic'].get(name+'.shp') or e.M['generic'].get(name[:1]+'g'+name[2:]+'.shp')
    return b,file
   b,file=lookup(ident)
   if not b: print('missing building',ident,theater);continue
   W,H=struct.unpack_from('<HH',b,2);key=ident+('-snow' if theater=='snow' else '')
   entry=e.export(key,b,pal,anchor=(W/2,H-(fx+fy)*7.5));entry.update(foundation=[fx,fy],originalFile=file+'.shp',theater=theater)
   base=Image.open(e.OUT/'sprites'/(key+'.png')).convert('RGBA');mask=Image.open(e.OUT/'sprites'/(key+'-remap.png')).convert('RGBA');layers=[]
   # Base, idle/active machinery, closed roof components. Underdoor is composited last.
   for field in ['idleanim','activeanim','activeanimtwo','activeanimthree','activeanimfour','underdooranim','underroofdooranim']:
    n=art.get(field)
    if not n:continue
    ab,af=lookup(n)
    if not ab:continue
    fs=e.shp_frames(ab);im=e.colorize(fs[0],pal);dx=(W-im.width)//2;dy=(H-im.height)//2
    base.alpha_composite(im,(dx,dy));lm=Image.new('RGBA',im.size,(255,255,255,0));lm.putalpha(Image.frombytes('L',im.size,bytes(max(pal[p*3:p*3+3]) if 16<=p<=31 else 0 for p in fs[0].tobytes())));erase=Image.new('L',mask.size,255);erase.paste(Image.eval(im.getchannel('A'),lambda a:255-a),(dx,dy));mask.putalpha(ImageChops.multiply(mask.getchannel('A'),erase));mask.alpha_composite(lm,(dx,dy));layers.append(af+'.shp')
   base.save(e.OUT/'sprites'/(key+'.png'));mask.save(e.OUT/'sprites'/(key+'-remap.png'));entry['originalLayers']=layers
  if art.get('cameo'):
   b=e.M['cameo'].get(art['cameo']+'.shp')
   if b:e.export(ident,b,cp,'cameos',shadow=False)
 for ident in ['gi','cons','engineer','rock','flakt','shk','deso','trst','ivan','spy','snipe','tany','seal','dog','adog','cleg','yuri','ccom','dron','dlph','sqd']:
  b=e.M['conquer'].get(ident+'.shp')
  if not b:print('missing unit',ident);continue
  W,H=struct.unpack_from('<HH',b,2);entry=e.export(ident,b,up,maxframes=512,anchor=(W/2,H/2));art=e.ART.get(ident,{})
  entry['sequence']=art.get('sequence');entry['facings']=8
  if art.get('sequence'):
   seq=e.ART.get(art['sequence'].lower(),{});entry['sequences']={k:[int(x) for x in v.split(',') if x.strip().lstrip('-').isdigit()] for k,v in seq.items() if k in ['ready','guard','walk','fireup','prone','crawl','fireprone','idle1','idle2','die1','die2','deploy','deployed','swim']}
  if art.get('cameo'):
   b=e.M['cameo'].get(art['cameo']+'.shp')
   if b:e.export(ident,b,cp,'cameos',shadow=False)
 # Trees, ore, common original explosion animations.
 for ident in ['tib01','tib02','tib03','gem01','gem02','gem03','tree01','tree02','tree03','tree04','tree05','tree06','tree07','tree08','tree09','tree10','tree11','tree12','tree13','tree14','tree15','tree16','tree17','tree18','tree19','tree20','gtree01','gtree02','gtree03','twlt050','twlt100','s_tumu30','s_tumu60','s_tumu60','smallfire','fire01','piffpiff']:
  b=e.find(ident+'.shp')
  if b:
   try:e.export(ident,b,up,maxframes=32,anchor=None)
   except Exception as ex:print('effect skip',ident,str(ex))
 for alias,source in [('gacnst','mcv'),('nacnst','smcv'),('gagcan','gtgcan')]:
  if source in e.manifest['cameos']:e.manifest['cameos'][alias]=dict(e.manifest['cameos'][source])
 (e.OUT/'manifest.json').write_text(json.dumps(e.manifest,indent=2));print('sprites',len(e.manifest['sprites']))
if __name__=='__main__':main()
