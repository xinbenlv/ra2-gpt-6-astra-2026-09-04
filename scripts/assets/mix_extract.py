"""Read original Westwood MIX files. RSA/Blowfish directory layout documented by OpenRA.
Python dependencies: pycryptodome. This module extracts data; it does not execute game code.
"""
import struct, base64, zlib
from pathlib import Path
from Crypto.Cipher import Blowfish
PUBLIC_KEY = int.from_bytes(base64.b64decode('AihRvNoIbTn85FZRYNZRcT+i6KpU+maCsEqr3Q5q+LDB5tH7Tz2qQ38V')[2:], 'big')
def hashes(name):
    b=name.upper().encode('ascii')
    yield zlib.crc32(b)&0xffffffff
    r=len(b)%4
    if r:
        tail=b[-r:][0]
        b+=bytes([r])+bytes([tail])*(3-r)
        yield zlib.crc32(b)&0xffffffff
    v=0
    for i in range(0,len(b),4):
        v=(((v<<1)|(v>>31))+int.from_bytes(b[i:i+4].ljust(4,b'\0'),'little'))&0xffffffff
    yield v
class Mix:
    def __init__(self, path=None, data=None):
        self.data=data if data is not None else Path(path).read_bytes()
        b=self.data
        if len(b)<6: self.entries={};return
        flags=struct.unpack_from('<I',b)[0] if b[:2]==b'\0\0' else 0
        p=4 if b[:2]==b'\0\0' else 0
        if flags&0x20000:
            key=b''.join(pow(int.from_bytes(b[i:i+40],'little'),65537,PUBLIC_KEY).to_bytes(40,'little')[:39] for i in [4,44])[:56]
            fish=Blowfish.new(key,Blowfish.MODE_ECB)
            n=struct.unpack_from('<H',fish.decrypt(b[84:92]))[0]
            count=(13+n*12)//8*8
            header=fish.decrypt(b[84:84+count]);self.start=84+count
        else:
            header=b[p:];n=struct.unpack_from('<H',header)[0];self.start=p+6+n*12
        self.entries={h:(off,size) for h,off,size in (struct.unpack_from('<III',header,6+i*12) for i in range(n))}
    def get(self,name):
        for h in hashes(name):
            if h in self.entries:
                off,size=self.entries[h];return self.data[self.start+off:self.start+off+size]
        return None
    def extract(self,name,dest):
        b=self.get(name)
        if b is not None:Path(dest).parent.mkdir(parents=True,exist_ok=True);Path(dest).write_bytes(b)
        return b is not None
if __name__=='__main__':
    import sys
    m=Mix(sys.argv[1])
    for name in sys.argv[3:]:
        print(name,m.extract(name,Path(sys.argv[2])/name))
