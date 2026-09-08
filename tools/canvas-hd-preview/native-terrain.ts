import type {Assets} from '@game/assets';
import type {ResolvedTerrainCell} from '@game/custom-terrain';
import type {MapData} from '@game/maps';
import type {Terrain} from '@game/game/types';

/** Reuse an unchanged block of native map cells, including original heights and TMP subtiles. */
export function applyNativeTerrain(map:{width:number;height:number;cells:Terrain[]},resolvedTerrain:ResolvedTerrainCell[],source:MapData,assets:Assets){
 const elevations=Array(map.width*map.height).fill(0),slopes=Array(map.width*map.height).fill(0),tiles:MapData['tiles']=[];
 const patch={sourceMap:'valley.map',sourceX:83,sourceY:86,width:13,height:9,x:24,y:26};
 for(const tile of source.tiles){
  if(tile.x<patch.sourceX||tile.x>=patch.sourceX+patch.width||tile.y<patch.sourceY||tile.y>=patch.sourceY+patch.height)continue;
  const x=tile.x-patch.sourceX+patch.x,y=tile.y-patch.sourceY+patch.y,index=y*map.width+x;
  map.cells[index]=tile.terrain;elevations[index]=tile.elevation;slopes[index]=tile.slope;
  tiles.push({...tile,x,y});resolvedTerrain[index]={kind:tile.terrain,layers:[{tileId:tile.tileId,subTile:tile.subTile,theater:source.theater.toLowerCase()}]};
 }
 const required=new Set<string>();
 for(const cell of resolvedTerrain){
  if(!cell.layers.length)throw Error('原版地形缺少对应图层：'+cell.kind);
  for(const layer of cell.layers){const key=`${layer.theater}:${layer.tileId}:${layer.subTile}`,sprite=assets.terrain[key];required.add(key);if(!sprite||!assets.images.has(sprite.src))throw Error('缺少原版地块：'+key);}
  if(cell.overlayKey){const sprite=assets.manifest.overlays?.[cell.overlayKey];if(!sprite||!assets.images.has(sprite.src))throw Error('缺少原版资源覆盖物：'+cell.overlayKey);}
 }
 const sample=(x:number,y:number)=>{const i=y*map.width+x;return ((elevations[i]||0)+(slopes[i]?0.5:0))*15;};
 const groundHeight=(x:number,y:number)=>{const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;return (sample(a,b)*(1-u)+sample(a+1,b)*u)*(1-v)+(sample(a,b+1)*(1-u)+sample(a+1,b+1)*u)*v;};
 return {groundBase:resolvedTerrain[0].layers[0],resolvedTerrain,elevations,tiles,groundHeight,originalTerrain:{patch,required:[...required]}};
}
