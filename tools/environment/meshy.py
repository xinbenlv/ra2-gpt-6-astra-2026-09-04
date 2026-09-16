"""Recoverable Meshy requests; credentials stay in the injected process environment."""
import os,json,sys,urllib.request,urllib.error,base64,hashlib,time
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'.cache/environment'
base='https://api.meshy.ai/openapi/v1/'
def request(route,payload=None):
 req=urllib.request.Request(base+route,data=None if payload is None else json.dumps(payload).encode(),headers={'Authorization':'Bearer '+os.environ['MESHY_API_KEY'],'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=90) as r:return json.load(r)
 except urllib.error.HTTPError as ex:
  print('Meshy HTTP error',ex.code);sys.exit(2)
 except Exception as ex:
  print('Meshy transport failure',type(ex).__name__);sys.exit(3)
def save(p,data):p.write_text(json.dumps(data,indent=2))
cmd=sys.argv[1]
if cmd=='list':
 data=request('image-to-3d?page_size=100');save(root/'remote-task-list.json',data)
 tasks=data if isinstance(data,list) else data.get('result',data.get('data',[]))
 if isinstance(tasks,dict):tasks=tasks.get('tasks',[])
 print(json.dumps([{'id':t.get('id'),'status':t.get('status'),'created_at':t.get('created_at')} for t in tasks]))
elif cmd=='balance':print(json.dumps(request('balance')))
elif cmd=='submit':
 name=sys.argv[2];folder=root/name;folder.mkdir(exist_ok=True)
 if (folder/'started.json').exists():raise SystemExit('Submission marker exists; inspect saved task before retrying')
 im=root/(name+'-hd.png');sha=hashlib.sha256(im.read_bytes()).hexdigest()
 params={'ai_model':'meshy-6','should_texture':True,'enable_pbr':True,'should_remesh':False,'image_enhancement':False,'target_formats':['glb']}
 save(folder/'request.json',{'image_path':str(im),'image_sha256':sha,**params})
 save(folder/'started.json',{'time':time.time(),'image_sha256':sha})
 result=request('image-to-3d',{'image_url':'data:image/png;base64,'+base64.b64encode(im.read_bytes()).decode(),**params});save(folder/'created.json',result);print(name,json.dumps(result))
elif cmd=='poll':
 for name in sys.argv[2:]:
  folder=root/name;task=json.loads((folder/'created.json').read_text())['result'];data=request('image-to-3d/'+task);save(folder/'task.json',data);print(name,data.get('status'),data.get('progress'))
  if data.get('status')=='SUCCEEDED' and not (folder/'master.glb').exists():
   url=data['model_urls']['glb']
   try:
    with urllib.request.urlopen(url,timeout=180) as r:(folder/'master.glb').write_bytes(r.read())
    print(name,'master bytes',(folder/'master.glb').stat().st_size)
   except Exception as ex:print(name,'download failure',type(ex).__name__)
