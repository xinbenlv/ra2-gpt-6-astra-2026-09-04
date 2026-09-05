"""Export original RA2 EVA, unit, effects and music from MIX and IDX/BAG.
FFmpeg transcodes the original wave data into browser-playable MP3.
"""
from pathlib import Path
import struct,json,subprocess,concurrent.futures,os
import export_assets as e
OUT=e.OUT/'audio';OUT.mkdir(exist_ok=True);TMP=e.ROOT/'audio';TMP.mkdir(exist_ok=True)
IDX=(e.ROOT/'raw/audio.idx').read_bytes();BAG=(e.ROOT/'raw/audio.bag').read_bytes();entries={}
for i in range(struct.unpack_from('<I',IDX,8)[0]):
 p=12+i*36;n=IDX[p:p+16].split(b'\0')[0].decode();entries[n]=struct.unpack_from('<5I',IDX,p+16)
def wave_entry(name):
 off,size,rate,flags,block=entries[name];data=BAG[off:off+size];channels=2 if flags&1 else 1
 if flags&8:
  samples=(block-4*channels)*2//channels+1;fmt=struct.pack('<HHIIHHHH',17,channels,rate,rate*block//samples,block,4,2,samples)
 else:
  bits=16 if flags&2 else 8;fmt=struct.pack('<HHIIHH',1,channels,rate,rate*channels*bits//8,channels*bits//8,bits)
 body=b'WAVEfmt '+struct.pack('<I',len(fmt))+fmt+b'data'+struct.pack('<I',len(data))+data
 return b'RIFF'+struct.pack('<I',len(body))+body
jobs=[];sounds={};music={}
def add(key,b,original,text=None,mus=False):
 if not b:return
 target=OUT/(key+'.mp3');tmp=TMP/(key+'.wav');tmp.write_bytes(b);jobs.append((tmp,target,mus))
 item={'src':'/assets/audio/'+target.name,'originalFile':original}
 if text:item['text']=text
 (music if mus else sounds)[key]=item
EVA=e.read_ini((e.ROOT/'raw/eva.ini').read_bytes())
for key,rec in EVA.items():
 if not key.startswith('eva_'):continue
 for faction,n in [('allied',rec.get('allied')),('soviet',rec.get('russian'))]:
  if n:add(faction+'_'+key[4:],e.M['audio'].get(n+'.wav'),n+'.wav',rec.get('text'))
# Select original unit speech and common combat/UI effects; all variants are retained.
prefixes=['igise','igimo','igiat','iconse','iconmo','iconat','vgrise','vgrimo','vgriat','vrhise','vrhimo','vrhiat','vkir','vchrse','vchrmo','vwarse','vwarmo','iengse','iengmo','itanse','itanmo','itanat','uclick','ucommand','uplace','uplan','umenu','ugam','bplace','gen','gexp','expl','vtan','vapo','nuk']
for name in entries:
 add(name,wave_entry(name),'audio.bag:'+name)
for name in ['hm2','grinder','industro']:
 add(name,e.M['theme'].get(name+'.wav'),name+'.wav',mus=True)
def convert(job):
 source,target,mus=job
 result=subprocess.run([os.environ.get('RA2_FFMPEG', 'ffmpeg'),'-v','error','-y','-i',str(source),'-c:a','libmp3lame','-q:a','4' if mus else '3',str(target)],capture_output=True, text=True)
 if result.returncode:raise RuntimeError(f'FFmpeg failed converting {source.name}: {result.stderr.strip()}')
 return target.name, result.returncode
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 results=list(pool.map(convert,jobs))
e.manifest=json.loads((e.OUT/'manifest.json').read_text());e.manifest['sounds']=sounds;e.manifest['music']=music
soundini=e.read_ini((e.ROOT/'raw/sound.ini').read_bytes());e.manifest['soundEvents']={key:[n.lstrip('$').lower() for n in rec['sounds'].split() if n.lstrip('$').lower() in sounds] for key,rec in soundini.items() if 'sounds' in rec}
e.manifest['unitVoices']={key:{ev:rec[ev].lower() for ev in ['voiceselect','voicemove','voiceattack','diesound','movesound'] if ev in rec} for key,rec in e.RULES.items() if 'voiceselect' in rec}
(e.OUT/'manifest.json').write_text(json.dumps(e.manifest,indent=2));print('sounds',len(sounds),'music',len(music),'errors',[r for r in results if r[1]])
