"""Freeze actual generated references, runtime files, master locations and tool provenance."""
import pathlib,json,hashlib
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[2];folder=root/'assets/hd/environment'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[]
for p in sorted(folder.rglob('*')):
 if not p.is_file() or p.name=='inventory.json':continue
 item={'path':str(p.relative_to(folder)),'bytes':p.stat().st_size,'sha256':sha(p)}
 if p.suffix=='.png':
  im=Image.open(p);item.update(size=list(im.size),mode=im.mode)
 files.append(item)
masters=[]
for id in ['grass','ocean','plateau','ramp','tree22','tree10']:
 p=root/'.cache/environment'/id/'master.glb';masters.append({'id':id,'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)})
record={'description':'Measured local deliverables. Source art and high-resolution masters are excluded from Git.','files':files,'masters':masters,'sourceWorktree':'/Users/zzn/.codex/worktrees/9e22/ra2-gpt-6-astra-2026-09-04','sourceBaseline':'0ca560d643ddeb0c543dd0cf17aa428552977466','skillConflictResolution':'Read both halves of source SKILL.md; follow latter 52470b1 action/Canvas requirements and newer team-color-calibration. No blanket merge.','toolProvenance':'model-opt scripts compared/copied explicitly from source worktree; foliage mode added locally. Meshy wrapper copied then relocated to this cache. No four-assets viewer copied.','verification':'../../../../.cache/environment/verification','legacyServices':{'4179':{'pid':32886,'http':200},'4183':{'pid':39585,'http':200},'4184':{'pid':57337,'http':200}}}
(folder/'inventory.json').write_text(json.dumps(record,indent=2)+'\n')
print([(p.name,p.stat().st_size) for p in folder.glob('*.glb')])
