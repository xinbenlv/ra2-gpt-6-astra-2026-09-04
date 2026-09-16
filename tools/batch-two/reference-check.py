"""Compare authored references at original opaque sprite scale without aspect distortion."""
from PIL import Image,ImageDraw
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[2];out=ROOT/'.cache/batch-two/reference-check';out.mkdir(parents=True,exist_ok=True)
rows=[];board=Image.new('RGB',(1000,5*220),(52,52,52));draw=ImageDraw.Draw(board)
for j,id in enumerate(['htnk','cons','dest','gapile','tree26']):
 source=Image.open(ROOT/'.cache/batch-two/source'/f'{id}.png').convert('RGBA');source.putalpha(source.getchannel('A').point(lambda a:255 if a>200 else 0));box=source.getbbox();source=source.crop(box)
 ref=Image.open(ROOT/'assets/hd/batch-two/references'/f'{id}.png').convert('RGBA')
 if ref.getchannel('A').getextrema()[0]==255:
  mask=Image.new('L',ref.size);mask.putdata([255 if max(r,g,b)>70 else 0 for r,g,b,a in ref.getdata()]);bbox=mask.getbbox()
 else:bbox=ref.getchannel('A').point(lambda a:255 if a>200 else 0).getbbox()
 ref=ref.crop(bbox);scale=source.height/ref.height;size=(round(ref.width*scale),source.height);small=ref.resize(size,Image.Resampling.LANCZOS);small.save(out/f'{id}-downsample.png');source.save(out/f'{id}-original.png')
 rec={'id':id,'originalOpaqueBounds':box,'originalSize':source.size,'referenceCrop':bbox,'downsampleSize':small.size,'widthRatio':small.width/source.width,'scaleMethod':'uniform height match, no aspect stretching; background threshold only for approximate framing','reviewStatus':'pending visual judgment'};rows.append(rec)
 draw.text((15,j*220+5),id+'   original | reference downsample, same height',fill='white')
 zoom=min(6,180/source.height);src=source.resize((round(source.width*zoom),round(source.height*zoom)),Image.Resampling.NEAREST);dst=small.resize((round(small.width*zoom),round(small.height*zoom)),Image.Resampling.NEAREST)
 board.paste(src,(15,j*220+30),src);board.paste(dst,(500,j*220+30),dst)
board.save(out/'comparison.png');(out/'metrics.json').write_text(json.dumps(rows,indent=2)+'\n');print(rows)
