/* ====================== WARGA PULAU LANGIT v3 ======================
   Peta besar 96x96 • warga membangun kota sendiri (pathfinding A*, tidak menembus objek)
   v3: pekerjaan warga (gaji 1 kas) • warga mencari sumber daya sendiri • minimal 100 warga • waktu real-time
       free camera • rekam layar • semua fitur di menu ☰ • tombol simpan • jalan tanpa server (bisa di Acode) */
const fr=document.getElementById('fr'),$=id=>document.getElementById(id);
const MAKS_WARGA=100;   // jumlah warga maksimal yang digambar (naikkan kalau HP/PC kuat)
/* ---------- mode pemilik (Pak Bani) ----------
   Pemain lain hanya menonton (menu & tambah warga/sumber daya terkunci). Pemilik masuk dengan PIN:
   ketuk pojok kiri atas 5x cepat, atau buka alamat game dengan #pemilik. Di komputer/HP sendiri (localhost, file://, Acode) langsung jadi pemilik. */
const PIN_BAWAAN='05939ed3aadd51cf797a48c676c5ad9ba567db8a79d35e0fea582891b9fb00c0';   // PIN bawaan: pakbani (ganti lewat alat-pemilik/buat-pin.html lalu isi config.js)
function PINHASH(){return typeof OWNER_PIN_SHA256!='undefined'?OWNER_PIN_SHA256:PIN_BAWAAN}
const LOCAL=location.protocol=='file:'||/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
let OWNER=LOCAL||window.WPL_OPEN===true;try{if(!OWNER)OWNER=localStorage.getItem('wpl_owner')===PINHASH()}catch(_){}
const MIN_WARGA=1;      // jumlah warga awal = hanya Pak Bani; warga lain ditambah sendiri lewat menu ☰ (isi mis. 100 kalau mau kota selalu ramai)
const GAJI=1,CARRY=5,GDUR=4,PDUR=10;   // gaji (kas) per siklus kerja • muatan per perjalanan • detik mengumpulkan • detik 1 siklus kerja di bangunan
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const RK=['kayu','batu','makanan','besi','bahan'],RI={kayu:'🪵',batu:'🪨',makanan:'🌾',besi:'⚙️',bahan:'🧱'};
/* w,h = ukuran lahan (petak); p = warga minimal; c = biaya */
const DEF={rumah:{n:'Rumah',c:{kayu:8,bahan:4,kas:10},p:1,w:1,h:1},
sumur:{n:'Sumur',c:{batu:6,kas:8},p:3,w:1,h:1},
ladang:{n:'Ladang',c:{kayu:4,makanan:6,kas:5},p:2,w:2,h:2},
lumbung:{n:'Lumbung',c:{kayu:12,makanan:8,kas:15},p:4,w:2,h:2},
pasar:{n:'Pasar',c:{kayu:15,batu:8,kas:25},p:6,w:2,h:2},
taman:{n:'Taman',c:{kayu:10,bahan:5,kas:20},p:8,w:2,h:2},
kincir:{n:'Kincir Angin',c:{kayu:20,bahan:8,kas:30},p:8,w:1,h:1},
puskesmas:{n:'Puskesmas',c:{kayu:20,batu:15,bahan:10,kas:40},p:10,w:2,h:2},
menara:{n:'Menara Jaga',c:{batu:25,besi:8,kas:50},p:12,w:1,h:1},
sekolah:{n:'Sekolah',c:{kayu:25,batu:10,bahan:15,kas:50},p:14,w:2,h:2},
kastil:{n:'Kastil Raja',c:{batu:60,besi:30,bahan:30,kas:200},p:40,w:3,h:3}};
const SC={ladang:2,lumbung:2,pasar:2,taman:2,puskesmas:2,sekolah:2,kastil:1.3},BT={kastil:8};
const PROG=['ladang','sumur','lumbung','pasar','kincir','ladang','puskesmas','taman','sekolah','menara','ladang','pasar','kincir','menara','kastil'];
const LOOP=['rumah','ladang','pasar','taman','menara','kincir','lumbung','puskesmas','sekolah','sumur'];
const CAP={rumah:p=>Math.ceil(p/2)+2,ladang:p=>2+(p/3|0),lumbung:p=>1+(p/10|0),pasar:p=>1+(p/12|0),taman:p=>1+(p/15|0),kincir:p=>1+(p/12|0),puskesmas:p=>1+(p/30|0),menara:p=>2+(p/10|0),sekolah:p=>1+(p/40|0),sumur:p=>1+(p/8|0),kastil:()=>1};
const KEY={rumah:'rumah',kebun:'ladang',ladang:'ladang',sawah:'ladang',lumbung:'lumbung',pasar:'pasar',kincir:'kincir',menara:'menara',kastil:'kastil',istana:'kastil',
puskesmas:'puskesmas',klinik:'puskesmas',sehat:'puskesmas',rs:'puskesmas',sekolah:'sekolah',taman:'taman',sumur:'sumur',air:'sumur'};
const STG=[['🏕️ PEMUKIMAN',10,'DESA'],['🏘️ DESA',30,'KOTA'],['🏙️ KOTA',70,'KERAJAAN'],['👑 KERAJAAN',0,'']];
const ACT={ladang:'farm',pasar:'shop',puskesmas:'visit',sekolah:'visit',taman:'rest',sumur:'look',lumbung:'look'};
const SPD=1.7;

/* ---------- three.js dasar ---------- */
const N=96,H2=N/2,CX=(N-1)/2,wx=v=>v-H2+.5,cellOf=v=>Math.floor(v+H2);
const ren=new THREE.WebGLRenderer({antialias:true});ren.setPixelRatio(Math.min(devicePixelRatio,2));ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;fr.prepend(ren.domElement);
const sc=new THREE.Scene();sc.fog=new THREE.Fog(0xcdeeff,120,330);
const cam=new THREE.PerspectiveCamera(50,9/16,.1,700);
const hemi=new THREE.HemisphereLight(0xffffff,0x8aa070,.75),sun=new THREE.DirectionalLight(0xfff2d0,1),moon=new THREE.DirectionalLight(0x6f86ff,0);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;Object.assign(sun.shadow.camera,{left:-36,right:36,top:36,bottom:-36,near:1,far:100});sc.add(hemi,sun,sun.target,moon);
const MC={},M=c=>{let m=MC[c];if(!m){m=MC[c]=new THREE.MeshLambertMaterial({color:c});m.userData.pl=1}return m},GC={},G=(w,h,d)=>GC[[w,h,d]]||(GC[[w,h,d]]=new THREE.BoxGeometry(w,h,d));
const WM=new THREE.MeshLambertMaterial({color:0xbfe6ff,emissive:0xffc860,emissiveIntensity:0}),CRY=new THREE.MeshLambertMaterial({color:0x6fd8ff,emissive:0x2aa0ff,emissiveIntensity:.5});
function B(g,w,h,d,c,x,y,z,ns){const m=new THREE.Mesh(G(w,h,d),c&&c.isMaterial?c:M(c));m.position.set(x,y,z);m.castShadow=!ns;m.receiveShadow=true;g.add(m);return m}
function Rf(g,r,h,c,x,y,z){const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,4),M(c));m.rotation.y=Math.PI/4;m.position.set(x,y+h/2,z);m.castShadow=true;g.add(m)}
/* gabungkan puluhan kotak kecil dalam satu bagian menjadi beberapa mesh saja (jauh lebih ringan di HP) */
const VCM=new THREE.MeshLambertMaterial({vertexColors:true});
function merge(p){const bk=new Map();
for(const m of p.children.slice()){if(!m.isMesh||m.isInstancedMesh||!m.geometry.index||!m.geometry.attributes.normal)continue;const mt=m.material;if(Array.isArray(mt)||mt.map)continue;
 const k=mt.userData.pl?'vc':mt.uuid;let e=bk.get(k);if(!e){e={mt,vc:!!mt.userData.pl,ms:[]};bk.set(k,e)}e.ms.push(m)}
for(const e of bk.values()){const P=[],Nn=[],C=[],I=[];let off=0,cs=false,rs=false;
 for(const m of e.ms){m.updateMatrix();const g=m.geometry.clone().applyMatrix4(m.matrix),a=g.attributes.position.array,b=g.attributes.normal.array,ix=g.index.array,c=m.material.color;
  for(let i=0;i<a.length;i++){P.push(a[i]);Nn.push(b[i])}
  if(e.vc)for(let i=0;i<a.length/3;i++)C.push(c.r,c.g,c.b);
  for(let i=0;i<ix.length;i++)I.push(ix[i]+off);off+=a.length/3;cs=cs||m.castShadow;rs=rs||m.receiveShadow;p.remove(m)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(Nn,3));if(e.vc)g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);
 const o=new THREE.Mesh(g,e.vc?VCM:e.mt);o.castShadow=cs;o.receiveShadow=rs;p.add(o)}}
/* langit */
const DU={top:{value:new THREE.Color()},bot:{value:new THREE.Color()}};
const dome=new THREE.Mesh(new THREE.SphereGeometry(400,24,16),new THREE.ShaderMaterial({uniforms:DU,side:THREE.BackSide,depthWrite:false,fog:false,vertexShader:'varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top,bot;varying float h;void main(){gl_FragColor=vec4(mix(bot,top,smoothstep(-.1,.6,h)),1.);}'}));dome.renderOrder=-3;sc.add(dome);
const sp=[];for(let i=0;i<450;i++){const a=Math.random()*6.28,y=Math.random()*.95+.05,r=Math.sqrt(1-y*y)*380;sp.push(Math.cos(a)*r,y*380,Math.sin(a)*r)}
const stGeo=new THREE.BufferGeometry();stGeo.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
const stars=new THREE.Points(stGeo,new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false}));stars.renderOrder=-2;sc.add(stars);
const sunBall=new THREE.Mesh(new THREE.SphereGeometry(16,16,12),new THREE.MeshBasicMaterial({color:0xfff0b0,fog:false})),moonBall=new THREE.Mesh(new THREE.SphereGeometry(11,16,12),new THREE.MeshBasicMaterial({color:0xdfe8ff,fog:false}));sc.add(sunBall,moonBall);
const isl=new THREE.Group();sc.add(isl);let dyn=new THREE.Group();isl.add(dyn);

