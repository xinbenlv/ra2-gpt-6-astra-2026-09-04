"""Submit once, resume by task ID, and archive self-contained Meshy masters safely."""
import base64,hashlib,json,os,pathlib,sys,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[2]
API='https://api.meshy.ai/openapi/v1/image-to-3d'
PARAMS={'model_type':'standard','ai_model':'meshy-7','ultra_mode':False,'should_texture':True,'enable_pbr':True,'texture_resolution':'2k','should_remesh':False,'image_enhancement':False,'target_formats':['glb']}
def request(url,payload=None,auth=True):
 headers={'Content-Type':'application/json'}
 if auth: headers['Authorization']='Bearer '+os.environ['MESHY_API_KEY']
 req=urllib.request.Request(url,data=json.dumps(payload).encode() if payload is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=180) as response:return response.read()
 except urllib.error.HTTPError as e: raise RuntimeError('HTTP '+str(e.code)) from None
 except Exception as e:raise RuntimeError(type(e).__name__+'; request outcome may be unknown') from None
def main():
 action,id=sys.argv[1:3]; folder=ROOT/'.cache/batch-two'/id;folder.mkdir(parents=True,exist_ok=True)
 marker=folder/'submitted.json'; record=folder/'task.json'
 if action=='submit':
  if marker.exists() or record.exists():raise RuntimeError('Submission marker exists; recover instead of resubmitting')
  image=ROOT/'assets/hd/batch-two/references'/f'{id}.png';data=image.read_bytes()
  review=json.loads(image.with_suffix('.review.json').read_text())
  if review.get('status')!='accepted' or review.get('referenceSha256')!=hashlib.sha256(data).hexdigest():
   raise RuntimeError('Reference must pass downsample review for this exact image before submission')
  meta={'asset':id,'reference':str(image.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'parameters':PARAMS}
  marker.write_text(json.dumps(meta,indent=2)+'\n')
  result=json.loads(request(API,{**PARAMS,'image_url':'data:image/png;base64,'+base64.b64encode(data).decode()}))
  task=result['result'];meta['taskId']=task;record.write_text(json.dumps(meta,indent=2)+'\n');print(id,task)
 elif action=='poll':
  meta=json.loads(record.read_text());result=json.loads(request(API+'/'+meta['taskId']));state=result['status'];meta.update(status=state,progress=result.get('progress'))
  if state=='SUCCEEDED':
   master=folder/'master.glb'
   if not master.exists():
    data=request(result['model_urls']['glb'],auth=False)
    if data[:4]!=b'glTF':raise RuntimeError('Invalid GLB download')
    master.write_bytes(data)
   meta.update(master=str(master.relative_to(ROOT)),masterBytes=master.stat().st_size,masterSha256=hashlib.sha256(master.read_bytes()).hexdigest())
  record.write_text(json.dumps(meta,indent=2)+'\n');print(id,state,meta.get('progress'),meta.get('masterBytes',''))
 else:raise RuntimeError('Unknown action')
if __name__=='__main__':
 try:main()
 except Exception as e:print(type(e).__name__+': '+str(e));sys.exit(1)
