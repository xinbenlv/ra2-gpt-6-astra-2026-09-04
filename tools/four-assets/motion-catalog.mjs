// Source slots from RocketeerSequence and SQD WalkFrames/FiringFrames; 12 Hz is a preview convention.
export const fps=12;
export const catalogs={rock:{
 fly:{source:[292,6,6],label:'飞行',loop:true},hover:{source:[292,6,6],label:'悬停',loop:true,alias:'fly'},firefly:{source:[370,6,6],label:'空中射击',loop:true},
 tumble:{source:[340,15,0],label:'空中翻落',loop:false},airdeathstart:{source:[340,8,0],label:'空中死亡起始',loop:false},airdeathfalling:{source:[348,1,0],label:'坠落姿势',loop:false},airdeathfinish:{source:[349,6,0],label:'落地',loop:false},paradrop:{source:[418,1,0],label:'伞降姿势',loop:false},cheer:{source:[419,8,0],label:'欢呼',loop:false,fixedFacing:6}
},sqd:{swim:{source:[0,20,20],label:'游动',loop:true},ready:{source:[160,1,1],label:'静止',loop:true},attack:{source:[168,16,16],label:'抓握攻击',loop:false}}};
export function sourceIndex(id,action,facing,frame){const s=catalogs[id][action].source;return s[0]+facing*s[2]+frame;}
export function sourceFacing(id,worldAngle){const q=Math.round(worldAngle/Math.PI*4);return id==='sqd'?((3+q)%8+8)%8:((5-q)%8+8)%8;}
export function worldAngle(id,f){return (id==='sqd'?f-3:5-f)*Math.PI/4;}