/* ---------- peta 96x96 ---------- */
let r0=7;const R=()=>(r0=(r0*9301+49297)%233280)/233280;
const LAKE={x:17.5,y:73.5,rx:8,ry:6};                                   // danau (barat daya)
const inLake=(x,y)=>((x-LAKE.x)/LAKE.rx)**2+((y-LAKE.y)/LAKE.ry)**2<=1;
const inForest=(x,y)=>x<CX-24&&y<CX-20,inQuarry=(x,y)=>x>CX+24&&y<CX-20,inFarm=(x,y)=>x>CX+23&&y>CX+23&&x<N-3&&y<N-3;   // hutan (barat laut), tambang batu (timur laut), area pertanian (tenggara)
const FX0=Math.ceil(CX+24),FY0=FX0;                                       // pola ladang: 2 petak lahan + 1 petak jalan setapak
/* jenis petak: 0 rumput, 1 alun-alun, 2 jalan, 3 air, 4 batu (tambang) */
function ty(x,y){const dx=Math.abs(x-CX),dy=Math.abs(y-CX),m=Math.max(dx,dy);if(inLake(x,y))return 3;if(dx<2&&dy<2)return 1;if(dx<1||dy<1||m==9.5||m==21.5)return 2;if(inQuarry(x,y))return 4;return 0}
const kind=[],blk0=[],blk=[];for(let x=0;x<N;x++){kind.push(new Uint8Array(N));blk0.push(new Uint8Array(N));blk.push(new Uint8Array(N))}
const isRoad=(a,b)=>a>=0&&b>=0&&a<N&&b<N&&(kind[a][b]==1||kind[a][b]==2);
const nearRoad=(x,y)=>{for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)if(isRoad(x+i,y+j))return 1;return 0};
const gm=new THREE.InstancedMesh(G(1,.5,1),M(0xffffff),N*N),dm=new THREE.Object3D(),cc=new THREE.Color(),TC=[[0x66c84f,0x5cb946],[0xd8d0bd,0xcfc6b0],[0x7d818b,0x757983],[0x3f9be0,0x3a92d6],[0x9a9a98,0x8f8f8d]];
const setI=(m,i,x,y,z,s=1,ry=0)=>{dm.position.set(x,y,z);dm.scale.setScalar(s);dm.rotation.set(0,ry,0);dm.updateMatrix();m.setMatrixAt(i,dm.matrix)};
for(let x=0;x<N;x++)for(let y=0;y<N;y++){const k=ty(x,y);kind[x][y]=k;if(k==3)blk0[x][y]=1;setI(gm,x*N+y,wx(x),-.25,wx(y));gm.setColorAt(x*N+y,cc.setHex(TC[k][(x+y)%2]).multiplyScalar(.93+R()*.14))}
gm.receiveShadow=true;gm.frustumCulled=false;isl.add(gm);
blk0[46][72]=blk0[49][72]=1;                                              // tiang gerbang
/* pohon (hutan lebat di barat laut), batu (tambang di timur laut) */
const TL=[];for(let x=0;x<N;x++)for(let y=0;y<N;y++){if(kind[x][y]!=0||blk0[x][y]||nearRoad(x,y)||inFarm(x,y))continue;if(y>=68&&Math.abs(x-CX)<5)continue;
const m=Math.max(Math.abs(x-CX),Math.abs(y-CX)),p=inForest(x,y)?.55:m<=12?.01:m<=22?.04:.12;if(R()<p){blk0[x][y]=1;TL.push([x,y,.8+R()*.6,R()<(inForest(x,y)?.65:.3)?1:0])}}
const RK2=[];for(let x=0;x<N;x++)for(let y=0;y<N;y++){const k=kind[x][y];if((k!=0&&k!=4)||blk0[x][y]||nearRoad(x,y)||inFarm(x,y))continue;if(R()<(k==4?.3:.025)){blk0[x][y]=1;RK2.push([x,y,.6+R()*(k==4?1.1:.7),R()*3])}}
const DT=[];for(let x=0;x<N;x++)for(let y=0;y<N;y++)if(kind[x][y]==0&&!blk0[x][y]&&!inFarm(x,y)&&R()<.3)DT.push([x+R(),y+R(),[0x3f9a35,0x4cae3d,0xff6b8a,0xffd23f,0xffffff,0xb78cff][R()*6|0]]);
const mkI=(g,m,n)=>{const i=new THREE.InstancedMesh(g,m,Math.max(1,n));i.castShadow=true;i.frustumCulled=false;isl.add(i);return i};
const RT=TL.filter(t=>!t[3]),PN=TL.filter(t=>t[3]);
const T1=mkI(G(.2,.5,.2),M(0x7a4a26),RT.length),T2=mkI(G(.65,.55,.65),M(0x2f8f3a),RT.length),T3=mkI(G(.4,.4,.4),M(0x3aa84a),RT.length),
P1=mkI(G(.18,.5,.18),M(0x6a4326),PN.length),P2=mkI(new THREE.ConeGeometry(.5,.8,6),M(0x1f7a42),PN.length),P3=mkI(new THREE.ConeGeometry(.38,.65,6),M(0x2a9150),PN.length),P4=mkI(new THREE.ConeGeometry(.22,.5,6),M(0x37a860),PN.length);
RT.forEach((t,i)=>{[[T1,.25],[T2,.75],[T3,1.15]].forEach(([m,h])=>setI(m,i,wx(t[0]),h*t[2],wx(t[1]),t[2]))});
PN.forEach((t,i)=>{[[P1,.25],[P2,.85],[P3,1.3],[P4,1.7]].forEach(([m,h])=>setI(m,i,wx(t[0]),h*t[2],wx(t[1]),t[2]))});
const rkm=mkI(G(.4,.28,.34),M(0x9a9ea8),RK2.length);
/* titik sumber daya yang dicari warga: [x,y,0=berdiri di sebelahnya | 1=berdiri di petak itu] */
const NODE={kayu:[],batu:[],besi:[],makanan:[],bahan:[]};
RK2.forEach((r,i)=>{const q=kind[r[0]][r[1]]==4,fe=q&&i%3==0;setI(rkm,i,wx(r[0]),.1*r[2],wx(r[1]),r[2],r[3]);rkm.setColorAt(i,cc.setHex(fe?0xd89a7a:0xffffff));if(q)(fe?NODE.besi:NODE.batu).push([r[0],r[1],0])});
TL.forEach(t=>{if(inForest(t[0],t[1]))NODE.kayu.push([t[0],t[1],0])});if(NODE.kayu.length<8)TL.forEach(t=>NODE.kayu.push([t[0],t[1],0]));
{const dd=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],shore=[];for(let x=1;x<N-1;x++)for(let y=1;y<N-1;y++){if(blk0[x][y]||kind[x][y]==3)continue;if(dd.some(([a,b])=>kind[x+a][y+b]==3))shore.push([x,y,1])}shore.forEach((q,i)=>NODE[i%2?'bahan':'makanan'].push(q))}
const dtm=new THREE.InstancedMesh(G(.07,.16,.07),M(0xffffff),Math.max(1,DT.length));dtm.frustumCulled=false;DT.forEach((d,i)=>{setI(dtm,i,d[0]-H2,.08,d[1]-H2);dtm.setColorAt(i,cc.setHex(d[2]))});isl.add(dtm);
/* marka jalan */
const dsh=[];for(let y=0;y<N;y++)if(Math.abs(y-CX)>2.5)dsh.push([0,wx(y),0]);for(let x=0;x<N;x++)if(Math.abs(x-CX)>2.5)dsh.push([wx(x),0,Math.PI/2]);
const dsm=new THREE.InstancedMesh(G(.1,.02,.42),M(0xf4f1e6),dsh.length);dsm.frustumCulled=false;dsh.forEach((d,i)=>setI(dsm,i,d[0],.012,d[1],1,d[2]));isl.add(dsm);
const lake=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.04,40),new THREE.MeshLambertMaterial({color:0x4aa8ff,emissive:0x1a60b0,emissiveIntensity:.2,transparent:true,opacity:.85}));lake.scale.set(LAKE.rx+.3,1,LAKE.ry+.3);lake.position.set(wx(LAKE.x),.03,wx(LAKE.y));isl.add(lake);
/* lampu jalan */
function lamp(x,z){const g=new THREE.Group();B(g,.08,1.1,.08,0x2b2b33,0,.55,0,1);B(g,.22,.2,.22,WM,0,1.2,0,1);g.position.set(x,0,z);isl.add(g)}
for(let k=5;k<=44;k+=6)[1,-1].forEach(s=>[.9,-.9].forEach(o=>{lamp(o,s*k);lamp(s*k,o)}));
/* label teks (dipakai gerbang & nama warga) */
function drawLabel(s,t){const c=s.userData.c,x=c.getContext('2d');x.clearRect(0,0,384,64);let f=40;x.font='bold '+f+'px sans-serif';while(x.measureText(t).width>360&&f>14){f-=2;x.font='bold '+f+'px sans-serif'}
x.textAlign='center';x.lineWidth=7;x.strokeStyle='#0a1432';x.strokeText(t,192,46);x.fillStyle=s.userData.col||'#fff';x.fillText(t,192,46);s.material.map.needsUpdate=true}
function label(t,col,sw){const c=document.createElement('canvas');c.width=384;c.height=64;
const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true}));s.userData.c=c;s.userData.col=col;drawLabel(s,t);s.scale.set(sw||2.4,(sw||2.4)/6,1);s.renderOrder=10;return s}
/* gerbang selamat datang (jalan masuk warga baru, selatan) */
{const g=new THREE.Group(),ST0=0xb9bec6,GY0=0x9097a3;[-1.5,1.5].forEach(x=>{B(g,.45,2.6,.45,ST0,x,1.3,0);B(g,.55,.2,.55,GY0,x,2.7,0)});B(g,3.9,.35,.5,0x6b4226,0,2.65,0);B(g,3.9,.1,.55,0xe8b923,0,2.88,0,1);
const s=label('PULAU LANGIT','#ffe14d',3.6);s.position.set(0,3.4,0);g.add(s);g.position.set(0,0,wx(72));isl.add(g)}
/* dasar pulau: batuan, stalaktit, kristal */
[0x8a5a36,0x7a4d2d,0x6b4226,0x5c381f,0x4d2f1a,0x402815,0x38230f,0x2f1d0d].forEach((c,i)=>B(isl,N*(1-i*.125),2.2,N*(1-i*.125),c,0,-1.6-i*2.2,0,1));
for(let i=0;i<90;i++){const a=R()*6.28,r=Math.sqrt(R())*N*.33,h=3+R()*14,m=new THREE.Mesh(new THREE.ConeGeometry(.8+R()*2.2,h,5),M(i%2?0x4d2f1a:0x5c381f));m.rotation.x=Math.PI;m.position.set(Math.cos(a)*r,-4-h/2-R()*4,Math.sin(a)*r);isl.add(m)}
for(let i=0;i<20;i++){const a=R()*6.28,r=5+R()*N*.25,m=new THREE.Mesh(new THREE.OctahedronGeometry(.8,0),CRY);m.scale.y=2;m.rotation.z=R()-.5;m.position.set(Math.cos(a)*r,-4-R()*10,Math.sin(a)*r);isl.add(m)}
/* pulau kecil melayang & awan */
const islets=[];for(let i=0;i<10;i++){const g=new THREE.Group(),s=2+R()*3;B(g,s,.5,s,0x66c84f,0,-.25,0,1);B(g,s*.8,.9,s*.8,0x7a4d2d,0,-.95,0,1);B(g,s*.4,.9,s*.4,0x5c381f,0,-1.85,0,1);B(g,.2,.5,.2,0x7a4a26,0,.25,0,1);B(g,.7,.6,.7,0x2f8f3a,0,.8,0,1);const a=i*.63+R(),r=N*.72+R()*18;g.position.set(Math.cos(a)*r,-4+R()*14,Math.sin(a)*r);g.userData.p=R()*6;sc.add(g);islets.push(g)}
const clouds=[],CM=new THREE.MeshLambertMaterial({color:0xffffff,emissive:0x333333});for(let i=0;i<28;i++){const g=new THREE.Group();for(let j=0;j<5;j++){const m=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),CM);m.scale.set(1.6+Math.random()*1.6,1+Math.random()*.6,1.3+Math.random());m.position.set(j*1.8-3.6,Math.random()*.5,Math.random()-.5);g.add(m)}const a=Math.random()*6.28,r=N*.6+Math.random()*N*.8;g.position.set(Math.cos(a)*r,-4+Math.random()*20,Math.sin(a)*r);sc.add(g);clouds.push(g)}

/* ---------- model bangunan (digambar 1x1, lalu diperbesar sesuai lahan) ---------- */
const RD=0xd0432e,BR=0x6b4226,ST=0xb9bec6,GY=0x9097a3,BL=0x3f6fd0,GD=0xe8b923,WLS=[0xf5e6c8,0xf2d3a5,0xe4ecf2,0xf4c6b0,0xd6e8c0],RFS=[0xd0432e,0x3f6fd0,0x8a52b0,0xe0902e,0x2f9a8a];
const MK={rumah:(g,i)=>{B(g,.7,.9,.7,WLS[i],0,.45,0);Rf(g,.66,.6,RFS[i],0,.9,0);B(g,.12,.35,.12,0x8a5a45,.2,1.25,-.15);B(g,.2,.4,.02,BR,0,.2,.361);B(g,.3,.05,.12,ST,0,.025,.42,1);B(g,.16,.16,.02,WM,-.22,.58,.361,1);B(g,.16,.16,.02,WM,.22,.58,.361,1)},
ladang:g=>{B(g,.92,.1,.92,0x7a4a26,0,.05,0);for(let i=0;i<4;i++)B(g,.12,.28,.7,i%2?0x62b834:0xd9b84a,-.3+i*.2,.24,0,1);B(g,.2,.2,.2,0xe0c060,.3,.2,-.38,1)},
lumbung:g=>{B(g,.8,1.1,.8,RD,0,.55,0);Rf(g,.82,.7,BR,0,1.1,0);B(g,.34,.5,.02,0xf5e6c8,0,.25,.41);B(g,.04,.62,.03,RD,0,.25,.425,1).rotation.z=.6;B(g,.04,.62,.03,RD,0,.25,.425,1).rotation.z=-.6;B(g,.2,.2,.02,0x3a2410,0,.95,.41,1)},
pasar:g=>{B(g,.8,.4,.5,0xb0804a,0,.2,.1);[[-.4,-.4],[.4,-.4],[-.4,.4],[.4,.4]].forEach(p=>B(g,.04,.8,.04,0xdddddd,p[0],.4,p[1],1));for(let i=0;i<5;i++)B(g,.18,.06,.9,i%2?0xffffff:0xe84a5f,-.36+i*.18,.85,0,1);[[-.25,0xe84a5f],[0,0xf0a02e],[.25,0x62b834]].forEach(c=>B(g,.15,.12,.15,c[1],c[0],.46,.1,1))},
puskesmas:g=>{const W=0xf4f6f8,TL_=0x2f9a8a,RC=0xe0313a;B(g,.9,.6,.7,W,0,.3,0);B(g,.96,.06,.76,TL_,0,.63,0);B(g,.5,.3,.4,W,0,.81,-.08);B(g,.54,.05,.44,TL_,0,.985,-.08);
B(g,.22,.06,.02,RC,0,.52,.361,1);B(g,.06,.22,.02,RC,0,.52,.361,1);B(g,.2,.3,.02,0x6ab7d8,0,.15,.351,1);[-.3,.3].forEach(x=>B(g,.14,.14,.02,WM,x,.38,.351,1));[-.15,.15].forEach(x=>B(g,.1,.1,.02,WM,x,.84,.121,1));B(g,.3,.05,.14,ST,0,.025,.42,1)},
sekolah:g=>{const Y=0xf2d36a,RR=0xc23b2e;B(g,.95,.5,.6,Y,0,.25,0);B(g,1,.08,.65,RR,0,.54,0);B(g,.3,.35,.4,Y,0,.72,-.05);Rf(g,.32,.3,RR,0,.9,-.05);[-.33,-.11,.11,.33].forEach(x=>B(g,.12,.14,.02,WM,x,.3,.301,1));B(g,.16,.28,.02,BR,0,.14,.311,1);B(g,.08,.08,.02,GD,0,.72,.16,1);
B(g,.02,.9,.02,0xdddddd,.42,.45,.4,1);B(g,.18,.05,.01,RD,.51,.83,.4,1);B(g,.18,.05,.01,0xffffff,.51,.78,.4,1)},
taman:g=>{B(g,.96,.06,.96,0x4cbf4a,0,.03,0,1);B(g,.12,.065,.96,0xd8d0bd,0,.033,0,1);B(g,.96,.065,.12,0xd8d0bd,0,.033,0,1);B(g,.3,.09,.3,0x4aa8ff,0,.05,0,1);B(g,.05,.22,.05,0xdddddd,0,.17,0,1);B(g,.12,.04,.12,0xdddddd,0,.3,0,1);
[[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]].forEach((p,i)=>{B(g,.06,.2,.06,0x7a4a26,p[0],.16,p[1],1);B(g,.26,.24,.26,i%2?0x2f8f3a:0x3aa84a,p[0],.4,p[1])});[[-.3,0],[.3,0]].forEach(p=>B(g,.07,.05,.2,BR,p[0],.1,p[1],1));[[0xff6b8a,-.15,.28],[0xffd23f,.15,-.28],[0xb78cff,.28,.15]].forEach(f=>B(g,.06,.06,.06,f[0],f[1],.1,f[2],1))},
sumur:g=>{B(g,.4,.3,.4,ST,0,.15,0);B(g,.28,.05,.28,0x2a60a0,0,.31,0,1);[-.17,.17].forEach(x=>B(g,.04,.5,.04,BR,x,.5,0,1));B(g,.4,.04,.08,BR,0,.75,0,1);Rf(g,.36,.25,RD,0,.76,0);B(g,.1,.1,.1,0xb8864a,0,.55,0,1)},
kincir:g=>{B(g,.5,1.6,.5,ST,0,.8,0);B(g,.7,.3,.7,GY,0,.15,0);Rf(g,.5,.4,BR,0,1.6,0);B(g,.16,.3,.02,BR,0,.25,.26,1);B(g,.12,.12,.02,WM,0,.95,.26,1);const b=new THREE.Group();b.position.set(0,1.3,.32);B(b,.1,1.2,.03,0xf5e6c8,0,0,0);B(b,1.2,.1,.03,0xf5e6c8,0,0,0);g.add(b);g.userData.bl=b},
menara:g=>{B(g,.8,.3,.8,GY,0,.15,0);B(g,.6,2.4,.6,GY,0,1.2,0);B(g,.78,.2,.78,ST,0,2.45,0);[[-.33,-.33],[0,-.33],[.33,-.33],[-.33,0],[.33,0],[-.33,.33],[0,.33],[.33,.33]].forEach(p=>B(g,.16,.18,.16,ST,p[0],2.65,p[1],1));Rf(g,.4,.8,BL,0,2.55,0);B(g,.1,.3,.02,WM,0,1.2,.31,1);B(g,.1,.3,.02,WM,0,1.9,.31,1)},
kastil:g=>{B(g,2,1.2,2,GY,0,.6,0);for(let i=0;i<9;i++){const x=-.9+i*.225;B(g,.14,.18,.14,ST,x,1.29,.93,1);B(g,.14,.18,.14,ST,x,1.29,-.93,1);B(g,.14,.18,.14,ST,.93,1.29,x,1);B(g,.14,.18,.14,ST,-.93,1.29,x,1)}
[[-.95,-.95],[.95,-.95],[-.95,.95],[.95,.95]].forEach(p=>{B(g,.5,2,.5,ST,p[0],1,p[1]);Rf(g,.5,.7,BL,p[0],2,p[1]);if(p[1]>0)B(g,.1,.3,.02,WM,p[0],1.4,p[1]+.26,1)});
B(g,1,1.3,1,ST,0,1.85,0);Rf(g,.85,.9,RD,0,2.5,0);B(g,.12,.3,.02,WM,0,1.9,.51,1);B(g,.04,.8,.04,0xffffff,0,3.8,0);B(g,.4,.25,.02,GD,.22,4,0,1);
B(g,.6,.8,.04,0x3a2a1a,0,.4,1.01,1);B(g,.64,.1,.05,ST,0,.85,1.01,1);B(g,.28,.6,.02,RD,-.6,.8,1.01,1);B(g,.28,.6,.02,RD,.6,.8,1.01,1);B(g,.28,.06,.025,GD,-.6,.55,1.01,1);B(g,.28,.06,.025,GD,.6,.55,1.01,1)}};

