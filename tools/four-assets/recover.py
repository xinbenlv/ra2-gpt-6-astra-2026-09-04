"""GET-only recovery of previously paid Meshy tasks; never submits generation."""
import os,json,urllib.request,hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
TASKS={
'refinery':('01a0a96d-bc6e-74d6-82a0-ebc767e3b514','27d3a5dabbb3ae157922ca7e0021fca92c3b4bc6a5e9243f103fab0a0aa65e2b'),
'miner':('01a0a96d-d583-745c-bd4f-f4639fc8b8e5','9231d14fe3df3d9ca32a028bec1df2523debfccd85e25300141d9ad96c4c513a'),
'rocketeer':('01a0a96d-ece6-76e3-a37d-845a5ec1847f','fb998e587f03d9731feb1d72579282fec253cab53aae21ac6d9d4a2f6e3ac352'),
'squid':('01a0a96e-03f5-774a-b462-d37f1f1221d9','26d1ed3c70fbb528acbe0e5a3c0f1e08166c870c74a798d71687f648a2b32f28')}
def recover(item):
 name,(task,expected)=item;root=Path('.cache/four-assets')/name;root.mkdir(parents=True,exist_ok=True);dest=root/'master.glb'
 if dest.exists() and hashlib.sha256(dest.read_bytes()).hexdigest()==expected:return name,'already verified'
 request=urllib.request.Request('https://api.meshy.ai/openapi/v1/image-to-3d/'+task,headers={'Authorization':'Bearer '+os.environ['MESHY_API_KEY']})
 try:
  with urllib.request.urlopen(request,timeout=60) as response:data=json.load(response)
  assert data['status']=='SUCCEEDED','Task incomplete'
  url=data['model_urls']['glb'];assert url.startswith('https://')
  with urllib.request.urlopen(url,timeout=180) as response:content=response.read()
  assert hashlib.sha256(content).hexdigest()==expected,'Master checksum differs'
  dest.write_bytes(content)
  # Persist the recovery identity, never temporary signed download URLs.
  (root/'recovery.json').write_text(json.dumps({'taskId':task,'masterSha256':expected,'bytes':len(content),'recoveredFrom':'existing Meshy image-to-3d task','originalTask':'01a0a965-90a2-7c83-b65d-3d3f2f7103f4'},indent=2)+'\n')
  return name,len(content)
 except Exception as error:return name,type(error).__name__
with ThreadPoolExecutor(max_workers=4) as pool:
 for row in pool.map(recover,TASKS.items()):print(*row,flush=True)
