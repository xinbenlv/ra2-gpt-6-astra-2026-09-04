"""Export original RA2 SHP/PAL assets into transparent web sprite atlases.
Usage: npm run assets:setup (or run from the isolated asset-converter Python environment).
Dependencies: Pillow and pycryptodome. Source files are never game implementations.
"""
from pathlib import Path
import struct, math, json, re, io, os
from PIL import Image
from mix_extract import Mix
from paths import ASSET_CACHE as ROOT, PUBLIC_DIR
OUT=PUBLIC_DIR/'assets';OUT.mkdir(parents=True,exist_ok=True)
M={p.stem:Mix(p) for p in (ROOT/'mixes').glob('*.mix')}
browser_runtime=os.environ.get('RA2_BROWSER_RUNTIME')=='1'
M.update({p.stem:Mix(p) for p in (ROOT/'game').glob('*.mix') if p.stat().st_size and (not browser_runtime or p.stem not in ['ra2','multi'])})
M['cameo']=Mix(data=M['language'].get('cameo.mix'))
if browser_runtime:del M['language']  # Its audio/cameo data is already extracted.
def read_ini(b):
 r={};cur={}
 for line in b.decode('cp1252').splitlines():
  line=line.split(';',1)[0].strip()
  if line.startswith('['):cur={};r[line[1:line.index(']')].lower()]=cur
  elif '=' in line:k,v=line.split('=',1);cur[k.strip().lower()]=v.strip()
 return r
ART=read_ini((ROOT/'raw/art.ini').read_bytes());RULES=read_ini((ROOT/'raw/rules.ini').read_bytes())
def find(name,mixes=None):
 for m in (mixes or M.values()):
  b=m.get(name)
  if b:return b
 return None

def shp_frames(b):
 _,W,H,N=struct.unpack_from('<4H',b)
 frames=[]
 for i in range(N):
  x,y,w,h,flags,_,_,off=struct.unpack_from('<4H4I',b,8+i*24)
  full=Image.new('P',(W,H));pix=bytearray(w*h)
  if off and w*h:
   if flags&2:
    p=off
    for yy in range(h):
     ln=struct.unpack_from('<H',b,p)[0];end=p+ln;p+=2;xx=0
     while p<end:
      v=b[p];p+=1
      if v==0:xx+=b[p];p+=1
      else:
       if xx<w:pix[yy*w+xx]=v
       xx+=1
     p=end
   else:pix[:]=b[off:off+w*h]
   frame=Image.frombytes('P',(w,h),bytes(pix));full.paste(frame,(x,y))
  frames.append(full)
 return frames

def palette(n):
 b=find(n+'.pal');return bytes(min(v*4,255) for v in b)

def colorize(im,pal,shadow=False):
 im=im.copy();im.putpalette(pal);rgb=im.convert('RGBA');data=im.tobytes()
 if shadow:rgb=Image.new('RGBA',im.size,(0,0,0,0));rgb.putalpha(Image.frombytes('L',im.size,bytes(90 if p else 0 for p in data)))
 else:rgb.putalpha(Image.frombytes('L',im.size,bytes(255 if p else 0 for p in data)))
 return rgb