/* ---------- karakter: Pak Bani & warga (setiap warga punya tampilan unik) ---------- */
const SK=0xf2b98e,SH=0xc99a58,PT=0xb58a45,BK=0x1a1a1f;
const lc=document.createElement('canvas');lc.width=lc.height=64;(x=>{x.fillStyle='#ffd24a';x.beginPath();x.arc(46,20,11,0,7);x.fill();x.fillStyle='#4a8fe0';x.beginPath();x.ellipse(32,50,26,10,0,0,7);x.fill();x.fillStyle='#e8c46a';x.beginPath();x.ellipse(30,44,16,6,0,0,7);x.fill();x.strokeStyle='#7a4a26';x.lineWidth=4;x.beginPath();x.moveTo(30,44);x.lineTo(28,22);x.stroke();x.fillStyle='#2f9a3a';for(let a=0;a<5;a++){x.beginPath();x.ellipse(28+Math.cos(a*1.3)*9,20+Math.sin(a*1.3)*5,9,3,a*1.3,0,7);x.fill()}})(lc.getContext('2d'));
const LOGO=new THREE.CanvasTexture(lc),OLM=new THREE.MeshBasicMaterial({color:0x101018,side:THREE.BackSide});
const GL=[new THREE.MeshLambertMaterial({color:0x7fd6ff,transparent:true,opacity:.5}),new THREE.MeshLambertMaterial({color:0x222233,transparent:true,opacity:.9})];
function OL(p,m){const o=new THREE.Mesh(m.geometry,OLM);o.position.copy(m.position);o.scale.setScalar(1.16);p.add(o)}
function bo(p,...a){const m=B(p,...a);OL(p,m);return m}
const SKINS=[0xffe0c4,0xf2b98e,0xe0a070,0xc68642,0x9b6a3c,0x6b4423,0xf7d1b5],
HAIRC=[0x1a1a1f,0x2b1b12,0x3b2314,0x6b3f1d,0xa0622d,0xd8b36a,0xc0392b,0x8a8a8a,0xeeeeee,0x2a4d9b,0x7a3fb0,0x2f9a8a,0xff7aa8],
SHIRTC=[0xd8322f,0x3f6fd0,0x2f9a4a,0xf0a02e,0x8a52b0,0x2f9a8a,0xe84a5f,0xf4f1e6,0x34495e,0xe8b923,0x7fd6ff,0xff8fb1,0x9bd14a,0x6d4c41,0xff6f3c,0x4db6ac],
PANTC=[0x2b3a67,0x3a3a44,0x6b4a2a,0x1f5f4a,0x7a2e2e,0x555b66,0x8a7a5a,0x2c2c2c,0x3d5a80,0x5a3d6e],SHOEC=[0x1a1a1f,0x4a2f1a,0xffffff,0xd8322f,0x2f4f9a],
HATS=[-1,-1,-1,-1,-1,1,1,2,3,4,4,5,6],WORN=['kacamata','kacamata hitam','syal','ransel','kalung','bunga','headphone','kumis','jenggot'],HELD=['cangkul','bendera','keranjang','tongkat'];
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const rng=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
function mkLook(key,salt){const r=rng(hash(key)^Math.imul(salt+1,2654435761)),pk=a=>a[r()*a.length|0];
const hair={s:r()*9|0,c:pk(HAIRC)},ht=pk(HATS),hat=ht<0?null:{t:ht,c:pk(SHIRTC)},hand=r()<.45?pk(HELD):null,worn=[];for(let i=r()*3|0;i>0;i--){const a=pk(WORN);if(!worn.includes(a))worn.push(a)}
return{skin:pk(SKINS),hair,hat,shirt:pk(SHIRTC),style:r()*6|0,pants:pk(PANTC),shoe:pk(SHOEC),shorts:r()<.22,skirt:r()<.12,long:r()<.3,hand,worn,ac:pk(SHIRTC),sc:.8+r()*.1,face:r()*3|0}}
const sig=l=>[l.skin,l.hat?l.hat.t+'/'+l.hat.c:'-',l.hat&&l.hat.t==4?'':l.hair.s+'/'+l.hair.c,l.shirt,l.style,l.pants,l.shoe,l.shorts|0,l.skirt|0,l.long|0,l.hand,l.worn.join(),l.ac,l.face].join('|');
function newLook(key){let l,i=0;do{l=mkLook(key,i++)}while(S.looks.has(sig(l))&&i<80);S.looks.add(sig(l));return l}
const BANI={bani:1,skin:SK,shirt:SH,pants:PT,shoe:BK,hair:{s:-1,c:BK},hat:null,style:-1,worn:[],hand:null,face:0,sc:1};
function hairHat(g,l){const hc=l.hair.c,hs=l.hair.s,ht=l.hat?l.hat.t:-1,hcol=l.hat?l.hat.c:0,top=ht<0||ht==3;
if(ht==4){B(g,.36,.1,.32,hcol,0,.7,0,1);B(g,.05,.32,.3,hcol,-.175,.55,0,1);B(g,.05,.32,.3,hcol,.175,.55,0,1);B(g,.36,.34,.07,hcol,0,.54,-.15,1);B(g,.36,.07,.2,hcol,0,.42,.02,1);return}
if(hs>=0&&hs!=6){const base=[0,1,2,3,7].includes(hs);
 if(base){if(top)B(g,.32,.09,.28,hc,0,.7,0,1);B(g,.32,.2,.07,hc,0,.58,-.13,1);for(const s of[-1,1])B(g,.03,.1,.1,hc,s*.155,.6,.04,1)}
 if(hs==1)B(g,.32,.07,.04,hc,0,.64,.14,1);
 if(hs==2){B(g,.32,.3,.07,hc,0,.45,-.13,1);for(const s of[-1,1])B(g,.04,.28,.1,hc,s*.165,.5,-.02,1)}
 if(hs==3&&top)B(g,.12,.12,.12,hc,0,.8,-.06,1);
 if(hs==4&&top){B(g,.3,.05,.27,hc,0,.69,0,1);for(let i=-2;i<=2;i++)B(g,.06,.1+(i&1?.06:0),.06,hc,i*.065,.76,0,1)}
 if(hs==5&&top)B(g,.42,.2,.38,hc,0,.72,-.01,1);
 if(hs==7)B(g,.08,.22,.08,hc,0,.5,-.2,1);
 if(hs==8&&top)B(g,.07,.12,.28,hc,0,.74,0,1)}
if(ht==1){B(g,.33,.08,.29,hcol,0,.72,0,1);B(g,.3,.025,.13,hcol,0,.69,.2,1)}
if(ht==2){B(g,.33,.15,.3,hcol,0,.74,0,1);B(g,.08,.08,.08,0xffffff,0,.84,0,1)}
if(ht==3){B(g,.32,.04,.28,hcol,0,.65,0,1);B(g,.06,.06,.04,hcol,.13,.65,-.15,1)}
if(ht==5){B(g,.62,.025,.62,0xe0c060,0,.7,0,1);B(g,.3,.1,.3,0xe0c060,0,.76,0,1)}
if(ht==6){B(g,.34,.12,.3,0xffd23f,0,.73,0,1);B(g,.36,.03,.34,0xffd23f,0,.68,0,1)}}
function mkChar(l){const g=new THREE.Group(),u=g.userData;u.L=[];u.A=[];const sk=l.skin,sh=l.shirt,sl=l.long||l.bani?sh:sk,bn=l.bani;
for(const s of[-1,1]){const lg=new THREE.Group();lg.position.set(s*.065,.2,0);
 if(l.skirt)bo(lg,.085,.14,.085,sk,0,-.07,0,1);else if(l.shorts){bo(lg,.1,.07,.1,l.pants,0,-.035,0,1);bo(lg,.085,.08,.085,sk,0,-.11,0,1)}else bo(lg,.1,.14,.1,l.pants,0,-.07,0,1);
 bo(lg,.11,.07,.15,l.shoe,0,-.165,.02,1);g.add(lg);u.L.push(lg);
 const a=new THREE.Group();a.position.set(s*.165,.395,0);bo(a,.08,.09,.09,sh,0,-.04,0,1);bo(a,.07,.11,.08,sl,0,-.145,0,1);g.add(a);u.A.push(a);
 B(g,.07,.085,.01,0xffffff,s*.075,.55,.131,1);B(g,.05,.07,.01,0x1b1214,s*.075,.55,.137,1);B(g,.02,.02,.01,0xffffff,s*.075+.012,.572,.143,1);
 B(g,.09,.022,.01,bn?BK:l.hair.c,s*.075,.62,.134,1).rotation.z=s*.35;B(g,.04,.07,.06,sk,s*.17,.56,0,1);
 if(bn){B(g,.06,.06,.01,0xb88c4a,s*.065,.32,.078,1);B(g,.02,.02,.01,GD,s*.065,.33,.085,1);B(g,.09,.018,.07,GD,s*.12,.405,0,1);B(g,.03,.1,.1,BK,s*.15,.58,.04,1)}}
bo(g,.27,.2,.15,sh,0,.3,0);B(g,.28,.035,.16,bn?BK:0x2a2a30,0,.215,0,1);
if(l.skirt)B(g,.3,.1,.19,l.pants,0,.17,0,1);
if(bn){B(g,.06,.035,.01,GD,0,.215,.081,1);B(g,.07,.02,.01,BK,.06,.375,.078,1)}
const st=l.style;
if(st==1){B(g,.28,.03,.16,l.ac,0,.35,0,1);B(g,.28,.03,.16,l.ac,0,.27,0,1)}
else if(st==2){for(const s of[-1,1])B(g,.09,.17,.16,l.ac,s*.09,.3,0,1)}
else if(st==3){B(g,.15,.15,.02,l.pants,0,.29,.078,1);for(const s of[-1,1])B(g,.025,.1,.02,l.pants,s*.05,.385,.078,1)}
else if(st==4){[[-.06,.34],[.05,.3],[-.02,.26],[.08,.36],[-.08,.27]].forEach(p=>B(g,.04,.04,.01,l.ac,p[0],p[1],.078,1))}
else if(st==5)B(g,.16,.04,.16,0xffffff,0,.395,0,1);
bo(g,.3,.26,.26,sk,0,.56,0);B(g,l.face==1?.08:.05,.012,.01,0xa0604a,0,.49,.132,1);if(l.face==2)B(g,.03,.02,.01,0x7a2a2a,0,.485,.133,1);
if(bn){bo(g,.31,.19,.28,BK,0,.78,0);const lg=new THREE.Mesh(new THREE.PlaneGeometry(.13,.13),new THREE.MeshBasicMaterial({map:LOGO,transparent:true}));lg.position.set(0,.78,.1415);g.add(lg);B(g,.31,.05,.03,BK,0,.62,.12,1);B(g,.32,.2,.08,BK,0,.58,-.11,1)}
else hairHat(g,l);
const W=l.worn,has=k=>W.includes(k);
if(has('kacamata')||has('kacamata hitam')){const m=has('kacamata')?GL[0]:GL[1];for(const s of[-1,1]){const q=new THREE.Mesh(G(.11,.1,.012),m);q.position.set(s*.075,.55,.15);g.add(q)}B(g,.04,.015,.012,0x222222,0,.56,.15,1)}
if(has('syal')){B(g,.31,.06,.2,l.ac,0,.455,0,1);B(g,.06,.15,.02,l.ac,.07,.37,.1,1)}
if(has('ransel'))B(g,.2,.22,.09,l.ac,0,.3,-.12,1);
if(has('kalung')){B(g,.16,.02,.01,GD,0,.4,.08,1);B(g,.04,.05,.01,GD,0,.36,.085,1)}
if(has('bunga')){B(g,.07,.07,.02,0xff7aa8,.12,.64,.145,1);B(g,.03,.03,.02,0xffe14d,.12,.64,.157,1)}
if(has('headphone')&&!l.hat){B(g,.36,.03,.05,0x333344,0,.71,0,1);for(const s of[-1,1]){B(g,.03,.14,.04,0x333344,s*.175,.64,0,1);B(g,.05,.1,.1,0x333344,s*.19,.56,0,1)}}
if(has('jenggot'))B(g,.2,.09,.04,l.hair.c,0,.47,.12,1);else if(has('kumis'))B(g,.1,.025,.02,l.hair.c,0,.51,.134,1);
const a1=u.A[1];
if(l.hand=='cangkul'){B(a1,.03,.45,.03,BR,0,-.2,.07,1);B(a1,.13,.05,.025,GY,.05,-.43,.07,1)}
if(l.hand=='bendera'){B(a1,.02,.6,.02,0xdddddd,0,.1,.07,1);B(a1,.2,.06,.01,RD,.11,.34,.07,1);B(a1,.2,.06,.01,0xffffff,.11,.28,.07,1)}
if(l.hand=='keranjang'){B(a1,.15,.1,.11,0xb8864a,0,-.2,.08,1);B(a1,.16,.02,.12,0x8a6030,0,-.15,.08,1)}
if(l.hand=='tongkat')B(a1,.025,.55,.025,BR,0,-.15,.08,1);
[g,...u.L,...u.A].forEach(merge);return g}
/* efek percikan */
const PTC=[];function burst(p,c){for(let i=0;i<14;i++){const m=new THREE.Mesh(G(.1,.1,.1),new THREE.MeshBasicMaterial({color:c,transparent:true}));m.position.copy(p);m.position.y+=.6;m.userData.v=new THREE.Vector3((Math.random()-.5)*2.5,2+Math.random()*2.5,(Math.random()-.5)*2.5);m.userData.life=1.2;dyn.add(m);PTC.push(m)}}
/* siang-malam */
let tm=.22,todMode=0;
const CD=[0x3f9bf0,0x070b24,0xcdeeff,0x1a2255,0xff9a5a].map(c=>new THREE.Color(c)),tT=new THREE.Color(),tB=new THREE.Color();
function realTm(){const d=new Date();return((d.getHours()*3600+d.getMinutes()*60+d.getSeconds()+d.getMilliseconds()/1000)/86400-.25+1)%1}   // 06:00 = matahari terbit, 12:00 = siang, 18:00 = terbenam, 00:00 = tengah malam
function env(dt,t){tm=todMode==0?realTm():todMode==1?.25:.75;
const a=Math.PI*2*tm,h=Math.sin(a),d=Math.min(1,Math.max(0,(h+.12)/.42)),k=Math.max(0,1-Math.abs(h)/.3)*.65;
tT.copy(CD[1]).lerp(CD[0],d);tB.copy(CD[3]).lerp(CD[2],d).lerp(CD[4],k);DU.top.value.copy(tT);DU.bot.value.copy(tB);sc.fog.color.copy(tB);
hemi.intensity=.25+.55*d;sun.intensity=d;sun.color.setHex(0xfff2d0).lerp(CD[4],k);moon.intensity=.4*(1-d);
sun.position.set(fcus.x+Math.cos(a)*22+6,fcus.y+Math.max(h,.1)*20+2,fcus.z+8);sun.target.position.copy(fcus);moon.position.set(fcus.x-12,fcus.y+16,fcus.z-8);
WM.emissiveIntensity=(1-d)*1.6;CRY.emissiveIntensity=.5+(1-d)*1.3;stars.material.opacity=1-d;
sunBall.position.set(Math.cos(a),h,.3).normalize().multiplyScalar(350).add(cam.position);sunBall.visible=h>-.05;
moonBall.position.set(-Math.cos(a),-h,-.3).normalize().multiplyScalar(350).add(cam.position);moonBall.visible=h<.05;
dome.position.copy(cam.position);stars.position.copy(cam.position);lake.material.emissiveIntensity=.2+.12*Math.sin(t*2);
islets.forEach(g=>g.position.y+=Math.sin(t*.8+g.userData.p)*dt*.3);
for(let i=PTC.length-1;i>=0;i--){const m=PTC[i],v=m.userData.v;m.userData.life-=dt;v.y-=9*dt;m.position.addScaledVector(v,dt);m.material.opacity=Math.max(0,m.userData.life);if(m.userData.life<=0){m.parent&&m.parent.remove(m);m.material.dispose();PTC.splice(i,1)}}}

