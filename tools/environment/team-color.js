// Per-instance player color using an explicit embedded GLB mask, not runtime red detection.
import * as T from 'three';
export async function applyTeamColor(gltf,color='#ff0000'){
 const controls=[];const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const mesh of meshes){
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material],next=[];
  for(const source of materials){
   const spec=source.userData.ra2TeamColor;if(!spec){next.push(source);continue;}
   const mask=await gltf.parser.loadImageSource(spec.maskImage,new T.TextureLoader());
   mask.flipY=false;mask.colorSpace=T.NoColorSpace;mask.wrapS=source.map.wrapS;mask.wrapT=source.map.wrapT;
   const material=source.clone(),uniform={value:new T.Color(color)},showMask={value:false};
   material.onBeforeCompile=shader=>{
    shader.uniforms.ra2PlayerColor=uniform;shader.uniforms.ra2PlayerMask={value:mask};shader.uniforms.ra2ShowMask=showMask;
    shader.fragmentShader='uniform vec3 ra2PlayerColor; uniform sampler2D ra2PlayerMask; uniform bool ra2ShowMask;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float ra2Mask=texture2D(ra2PlayerMask,vMapUv).r;
      float ra2Chroma=max(0.0,diffuseColor.r-min(diffuseColor.g,diffuseColor.b));
      diffuseColor.rgb+=ra2Mask*ra2Chroma*(ra2PlayerColor-vec3(1.0,0.0,0.0));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','#include <opaque_fragment>\nif(ra2ShowMask)gl_FragColor=vec4(vec3(ra2Mask),1.0);');
   };
   material.customProgramCacheKey=()=> 'ra2-embedded-team-mask-v1';next.push(material);controls.push({uniform,showMask});
  }
  mesh.material=Array.isArray(mesh.material)?next:next[0];
 }
 if(!controls.length)throw Error('Model has no embedded player-color mask');
 return {setColor:color=>controls.forEach(c=>c.uniform.value.set(color)),showMask:value=>controls.forEach(c=>c.showMask.value=value),materialCount:controls.length};
}
