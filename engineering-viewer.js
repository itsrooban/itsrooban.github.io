(function(){
  const canvas=document.getElementById('machineCanvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d',{alpha:false});
  const $=id=>document.getElementById(id);
  const tabs=[...document.querySelectorAll('.model-tab')];
  const canvasHost=$('modelStage');
  const names=['arm','plasma','amr'];
  const models={
    arm:{
      index:'01 / 03',title:'Six-axis robotic arm',stage:'Six-axis robotic arm',sub:'Articulated reach · joint motion',badge:'ROBOTICS',mode:'KINEMATIC STUDY',phaseLabel:'Joint sweep',
      description:'A conceptual articulated arm with a cast base, servo joints, structural links, wrist and end-effector interface.',
      parts:[['base','Base'],['shoulder','Shoulder'],['upper','Upper link'],['elbow','Elbow'],['forearm','Forearm'],['wrist','Wrist'],['tool','Tool flange']],
      offsets:{shoulder:[-.18,.36,0],upper:[-.28,.52,0],elbow:[0,.64,0],forearm:[.32,.43,.08],wrist:[.4,.48,0],tool:[.56,.4,0]},
      footnote:'Illustrative kinematic geometry for portfolio exploration. Dimensions, payload and reach are not production specifications.'
    },
    plasma:{
      index:'02 / 03',title:'Plasma process tool',stage:'Plasma process tool',sub:'Vacuum chamber · process modules',badge:'PROCESS TOOL',mode:'PROCESS CYCLE',phaseLabel:'Process phase',
      description:'A generic semiconductor process-tool concept with a vacuum chamber cluster, load-lock modules, service cabinets and utility routing.',
      parts:[['frame','Base frame'],['cabinetL','Left service cabinet'],['cabinetR','Right service cabinet'],['chamber','Vacuum chamber'],['ports','Process modules'],['pump','Pump module'],['panel','Control panel']],
      offsets:{cabinetL:[-.62,.18,0],cabinetR:[.62,.18,0],chamber:[0,.72,0],ports:[0,.5,.28],pump:[0,-.42,-.12],panel:[.4,.16,.7]},
      footnote:'Generic conceptual process-tool layout. It does not depict proprietary Applied Materials production CAD or a specific tool configuration.'
    },
    amr:{
      index:'03 / 03',title:'Autonomous mobile robot',stage:'AMR drive base',sub:'Drive modules · sensor sweep · payload deck',badge:'MOBILE ROBOT',mode:'NAVIGATION STUDY',phaseLabel:'Route position',
      description:'A low-profile mobile robot concept showing its welded chassis, traction modules, protected battery, payload deck and navigation sensor.',
      parts:[['chassis','Chassis'],['wheels','Drive modules'],['battery','Battery'],['deck','Upper deck'],['lift','Lift interface'],['lidar','Lidar']],
      offsets:{wheels:[0,-.42,0],battery:[0,.55,0],deck:[0,.72,0],lift:[0,1.02,0],lidar:[.35,.72,0]},
      footnote:'Illustrative mobile-platform architecture. Payload ratings, navigation performance and safety compliance require project-specific validation.'
    }
  };
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const state={scene:'arm',width:0,height:0,dpr:1,time:0,playing:!reduceMotion.matches,explode:0,pose:.5,yaw:-.58,pitch:.48,zoom:1,selected:null,drag:null,raf:0,last:0,visible:true};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>{const n=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/n,a[1]/n,a[2]/n]};
  function groupShift(part){
    const delta=(models[state.scene].offsets||{})[part]||[0,0,0];
    let move=[0,0,0];
    if(state.scene==='amr'&&state.playing)move=[Math.sin(state.time*.55)*.15,0,Math.cos(state.time*.55)*.09];
    return add(mul(delta,state.explode/100),move);
  }
  function moved(point,part){return add(point,groupShift(part))}
  function addFace(faces,points,color,part){
    const normal=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
    faces.push({points,color,part,normal,depth:0,projected:null});
  }
  function addBox(faces,center,size,color,part){
    center=moved(center,part);
    const [sx,sy,sz]=size.map(v=>v/2);
    const p=[
      [center[0]-sx,center[1]-sy,center[2]-sz],[center[0]+sx,center[1]-sy,center[2]-sz],
      [center[0]+sx,center[1]+sy,center[2]-sz],[center[0]-sx,center[1]+sy,center[2]-sz],
      [center[0]-sx,center[1]-sy,center[2]+sz],[center[0]+sx,center[1]-sy,center[2]+sz],
      [center[0]+sx,center[1]+sy,center[2]+sz],[center[0]-sx,center[1]+sy,center[2]+sz]
    ];
    [[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[7,6,2,3],[0,1,5,4]].forEach(face=>addFace(faces,face.map(i=>p[i]),color,part));
  }
  function addCylinder(faces,start,end,radius,color,part,segments=18,topRadius=radius){
    start=moved(start,part);end=moved(end,part);
    const axis=unit(sub(end,start));
    let ref=Math.abs(axis[1])<.92?[0,1,0]:[1,0,0];
    const u=unit(cross(axis,ref)),v=unit(cross(axis,u));
    const a=[],b=[];
    for(let i=0;i<segments;i++){
      const t=2*Math.PI*i/segments;
      const radial=add(mul(u,Math.cos(t)),mul(v,Math.sin(t)));
      a.push(add(start,mul(radial,radius)));
      b.push(add(end,mul(radial,topRadius)));
    }
    for(let i=0;i<segments;i++)addFace(faces,[a[i],a[(i+1)%segments],b[(i+1)%segments],b[i]],color,part);
    addFace(faces,a.slice().reverse(),color,part);addFace(faces,b,color,part);
  }
  function addBeam(faces,start,end,width,depth,color,part){
    start=moved(start,part);end=moved(end,part);
    const axis=unit(sub(end,start));
    let ref=Math.abs(axis[2])<.92?[0,0,1]:[0,1,0];
    const side=unit(cross(axis,ref)),normal=unit(cross(axis,side));
    const sw=mul(side,width/2),sd=mul(normal,depth/2);
    const p=[
      add(add(start,sw),sd),add(sub(start,sw),sd),sub(sub(start,sw),sd),sub(add(start,sw),sd),
      add(add(end,sw),sd),add(sub(end,sw),sd),sub(sub(end,sw),sd),sub(add(end,sw),sd)
    ];
    [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7],[0,3,2,1]].forEach(face=>addFace(faces,face.map(i=>p[i]),color,part));
  }
  function addPath(faces,points,radius,color,part){
    for(let i=0;i<points.length-1;i++)addCylinder(faces,points[i],points[i+1],radius,color,part,8);
  }
  function rotateY(p,angle){const c=Math.cos(angle),s=Math.sin(angle);return [p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c]}
  function addTread(faces,center,angle,part){
    const p=[center[0],center[1],center[2]];
    const r=.405;
    for(let i=0;i<18;i++){
      const a=angle+i*Math.PI*2/18;
      const x=p[0]+Math.sin(a)*r,y=p[1]+Math.cos(a)*r;
      const start=[x-.045,y-.018,p[2]-.135],end=[x+.045,y+.018,p[2]+.135];
      addBox(faces,[x,y,p[2]],[.09,.035,.27],'#3d4b50',part);
    }
  }
  function buildArm(faces,t){
    const motion=state.playing?Math.sin(t*.78):((state.pose-.5)*2);
    const baseYaw=state.playing?Math.sin(t*.25)*.16:0;
    const point=p=>rotateY(p,baseYaw);
    addBox(faces,[0,.11,0],[1.35,.22,1.02],'#263b47','base');
    addBox(faces,[0,.24,0],[1.05,.12,.82],'#73828a','base');
    addCylinder(faces,[0,.28,0],[0,.66,0],.53,'#98a8ac','base',24,.47);
    addCylinder(faces,[0,.58,0],[0,.91,0],.39,'#405660','base',24,.43);
    addCylinder(faces,[0,.86,0],[0,1.13,0],.32,'#b7c3c6','shoulder',24,.33);
    const shoulder=point([0,1.22,0]);
    const a1=.67+motion*.2,a2=.2+Math.sin(t*.68+1)*.26+(state.playing?0:(state.pose-.5)*.42),a3=-.22+Math.sin(t*.72+2)*.22;
    const l1=1.48,l2=1.25,l3=.69;
    const elbow0=[l1*Math.sin(a1),1.22+l1*Math.cos(a1),0];
    const wrist0=[elbow0[0]+l2*Math.sin(a2),elbow0[1]+l2*Math.cos(a2),0];
    const tool0=[wrist0[0]+l3*Math.sin(a3),wrist0[1]+l3*Math.cos(a3),0];
    const elbow=point(elbow0),wrist=point(wrist0),tip=point(tool0);
    addCylinder(faces,point([0,1.07,-.36]),point([0,1.07,.36]),.36,'#283b46','shoulder',20);
    addCylinder(faces,point([0,1.07,.37]),point([0,1.07,.42]),.24,'#49b9ab','shoulder',20);
    addBeam(faces,shoulder,elbow,.58,.48,'#aebabe','upper');
    addBeam(faces,point([shoulder[0]+.03,shoulder[1]-.06,.25]),point([elbow[0]-.03,elbow[1]-.06,.25]),.06,.025,'#45b8aa','upper');
    addCylinder(faces,point([elbow[0],elbow[1],-.43]),point([elbow[0],elbow[1],.43]),.34,'#273a45','elbow',22);
    addCylinder(faces,point([elbow[0],elbow[1],.44]),point([elbow[0],elbow[1],.49]),.23,'#7dd3c5','elbow',20);
    addBeam(faces,elbow,wrist,.46,.4,'#c0c9c9','forearm');
    addBeam(faces,point([elbow[0],elbow[1]-.06,.215]),point([wrist[0],wrist[1]-.06,.215]),.055,.028,'#52666f','forearm');
    const cable=[point([.13,1.4,-.28]),point([.49,2.03,-.3]),point([.66,2.13,-.31]),point([wrist[0]-.05,wrist[1]+.1,-.28])];
    addPath(faces,cable,.042,'#26363d','forearm');
    addCylinder(faces,point([wrist[0],wrist[1],-.34]),point([wrist[0],wrist[1],.34]),.26,'#273943','wrist',20);
    addCylinder(faces,point([wrist[0],wrist[1],.35]),point([wrist[0],wrist[1],.43]),.18,'#69c5b5','wrist',20);
    addBeam(faces,wrist,tip,.32,.3,'#acb9bd','tool');
    addCylinder(faces,point([tip[0],tip[1],-.22]),point([tip[0],tip[1],.22]),.17,'#344852','tool',18);
    const clawA=point([tip[0]+.3,tip[1]+.2,0]),clawB=point([tip[0]+.3,tip[1]-.2,0]);
    addBeam(faces,point([tip[0],tip[1],0]),clawA,.12,.15,'#76c6ba','tool');
    addBeam(faces,point([tip[0],tip[1],0]),clawB,.12,.15,'#76c6ba','tool');
    const floor=point([0,.02,0]);drawRing(floor,1.05,'rgba(111,222,195,.24)',[4,6]);
  }
  function buildAMR(faces,t){
    const cycle=state.playing?t:state.pose*Math.PI*2;const drift=state.playing?Math.sin(cycle*.56)*.22:(state.pose-.5)*.7;
    const x=drift;
    drawGroundRoute(t);
    addBox(faces,[x,.3,0],[4.05,.47,2.22],'#2c414b','chassis');
    addBox(faces,[x,.52,0],[3.82,.12,2.02],'#70848a','chassis');
    addBox(faces,[x,.64,0],[3.56,.16,1.78],'#c4cdce','deck');
    addBox(faces,[x,.735,0],[3.15,.035,1.4],'#9cabad','deck');
    addBox(faces,[x,.83,-.1],[1.26,.38,1.04],'#405660','battery');
    addBox(faces,[x,.855,-.1],[1.04,.22,.86],'#566b72','battery');
    addBox(faces,[x,.7,.58],[1.55,.24,.5],'#91a1a2','lift');
    addBox(faces,[x,.84,.58],[1.12,.1,.36],'#c2ccca','lift');
    addBox(faces,[x+1.45,.89,-.45],[.57,.19,.45],'#b9c5c6','deck');
    addBox(faces,[x+1.45,1.01,-.45],[.34,.08,.26],'#384d56','deck');
    addCylinder(faces,[x+1.45,1.05,-.45],[x+1.45,1.27,-.45],.19,'#c1cbcb','lidar',24,.19);
    addCylinder(faces,[x+1.45,1.25,-.45],[x+1.45,1.29,-.45],.21,'#35afa7','lidar',24,.21);
    addCylinder(faces,[x+1.45,1.16,-.45],[x+1.45,1.19,-.45],.195,'#243941','lidar',24,.195);
    const wheelDefs=[[-1.25,.28,-1.14],[1.25,.28,-1.14],[-1.25,.28,1.14],[1.25,.28,1.14]];
    wheelDefs.forEach((p,i)=>{
      const wp=[p[0]+x,p[1],p[2]];
      const axisA=[wp[0]-.17,wp[1],wp[2]],axisB=[wp[0]+.17,wp[1],wp[2]];
      addCylinder(faces,axisA,axisB,.44,'#202b31','wheels',22);
      addCylinder(faces,[wp[0]-.185,wp[1],wp[2]],[wp[0]-.2,wp[1],wp[2]],.25,'#788b8d','wheels',20);
      addCylinder(faces,[wp[0]+.185,wp[1],wp[2]],[wp[0]+.2,wp[1],wp[2]],.25,'#788b8d','wheels',20);
      for(let k=0;k<10;k++){
        const a=cycle*3+k*Math.PI/5;
        const gx=wp[0]+Math.sin(a)*.405,gy=wp[1]+Math.cos(a)*.405;
        addBox(faces,[gx,gy,wp[2]],[.085,.036,.31],'#45545a','wheels');
      }
    });
    for(const px of [-1.52,1.52])for(const pz of [-.73,.73])addCylinder(faces,[x+px,.72,pz],[x+px,.76,pz],.045,'#e7ece8','deck',10);
    for(let i=0;i<4;i++)addBox(faces,[x-1.84+i*1.22,.58,1.11],[.44,.11,.11],'#dce4df','chassis');
    addCylinder(faces,[x-1.75,.73,.97],[x-1.75,.84,.97],.09,'#d85e4f','deck',14);
    const scan=[x+1.45,1.29,-.45];
    const angle=cycle*1.2;
    const scanA=[scan[0]+Math.cos(angle)*1.4,scan[1]-.2,scan[2]+Math.sin(angle)*1.4];
    const scanB=[scan[0]+Math.cos(angle+.38)*1.4,scan[1]-.2,scan[2]+Math.sin(angle+.38)*1.4];
    drawPath2D3D([scan,scanA,scanB,scan],'rgba(205,244,123,.23)',1);
  }
  function buildPlasma(faces,t){
    const cycle=state.playing?t:state.pose*Math.PI*2;const glow=.5+.5*Math.sin(cycle*2.2);
    addBox(faces,[0,.16,0],[6.05,.32,2.38],'#34464e','frame');
    addBox(faces,[0,.38,0],[5.76,.16,2.12],'#839194','frame');
    addBox(faces,[0,.52,0],[5.45,.12,1.92],'#b3bdbe','frame');
    for(const x of [-2.15,2.15]){
      addBox(faces,[x,1.46,0],[1.17,1.82,1.62],'#c5cecf',x<0?'cabinetL':'cabinetR');
      addBox(faces,[x,1.47,.835],[1.06,1.65,.07],'#9ba9ab',x<0?'cabinetL':'cabinetR');
      const key=x<0?'cabinetL':'cabinetR';
      addBox(faces,[x,2.33,.88],[1.13,.15,.09],'#53666d',key);
      addBox(faces,[x,2.42,.88],[.66,.05,.08],'#d8dfdc',key);
      for(let i=0;i<7;i++)addBox(faces,[x-.34+i*.11,1.08,.89],[.055,.29,.035],'#596b70',key);
      addBox(faces,[x,1.87,.89],[.43,.3,.08],x>0?'#183d4b':'#425b61',key);
      if(x>0)addBox(faces,[x,1.87,.941],[.35,.22,.012],'#47b5aa','panel');
      for(let i=0;i<3;i++)addCylinder(faces,[x-.4+i*.13,2.14,.92],[x-.4+i*.13,2.18,.92],.036,i===1?'#dcad68':'#5bd2aa',key,12);
      addBox(faces,[x,.58,-.72],[.72,.2,.28],'#5b6d71',key);
      for(let i=0;i<2;i++)addCylinder(faces,[x-.2+i*.4,.69,-.8],[x-.2+i*.4,.76,-.8],.09,'#34474e',key,14);
    }
    addBox(faces,[0,1.12,.35],[1.48,1.07,1.08],'#4c5f65','chamber');
    addBox(faces,[0,1.11,.91],[1.12,.82,.055],'#52666b','chamber');
    addCylinder(faces,[0,1.54,-.12],[0,2.23,-.12],.79,'#aebabc','chamber',28,.82);
    addCylinder(faces,[0,2.23,-.12],[0,2.33,-.12],.84,'#596b70','chamber',28,.84);
    addCylinder(faces,[0,2.34,-.12],[0,2.42,-.12],.73,'#d1d9d8','chamber',28,.7);
    addCylinder(faces,[0,1.51,.69],[0,1.51,.76],.37,'#42575e','chamber',24,.37);
    addCylinder(faces,[0,1.51,.77],[0,1.51,.8],.28,'#42b8b2','chamber',24,.28);
    addCylinder(faces,[-.72,1.64,-.12],[-1.31,1.64,-.12],.42,'#aeb9bb','ports',22,.38);
    addCylinder(faces,[-1.26,1.64,-.12],[-1.37,1.64,-.12],.34,'#606f73','ports',22,.34);
    addCylinder(faces,[.72,1.64,-.12],[1.31,1.64,-.12],.42,'#aeb9bb','ports',22,.38);
    addCylinder(faces,[1.26,1.64,-.12],[1.37,1.64,-.12],.34,'#606f73','ports',22,.34);
    addCylinder(faces,[-.72,1.04,.52],[-1.15,1.04,.52],.28,'#92a1a3','ports',20,.3);
    addCylinder(faces,[.72,1.04,.52],[1.15,1.04,.52],.28,'#92a1a3','ports',20,.3);
    addBox(faces,[0,.93,-.7],[1.58,.58,.49],'#5e7074','pump');
    addBox(faces,[0,.94,-.96],[1.35,.41,.07],'#253b43','pump');
    for(let i=0;i<7;i++)addBox(faces,[-.55+i*.18,1.02,-1.01],[.055,.24,.02],'#87a1a2','pump');
    addBeam(faces,[-1.2,2.18,-.1],[-.86,2.18,-.1],.11,.11,'#5d7075','ports');
    addBeam(faces,[1.2,2.18,-.1],[.86,2.18,-.1],.11,.11,'#5d7075','ports');
    for(let i=0;i<8;i++)addBox(faces,[-.55+i*.16,2.48,.08],[.085,.07,.09],'#53686e','chamber');
    addCylinder(faces,[-2.15,2.08,.12],[-2.15,2.22,.12],.045,'#60d3aa','cabinetL',12);
    addCylinder(faces,[2.15,2.08,.12],[2.15,2.22,.12],.045,glow>.35?'#60d3aa':'#b3bb7a','cabinetR',12);
  }
  function viewConfig(){
    if(state.scene==='arm')return {target:[.1,2.12,0],scale:1};
    if(state.scene==='plasma')return {target:[0,1.38,0],scale:1.08};
    return {target:[0,.52,0],scale:1.27};
  }
  function project(p){
    const cfg=viewConfig(),scale=Math.min(state.width/8.1,state.height/5.9)*cfg.scale*state.zoom;
    let x=p[0]-cfg.target[0],y=p[1]-cfg.target[1],z=p[2]-cfg.target[2];
    const yaw=state.yaw+(state.playing?state.time*.018:0),cy=Math.cos(yaw),sy=Math.sin(yaw);
    const rx=cy*x-sy*z,rz=sy*x+cy*z,cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
    const ry=cp*y-sp*rz,depth=sp*y+cp*rz,focal=Math.max(state.width,state.height)*2.7;
    const perspective=focal/(focal+depth*scale*.34);
    return {x:state.width*.53+rx*scale*perspective,y:state.height*.68-ry*scale*perspective,d:depth};
  }
  function shade(hex,factor){
    const n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    const f=clamp(factor,.34,1.25);
    return 'rgb('+Math.round(clamp(r*f,0,255))+','+Math.round(clamp(g*f,0,255))+','+Math.round(clamp(b*f,0,255))+')';
  }
  function blend(hex,other,amount){
    const a=parseInt(hex.slice(1),16),b=parseInt(other.slice(1),16),t=clamp(amount,0,1);
    const r=Math.round(((a>>16)&255)*(1-t)+((b>>16)&255)*t);
    const g=Math.round(((a>>8)&255)*(1-t)+((b>>8)&255)*t);
    const bl=Math.round((a&255)*(1-t)+(b&255)*t);
    return 'rgb('+r+','+g+','+bl+')';
  }
  function paintFaces(faces){
    const light=unit([-.42,.83,.56]);
    faces.forEach(face=>{face.projected=face.points.map(project);face.depth=face.projected.reduce((s,p)=>s+p.d,0)/face.projected.length});
    faces.sort((a,b)=>a.depth-b.depth);
    for(const face of faces){
      const lighting=.62+(dot(face.normal,light)+1)*.22;
      const focused=state.selected===face.part;
      let color=shade(face.color,lighting);
      if(focused)color=blend(color,'#c9f379',.45);
      ctx.beginPath();face.projected.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.fillStyle=color;ctx.fill();
      ctx.strokeStyle=focused?'rgba(220,251,148,.88)':'rgba(8,18,24,.42)';
      ctx.lineWidth=focused?1.25:.75;ctx.stroke();
      if(!focused&&lighting>.93){ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=.45;ctx.stroke()}
    }
  }
  function drawPath3D(points,color,width,dash){
    const ps=points.map(project);ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash||[]);ctx.stroke();ctx.setLineDash([]);
  }
  function drawPath2D3D(points,color,width){drawPath3D(points,color,width,[])}
  function drawRing(center,radius,color,dash){
    const points=[];for(let i=0;i<=56;i++){const a=i*Math.PI*2/56;points.push([center[0]+Math.cos(a)*radius,center[1],center[2]+Math.sin(a)*radius])}
    drawPath3D(points,color,1.25,dash);
  }
  function drawGroundRoute(t){
    const pts=[];for(let i=0;i<=84;i++){const a=i*Math.PI*2/84;pts.push([Math.cos(a)*2.9,.025,Math.sin(a)*1.72])}
    drawPath3D(pts,'rgba(205,244,123,.33)',1.3,[4,7]);
    const a=t*.4,bot=[Math.cos(a)*2.9,.035,Math.sin(a)*1.72],p=project(bot);
    ctx.beginPath();ctx.arc(p.x,p.y,5+Math.sin(t*2)*1.2,0,Math.PI*2);ctx.fillStyle='rgba(205,244,123,.9)';ctx.shadowColor='#cdf47b';ctx.shadowBlur=15;ctx.fill();ctx.shadowBlur=0;
  }
  function drawBackground(){
    const g=ctx.createLinearGradient(0,0,state.width,state.height);g.addColorStop(0,'#101b27');g.addColorStop(.55,'#172736');g.addColorStop(1,'#111d28');ctx.fillStyle=g;ctx.fillRect(0,0,state.width,state.height);
    const glow=ctx.createRadialGradient(state.width*.57,state.height*.49,5,state.width*.57,state.height*.49,state.width*.68);glow.addColorStop(0,'rgba(58,116,119,.25)');glow.addColorStop(1,'rgba(9,17,24,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,state.width,state.height);
    ctx.save();ctx.globalAlpha=.6;
    for(let i=-5;i<=5;i++){
      drawPath3D([[i,0,-5],[i,0,5]],'rgba(157,194,199,.105)',.8,[]);
      drawPath3D([[-5,0,i],[5,0,i]],'rgba(157,194,199,.105)',.8,[]);
    }
    ctx.restore();
    const base=project([0,.02,0]);const rad=ctx.createRadialGradient(base.x,base.y,2,base.x,base.y,state.width*.24);rad.addColorStop(0,'rgba(4,10,15,.53)');rad.addColorStop(1,'rgba(4,10,15,0)');ctx.fillStyle=rad;ctx.beginPath();ctx.ellipse(base.x,base.y,state.width*.24,state.height*.085,0,0,Math.PI*2);ctx.fill();
  }
  function drawAxis(){
    const origin=project([0,.025,0]),unitPx=Math.max(24,Math.min(42,state.width*.05));
    const ends=[[.55,0,0],[0,.55,0],[0,0,.55]],cols=['#e39b78','#b4dd8d','#85c7eb'];
    ends.forEach((p,i)=>{const e=project(p);ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(origin.x+(e.x-origin.x)*unitPx/.55,origin.y+(e.y-origin.y)*unitPx/.55);ctx.strokeStyle=cols[i];ctx.lineWidth=1.7;ctx.stroke()});
  }
  function render(){
    if(!state.width||!state.height)return;
    ctx.setTransform(state.dpr,0,0,state.dpr,0,0);drawBackground();
    const faces=[];
    if(state.scene==='arm')buildArm(faces,state.time);
    else if(state.scene==='plasma')buildPlasma(faces,state.time);
    else buildAMR(faces,state.time);
    paintFaces(faces);
    if(state.scene==='plasma'){
      const p=project([0,1.51,.82]);const glow=ctx.createRadialGradient(p.x,p.y,1,p.x,p.y,34+14*Math.sin(state.time*2));glow.addColorStop(0,'rgba(147,255,229,.45)');glow.addColorStop(1,'rgba(62,207,184,0)');ctx.fillStyle=glow;ctx.fillRect(p.x-50,p.y-50,100,100);
    }
    drawAxis();
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    state.width=rect.width;state.height=rect.height;state.dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(state.width*state.dpr);canvas.height=Math.round(state.height*state.dpr);render();
  }
  function updateModel(name){
    if(!models[name])return;
    state.scene=name;state.explode=0;state.pose=.5;state.selected=null;
    $('modelExplode').value='0';$('modelExplodeValue').textContent='0%';$('modelPhase').value='50';$('modelPhaseValue').textContent='50%';
    tabs.forEach(button=>{const active=button.dataset.model===name;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});
    const model=models[name];
    $('modelIndex').textContent=model.index;$('modelTitle').textContent=model.title;$('modelStageName').textContent=model.stage;$('modelStageSub').textContent=model.sub;$('modelBadge').textContent=model.badge;$('modelDescription').textContent=model.description;$('modelPhaseLabel').textContent=model.phaseLabel;$('modelFootnote').textContent=model.footnote;$('telemetryMode').textContent=model.mode;$('telemetryPart').textContent='Focus · complete assembly';
    const group=$('modelComponents');group.replaceChildren();
    model.parts.forEach(([key,label])=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.focus=key;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>setFocus(key,label));group.appendChild(button)});
    canvas.setAttribute('aria-label',model.stage+'. Interactive conceptual 3D model. Drag to orbit; use the wheel or pinch to zoom.');
    resize();
  }
  function setFocus(key,label){
    state.selected=state.selected===key?null:key;
    $('modelComponents').querySelectorAll('button').forEach(button=>{const active=button.dataset.focus===state.selected;button.classList.toggle('is-selected',active);button.setAttribute('aria-pressed',String(active))});
    const chosen=state.selected?label:'complete assembly';$('telemetryPart').textContent='Focus · '+chosen;
    render();
  }
  function updatePlay(){
    $('modelPlay').textContent=state.playing?'Ⅱ  Pause cycle':'▶  Play cycle';$('modelPlay').setAttribute('aria-pressed',String(state.playing));$('modelStatus').textContent=state.playing?'CYCLE RUNNING':'CYCLE PAUSED';
  }
  function frame(now){
    state.raf=0;if(!state.visible||!state.playing)return;
    if(state.last)state.time+=(now-state.last)/1000;state.last=now;render();state.raf=requestAnimationFrame(frame);
  }
  function start(){if(!state.playing||!state.visible||state.raf)return;state.last=0;state.raf=requestAnimationFrame(frame)}
  function stop(){if(state.raf){cancelAnimationFrame(state.raf);state.raf=0}state.last=0;render()}
  function togglePlay(){state.playing=!state.playing;updatePlay();if(state.playing)start();else stop()}
  function resetView(){
    state.yaw=-.58;state.pitch=.48;state.zoom=1;state.explode=0;state.pose=.5;state.selected=null;
    $('modelExplode').value='0';$('modelExplodeValue').textContent='0%';$('modelPhase').value='50';$('modelPhaseValue').textContent='50%';
    $('modelComponents').querySelectorAll('button').forEach(b=>{b.classList.remove('is-selected');b.setAttribute('aria-pressed','false')});
    $('telemetryPart').textContent='Focus · complete assembly';$('telemetryView').textContent='Orbit · reset';render();
  }
  tabs.forEach(button=>button.addEventListener('click',()=>updateModel(button.dataset.model)));
  $('modelExplode').addEventListener('input',event=>{state.explode=Number(event.target.value);$('modelExplodeValue').textContent=state.explode+'%';render()});
  $('modelPhase').addEventListener('input',event=>{state.pose=Number(event.target.value)/100;$('modelPhaseValue').textContent=event.target.value+'%';render()});
  $('modelPlay').addEventListener('click',togglePlay);$('modelReset').addEventListener('click',resetView);
  canvas.addEventListener('pointerdown',event=>{state.drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId)});
  canvas.addEventListener('pointermove',event=>{if(!state.drag)return;const dx=event.clientX-state.drag.x,dy=event.clientY-state.drag.y;state.drag={x:event.clientX,y:event.clientY};state.yaw+=dx*.008;state.pitch=clamp(state.pitch+dy*.006,.08,1.16);$('telemetryView').textContent='Orbit · hand controlled';render()});
  const endDrag=()=>{state.drag=null};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('wheel',event=>{event.preventDefault();state.zoom=clamp(state.zoom*Math.exp(-event.deltaY*.001),.68,1.75);$('telemetryView').textContent='Zoom · '+Math.round(state.zoom*100)+'%';render()},{passive:false});
  canvas.addEventListener('keydown',event=>{if(event.key==='ArrowLeft')state.yaw-=.12;else if(event.key==='ArrowRight')state.yaw+=.12;else if(event.key==='ArrowUp')state.pitch=clamp(state.pitch-.08,.08,1.16);else if(event.key==='ArrowDown')state.pitch=clamp(state.pitch+.08,.08,1.16);else if(event.key==='+'||event.key==='=')state.zoom=clamp(state.zoom+.1,.68,1.75);else if(event.key==='-')state.zoom=clamp(state.zoom-.1,.68,1.75);else return;event.preventDefault();render()});
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{state.visible=!document.hidden;if(state.visible)start();else stop()});
  if('IntersectionObserver'in window){
    new IntersectionObserver(entries=>{state.visible=entries[0].isIntersecting&&!document.hidden;if(state.visible)start();else stop()},{threshold:.05}).observe(canvasHost);
  }
  reduceMotion.addEventListener?.('change',event=>{if(event.matches&&state.playing){state.playing=false;updatePlay();stop()}});
  updateModel('arm');updatePlay();start();
})();