/* ---------- pencari jalan A* (warga tidak menembus rumah, pohon, batu, air) ---------- */
const NN=N*N,gS=new Float32Array(NN),par=new Int32Array(NN),seen=new Int32Array(NN),clo=new Int32Array(NN);let stamp=0;
function hpush(h,f,i){let k=h.length;h.push(null);while(k>0){const q=(k-1)>>1;if(h[q][0]<=f)break;h[k]=h[q];k=q}h[k]=[f,i]}
function hpop(h){const top=h[0],last=h.pop();if(h.length){let k=0;const n=h.length;for(;;){let c=2*k+1;if(c>=n)break;if(c+1<n&&h[c+1][0]<h[c][0])c++;if(h[c][0]>=last[0])break;h[k]=h[c];k=c}h[k]=last}return top}
const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function astar(sx,sy,gx,gy){if(sx==gx&&sy==gy)return[];if(blk[gx][gy])return null;stamp++;const h=[],s=sx*N+sy,g=gx*N+gy;seen[s]=stamp;gS[s]=0;par[s]=-1;hpush(h,0,s);let it=0,ok=false;
while(h.length&&it++<7000){const i=hpop(h)[1];if(clo[i]==stamp)continue;clo[i]=stamp;if(i==g){ok=true;break}const x=(i/N)|0,y=i%N;
 for(const[dx,dy]of DIRS){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=N||ny>=N||blk[nx][ny])continue;if(dx&&dy&&(blk[x+dx][y]||blk[x][y+dy]))continue;
  const j=nx*N+ny,c=gS[i]+(dx&&dy?1.414:1)*(kind[nx][ny]==1||kind[nx][ny]==2?1:1.25);if(seen[j]!=stamp||c<gS[j]){seen[j]=stamp;gS[j]=c;par[j]=i;const hx=Math.abs(nx-gx),hy=Math.abs(ny-gy);hpush(h,c+hx+hy-.586*Math.min(hx,hy),j)}}}
if(!ok)return null;const out=[];for(let i=g;i!=s;i=par[i])out.push([wx((i/N)|0),wx(i%N)]);return out.reverse()}

/* ---------- state ---------- */
let S,auto=true,demoT=null;
const cnt=t=>S.bs.filter(b=>b.t==t).length,cntD=t=>S.bs.filter(b=>b.t==t&&b.st=='done').length;
function face(x,y,w,h){const sd=[[0,0,1],[Math.PI/2,1,0],[Math.PI,0,-1],[-Math.PI/2,-1,0]];
for(const[r,dx,dz]of sd)for(let i=0;i<(dx?h:w);i++){const a=dx?(dx>0?x+w:x-1):x+i,b=dx?y+i:(dz>0?y+h:y-1);if(isRoad(a,b))return r}
return Math.round(Math.atan2(CX-(x+(w-1)/2),CX-(y+(h-1)/2))/(Math.PI/2))*Math.PI/2}
function addB(t,x,y,done){const d=DEF[t],s=SC[t]||1,g=new THREE.Group();MK[t](g,Math.random()*5|0);merge(g);g.scale.set(s,done?s:.01,s);g.position.set(x+d.w/2-H2,0,y+d.h/2-H2);g.rotation.y=face(x,y,d.w,d.h);
for(let i=0;i<d.w;i++)for(let j=0;j<d.h;j++)blk[x+i][y+j]=1;dyn.add(g);
S.vil.forEach(v=>{const a=cl(cellOf(v.g.position.x),0,N-1),c=cl(cellOf(v.g.position.z),0,N-1);if(blk[a][c]){unstuck(v,a,c);v.path=[];v.wait=.3}});
const b={t,x,y,w:d.w,h:d.h,sc:s,g,st:done?'done':'plan',age:0,pt:0,ws:[],T:BT[t]||2+d.w*d.h*.6};
if(!done)b.mk=B(dyn,d.w-.1,.05,d.h-.1,0xb89a6a,g.position.x,.03,g.position.z,1);S.bs.push(b);return b}
/* mencari lokasi pembangunan: kota tumbuh dari tengah, rumah di tepi jalan, ladang di area pertanian */
const kOK=(a,b)=>a>=0&&b>=0&&a<N&&b<N&&!blk[a][b]&&(kind[a][b]==0||kind[a][b]==4);
function fits(x,y,w,h){for(let i=0;i<w;i++)for(let j=0;j<h;j++)if(!kOK(x+i,y+j))return 0;return 1}
function vilIn(x,y,w,h){return S.vil.some(v=>{const a=cellOf(v.g.position.x),b=cellOf(v.g.position.z);return a>=x&&a<x+w&&b>=y&&b<y+h})}
function roadAdj(x,y,w,h){for(let i=0;i<w;i++)if(isRoad(x+i,y-1)||isRoad(x+i,y+h))return 1;for(let j=0;j<h;j++)if(isRoad(x-1,y+j)||isRoad(x+w,y+j))return 1;return 0}
function slot(t){const d=DEF[t],w=d.w,h=d.h;let best=null,bd=1e9;const tw=S.bs.filter(b=>b.t=='menara');
for(let x=0;x<=N-w;x++)for(let y=0;y<=N-h;y++){if(!fits(x,y,w,h)||vilIn(x,y,w,h))continue;const mx=x+(w-1)/2,my=y+(h-1)/2,dc=Math.hypot(mx-CX,my-CX);let s;
 if(t=='ladang'||t=='lumbung'){if(!inFarm(x,y)||!inFarm(x+w-1,y+h-1)||(x-FX0)%3||(y-FY0)%3)continue;s=Math.hypot(mx-FX0-2,my-FY0-2)+Math.random()*1.5}
 else if(t=='kincir'){if(!inFarm(x,y)||(x-FX0)%3!=2||(y-FY0)%3!=2)continue;s=Math.hypot(mx-FX0-2,my-FY0-2)+Math.random()*2}
 else if(t=='menara'){if(dc<27||dc>36||inForest(x,y)||inQuarry(x,y)||inFarm(x,y))continue;s=Math.abs(dc-31)+Math.random()*4-.6*Math.min(20,...tw.map(q=>Math.hypot(q.x-x,q.y-y)),20)}
 else{if(inForest(x,y)||inQuarry(x,y)||inFarm(x,y)||dc>38)continue;if(t!='taman'&&t!='sumur'&&!roadAdj(x,y,w,h))continue;
  s=t=='taman'?Math.abs(dc-13)+Math.random()*5:t=='sumur'?Math.abs(dc-7)+Math.random()*4:dc+Math.random()*.8}
 if(s<bd){bd=s;best=[x,y]}}
return best}
/* ---------- warga ---------- */
const clean=s=>String(s||'').replace(/^@+/,'').replace(/[^\w.\-\u00C0-\u024F\u0400-\u04FF]/g,'').slice(0,20);
function nearestFree(x,y){for(let r=0;r<12;r++)for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){if(Math.max(Math.abs(i),Math.abs(j))!=r)continue;const a=x+i,b=y+j;if(a>=0&&b>=0&&a<N&&b<N&&!blk[a][b])return[a,b]}return[x,y]}
function addVil(bani,name,key,restore,quiet){const look=bani?BANI:newLook(key||name),g=mkChar(look);g.scale.setScalar(bani?1:look.sc);const cr=new THREE.Mesh(G(.16,.14,.14),M(0x8a5a2a));cr.position.set(0,.33,-.17);cr.visible=false;g.add(cr);g.userData.cr=cr;
let c;if(bani)c=nearestFree(45,52);else if(restore)c=nearestFree(41+(Math.random()*12|0),41+(Math.random()*12|0));else c=[47+(Math.random()<.5?0:1),75+(Math.random()*3|0)];
g.position.set(wx(c[0]),0,wx(c[1]));const lb=label(name,bani?'#ffe14d':'#fff',bani?2.4:2);lb.position.set(0,bani?1.2:1.3,0);g.add(lb);dyn.add(g);
const v={g,bani,name,key:key||name,ph:Math.random()*6,path:[],wait:Math.random()*2,job:null,atJob:false,act:null,face:null,goal:null,lb,named:0,look,occ:null,w:null,earn:0,auto:0};S.vil.push(v);
if(!bani&&!restore){if(!quiet)burst(g.position,0x9ff59a);const q=nearestFree(44+(Math.random()*6|0),44+(Math.random()*6|0));goTo(v,q[0],q[1])}return v}
function removeVil(v){const i=S.vil.indexOf(v);if(i<1)return;S.vil.splice(i,1);dyn.remove(v.g);S.looks.delete(sig(v.look));S.names.delete(String(v.name).toLowerCase());v.lb.material.map.dispose();v.lb.material.dispose()}
function goTo(v,gx,gy){const p=v.g.position,sx=cl(cellOf(p.x),0,N-1),sy=cl(cellOf(p.z),0,N-1);v.goal=[gx,gy];const r=astar(sx,sy,gx,gy);v.path=r||[];return !!r}
function perim(b,from){let best=null,bd=1e9;for(let i=-1;i<=b.w;i++)for(let j=-1;j<=b.h;j++){if((i<0||i>=b.w)&&(j<0||j>=b.h))continue;if(i>=0&&i<b.w&&j>=0&&j<b.h)continue;const a=b.x+i,c=b.y+j;if(a<0||c<0||a>=N||c>=N||blk[a][c])continue;const d=Math.hypot(a-from[0],c-from[1])+Math.random()*3;if(d<bd){bd=d;best=[a,c]}}return best}
function faceB(v,b){if(!b)return;v.g.rotation.y=Math.atan2(b.g.position.x-v.g.position.x,b.g.position.z-v.g.position.z)}
function dest(v){const p=v.g.position,c=[cl(cellOf(p.x),0,N-1),cl(cellOf(p.z),0,N-1)],done=S.bs.filter(b=>b.st=='done');let act=null,ok=false;v.face=null;
if(done.length&&Math.random()<(v.bani?.6:.5)){const b=done[Math.random()*done.length|0],q=perim(b,c);if(q&&goTo(v,q[0],q[1])){ok=true;act=ACT[b.t]||'look';v.face=b}}
for(let i=0;i<12&&!ok;i++){const R2=v.bani?9:14,ox=v.bani?CX:c[0],oy=v.bani?CX:c[1],x=cl(Math.round(ox+(Math.random()*2-1)*R2),0,N-1),y=cl(Math.round(oy+(Math.random()*2-1)*R2),0,N-1);if(!blk[x][y])ok=goTo(v,x,y)}
v.act=ok?act:null;v.wait=2+Math.random()*5}
function assign(b){const pool=S.vil.filter(v=>!v.bani&&!v.job&&!v.me).map(v=>[Math.hypot(cellOf(v.g.position.x)-b.x,cellOf(v.g.position.z)-b.y)+(v.occ?25:0)+(v.w&&v.w.c?60:0),v]).sort((a,c)=>a[0]-c[0]).slice(0,b.w*b.h>=4?3:2);
b.ws=pool.map(q=>q[1]);b.ws.forEach(v=>{v.job=b;v.atJob=false;v.act=null;v.face=null;if(v.w){v.w.st='idle';v.w.c=0;v.w.t=0}v.g.userData.cr.visible=false;const q=perim(b,[cellOf(v.g.position.x),cellOf(v.g.position.z)]);if(!q||!goTo(v,q[0],q[1]))v.atJob=true})}
function finish(b){b.st='done';b.g.scale.set(b.sc,b.sc,b.sc);if(b.mk){dyn.remove(b.mk);b.mk=null}b.ws.forEach(v=>{v.job=null;v.atJob=false;v.wait=1+Math.random()*2;payWage(v)});b.ws=[];burst(b.g.position,0xffe14d);log(`✅ ${DEF[b.t].n} selesai dibangun`,'#fff')}
function unstuck(v,x,y){const q=nearestFree(x,y);v.g.position.x=wx(q[0]);v.g.position.z=wx(q[1])}
/* ---------- pekerjaan warga: tiap siklus kerja digaji 1 kas • warga mencari sumber daya sendiri ---------- */
const JOBS={penebang:{n:'Penebang Kayu',ic:'🪓',r:'kayu',an:'chop'},penambang:{n:'Penambang Batu',ic:'⛏️',r:'batu',an:'chop'},pandai:{n:'Penambang Besi',ic:'⚒️',r:'besi',an:'chop'},nelayan:{n:'Nelayan',ic:'🎣',r:'makanan',an:'fish'},pengrajin:{n:'Pengrajin Bata',ic:'🧱',r:'bahan',an:'dig'},
petani:{n:'Petani',ic:'🌾',at:'ladang',s:2,an:'dig',o:['makanan',1]},pedagang:{n:'Pedagang',ic:'🛒',at:'pasar',s:2,an:'wave'},guru:{n:'Guru',ic:'📚',at:'sekolah',s:2,an:'wave',o:['bahan',1]},perawat:{n:'Perawat',ic:'🩺',at:'puskesmas',s:2,an:'wave'},penjaga:{n:'Penjaga Menara',ic:'🛡️',at:'menara',s:1,an:'stand'},tukangkebun:{n:'Tukang Kebun',ic:'🌳',at:'taman',s:1,an:'dig'}};
const R2J={kayu:'penebang',batu:'penambang',besi:'pandai',makanan:'nelayan',bahan:'pengrajin'},CRC={kayu:0x8a5a2a,batu:0x9a9ea8,besi:0x6b4a4a,makanan:0xe0c060,bahan:0xc2603a},DEP=[47,47];
const NA=['sari','budi','dewi','rian','nina','agus','putri','dimas','citra','bayu','wulan','fajar','lina','hendra','maya','andi','rina','eko','tika','yoga','intan','rizky','ayu','dani','nadia','fikri','mega','joko','siti','rafi','laras','ilham','tari','galih','vina','reza','salsa','arif','dinda','bagas','fitri','gilang','indah','haikal','kiki','lutfi','mawar','naufal','olivia','panji'],
NB=['putra','ayu','kusuma','wijaya','saputra','lestari','pratama','santoso','hidayat','nugraha','rahma','permata','utami','setiawan','maulana','ramadhan','anggraini','kurniawan','fauzi','salma','gaming','official','story','daily','vlog'];
function genName(){const pk=a=>a[Math.random()*a.length|0];for(let i=0;i<60;i++){const a=pk(NA),b=pk(NB),n=Math.random()*100|0,k=Math.random()*6|0,nm=k==0?a+n:k==1?a+'_'+b:k==2?a+'.'+b:k==3?a+b+n:k==4?'its'+a+n:a+'_'+b+(n%10);if(!S.names.has(nm.toLowerCase()))return nm}return 'warga'+Math.random().toString(36).slice(2,7)}
function fillTick(){if(S.vil.length>=Math.min(MAKS_WARGA,S.pop))return;const nm=genName();S.names.add(nm.toLowerCase());const v=addVil(false,nm,nm.toLowerCase(),false,true);v.auto=1}
function payWage(v){S.kas+=GAJI;S.gaji=(S.gaji|0)+GAJI;v.earn=(v.earn|0)+GAJI}
function relabel(v){drawLabel(v.lb,(v.me?'⭐ ':'')+(v.occ?JOBS[v.occ].ic+' ':'')+v.name)}
function employ(v,k){v.occ=k;v.w={st:'idle',n:null,s:null,c:0,t:0,f:0};v.act=null;v.face=null;relabel(v)}
function unemploy(v){v.occ=null;v.w=null;v.g.userData.cr.visible=false;v.wait=1;relabel(v)}
function pickNode(r){const L=NODE[r];if(!L||!L.length)return null;let best=null,bd=1e9;for(let i=0;i<8;i++){const n=L[Math.random()*L.length|0],d=Math.hypot(n[0]-DEP[0],n[1]-DEP[1])+Math.random()*6;if(d<bd){bd=d;best=n}}return best}
function stand(n,cx,cy){if(n[2])return blk[n[0]][n[1]]?null:[n[0],n[1]];let best=null,bd=1e9;for(const[dx,dy]of DIRS){const a=n[0]+dx,b=n[1]+dy;if(a<0||b<0||a>=N||b>=N||blk[a][b])continue;const d=Math.hypot(a-cx,b-cy)+Math.random()*.5;if(d<bd){bd=d;best=[a,b]}}return best}
function depot(){return nearestFree(DEP[0]+(Math.random()*5|0)-2,DEP[1]+(Math.random()*5|0)-2)}
function freeW(b){let best=null,bd=1e9;for(const v of S.vil){if(v.bani||v.occ||v.job||v.me)continue;const d=b?Math.hypot(cellOf(v.g.position.x)-b.x,cellOf(v.g.position.z)-b.y):Math.random();if(d<bd){bd=d;best=v}}return best}
/* kebutuhan sumber daya: bangunan berikutnya + 2 bangunan sesudahnya -> warga mencari yang paling kurang */
function needW(){const w={kayu:3,batu:2,makanan:1,besi:1,bahan:2},T=target(),q=[];if(T)q.push(T[0]);S.pri.slice(1,3).forEach(k=>q.length<3&&!q.includes(k)&&q.push(k));for(let i=S.pi+(T&&T[1]=='p'?1:0);q.length<3&&i<PROG.length;i++)q.push(PROG[i]);
q.forEach((tp,i)=>{for(const[k,c]of Object.entries(DEF[tp].c)){if(k=='kas')continue;const sh=c-S.res[k];if(sh>0)w[k]+=Math.min(12,sh/2)*(i?.4:1)}});return w}
function balance(){const W=S.vil.filter(v=>!v.bani);let ch=0;
for(const k in JOBS){const J=JOBS[k];if(!J.at)continue;const bs=S.bs.filter(b=>b.t==J.at&&b.st=='done'),cap=bs.length*J.s,cur=W.filter(v=>v.occ==k);
 for(let i=cur.length;i<cap&&ch<8;i++){const v=freeW(bs[i%bs.length]);if(!v)break;employ(v,k);ch++}}
const posts=W.filter(v=>v.occ&&!JOBS[v.occ].r).length,gt=Math.max(0,Math.ceil(W.length*.6)-posts),wt=needW(),tot=Object.values(wt).reduce((a,c)=>a+c,0),want={},cur={};
RK.forEach(r=>{want[r]=Math.round(gt*wt[r]/tot);cur[r]=W.filter(v=>v.occ==R2J[r])});
RK.forEach(r=>{let ex=cur[r].length-want[r]-1;for(const v of cur[r]){if(ex<=0||ch>=8)break;if(v.w.st=='idle'&&!v.w.c){unemploy(v);ex--;ch++}}});
RK.forEach(r=>{let n=want[r]-cur[r].filter(v=>v.occ).length;while(n-->0&&ch<8){const v=freeW();if(!v)break;employ(v,R2J[r]);ch++}})}
function workStep(v,dt,t,u){const J=JOBS[v.occ],w=v.w,p=v.g.position,cx=cl(cellOf(p.x),0,N-1),cy=cl(cellOf(p.z),0,N-1),A0=u.A[0],A1=u.A[1];
if(w.st=='idle'){A0.rotation.x=A1.rotation.x=0;if(w.t>0){w.t-=dt;return}
 let ok=false;
 if(J.r){for(let i=0;i<3&&!ok;i++){const n=pickNode(J.r),q=n&&stand(n,cx,cy);if(q&&goTo(v,q[0],q[1])){w.n=n;w.s=q;ok=true}}}
 else{const bs=S.bs.filter(b=>b.t==J.at&&b.st=='done');if(bs.length){const b=bs[Math.random()*bs.length|0],q=perim(b,[cx,cy]);if(q&&goTo(v,q[0],q[1])){w.n=b;w.s=q;v.face=b;ok=true}}}
 if(ok){w.st='go';w.f=0}else{w.t=1.5+Math.random()*2;if(++w.f>6)unemploy(v)}return}
if(w.st=='go'||w.st=='back'){
 if(Math.hypot(w.s[0]-cx,w.s[1]-cy)>1.5){if(!goTo(v,w.s[0],w.s[1])){w.st='idle';w.t=1}return}
 if(w.st=='go'){w.st='work';w.t=0;if(J.r){const n=w.n,fx=n[2]?wx(LAKE.x):wx(n[0]),fz=n[2]?wx(LAKE.y):wx(n[1]);v.g.rotation.y=Math.atan2(fx-p.x,fz-p.z)}else faceB(v,w.n)}
 else{S.res[J.r]+=w.c;payWage(v);w.c=0;u.cr.visible=false;w.st='idle';w.t=.4+Math.random()}
 return}
w.t+=dt;const an=J.an;
if(an=='chop'){A0.rotation.x=-.4;A1.rotation.x=-1.2+Math.sin(t*10+v.ph)*.9}
else if(an=='fish'){A0.rotation.x=-.3;A1.rotation.x=-1.5+Math.sin(t*2+v.ph)*.15}
else if(an=='dig'){A0.rotation.x=-.9+Math.sin(t*3+v.ph)*.5;A1.rotation.x=-.9-Math.sin(t*3+v.ph)*.5}
else if(an=='wave'){A1.rotation.x=-2.7;A1.rotation.z=Math.sin(t*6+v.ph)*.4;A0.rotation.x=0}
else A0.rotation.x=A1.rotation.x=0;
if(w.t>=(J.r?GDUR:PDUR)){A1.rotation.z=0;
 if(J.r){w.c=CARRY;u.cr.material=M(CRC[J.r]);u.cr.visible=true;const d=depot();if(d&&goTo(v,d[0],d[1])){w.s=d;w.st='back'}else{S.res[J.r]+=w.c;payWage(v);w.c=0;u.cr.visible=false;w.st='idle';w.t=1}}
 else{payWage(v);if(J.o)S.res[J.o[0]]+=J.o[1];w.t=0;if(Math.random()<.2){w.st='idle';w.t=.5}}}}