manifest={'source':{'title':'Command & Conquer: Red Alert 2 original Westwood assets (XWIS distribution)','url':'https://archive.org/details/red-alert-2-multiplayer','download':'https://archive.org/download/red-alert-2-multiplayer/Red-Alert-2-Multiplayer.exe'},'sprites':{},'cameos':{},'ui':{},'sounds':{},'music':{},'tiles':{}}
def export(name,b,pal,kind='sprites',maxframes=1,shadow=True,anchor=None):
 fs=shp_frames(b);n=len(fs);has_shadow=shadow and n%2==0 and max(fs[n//2].tobytes(),default=0)<=1
 count=min(n//2 if has_shadow else n,maxframes);W,H=fs[0].size;cols=min(count,16)
 sheet=Image.new('RGBA',(W*cols,H*math.ceil(count/cols)));maskSheet=Image.new('RGBA',(W*cols,H*math.ceil(count/cols)))
 for i in range(count):
  im=colorize(fs[i],pal)
  if has_shadow:
   sh=colorize(fs[i+n//2],pal,True);sh.alpha_composite(im);im=sh
  sheet.paste(im,((i%cols)*W,(i//cols)*H))
  mask=Image.new('RGBA',(W,H),(255,255,255,0));mask.putalpha(Image.frombytes('L',(W,H),bytes(max(pal[p*3:p*3+3]) if 16<=p<=31 else 0 for p in fs[i].tobytes())));maskSheet.paste(mask,((i%cols)*W,(i//cols)*H))
 folder=OUT/kind;folder.mkdir(exist_ok=True);sheet.save(folder/(name+'.png'))
 entry={'src':'/assets/'+kind+'/'+name+'.png','width':sheet.width,'height':sheet.height,'frameWidth':W,'frameHeight':H,'frames':count,'columns':cols,'anchorX':anchor[0] if anchor else W/2,'anchorY':anchor[1] if anchor else H/2,'originalFrames':n,'originalFile':name.split('-')[0]+'.shp'}
 if kind=='sprites':
  maskSheet.save(folder/(name+'-remap.png'));entry['remapMaskSrc']='/assets/'+kind+'/'+name+'-remap.png'
 manifest[kind][name]=entry;return entry

def main():
 unitpal=palette('unittem');snowpal=palette('unitsno');cameopal=palette('cameo')
 for ident in ['gacnst','gapowr','gapile','garefn','gaweap','gadept','gaairc','gawall','gapill','gagun','nasam','gatech','gaspysat','gagap','gaweat','gacsph','gacspy','nacnst','napowr','nahand','narefn','naweap','naradr','naflak','nalasr','tesla','natech','nanrct','namisl','nairon','naprop','gagcan','gaorep','gayar','nayard','nafnce']:
  art=ART.get(ident,{});fnd=art.get('foundation','3x3');fnd=re.match(r'(\d+)x(\d+)',fnd);fx,fy=(int(fnd[1]),int(fnd[2])) if fnd else (3,3)
  for theater,archive,pal,file in [('temperate','generic',unitpal,ident[:1]+'g'+ident[2:]),('snow','snow',snowpal,ident)]:
   b=M[archive].get(file+'.shp') or find(file+'.shp')
   if not b:continue
   W,H=struct.unpack_from('<HH',b,2);entry=export(ident+('-snow' if theater=='snow' else ''),b,pal,anchor=(W/2,H-(fx+fy)*7.5));entry['foundation']=[fx,fy];entry['originalFile']=file+'.shp';entry['theater']=theater
  cameo=art.get('cameo')
  if cameo:
   b=M['cameo'].get(cameo+'.shp')
   if b:export(ident,b,cameopal,'cameos',shadow=False)
 for ident in ['gi','cons','engineer','jjet','flakt','shk','deso','terror','ivan','spy','snip','tany','seal','dog','adog','cleg','yuri','ccom','e1','e2']:
  b=find(ident+'.shp',[M['conquer']])
  if b:
   W,H=struct.unpack_from('<HH',b,2);export(ident,b,unitpal,maxframes=80,anchor=(W/2,H/2))
  art=ART.get(ident,{})
  if art.get('cameo'):
   b=M['cameo'].get(art['cameo']+'.shp')
   if b:export(ident,b,cameopal,'cameos',shadow=False)
 for ident,art in ART.items():
  cameo=art.get('cameo')
  if cameo and ident not in manifest['cameos']:
   b=M['cameo'].get(cameo+'.shp')
   if b:export(ident,b,cameopal,'cameos',shadow=False)
 # Stock interface palette-aware PCX art; embedded palettes preserve original coloration.
 db=M['local'].get('local mix database.dat')
 for name in db[52:].decode('ascii',errors='ignore').split('\0'):
  if not name.lower().endswith('.pcx'):continue
  b=M['local'].get(name)
  if not b:continue
  try:
   im=Image.open(io.BytesIO(b));
   if im.width<450 or im.height<200:continue
   p=OUT/'ui';p.mkdir(exist_ok=True);im.convert('RGB').save(p/(name[:-4]+'.png'));manifest['ui'][name[:-4]]={'src':'/assets/ui/'+name[:-4]+'.png','width':im.width,'height':im.height,'originalFile':name}
  except Exception:pass
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 print({k:len(v) for k,v in manifest.items() if isinstance(v,dict)})
if __name__=='__main__':main()
