"""Convert original faction sidebar chrome and cursor SHP animations."""
import json
import export_assets as e

def main():
 e.manifest=json.loads((e.OUT/'manifest.json').read_text())
 for side in ['sidec01','sidec02']:
  pal=bytes(v*4 for v in e.M[side].get('sidebar.pal'))
  for name in ['tab01','tab02','tab03','side1','side2','side3','radar','top','repair','sell','map','pause','sidebar','silo','power','powerp','powerb','bpower','batt','build','clock','pwrbar','radaract','radaroff','radaron']:
   b=e.M[side].get(name+'.shp')
   if b:e.export(side+'-'+name,b,pal,kind='ui',maxframes=40,shadow=False,anchor=(0,0))
 for name,pal,archive in [('mnscrnl','shell','neutral'),('mnscrns','shell','neutral'),('glsl','gls','local')]:
  b=e.M[archive].get(name+'.shp');pb=e.find(pal+'.pal')
  if b and pb:e.export(name,b,bytes(v*4 for v in pb),kind='ui',shadow=False,anchor=(0,0))
 # Cursor .sha has the same TS SHP frame layout.
 b=e.find('mouse.sha');pal=e.find('mousepal.pal')
 if b and pal:e.export('mouse',b,bytes(v*4 for v in pal),kind='ui',maxframes=512,shadow=False,anchor=(0,0))
 e.manifest['source']['sha256']='5388c54d7d7b73060083563ff1926bca0d2663a76678b807e23e9a8d491441ce'
 e.manifest['source']['formatReferences']=['https://moddingwiki.shikadi.net/wiki/Westwood_SHP_Format_(TS)','https://github.com/OpenRA/OpenRA/blob/bleed/OpenRA.Mods.Cnc/FileSystem/MixFile.cs','https://github.com/sh4faq/Red-Alert-2--Modding-Guide/blob/master/01-VXL-HVA-Format.md','https://ppmforums.com/topic-46489/audioidxbag-format/']
 (e.OUT/'manifest.json').write_text(json.dumps(e.manifest,indent=2));print('ui',len(e.manifest['ui']))
if __name__=='__main__':main()
