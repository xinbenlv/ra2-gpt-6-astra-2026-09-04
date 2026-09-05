import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { configureMapData, importMap, listMaps } from '../../src/maps.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const publicRoot = process.env.RA2_PUBLIC_DIR ? path.resolve(process.env.RA2_PUBLIC_DIR) : path.join(root, 'public');
const mapDirectory = path.join(publicRoot, 'maps');
configureMapData({
  catalog: JSON.parse(fs.readFileSync(path.join(mapDirectory, 'catalog.json'), 'utf8')),
  terrain: JSON.parse(fs.readFileSync(path.join(mapDirectory, 'terrain.json'), 'utf8')),
  overlays: JSON.parse(fs.readFileSync(path.join(mapDirectory, 'overlays.json'), 'utf8')),
});
const output = path.join(mapDirectory, 'previews');
fs.mkdirSync(output, { recursive: true });
const crcTable = Array.from({length:256}, (_,index) => {
  let value = index;
  for (let i=0;i<8;i++) value = value&1 ? 0xedb88320^(value>>>1) : value>>>1;
  return value >>> 0;
});
function chunk(type: string, data: Buffer): Buffer {
  const combined = Buffer.concat([Buffer.from(type),data]);
  let crc = 0xffffffff;
  for (const value of combined) crc = crcTable[(crc^value)&255]! ^ (crc>>>8);
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([size,combined,checksum]);
}
function png(width:number,height:number,rgb:Uint8Array):Buffer {
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
  const rows=Buffer.alloc((width*3+1)*height);
  for(let y=0;y<height;y++) rows.set(rgb.subarray(y*width*3,(y+1)*width*3), y*(width*3+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
let count = 0;
for (const definition of listMaps()) {
  const map = importMap(fs.readFileSync(path.join(mapDirectory,definition.filename),'utf8'), definition.filename,definition);
  if (map.previewData) {
    const {width,height,rgb}=map.previewData;
    fs.writeFileSync(path.join(output,definition.id+'.png'),png(width,height,rgb));count++;
  }
}
console.log(`Decoded ${count} original RA2 PreviewPack images without redrawing them.`);
