// Authored asset axes are measured before scene yaw: X/Z ground, Y up.
// Vehicles: nose -X. Humanoids: face +Z. Squid: mantle-first swim -Z.
export const actors=[
 {id:'tanya',name:'谭雅',type:'tanya',file:'tanya/tanya-actions.glb',height:.76,x:11,z:15,forwardAxis:[0,0,1],kind:'infantry'},
 {id:'apocalypse',name:'天启坦克',type:'apocalypse',file:'apocalypse-tank/30k.glb',width:1.75,x:15,z:16,forwardAxis:[-1,0,0],kind:'vehicle'},
 {id:'yard',name:'盟军建造厂',type:'construction_yard',file:'allied-construction-yard/30k.glb',width:4.4,x:9,z:8,forwardAxis:[0,0,1],kind:'building'},
 {id:'reactor',name:'苏军核电站',type:'nuclear_reactor',file:'soviet-nuclear-power-plant/30k.glb',width:3.7,x:15,z:7,forwardAxis:[0,0,1],kind:'building'},
 {id:'refinery',name:'苏军矿石精炼厂',type:'soviet_refinery',file:'soviet-ore-refinery/30k.glb',width:3.6,x:8,z:22,forwardAxis:[0,0,1],kind:'building'},
 {id:'miner',name:'武装采矿车',type:'war_miner',file:'war-miner/30k.glb',width:1.5,x:12,z:21,forwardAxis:[-1,0,0],kind:'vehicle'},
 {id:'rocketeer',name:'火箭飞行兵',type:'rocketeer',file:'rocketeer/actions.glb',height:.80,x:18,z:13,forwardAxis:[0,0,1],kind:'air'},
 {id:'cons',name:'苏军动员兵',type:'conscript',file:'../batch-two/cons.glb',height:.76,x:17,z:20,forwardAxis:[0,0,1],kind:'infantry',motionKind:'skeletal'},
 {id:'htnk',name:'犀牛坦克',type:'rhino',file:'../batch-two/htnk-v4-actions.glb',width:1.65,x:16,z:26,forwardAxis:[-1,0,0],kind:'vehicle',motionKind:'mechanical',teamColor:true,muzzleLocal:[-.662,0,0]},
 {id:'dest',name:'盟军驱逐舰',type:'destroyer',file:'../batch-two/dest.glb',width:3.4,x:27,z:23,forwardAxis:[-1,0,0],kind:'naval',motionKind:'mechanical',waterline:-.30},
 {id:'gapile',name:'盟军兵营',type:'barracks',file:'../batch-two/gapile.glb',width:3,x:9,z:28,forwardAxis:[0,0,1],kind:'building',motionKind:'mechanical'},
 {id:'tree26',name:'TREE26 针叶树',file:'../batch-two/tree26.glb',height:2.1,x:20,z:20,forwardAxis:[0,0,1],kind:'environment',environment:true},
 {id:'dirt-road',name:'直线土路模块',file:'../batch-two/dirt-road.glb',width:1,x:17,z:7,forwardAxis:[0,0,1],kind:'environment',environment:true},
 {id:'squid',name:'巨型乌贼',type:'giant_squid',file:'giant-squid/actions.glb',width:2.7,x:25,z:14,forwardAxis:[0,0,-1],kind:'naval'}
];
export const labels={aim_left:'炮塔左转',aim_right:'炮塔右转',rotor:'旋翼',launch:'舰载机起飞',land:'舰载机降落',work:'工作（旗帜）',damaged:'受损',construction:'建造',auto:'自动（游戏状态）',ready:'待命',guard:'警戒',walk:'跑步',idle1:'待机 1',idle2:'待机 2',crawl:'匍匐',prone:'伏地',die1:'倒地 1',die2:'倒地 2',fireup:'站姿射击',fireprone:'卧姿射击',down:'卧倒',up:'起身',wetidle1:'水中待机 1',wetidle2:'水中待机 2',wetdie1:'水中死亡 1',wetdie2:'水中死亡 2',tread:'踩水',swim:'游泳',wetattack:'水中射击',paradrop:'伞降姿态',cheer:'欢呼',panic:'惊慌跑步',swimstop:'游泳 → 踩水',swimstart:'踩水 → 游泳',fly:'飞行',hover:'悬停',firefly:'空中射击',tumble:'翻滚坠落',airdeathstart:'坠落起始',airdeathfalling:'坠落中',airdeathfinish:'落地',attack:'攻击',move:'移动',hit:'受击反馈',repair:'维修反馈'};
export const once=new Set(['die1','die2','wetdie1','wetdie2','down','up','tumble','airdeathstart','airdeathfinish','swimstop','swimstart']);
export const waterActions=new Set(['swim','tread','wetattack','wetidle1','wetidle2','wetdie1','wetdie2','swimstart','swimstop']);
