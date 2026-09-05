"""Render original Westwood TMP diamonds and their extra cliff pixels into PNG atlases.

TMP fields documented by https://modenc.renegadeprojects.com/TMP ; diamond row
layout verified against the OpenRA TmpTSLoader format reader. This is an asset
conversion utility; the original pixels, palettes and per-cell art are preserved.
"""
import sys, struct, json
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'assets'))
from mix_extract import Mix
from paths import ASSET_CACHE, PUBLIC_DIR

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[1]) if len(sys.argv)>1 else ASSET_CACHE
OUT = PUBLIC_DIR / 'assets/terrain'
OUT.mkdir(parents=True,exist_ok=True)
definitions = json.loads((PUBLIC_DIR / 'maps/terrain.json').read_text())
manifest = {}

def render(data, offset, palette):
    bx,by,extra_offset,_,_,ex,ey,ew,eh = struct.unpack_from('<iiiiiiiii',data,offset)
    has_extra = data[offset+36] & 1
    ex -= bx; ey -= by
    if has_extra and (ew<=0 or eh<=0 or ew>1024 or eh>1024):
        has_extra = False
    left = min(0,ex) if has_extra else 0
    top = min(0,ey) if has_extra else 0
    right = max(60,ex+ew) if has_extra else 60
    bottom = max(30,ey+eh) if has_extra else 30
    image = Image.new('RGBA',(right-left,bottom-top))
    pixels = image.load(); pos = offset+52
    for row in range(30):
        row_width = (row+1)*4 if row<15 else (29-row)*4
        start = (60-row_width)//2
        for column in range(row_width):
            value = data[pos]; pos += 1
            if value: pixels[start+column-left,row-top] = palette[value]
    if has_extra:
        pos = offset+extra_offset
        for row in range(eh):
            for column in range(ew):
                value = data[pos]; pos += 1
                if value: pixels[ex+column-left,ey+row-top] = palette[value]
    return image,30-left,15-top

for theater, archive, pal_name in [('snow','isosnow.mix','isosno.pal'),('temperate','isotemp.mix','isotem.pal'),('urban','isourb.mix','isourb.pal')]:
    mix = Mix(SOURCE / 'mixes' / archive)
    pal_path = SOURCE / 'raw' / pal_name
    pal = pal_path.read_bytes() if pal_path.exists() else Mix(SOURCE/'mixes/cache.mix').get(pal_name)
    palette = [tuple(min(255,v*4) for v in pal[i:i+3])+(255,) for i in range(0,768,3)]
    sprites = []
    for tile_id,tile in enumerate(definitions[theater]):
        data = mix.get(tile['file'])
        if not data: continue
        width,height = struct.unpack_from('<II',data)
        for sub in range(width*height):
            offset = struct.unpack_from('<I',data,16+sub*4)[0]
            if not offset: continue
            image,ax,ay=render(data,offset,palette)
            sprites.append((f'{theater}:{tile_id}:{sub}',image,ax,ay))
    sprites.sort(key=lambda item:-item[1].height)
    page = 0; atlas = Image.new('RGBA',(2048,2048)); x=1;y=1;rowheight=0
    for key,image,ax,ay in sprites:
        if x+image.width+1>2048: x=1;y+=rowheight+1;rowheight=0
        if y+image.height+1>2048:
            atlas.save(OUT/f'{theater}-{page}.png',optimize=True);page+=1;atlas=Image.new('RGBA',(2048,2048));x=1;y=1;rowheight=0
        atlas.paste(image,(x,y))
        manifest[key]={'src':f'/assets/terrain/{theater}-{page}.png','x':x,'y':y,'width':image.width,'height':image.height,'anchorX':ax,'anchorY':ay}
        x+=image.width+1;rowheight=max(rowheight,image.height)
    atlas.save(OUT/f'{theater}-{page}.png',optimize=True)
    print(theater,len(sprites),'native subtile sprites',page+1,'sheets',flush=True)
(OUT/'manifest-tiles.json').write_text(json.dumps(manifest,separators=(',',':')))
print('Total original terrain frames:',len(manifest))