function stepV(v,dt,t){const g=v.g,p=g.position,u=g.userData;let cx=cl(cellOf(p.x),0,N-1),cy=cl(cellOf(p.z),0,N-1);
if(blk[cx][cy]){unstuck(v,cx,cy);v.path=[];v.wait=.3}
if(v.path.length&&blk[cellOf(v.path[0][0])][cellOf(v.path[0][1])]){const gl=v.goal;v.path=[];if(gl&&!blk[gl[0]][gl[1]])goTo(v,gl[0],gl[1])}
let mv=false,w=0;
if(v.path.length){const q=v.path[0],dx=q[0]-p.x,dz=q[1]-p.z,d=Math.hypot(dx,dz),stp=SPD*dt;mv=true;
 if(d>.001){const k=Math.min(d,stp)/d;p.x+=dx*k;p.z+=dz*k;g.rotation.y=Math.atan2(dx,dz)}
 if(d<=stp+.001){v.path.shift();if(!v.path.length){if(v.job)v.atJob=true;faceB(v,v.job||v.face)}}
 w=Math.sin(t*9+v.ph)*.6;u.L[0].rotation.x=w;u.L[1].rotation.x=-w;u.A[0].rotation.x=-w;u.A[1].rotation.x=w;u.A[0].rotation.z=u.A[1].rotation.z=0}
else{u.L[0].rotation.x=u.L[1].rotation.x=0;u.A[0].rotation.z=u.A[1].rotation.z=0;
 if(v.job){if(!v.atJob)v.atJob=true;if(v.job.st=='build'){u.A[0].rotation.x=-.4;u.A[1].rotation.x=-1.2+Math.sin(t*10+v.ph)*.9}else u.A[0].rotation.x=u.A[1].rotation.x=0}
 else if(v.occ)workStep(v,dt,t,u);
 else{const a=v.act;if(a=='farm'){u.A[0].rotation.x=-.9+Math.sin(t*3+v.ph)*.5;u.A[1].rotation.x=-.9-Math.sin(t*3+v.ph)*.5}
  else if(a=='shop'||a=='visit'){u.A[1].rotation.x=-2.7;u.A[1].rotation.z=Math.sin(t*6+v.ph)*.4;u.A[0].rotation.x=0}
  else u.A[0].rotation.x=u.A[1].rotation.x=0;
  v.wait-=dt;if(v.wait<=0)dest(v)}}
p.y=mv?Math.abs(w)*.04:0;
const d=Math.hypot(cam.position.x-p.x,cam.position.y-p.y,cam.position.z-p.z),o=v.bani?cl(1-(d-70)/40,0,1):cl(1-(d-32)/28,0,1);v.lb.material.opacity=o;v.lb.visible=o>.03}
/* ---------- aturan kota ---------- */
function log(t,c){S.log.push({t,c:c||'#fff'});if(S.log.length>40)S.log.shift()}
function fl(t,c){const d=document.createElement('div');d.className='fl';d.textContent=t;d.style.color=c;d.style.left=(25+Math.random()*50)+'%';d.style.top=(28+Math.random()*22)+'%';$('hud').appendChild(d);setTimeout(()=>d.remove(),1800)}
function init(skipStart){isl.remove(dyn);dyn=new THREE.Group();isl.add(dyn);for(let x=0;x<N;x++)blk[x].set(blk0[x]);
S={verif:[],pop:MIN_WARGA,res:{kayu:16,batu:8,makanan:8,besi:0,bahan:8},kas:20,gaji:0,bs:[],pri:[],pi:0,li:0,log:[{t:'🌤️ Pulau Langit sepi… hanya ada Pak Bani. Tambah warga lewat menu ☰',c:'#fff'}],vil:[],names:new Set(),looks:new Set(['bani']),prod:{a:0,b:0}};
if(skipStart)return;const p=slot('rumah');addB('rumah',p[0],p[1],true);addVil(true,'Pak Bani')}
function ev(k,n,names){if(!OWNER)return;if(k=='f'){let add=0,last=null;for(let i=0;i<n;i++){const nm=names&&names[i]?clean(names[i]):'';if(nm&&S.names.has(nm.toLowerCase())){log(`ℹ️ @${nm} sudah jadi warga`,'#aaa');continue}if(nm)S.names.add(nm.toLowerCase());
 S.pop++;add++;last=nm;if(S.vil.length>=MAKS_WARGA){const a=S.vil.find(q=>q.auto&&!q.job&&!(q.w&&q.w.c));if(a)removeVil(a)}
 if(S.vil.length<MAKS_WARGA){const v=addVil(false,nm||('Warga '+S.pop),nm?nm.toLowerCase():'anon'+S.pop+'-'+Math.random().toString(36).slice(2,7));v.named=nm?1:0;NEWV=v;if(CINE&&!SHOT)startShot(v,false)}}
 if(add==1&&last)log(`👋 @${last} pindah ke pulau`,'#9ff59a');else if(add)log(`👥 +${add} warga baru pindah ke pulau`,'#9ff59a');if(add)fl(`+${add} Warga`,'#9ff59a')}
if(k=='l'){const g={kayu:2,batu:1,makanan:2,besi:1,bahan:1};RK.forEach(r=>S.res[r]+=g[r]*n);log(`👍 ${n} like → sumber daya bertambah`,'#ffd36a');fl(`+${n} Like`,'#ffd36a')}
if(k=='s'){S.kas+=5*n;log(`🔁 ${n} share → kas +${5*n}`,'#7fd6ff');fl(`+${5*n} Kas`,'#7fd6ff')}}
function addUser(){if(!OWNER)return;const i=$('un'),ns=i.value.split(/[\s,;]+/).map(clean).filter(Boolean);i.value='';if(ns.length)ev('f',ns.length,ns);else ev('f',1)}
function cmt(txt,who){if(!OWNER)return;const i=$('cm');txt=txt||i.value;if(!txt)return;i.value='';log(`💬 ${who||'@kamu'}: ${txt}`,'#ffb3f0');for(const k of txt.toLowerCase().split(/\W+/))if(KEY[k]){const v=KEY[k];if(!S.pri.includes(v)&&!(v=='kastil'&&cnt('kastil')))S.pri.push(v);break}}
function target(){const h=cnt('rumah');if(S.pri.length)return[S.pri[0],'pri'];if(S.pop>h*3&&(S.pi>=PROG.length||h<4+2*S.pi))return['rumah','h'];if(S.pi<PROG.length)return[PROG[S.pi],'p'];
for(let k=0;k<LOOP.length;k++){const t=LOOP[(S.li+k)%LOOP.length];if(cnt(t)<CAP[t](S.pop))return[t,'l',k]}return null}
const val=k=>k=='kas'?S.kas:S.res[k];
function aff(d){return S.pop>=d.p&&Object.entries(d.c).every(([k,v])=>val(k)>=v)}
function tick(){const act=S.bs.filter(b=>b.st!='done').length;if(act>=Math.min(3,1+(S.pop/20|0)))return;
const T=target();if(!T)return;const tp=T[0],src=T[1],d=DEF[tp];if(!aff(d))return;const pos=tp=='kastil'?[46,46]:slot(tp),adv=()=>{if(src=='pri')S.pri.shift();else if(src=='p')S.pi++;else if(src=='l')S.li+=T[2]+1};
if(!pos){adv();return}
Object.entries(d.c).forEach(([k,v])=>k=='kas'?S.kas-=v:S.res[k]-=v);const b=addB(tp,pos[0],pos[1],false);assign(b);adv();log(`🏗️ Warga mulai membangun ${d.n}`);fl(`🏗️ ${d.n}`,'#fff')}
function produce(d){const P=S.prod;P.a+=d;P.b+=d;if(P.a>=6){P.a=0;const f=cntD('ladang'),k=cntD('kincir');if(f)S.res.makanan+=f+Math.ceil(f*k*.15)}
if(P.b>=10){P.b=0;S.kas+=cntD('pasar')*3;S.res.bahan+=cntD('sekolah')}}
const sehat=()=>Math.round(50+50*Math.min(1,(cntD('puskesmas')*30+cntD('sumur')*6+cntD('taman')*8)/Math.max(1,S.pop)));
function demo(){if(!OWNER)return;const b=$('dm');if(demoT){clearInterval(demoT);demoT=null;b.textContent='▶ Mode Demo';return}b.textContent='⏸ Stop Demo';
const ids=['rumah ya','bikin pasar dong','menara jaga','kincir angin','kastil raja!','kebun sayur','lumbung besar','butuh puskesmas','sekolah dong','taman kota'],us=['@sari','@budi','@dewi','@rian','@nina'],nm=['sari','budi','dewi','rian','nina','agus','putri','dimas','citra','bayu','wulan','fajar','lina','hendra','maya'];
demoT=setInterval(()=>{if(Math.random()<.5){const n=1+(Math.random()*2|0);ev('f',n,Array.from({length:n},()=>nm[Math.random()*nm.length|0]+(Math.random()*99|0)))}if(Math.random()<.8)ev('l',3+(Math.random()*14|0));if(Math.random()<.4)ev('s',1+(Math.random()*2|0));if(Math.random()<.12)cmt(ids[Math.random()*ids.length|0],us[Math.random()*us.length|0])},900)}
function hud(){const nb=S.bs.filter(b=>b.st=='done').length,si=cntD('kastil')||nb>=70?3:nb>=30?2:nb>=10?1:0,st=STG[si];$('stg').textContent=st[0];hudX();
$('bar').style.width=(st[1]?Math.min(100,nb/st[1]*100):100)+'%';$('prg').textContent=st[1]?`${nb}/${st[1]} bangunan menuju ${st[2]}`:'Kerajaan terbesar kita! 👑';
$('pop').textContent='👥 Warga: '+S.pop;$('hlt').textContent='❤️ Sehat: '+sehat()+'%';$('kas').textContent='💰 Kas: '+S.kas;$('res').innerHTML=RK.map(r=>`<span>${RI[r]} ${S.res[r]}</span>`).join('');
const T=target();if(!T){$('nxt').innerHTML='<b>⏳ Kota sudah sesuai jumlah warga</b><br><small>Tambah warga atau tulis komentar (mis. "sekolah") untuk membangun lagi</small>';$('feed').innerHTML=S.log.slice(-4).map(l=>`<div style="color:${l.c}">${l.t}</div>`).join('');return}
const tp=T[0],d=DEF[tp],pr=S.pri[0]==tp;
$('nxt').innerHTML=`<b>${pr?'💬 Pilihan penonton':'🏗️ Berikutnya'}: ${d.n}</b><br>`+[`<span class="${S.pop>=d.p?'ok':'no'}">👥${d.p}</span>`,...Object.entries(d.c).map(([k,v])=>`<span class="${val(k)>=v?'ok':'no'}">${k=='kas'?'💰':RI[k]}${v}</span>`)].join(' · ')+(S.pri.length>1?`<br><small>Antrean: ${S.pri.slice(1).map(k=>DEF[k].n).join(', ')}</small>`:'');
$('feed').innerHTML=S.log.slice(-4).map(l=>`<div style="color:${l.c}">${l.t}</div>`).join('')}
/* ---------- simpan otomatis (aman kalau halaman dimuat ulang) ---------- */
const SAVEK='wpl2';
let SVT=0,svBad=0,LOCALTS=0;
function snapData(){return{ts:Date.now(),verif:S.verif||[],pop:S.pop,res:S.res,kas:S.kas,gaji:S.gaji|0,pi:S.pi,li:S.li,pri:S.pri,bs:S.bs.map(b=>[b.t,b.x,b.y]),vil:S.vil.filter(v=>!v.bani).map(v=>[v.name,v.key,v.named,v.occ,v.auto,v.earn|0]),log:S.log.slice(-10)}}
function save(){if(!OWNER)return false;try{localStorage.setItem(SAVEK,JSON.stringify(snapData()));SVT=Date.now();svBad=0;return true}catch(_){svBad=1;return false}}
function loadData(d){if(!d||!d.bs)return false;init(true);S.verif=Array.isArray(d.verif)?d.verif:[];S.pop=Math.max(MIN_WARGA,(d.pop|0)-(d.vil||[]).filter(q=>q[4]).length);Object.assign(S.res,d.res);S.kas=d.kas|0;S.gaji=d.gaji|0;S.pi=d.pi|0;S.li=d.li|0;S.pri=(d.pri||[]).filter(k=>DEF[k]);
d.bs.forEach(([t,x,y])=>{if(DEF[t]&&!blk[x][y])addB(t,x,y,true)});addVil(true,'Pak Bani');(d.vil||[]).filter(q=>!q[4]).slice(0,MAKS_WARGA-1).forEach(([n,k,nd,oc,au,er])=>{S.names.add(String(n).toLowerCase());const v=addVil(false,n,k,true);v.named=nd;v.auto=au?1:0;v.earn=er|0;if(oc&&JOBS[oc])employ(v,oc)});
S.log=(d.log||[]).slice(-10);log('💾 Kota dipulihkan dari simpanan','#9ff59a');return true}
function loadGame(){let raw=null;try{raw=localStorage.getItem(SAVEK);const d=JSON.parse(raw);LOCALTS=d&&d.ts||0;return loadData(d)}catch(e){console.error('load gagal',e);try{if(raw)localStorage.setItem(SAVEK+'_bak',raw)}catch(_){}return false}}
/* ---------- penyimpanan permanen di akun (aktif hanya di halaman Claude yang punya window.claude) ---------- */
const CLOUD={doc:null,ok:false,sync:false,busy:false,last:'',at:0,err:0};
async function cloudInit(){try{if(!OWNER)return;if(!window.claude||!claude.use)return;const[db,us]=await Promise.all([claude.use('db'),claude.use('user')]);if(!db||!us)return;const id=await us.id();if(!id)return;
CLOUD.doc=db.doc('data/users/'+id+'/save');const snap=await CLOUD.doc.get();let d=null;if(snap.exists){try{d=JSON.parse(snap.data().data)}catch(_){d=null}}
if(d&&d.bs&&(d.ts||0)>LOCALTS){try{if(loadData(d)){save();toast('☁️ Data dipulihkan dari penyimpanan akun')}}catch(e){console.error('cloud load gagal',e);init();CLOUD.err=1;return}}
CLOUD.ok=true;CLOUD.sync=true;cloudPush(true)}catch(e){console.error('cloud',e);CLOUD.err=1}}
let cChain=Promise.resolve();
function cloudPush(force){if(!CLOUD.sync||!CLOUD.doc||(!force&&CLOUD.busy))return Promise.resolve(false);const r=cChain.then(()=>cloudDo(force));cChain=r.catch(()=>{});return r}
async function cloudDo(force){const o=snapData(),js=JSON.stringify(Object.assign({},o,{ts:0}));if(!force&&js===CLOUD.last)return true;CLOUD.busy=true;
try{await CLOUD.doc.set({v:3,ts:o.ts,data:JSON.stringify(o)});CLOUD.last=js;CLOUD.at=Date.now();CLOUD.err=0;return true}catch(e){CLOUD.err=1;return false}finally{CLOUD.busy=false}}
function svtText(){const f=t=>{const z=new Date(t),p=n=>String(n).padStart(2,'0');return`${p(z.getHours())}:${p(z.getMinutes())}:${p(z.getSeconds())}`};
const a=svBad?'⚠️ Perangkat tidak bisa menyimpan':SVT?'✅ Perangkat: '+f(SVT):'Belum tersimpan',b=CLOUD.err?'⚠️ Akun: gagal menyimpan':CLOUD.ok&&CLOUD.at?'☁️ Akun: '+f(CLOUD.at):(window.claude&&!CLOUD.ok?'⏳ Menyambung ke akun…':'');return b?a+' • '+b:a}
let rw=0;const RWT='🧹 Reset Warga (sisakan Pak Bani)';
function resetWargaAsk(b){if(!OWNER)return;if(!rw){b.textContent='⚠️ Yakin? Ketuk lagi';rw=setTimeout(()=>{rw=0;b.textContent=RWT},3000);return}clearTimeout(rw);rw=0;b.textContent=RWT;resetWarga()}
function resetWarga(){if(!OWNER)return;S.vil.slice(1).forEach(removeVil);S.pop=1;S.names=new Set();S.looks=new Set(['bani']);S.bs.forEach(b=>{b.ws=[]});log('🧹 Warga direset: tinggal Pak Bani','#9ff59a');save();toast('🧹 Warga direset: tinggal Pak Bani')}
let rq=0;function resetAsk(b){if(!OWNER)return;if(!rq){b.textContent='⚠️ Yakin? Ketuk lagi';rq=setTimeout(()=>{rq=0;b.textContent='↺ Reset Kota'},3000);return}clearTimeout(rq);rq=0;b.textContent='↺ Reset Kota';try{localStorage.removeItem(SAVEK)}catch(_){}init()}
/* ---------- HUD tambahan: jam real-time, indikator rekam, daftar pekerjaan ---------- */
function hudX(){const ar=$('arr');if(SHOT&&SHOT.t<7){const nm=SHOT.v.name;ar.style.display='block';if(ar.dataset.n!==nm){ar.dataset.n=nm;ar.innerHTML='🎉 WARGA BARU DATANG!<b>@'+String(nm).replace(/[<>&"']/g,'')+'</b>'}}else{ar.style.display='none';ar.dataset.n=''}const d=new Date(),pd=n=>String(n).padStart(2,'0');$('hclk').textContent=todMode==0?`🕒 ${pd(d.getHours())}:${pd(d.getMinutes())}`:todMode==1?'☀️ Siang (manual)':'🌙 Malam (manual)';
const r=$('recb');if(RC){r.style.display='block';const q=(performance.now()-RC.t0)/1000|0;r.textContent=`⏺ ${pd(q/60|0)}:${pd(q%60)}  ⏹`}else r.style.display='none';
if($('mnu').classList.contains('open')){jobsHud();$('svt').textContent=svtText()}}
function jobsHud(){const c={},W=S.vil.filter(v=>!v.bani);let tk=0,mg=0;W.forEach(v=>{if(v.job)tk++;else if(v.occ)c[v.occ]=(c[v.occ]|0)+1;else mg++});
$('jobs').innerHTML=Object.entries(JOBS).map(([k,J])=>`<div><span>${J.ic} ${J.n}</span><b>${c[k]||0}</b></div>`).join('')+`<div><span>🔨 Tukang Bangunan</span><b>${tk}</b></div><div><span>🚶 Belum bekerja</span><b>${mg}</b></div><div class="tot"><span>💼 Total gaji dibayar</span><b>${S.gaji|0} kas</b></div>`}
let tt=0;function toast(m){const e=$('toast');e.textContent=m;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),2600)}
async function saveNow(){const a=save(),c=CLOUD.sync?await cloudPush(true):false;toast(c?'☁️ Tersimpan permanen di akun Anda':a?'💾 Tersimpan di perangkat ini'+(window.claude?' (akun belum tersambung)':''):'⚠️ Gagal menyimpan')}

/* ---------- rekam layar (merekam tampilan game + info kota, tanpa menu) ---------- */
let RC=null;
function recOK(){return !!(window.MediaRecorder&&HTMLCanvasElement.prototype.captureStream)}
function recStart(){if(RC)return;if(!recOK()){toast('⚠️ Browser ini belum mendukung rekam. Pakai perekam layar bawaan HP.');return}
const cv=ren.domElement,c2=document.createElement('canvas');c2.width=cv.width;c2.height=cv.height;const x=c2.getContext('2d'),ch=[];
const mt=['video/mp4;codecs=avc1','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
let mr;try{mr=new MediaRecorder(c2.captureStream(30),mt?{mimeType:mt,videoBitsPerSecond:5e6}:{videoBitsPerSecond:5e6})}catch(e){toast('⚠️ Gagal memulai rekam');return}
mr.ondataavailable=e=>{if(e.data&&e.data.size)ch.push(e.data)};mr.onstop=()=>recDone(ch,mr.mimeType||mt||'video/webm');
RC={mr,c2,x,t0:performance.now()};mr.start(1000);menu(0);toast('⏺ Merekam… ketuk tombol merah di kiri atas untuk berhenti');updMenu()}
function recStop(){if(!RC)return;const r=RC;RC=null;try{r.mr.stop()}catch(_){}updMenu()}
function recFrame(){const c=ren.domElement,x=RC.x,w=RC.c2.width,h=RC.c2.height;x.drawImage(c,0,0,w,h);recHud(x,w,h)}
function recHud(x,w,h){const u=w/100;x.textAlign='center';x.lineJoin='round';
const T=(s,px,py,sz,col)=>{x.font='800 '+sz+'px "Trebuchet MS",system-ui,sans-serif';x.lineWidth=sz*.2;x.strokeStyle='#0a1432';x.strokeText(s,px,py);x.fillStyle=col;x.fillText(s,px,py)};
T('WARGA PULAU LANGIT',50*u,9*u,6.2*u,'#ffe14d');T($('stg').textContent+'   '+$('hclk').textContent,50*u,16*u,3.8*u,'#fff');
T(`👥 ${S.pop}   ${$('hlt').textContent}   💰 ${S.kas}`,50*u,23*u,4.2*u,'#fff');T(RK.map(r=>RI[r]+' '+S.res[r]).join('   '),50*u,29*u,3.4*u,'#fff');
if(SHOT&&SHOT.t<7){T('🎉 WARGA BARU DATANG!',50*u,52*u,6*u,'#ffe14d');T('@'+SHOT.v.name,50*u,61*u,7.5*u,'#fff')}
const L=S.log.slice(-4);L.forEach((l,i)=>T(l.t,50*u,h-(L.length-i)*4.2*u-4*u,2.9*u,l.c))}
function recDone(ch,type){if(!ch.length){toast('⚠️ Rekaman kosong');return}const b=new Blob(ch,{type}),url=URL.createObjectURL(b),ext=/mp4/.test(type)?'mp4':'webm',nm='warga-pulau-langit-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)+'.'+ext;
const m=$('recm');m.innerHTML=`<div class="box"><b>🎬 Rekaman selesai</b><video src="${url}" controls playsinline></video><a class="btn" href="${url}" download="${nm}">⬇️ Unduh ${ext.toUpperCase()}</a><small>Kalau unduh tidak jalan, tekan lama videonya lalu pilih simpan.</small><button onclick="recClose()">Tutup</button></div>`;m.classList.add('open')}
function recClose(){const m=$('recm');m.classList.remove('open');m.innerHTML=''}

/* ---------- menu ---------- */
function menu(o){$('mnu').classList.toggle('open',!!o);if(o){updMenu();jobsHud();verifList()}}
function updMenu(){$('bCam').textContent=camMode?'🎥 Kamera: Bebas (Free Cam)':'🎥 Kamera: Orbit';$('ar').textContent=auto?'🔄 Auto-putar: Hidup':'🔄 Auto-putar: Mati';$('bFol').textContent=follow?'🎯 Ikuti Pak Bani: Hidup':'🎯 Ikuti Pak Bani: Mati';
$('bPad').textContent=padOn?'🕹️ Tombol arah: Tampil':'🕹️ Tombol arah: Sembunyi';$('bRec').textContent=RC?'⏹ Hentikan Rekaman':'⏺ Mulai Rekam Layar';
$('bTod').textContent=['🕒 Waktu: Real-time (jam perangkat)','☀️ Waktu: Siang (manual)','🌙 Waktu: Malam (manual)'][todMode];$('dm').textContent=demoT?'⏸ Stop Demo':'▶ Mode Demo';
$('bCine').textContent=CINE?'🎬 Sorot warga baru otomatis: Hidup':'🎬 Sorot warga baru otomatis: Mati';$('pad').classList.toggle('on',padOn);$('kzi').textContent=camMode?'⬆️':'🔍＋';$('kzo').textContent=camMode?'⬇️':'🔍－'}

/* ---------- kamera: orbit (bawaan) dan Free Cam (terbang bebas) ---------- */
let followV=null,th=.6,ph=.95,rad=60,follow=false,camMode=0,padOn=false,fyaw=0,fpit=0,fspd=14;const tg=new THREE.Vector3(0,.5,0),fp=new THREE.Vector3(),fcus=new THREE.Vector3(0,.5,0),FW=new THREE.Vector3(),mv={};
function resetCam(){th=.6;ph=.95;rad=60;follow=false;camMode=0;tg.set(0,.5,0);updMenu()}
function fwd(o){return o.set(-Math.cos(fpit)*Math.sin(fyaw),Math.sin(fpit),-Math.cos(fpit)*Math.cos(fyaw))}
function setCam(m){if(m==camMode)return;if(m){fp.copy(cam.position);FW.subVectors(tg,cam.position).normalize();fpit=Math.asin(cl(FW.y,-1,1));fyaw=Math.atan2(-FW.x,-FW.z);camMode=1;auto=false;follow=false;padOn=true}else camMode=0;updMenu()}
/* ---------- sorotan warga baru datang (kamera sinematik + rekam otomatis) ---------- */
let SHOT=null,CINE=false,NEWV=null,camSave=null;
function startShot(v,rec){if(SHOT)return;camSave={th,ph,rad,tg:new THREE.Vector3().copy(tg),cm:camMode,fl:follow,au:auto};camMode=0;follow=false;auto=false;let r=false;
if(rec&&!RC){if(recOK()){recStart();r=!!RC}else toast('ℹ️ Browser tidak bisa merekam, pakai perekam layar bawaan HP')}
SHOT={v,t:0,d:11,rec:r};menu(0);updMenu()}
function endShot(){if(!SHOT)return;const s=SHOT;SHOT=null;th=camSave.th;ph=camSave.ph;rad=camSave.rad;tg.copy(camSave.tg);camMode=camSave.cm;follow=camSave.fl;auto=camSave.au;if(s.rec)recStop();updMenu()}
function videoWarga(){if(!OWNER||SHOT)return;const i=$('un'),raw=i.value.split(/[\s,;]+/).map(clean).filter(Boolean)[0],nm=raw||genName();NEWV=null;ev('f',1,[nm]);const v=NEWV;if(!v){toast('⚠️ Nama itu sudah jadi warga atau kota penuh, pakai nama lain');return}i.value='';startShot(v,true)}
const cv=ren.domElement,pts=new Map();
function pan(dx,dy){const k=rad*.0016,rx=Math.cos(th),rz=-Math.sin(th),fx=-Math.sin(th),fz=-Math.cos(th);tg.x=cl(tg.x-rx*dx*k+fx*dy*k,-H2,H2);tg.z=cl(tg.z-rz*dx*k+fz*dy*k,-H2,H2)}
cv.addEventListener('pointerdown',e=>{if(SHOT)endShot();cv.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);auto=false;follow=false;$('hint').style.opacity=0});
cv.addEventListener('pointermove',e=>{const o=pts.get(e.pointerId);if(!o)return;const n=[e.clientX,e.clientY];
if(pts.size==1){const dx=n[0]-o[0],dy=n[1]-o[1];if(camMode){fyaw-=dx*.005;fpit=cl(fpit-dy*.004,-1.5,1.5)}else if(e.shiftKey||e.buttons==2)pan(dx,dy);else{th-=dx*.008;ph=cl(ph-dy*.006,.08,1.52)}}
else if(pts.size==2){const q=[...pts].find(([k])=>k!=e.pointerId)[1],d0=Math.hypot(o[0]-q[0],o[1]-q[1]),d1=Math.hypot(n[0]-q[0],n[1]-q[1]);if(camMode)fp.addScaledVector(fwd(FW),(d1-d0)*.12);else{if(d1>0)rad=cl(rad*d0/d1,4,170);pan((n[0]-o[0])/2,(n[1]-o[1])/2)}}
pts.set(e.pointerId,n)});
['pointerup','pointercancel'].forEach(k=>cv.addEventListener(k,e=>pts.delete(e.pointerId)));
cv.addEventListener('wheel',e=>{e.preventDefault();if(camMode)fp.addScaledVector(fwd(FW),-e.deltaY*.04);else rad=cl(rad*(1+e.deltaY*.001),4,170)},{passive:false});cv.addEventListener('contextmenu',e=>e.preventDefault());
function fit(){const w=fr.clientWidth,h=fr.clientHeight;ren.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix()}
new ResizeObserver(fit).observe(fr);fit();
/* ---------- loop ---------- */
const clk=new THREE.Clock();let acc=0,hacc=0,sacc=0,bacc=0,fa=0,cacc=0;
function loop(){const dt=Math.min(clk.getDelta(),.1),t=clk.elapsedTime;
isl.position.y=Math.sin(t*1.2)*.12;if(auto&&!camMode)th+=dt*.12;
S.bs.forEach(b=>{if(b.st=='plan'){b.pt+=dt;if(b.pt>14||!b.ws.length||b.ws.some(v=>v.atJob)){b.st='build';b.age=0}}
 else if(b.st=='build'){b.age+=dt;const s=Math.min(1,b.age/b.T),e=1-Math.pow(1-s,3);b.g.scale.set(b.sc,Math.max(.01,e)*b.sc,b.sc);if(s>=1)finish(b)}
 if(b.g.userData.bl)b.g.userData.bl.rotation.z=t*2});
S.vil.forEach(v=>stepV(v,dt,t));
const mx=(mv.r?1:0)-(mv.l?1:0),mz=(mv.u?1:0)-(mv.d?1:0),my=(mv.zi?1:0)-(mv.zo?1:0);
if(SHOT){SHOT.t+=dt;const p=SHOT.v.g.position,k=Math.min(1,dt*4);tg.x+=(p.x-tg.x)*k;tg.z+=(p.z-tg.z)*k;tg.y=.8;rad+=((SHOT.t<4?12:15)-rad)*Math.min(1,dt*1.5);ph+=(1.18-ph)*Math.min(1,dt*2);th+=dt*.3;if(SHOT.t>SHOT.d)endShot()}
else if(camMode){const f=fwd(FW),k=fspd*dt,c=Math.cos(fyaw),s=Math.sin(fyaw);fp.set(cl(fp.x+(f.x*mz+c*mx)*k,-130,130),cl(fp.y+(f.y*mz+my)*k,.5,220),cl(fp.z+(f.z*mz-s*mx)*k,-130,130))}
else{const sp=rad*.7*dt,fx=-Math.sin(th),fz=-Math.cos(th),rx=Math.cos(th),rz=-Math.sin(th);
 if(mx||mz){follow=false;tg.x=cl(tg.x+(rx*mx+fx*mz)*sp,-H2,H2);tg.z=cl(tg.z+(rz*mx+fz*mz)*sp,-H2,H2)}
 if(mv.zi)rad=cl(rad*(1-dt*1.2),4,170);if(mv.zo)rad=cl(rad*(1+dt*1.2),4,170);
 if(follow){const b=(followV&&S.vil.includes(followV)?followV:S.vil[0]).g.position;tg.x+=(b.x-tg.x)*dt*3;tg.z+=(b.z-tg.z)*dt*3}}
if(camMode){fwd(FW);cam.rotation.order='YXZ';cam.position.copy(fp);cam.rotation.set(fpit,fyaw,0);const k=FW.y<-.05?cl(-fp.y/FW.y,5,60):25;fcus.set(cl(fp.x+FW.x*k,-H2,H2),.5,cl(fp.z+FW.z*k,-H2,H2))}
else{cam.position.set(tg.x+rad*Math.sin(ph)*Math.sin(th),tg.y+rad*Math.cos(ph),tg.z+rad*Math.sin(ph)*Math.cos(th));cam.lookAt(tg);fcus.copy(tg)}
env(dt,t);
clouds.forEach(c=>{c.position.x+=dt*.5;if(c.position.x>170)c.position.x=-170});
acc+=dt;hacc+=dt;sacc+=dt;bacc+=dt;fa+=dt;cacc+=dt;if(acc>.4){produce(acc);acc=0;tick()}if(hacc>.2){hacc=0;hud()}if(sacc>2){sacc=0;save()}if(cacc>10){cacc=0;cloudPush()}if(bacc>2){bacc=0;balance()}if(fa>.2){fa=0;fillTick()}
ren.render(sc,cam);if(RC)recFrame();requestAnimationFrame(loop)}
document.querySelectorAll('[data-k]').forEach(b=>{const k=b.dataset.k;b.style.touchAction='none';b.onpointerdown=()=>{mv[k]=1;auto=false};['pointerup','pointerleave','pointercancel'].forEach(e=>b['on'+e]=()=>mv[k]=0)});
const KM={w:'u',arrowup:'u',s:'d',arrowdown:'d',a:'l',arrowleft:'l',d:'r',arrowright:'r',e:'zi',q:'zo'};
addEventListener('keydown',e=>{const k=KM[e.key.toLowerCase()];if(k&&e.target.tagName!='INPUT'){mv[k]=1;auto=false}});addEventListener('keyup',e=>{const k=KM[e.key.toLowerCase()];if(k)mv[k]=0});
$('un').addEventListener('keydown',e=>{if(e.key=='Enter')addUser()});
$('spd').addEventListener('input',e=>{fspd=+e.target.value;$('spdv').textContent=fspd});
const flush=()=>{save();cloudPush(true)};addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
/* ---------- kartu warga: daftar lewat DM Instagram + kode, dicek ke daftar yang disetujui Pak Bani ---------- */
function sha256s(str){const msg=new TextEncoder().encode(str),P=[];for(let n=2;P.length<64;n++){let ok=true;for(let d=2;d*d<=n;d++)if(n%d==0){ok=false;break}if(ok)P.push(n)}
const fr=x=>Math.floor((x-Math.floor(x))*4294967296),K=P.map(p=>fr(Math.cbrt(p)));let H=P.slice(0,8).map(p=>fr(Math.sqrt(p)));
const l=msg.length,pl=((l+9+63)>>6)<<6,b=new Uint8Array(pl);b.set(msg);b[l]=0x80;const dv=new DataView(b.buffer);dv.setUint32(pl-4,(l*8)>>>0);dv.setUint32(pl-8,Math.floor(l*8/4294967296));const w=new Uint32Array(64);
for(let i=0;i<pl;i+=64){for(let j=0;j<16;j++)w[j]=dv.getUint32(i+j*4);for(let j=16;j<64;j++){const a=w[j-15],c=w[j-2],s0=(a>>>7|a<<25)^(a>>>18|a<<14)^(a>>>3),s1=(c>>>17|c<<15)^(c>>>19|c<<13)^(c>>>10);w[j]=(w[j-16]+s0+w[j-7]+s1)>>>0}
let[a,b2,c2,d,e,f,g,h]=H;for(let j=0;j<64;j++){const S1=(e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7),ch=(e&f)^(~e&g),t1=(h+S1+ch+K[j]+w[j])>>>0,S0=(a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10),mj=(a&b2)^(a&c2)^(b2&c2),t2=(S0+mj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c2;c2=b2;b2=a;a=(t1+t2)>>>0}
H=[a,b2,c2,d,e,f,g,h].map((v,i)=>(H[i]+v)>>>0)}return H.map(v=>v.toString(16).padStart(8,'0')).join('')}
const IGOWN=typeof OWNER_IG!='undefined'?String(OWNER_IG).replace(/^@/,'').trim():'';
let ME=null;try{ME=JSON.parse(localStorage.getItem('wpl_me')||'null')}catch(_){}
const cleanIG=t=>String(t||'').trim().replace(/^@/,'').toLowerCase(),validIG=u=>/^[a-z0-9._]{1,30}$/.test(u),normCode=c=>String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,''),vhash=(u,c)=>sha256s('wpl-ig|'+u+'|'+normCode(c));
function meSave(){try{ME?localStorage.setItem('wpl_me',JSON.stringify({u:ME.u,code:ME.code,t:ME.t,k:ME.k,t2:ME.t2})):localStorage.removeItem('wpl_me')}catch(_){}}
/* tanda tangan digital Pak Bani (ECDSA P-256): kunci privat hanya ada di perangkat Pak Bani, kunci publik ada di config.js */
const B64=u=>btoa(String.fromCharCode(...u)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const UB64=t=>Uint8Array.from(atob(String(t).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const ECA={name:'ECDSA',namedCurve:'P-256'},ESG={name:'ECDSA',hash:'SHA-256'},TE=new TextEncoder();
const PUBK=()=>typeof OWNER_PUBKEY!='undefined'?OWNER_PUBKEY:'',BLOK=()=>typeof OWNER_BLOKIR!='undefined'?OWNER_BLOKIR.map(x=>String(x).toLowerCase()):[],sgMsg=(u,c)=>'wpl2|'+u+'|'+normCode(c);
async function verifyMsg(m,sg){const k=await crypto.subtle.importKey('raw',UB64(PUBK()),ECA,false,['verify']);return crypto.subtle.verify(ESG,k,UB64(sg),TE.encode(m))}
function newCode(){const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789',b=new Uint8Array(8);if(typeof crypto!='undefined'&&crypto.getRandomValues)crypto.getRandomValues(b);else for(let i=0;i<8;i++)b[i]=Math.random()*256;let t='';for(const x of b)t+=A[x%A.length];return'WPL-'+t.slice(0,4)+'-'+t.slice(4)}
async function checkMe(){if(!ME||!validIG(ME.u)||BLOK().includes(ME.u))return false;let ok=false;
const h=vhash(ME.u,ME.code),e=(S.verif||[]).find(q=>q.u==ME.u&&q.h==h);
if(e){ok=true;ME.t2=ME.t2||e.t||ME.t}else if(ME.k&&PUBK()){try{ok=await verifyMsg(sgMsg(ME.u,ME.code),ME.k)}catch(_){ok=false}}
if(!ok){ME.ok=false;return false}
ME.ok=true;ME.no='WPL-'+sha256s('wpl-no|'+ME.u).slice(0,6).toUpperCase();ME.t2=ME.t2||ME.t;if(!ME.v||!S.vil.includes(ME.v))spawnMe(ME.u);return true}
function spawnMe(u){const key=u.toLowerCase();let v=S.vil.find(q=>String(q.name).toLowerCase()==key);if(!v){S.names.add(key);v=addVil(false,u,key);v.named=1}v.me=1;v.lb.userData.col='#ffe14d';relabel(v);ME.v=v;return v}
function lihatKu(){kartu(0);if(ME&&ME.v&&S.vil.includes(ME.v)){followV=ME.v;follow=true;auto=false;rad=14;ph=1.1}else toast('Karakter Anda belum muncul')}
function kartu(o){const m=$('kkm');if(!o){m.classList.remove('open');return}m.classList.add('open');kkRender()}
function kkDaftar(){const u=cleanIG($('kku').value);if(!validIG(u)){toast('⚠️ Username Instagram tidak valid');return}if(BLOK().includes(u)){toast('⛔ Akun ini diblokir');return}ME={u,code:newCode(),t:Date.now()};meSave();kkRender()}
function kkGanti(){if(ME&&ME.v&&S.vil.includes(ME.v))removeVil(ME.v);ME=null;followV=null;follow=false;meSave();kkRender()}
function kkSalin(){try{navigator.clipboard.writeText(ME.code).then(()=>toast('📋 Kode disalin'),()=>toast('Salin manual kodenya ya'))}catch(_){toast('Salin manual kodenya ya')}}
async function kkKunci(){const sg=String($('kkk')?$('kkk').value:'').replace(/\s/g,'').replace(/^WPL\./i,'');if(!ME||!sg){toast('Tempel kunci aktivasi dari Pak Bani dulu');return}
if(!PUBK()){toast('Pendaftaran belum siap: Pak Bani belum memasang kunci publik');return}
let ok=false;try{ok=await verifyMsg(sgMsg(ME.u,ME.code),sg)}catch(_){}
if(!ok){toast('❌ Kunci aktivasi salah atau bukan untuk akun ini');return}
ME.k=sg;ME.t2=Date.now();meSave();await checkMe();toast('✅ Terverifikasi! Selamat datang, warga');kkRender()}
async function kkCek(){toast('🔄 Memeriksa…');try{const r=await fetch('kota.json',{cache:'no-store'});if(r.ok){const d=await r.json();if(Array.isArray(d.verif))S.verif=d.verif}}catch(_){}
if(await checkMe())toast('✅ Terverifikasi! Selamat datang, warga');else toast('Belum disetujui. Pastikan DM sudah terkirim, lalu coba lagi nanti');kkRender()}
function potret(look){return new Promise(res=>{try{const c=document.createElement('canvas');c.width=c.height=320;const r=new THREE.WebGLRenderer({canvas:c,antialias:true,alpha:true,preserveDrawingBuffer:true});r.setSize(320,320,false);const sc2=new THREE.Scene();
sc2.add(new THREE.HemisphereLight(0xffffff,0x9fb4d0,1.05));const dl=new THREE.DirectionalLight(0xffffff,.8);dl.position.set(2,4,5);sc2.add(dl);const g=mkChar(look);g.scale.setScalar(look.sc||1);sc2.add(g);
const cm=new THREE.PerspectiveCamera(32,1,.1,50);cm.position.set(0,.6,1.4);cm.lookAt(0,.6,0);r.render(sc2,cm);const url=c.toDataURL('image/png');r.dispose();if(r.forceContextLoss)r.forceContextLoss();res(url)}catch(e){console.error('potret',e);res(null)}})}
function kartuGambar(u,no,tgl,url){return new Promise(res=>{const c=document.createElement('canvas');c.width=720;c.height=450;const x=c.getContext('2d');
const draw=img=>{const g=x.createLinearGradient(0,0,720,450);g.addColorStop(0,'#0e1424');g.addColorStop(1,'#27345a');x.fillStyle=g;x.fillRect(0,0,720,450);
x.fillStyle='#ffe14d';x.fillRect(0,0,720,72);x.fillStyle='#0a1432';x.font='800 30px "Trebuchet MS",system-ui,sans-serif';x.textAlign='center';x.fillText('KARTU TANDA WARGA',360,34);x.font='700 18px "Trebuchet MS",system-ui,sans-serif';x.fillText('PULAU LANGIT',360,58);
x.fillStyle='#8fd3ff';x.fillRect(40,110,230,290);x.strokeStyle='#ffe14d';x.lineWidth=4;x.strokeRect(40,110,230,290);if(img){x.drawImage(img,40,150,230,230)}else{x.font='120px sans-serif';x.fillStyle='#0a1432';x.fillText('🙂',155,300)}
x.textAlign='left';const row=(k,v,y,big)=>{x.fillStyle='#9fb4d0';x.font='700 16px "Trebuchet MS",system-ui,sans-serif';x.fillText(k,310,y);x.fillStyle='#fff';x.font=(big?'800 34px':'700 26px')+' "Trebuchet MS",system-ui,sans-serif';x.fillText(v,310,y+(big?38:30))};
row('NAMA','@'+u,130,true);row('NO. WARGA',no,215);row('TERDAFTAR',tgl,285);row('KOTA','Pulau Langit • Pak Bani',355);
x.fillStyle='#7cf06a';x.font='800 20px "Trebuchet MS",system-ui,sans-serif';x.fillText('✔ TERVERIFIKASI INSTAGRAM',310,425);res(c.toDataURL('image/png'))};
if(!url){draw(null);return}const im=new Image();im.onload=()=>draw(im);im.onerror=()=>draw(null);im.src=url})}
let kkTok=0;
async function kkRender(){const m=$('kkm'),tok=++kkTok;let h='';const hello=IGOWN?`<b>@${IGOWN}</b>`:'akun Instagram Pak Bani';
if(!ME)h=`<b>🪪 Daftar jadi warga</b><small>Masukkan username Instagram Anda. Anda akan mendapat kode untuk dikirim lewat pesan (DM) Instagram ke Pak Bani.</small><input id="kku" placeholder="username Instagram (tanpa @)" maxlength="30" autocomplete="off"><button onclick="kkDaftar()">Daftar &amp; ambil kode</button><button class="gr" onclick="kartu(0)">Tutup</button>`;
else if(!ME.ok)h=`<b>⏳ Menunggu verifikasi</b><div class="kode">${ME.code}</div><small>1) Kirim pesan Instagram ke ${hello} <b>dari akun @${ME.u}</b> berisi kode di atas. 2) Pak Bani membalas dengan kunci aktivasi. 3) Tempel kunci itu di bawah.</small><button onclick="kkSalin()">📋 Salin kode</button>${IGOWN?`<a class="btn" href="https://ig.me/m/${IGOWN}" target="_blank" rel="noopener">💬 Buka DM Instagram</a>`:''}<input id="kkk" placeholder="Tempel kunci aktivasi dari Pak Bani" autocomplete="off"><button class="btn" onclick="kkKunci()">✅ Verifikasi</button><button class="gr" onclick="kkCek()">🔄 Cek otomatis (daftar kota.json)</button><button class="gr" onclick="kkGanti()">Ganti username</button><button class="gr" onclick="kartu(0)">Tutup</button>`;
else{h=`<b>🪪 Kartu Tanda Warga</b><img id="kkimg" alt="Kartu warga" style="width:100%;border-radius:8px;background:#0003;min-height:120px"><a class="btn" id="kkdl" href="#" download="kartu-warga-${ME.u}.png">⬇️ Simpan kartu</a><button onclick="lihatKu()">👀 Lihat karakterku</button><small>Kalau unduh tidak jalan, tekan lama gambar lalu simpan.</small><button class="gr" onclick="kkGanti()">Keluar / ganti akun</button><button class="gr" onclick="kartu(0)">Tutup</button>`}
m.innerHTML=`<div class="box">${h}</div>`;
if(ME&&ME.ok){const look=(ME.v&&ME.v.look)||newLook(ME.u.toLowerCase()),url=await potret(look),png=await kartuGambar(ME.u,ME.no,new Date(ME.t2||Date.now()).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}),url);
if(tok!==kkTok)return;const im=$('kkimg'),dl=$('kkdl');if(im)im.src=png;if(dl)dl.href=png}}
/* ---------- pemilik: setujui warga yang sudah DM kode ---------- */
function showText(t,txt,note){const m=$('recm');m.innerHTML=`<div class="box"><b>${t}</b><textarea id="stx" readonly></textarea><button onclick="copyTxt()">📋 Salin</button><small>${note}</small><button onclick="recClose()">Tutup</button></div>`;$('stx').value=txt;m.classList.add('open')}
function copyTxt(){const e=$('stx');try{navigator.clipboard.writeText(e.value).then(()=>toast('📋 Disalin'),()=>{e.select();document.execCommand('copy')})}catch(_){e.select()}}
function pubFromJwk(j){return B64(new Uint8Array([4,...UB64(j.x),...UB64(j.y)]))}
async function ownerKeys(){if(!OWNER)return;try{let p=localStorage.getItem('wpl_priv');if(!p){const k=await crypto.subtle.generateKey(ECA,true,['sign','verify']);p=JSON.stringify(await crypto.subtle.exportKey('jwk',k.privateKey));localStorage.setItem('wpl_priv',p)}
showText('🔑 Kunci verifikasi',"const OWNER_PUBKEY='"+pubFromJwk(JSON.parse(p))+"';",'Salin baris ini ke config.js (ganti baris OWNER_PUBKEY), lalu upload ulang config.js. Simpan juga cadangan kunci privat.')}catch(e){toast('⚠️ Browser tidak mendukung pembuatan kunci')}}
function ownerBackup(){if(!OWNER)return;const p=localStorage.getItem('wpl_priv');if(!p){toast('Belum ada kunci. Buat dulu.');return}showText('💾 Cadangan kunci privat',p,'RAHASIA, jangan dibagikan. Dipakai memindahkan kunci ke perangkat lain (Impor Kunci Privat). Kalau hilang tanpa cadangan, semua pemain harus daftar ulang.')}
function ownerImport(){if(!OWNER)return;try{const j=JSON.parse($('kimp').value.trim());if(j.kty!='EC'||!j.d)throw 0;localStorage.setItem('wpl_priv',JSON.stringify(j));$('kimp').value='';toast('✅ Kunci privat diimpor')}catch(_){toast('⚠️ Format kunci tidak valid')}}
async function verifSetuju(){if(!OWNER)return;const u=cleanIG($('vu').value),code=normCode($('vc').value);if(!validIG(u)||code.length!=11||code.slice(0,3)!='WPL'){toast('⚠️ Isi username dan kode (WPL-XXXX-XXXX) dengan benar');return}
const p=localStorage.getItem('wpl_priv');if(!p){toast('Buat kunci verifikasi dulu (tombol di bawah)');return}
try{const k=await crypto.subtle.importKey('jwk',JSON.parse(p),ECA,false,['sign']),sg=B64(new Uint8Array(await crypto.subtle.sign(ESG,k,TE.encode(sgMsg(u,code)))));
if(!S.names.has(u))ev('f',1,[u]);$('vu').value='';$('vc').value='';showText('✅ Kunci aktivasi untuk @'+u,'WPL.'+sg,'Pastikan DM berisi kode tadi benar-benar dikirim dari akun @'+u+'. Lalu balas DM itu dengan kunci di atas.')}catch(e){toast('⚠️ Gagal membuat kunci aktivasi')}}
function verifHapus(u){if(!OWNER)return;S.verif=(S.verif||[]).filter(e=>e.u!=u);save();verifList()}
function verifList(){const l=$('vlist');if(!l)return;l.innerHTML=(S.verif||[]).map(e=>`<div><span>@${e.u}</span><button class="x" onclick="verifHapus('${e.u}')">✖</button></div>`).join('')||'<small>Belum ada warga terverifikasi.</small>'}
/* ---------- login pemilik, ekspor kota, mulai game ---------- */
async function sha(t){return sha256s(t)}
async function ownerLogin(){if(OWNER){toast('✅ Anda sudah masuk sebagai Pak Bani');return}const p=prompt('PIN Pak Bani:');if(!p)return;
try{if(await sha('wpl|'+p)===PINHASH()){localStorage.setItem('wpl_owner',PINHASH());location.reload()}else toast('❌ PIN salah')}catch(_){toast('⚠️ Browser ini tidak mendukung login pemilik')}}
function ownerLogout(){try{localStorage.removeItem('wpl_owner')}catch(_){}location.reload()}
function kotaJSON(){return JSON.stringify(snapData())}
function exportKota(){if(!OWNER)return;const j=kotaJSON(),url=URL.createObjectURL(new Blob([j],{type:'application/json'})),m=$('recm');
m.innerHTML=`<div class="box"><b>📤 Kota siap dipublikasikan</b><a class="btn" href="${url}" download="kota.json">⬇️ Unduh kota.json</a><button onclick="copyKota()">📋 Salin teks</button><small>Upload kota.json ke folder yang sama dengan index.html (ganti file lama). Pemain lain akan melihat kota ini.</small><button onclick="recClose()">Tutup</button></div>`;m.classList.add('open')}
function copyKota(){try{navigator.clipboard.writeText(kotaJSON()).then(()=>toast('📋 Disalin'),()=>toast('⚠️ Gagal menyalin'))}catch(_){toast('⚠️ Gagal menyalin')}}
let tapN=0,tapT=0;$('own').addEventListener('click',()=>{const n=performance.now();tapN=n-tapT<1500?tapN+1:1;tapT=n;if(tapN>=5){tapN=0;ownerLogin()}});
if(!OWNER&&/pemilik/.test(location.hash+location.search))setTimeout(ownerLogin,400);
function boot(){let on=false;const go=snap=>{if(on)return;on=true;
 if(OWNER){if(!loadGame()&&!(snap&&loadData(snap)))init()}else if(!(snap&&loadData(snap)))init();
 document.body.classList.toggle('owner',OWNER);document.body.classList.toggle('viewer',!OWNER);if(!OWNER){$('hint').innerHTML='👀 Mode penonton — kota milik Pak Bani<br>Geser = putar • cubit = zoom<br>🪪 Ketuk kartu di kanan atas untuk jadi warga';if(ME)checkMe()}
 updMenu();loop();cloudInit()};
 let has=false;if(OWNER){try{has=!!localStorage.getItem(SAVEK)}catch(_){}}
 if(has||typeof fetch!='function'){go(null);return}
 setTimeout(()=>go(null),3500);fetch('kota.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null).then(go)}
boot();

/* ===== Koneksi ke server (opsional: follow/sub/like/share/komentar otomatis). Tanpa server game tetap jalan ===== */
let wsOk=false,wsFail=0;
function setNet(s){const n=$('net');n.className=s==1?'on':'';n.textContent=s==1?'🟢 Terhubung ke server — event masuk otomatis':s==2?'🔴 Server putus, mencoba lagi…':OWNER?'⚪ Mode lokal (tanpa server) — pakai menu ☰':'👀 Mode penonton — kota milik Pak Bani'}
function onEvent(e){const n=Math.max(1,Math.min(+e.count||1,1000));
if(e.type=='follow'||e.type=='subscribe')ev('f',n,e.user?[e.user]:null);else if(e.type=='like')ev('l',n);else if(e.type=='share')ev('s',n);else if(e.type=='comment'&&e.text)cmt(String(e.text).slice(0,80),'@'+String(e.user||'penonton').slice(0,20))}
function connect(){let ws;try{ws=new WebSocket((location.protocol=='https:'?'wss://':'ws://')+location.host)}catch(_){setNet(0);return}
ws.onopen=()=>{wsOk=true;wsFail=0;setNet(1)};
ws.onclose=()=>{if(wsOk){wsOk=false;setNet(2);setTimeout(connect,2000)}else if(++wsFail<3)setTimeout(connect,2000);else setNet(0)};
ws.onmessage=m=>{try{onEvent(JSON.parse(m.data))}catch(_){}}}
setNet(0);if(OWNER&&location.protocol.startsWith('http'))connect();
