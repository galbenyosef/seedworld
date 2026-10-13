(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const stage = $("stage"),
    canvas = $("c");
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });
  if (!gl) {
    $("nogl").hidden = false;
    return;
  }

  /* ================= shaders ================= */
  const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  /* Shared by the picture and the texture export, so both always match. */
  const COMMON = `precision highp float;
uniform float uTime,uSea,uScale,uMount,uTemp,uWet,uCloud,uAtm,uTilt,uIce,uEmit,uCity,uOct,uGas;
uniform vec3 uOff,uCOff;
uniform vec3 cDeep,cShallow,cSand,cDry,cGrass,cGreen,cRock,cSnow;
float hash(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p,float o){float a=0.5,s=0.0;for(int i=0;i<12;i++){if(float(i)>=o)break;s+=a*noise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return s;}
vec3 rotY(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x-s*v.z,v.y,s*v.x+c*v.z);}
vec3 rotZ(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x-s*v.y,s*v.x+c*v.y,v.z);}
float terrainH(vec3 o,float oct){
 vec3 p=o*(1.7*uScale)+uOff;
 vec3 w=vec3(noise(p*0.8+7.3),noise(p*0.8+19.1),noise(p*0.8+31.7))-0.5;
 p+=w*0.9;
 float c=fbm(p,oct);
 float r=0.0;float a=0.5;vec3 q=p*2.1+3.1;
 for(int i=0;i<5;i++){float n=1.0-abs(noise(q)*2.0-1.0);r+=a*n*n;q=q*2.03+vec3(5.2,1.3,8.1);a*=0.5;}
 return c+uMount*0.42*r*smoothstep(0.42,0.60,c);
}
struct Mat{vec3 alb;float h;float water;float ice;float rough;float depth;vec3 city;vec3 glow;};
float crack(vec3 p){
 vec3 i=floor(p),f=fract(p);float d1=8.0,d2=8.0;
 for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec3 g=vec3(float(x),float(y),float(z));vec3 q=i+g;
  vec3 o=vec3(hash(q),hash(q+vec3(31.7,11.3,5.1)),hash(q+vec3(7.9,47.1,23.3)));
  vec3 r=g+o-f;float d=dot(r,r);
  if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}
 }
 return sqrt(d2)-sqrt(d1);
}
vec3 lavaCracks(vec3 o){
 vec3 w=vec3(noise(o*6.0+uOff),noise(o*6.0+uOff+9.1),noise(o*6.0+uOff+17.3))-0.5;
 float e=crack(o*(5.0*uScale+2.5)+uOff+w*1.0);
 float e2=crack(o*(15.0*uScale+6.0)+uOff*1.7+w*1.6);
 float e3=crack(o*(40.0*uScale+10.0)+uOff*2.3+w*2.0);
 float width=0.035+0.06*noise(o*9.0+uOff);
 float l1=1.0-smoothstep(0.0,width,e);
 float l2=(1.0-smoothstep(0.0,width*0.9,e2))*0.65*smoothstep(0.08,0.3,e);
 float l3=(1.0-smoothstep(0.0,width*0.9,e3))*0.4*smoothstep(0.1,0.35,e2);
 float heat=fbm(o*7.0+uOff+uTime*0.02,4.0);
 float halo=pow(1.0-smoothstep(0.0,0.35,e),2.0)*0.3;
 float k=(l1+l2+l3)*(0.55+0.9*heat)+halo*heat;
 vec3 hot=vec3(1.0,0.88,0.55);
 return mix(cShallow,hot,clamp(l1*l1*1.2+(l2+l3)*0.35,0.0,1.0))*k;
}
Mat material(vec3 o,float oct){
 Mat m;
 if(uGas>0.5){
  float tb=fbm(vec3(o.x*3.0,o.y*2.0,o.z*3.0)+uOff,4.0)-0.5;
  float tb2=fbm(vec3(o.x*9.0,o.y*5.0,o.z*9.0)+uOff.zxy,3.0)-0.5;
  float band=sin((o.y+tb*0.22+tb2*0.05)*uScale*20.0);
  float band2=sin((o.y+tb*0.3)*uScale*47.0+2.0);
  vec3 c=mix(cSand,cDry,smoothstep(-0.7,0.7,band));
  c=mix(c,cRock,smoothstep(0.35,1.0,band2)*0.35);
  c=mix(c,cSnow,smoothstep(0.55,1.0,tb2*2.0+band*0.3)*0.25);
  vec2 sp=vec2(o.x-0.55,(o.y+0.32)*2.2);
  float spot=1.0-smoothstep(0.0,0.2,length(vec2(sp.x*(o.z>0.0?1.0:0.0),sp.y)));
  c=mix(c,cRock*1.25,spot*uMount*0.6);
  m.alb=c*(0.9+0.2*noise(o*40.0+uOff));m.rough=0.85;m.h=uSea;
  m.city=vec3(0.0);m.glow=vec3(0.0);m.depth=0.0;m.water=0.0;m.ice=0.0;
  return m;
 }
 float h=terrainH(o,oct);float elev=h-uSea;
 float lat=abs(o.y);
 float moist=fbm(o*2.3*uScale+uOff.zxy+11.0,5.0)+uWet-0.5+0.14*cos(6.0*asin(clamp(o.y,-1.0,1.0)));
 float temp=1.08-lat*lat*0.95-lat*0.5-max(elev-0.04,0.0)*1.15+uTemp+(fbm(o*5.0+uOff,3.0)-0.5)*0.3;
 m.h=h;m.city=vec3(0.0);m.glow=vec3(0.0);m.depth=0.0;
 float ice;
 if(elev<0.0){
  float d=clamp(-elev*7.0,0.0,1.0);m.depth=d;m.water=1.0;
  ice=(1.0-smoothstep(uIce-0.2,uIce-0.06,temp))*(0.55+0.45*noise(o*26.0+uOff));
  vec3 c=mix(cShallow*1.15,cDeep,pow(d,0.55));
  c=mix(c,cSnow*0.92,ice);
  m.alb=c;m.rough=mix(0.06,0.5,ice);
  m.glow=cShallow*uEmit*(0.55+0.45*noise(o*24.0+uTime*0.15))*(1.0-d*0.6)*(1.0-ice);
  if(uEmit>0.0){
   vec3 w=vec3(noise(o*5.0+uOff),noise(o*5.0+uOff+9.1),noise(o*5.0+uOff+17.3))-0.5;
   float e=crack(o*(4.0*uScale+3.0)+uOff+w*1.1);
   float plate=smoothstep(0.10,0.34,e)*smoothstep(0.30,0.60,fbm(o*5.0+uOff+3.0,3.0));
   float heat=fbm(o*12.0+uOff,4.0);
   vec3 lava=mix(vec3(0.95,0.22,0.03),vec3(1.0,0.5,0.12),heat*heat*1.2);
   m.glow=lava*(1.0-plate)*uEmit*0.3*(0.6+0.7*heat);
   m.alb=mix(cDeep*0.9,vec3(0.02,0.015,0.015),plate);
   m.rough=0.6;
  }
 }else{
  m.water=0.0;
  vec3 c=mix(cDry,cGrass,smoothstep(0.30,0.48,moist));
  c=mix(c,cGreen,smoothstep(0.52,0.68,moist));
  c=mix(c,cSand*0.92,1.0-smoothstep(0.0,0.02,elev));
  float pt=fbm(o*14.0+uOff,4.0);
  c*=0.78+0.44*pt;
  c=mix(c,cRock*(0.8+0.4*pt),smoothstep(0.12,0.26,elev)*0.9);
  ice=1.0-smoothstep(uIce-0.06,uIce,temp+0.12*(noise(o*18.0+uOff)-0.5));
  c=mix(c,cSnow,ice);
  m.alb=c;m.rough=mix(0.88,0.45,ice);
  float city=smoothstep(0.55,0.78,fbm(o*55.0,3.0))*smoothstep(0.35,0.6,noise(o*9.0+uOff))*(1.0-smoothstep(0.0,0.08,elev))*(1.0-ice);
  m.city=vec3(1.0,0.66,0.3)*city*uCity;
  float cr=noise(o*30.0+uOff);
  m.glow=cShallow*smoothstep(0.47,0.5,cr)*(1.0-smoothstep(0.5,0.53,cr))*uEmit*0.5;
  if(uEmit>0.0){
   m.glow=lavaCracks(o)*uEmit*0.8*(1.0-smoothstep(0.12,0.32,elev)*0.75);
   m.alb=m.alb*(0.22+0.3*pt)+vec3(0.012,0.008,0.008);
   m.rough=0.9;
  }
 }
 m.ice=ice;
 return m;
}
float cloudAt(vec3 n){
 vec3 q=n*2.1+uCOff;
 float w=fbm(q*1.3,3.0);
 float cd=fbm(q+vec3(w*1.6,w*0.7,0.0),6.0);
 cd*=0.86+0.14*cos(n.y*9.0);
 cd+=(noise(vec3(n.x*5.0+w*2.0,n.y*36.0,n.z*5.0)+uCOff)-0.5)*0.10;
 float t=0.62-uCloud*0.34;
 return smoothstep(t,t+0.12,cd);
}
`;

  const VIEW_FS =
    COMMON +
    `
uniform vec2 uRes,uOrig,uShift;uniform float uSys,uRot,uCloudRot,uDist,uRelief,uRing,uRingIn,uRingOut,uMoon;
uniform mat3 uCam;uniform vec3 uSun,uMoonPos,cAtm,cCloud,cRingA,cRingB;
const float SUN=3.2;
vec2 sph(vec3 ro,vec3 rd,float r){float b=dot(ro,rd);float c=dot(ro,ro)-r*r;float h=b*b-c;if(h<0.0)return vec2(-1.0);h=sqrt(h);return vec2(-b-h,-b+h);}
vec3 lin(vec3 c){return pow(c,vec3(2.2));}
uniform float uNeb,uStarD;uniform vec3 uNebA,uNebB;uniform vec4 uGal[3],uFar[3];uniform vec3 uGalC[3],uFarC[3];
vec3 space(vec3 rd){
 vec3 col=vec3(0.004,0.005,0.009);
 float n=fbm(rd*1.7+uOff*0.1,5.0);
 float n2=fbm(rd*3.3+uOff*0.2+7.0,4.0);
 float m=smoothstep(0.38,0.82,n);
 col+=mix(uNebA,uNebB,n2)*m*uNeb*0.30*(0.55+0.9*n2*n2);
 col+=mix(uNebB,uNebA,n)*pow(smoothstep(0.5,0.9,n2),2.0)*uNeb*0.12;
 vec3 g=rd*220.0;vec3 id=floor(g);float h=hash(id);vec3 f=fract(g)-0.5;
 float st=(1.0-smoothstep(0.0,0.35,length(f)))*step(1.0-0.015*uStarD,h)*(0.4+0.6*hash(id+7.0));
 col+=st*1.6*mix(vec3(1.0,0.85,0.7),vec3(0.7,0.8,1.0),hash(id+3.0));
 vec3 g2=rd*520.0;vec3 id2=floor(g2);float h2=hash(id2+3.7);vec3 f2=fract(g2)-0.5;
 col+=(1.0-smoothstep(0.0,0.3,length(f2)))*step(1.0-0.03*uStarD,h2)*0.35*vec3(0.85,0.9,1.0);
 for(int i=0;i<3;i++){
  if(uGal[i].w>0.0){
   vec3 d=uGal[i].xyz;
   if(dot(rd,d)>0.9){
    vec3 t1=normalize(cross(d,vec3(0.0,1.0,0.013)));vec3 t2=cross(d,t1);
    vec2 q=vec2(dot(rd,t1),dot(rd,t2))/uGal[i].w;
    float ca=cos(d.x*9.0),sa=sin(d.x*9.0);q=vec2(ca*q.x-sa*q.y,sa*q.x+ca*q.y);q.y*=2.4;
    float r=length(q);float ang=atan(q.y,q.x);
    float arm=0.5+0.5*cos(2.0*(ang-log(r+0.03)*3.2));
    float v=exp(-r*6.5)*1.4+exp(-r*2.4)*(0.25+0.75*arm)*0.7;
    col+=uGalC[i]*v*smoothstep(1.0,0.55,r)*(0.8+0.4*noise(rd*90.0));
   }
  }
  if(uFar[i].w>0.0){
   vec3 d=uFar[i].xyz;float c=dot(rd,d);
   if(c>0.9){
    float a=acos(clamp(c,-1.0,1.0));float rad=uFar[i].w;
    if(a<rad*1.35){
     vec3 t1=normalize(cross(d,vec3(0.0,1.0,0.013)));vec3 t2=cross(d,t1);
     vec2 q=vec2(dot(rd,t1),dot(rd,t2))/rad;float z=sqrt(max(1.0-dot(q,q),0.0));
     vec3 nn=normalize(q.x*t1+q.y*t2+z*d);
     float l=clamp(dot(nn,uSun)*1.15+0.08,0.0,1.0);
     float band=0.75+0.25*noise(vec3(nn.x*3.0+float(i)*9.0,nn.y*14.0,nn.z*3.0));
     vec3 pc=uFarC[i]*band*(0.03+l*1.25);
     float edge=smoothstep(rad,rad*0.97,a);
     col=mix(col,pc+uFarC[i]*pow(1.0-z,3.0)*0.35*l,edge);
     col+=uFarC[i]*exp(-(a-rad)*(a-rad)/(rad*rad*0.05))*0.08*step(rad,a)*l;
    }
   }
  }
 }
 float sd=max(dot(rd,uSun),0.0);
 col+=vec3(1.0,0.86,0.65)*(pow(sd,900.0)*8.0+pow(sd,40.0)*0.05);
 return col;}
vec3 atmo(vec3 ro,vec3 rd,float t0,float t1,vec3 base){
 float dt=(t1-t0)/8.0;vec3 acc=vec3(0.0);float od=0.0;
 vec3 ac=lin(cAtm);
 for(int i=0;i<8;i++){
  vec3 p=ro+rd*(t0+dt*(float(i)+0.5));
  float hh=length(p)-1.0;float d=exp(-max(hh,0.0)*32.0)*uAtm;
  float mu=dot(normalize(p),uSun);
  float l=smoothstep(-0.3,0.35,mu);
  vec3 c=mix(ac,vec3(1.0,0.2,0.04),0.45*(1.0-smoothstep(0.0,0.4,mu))*smoothstep(-0.3,0.05,mu));
  acc+=c*l*d*dt;od+=d*dt;}
 return base*exp(-od*2.4)+acc*2.6;}
float ringBand(float rr){
 float x=(rr-uRingIn)/(uRingOut-uRingIn);
 if(x<0.0||x>1.0)return 0.0;
 float b=fbm(vec3(rr*34.0,uOff.x*3.0,uOff.y*3.0),4.0);
 float edge=smoothstep(0.0,0.04,x)*smoothstep(1.0,0.94,x);
 float gap=smoothstep(0.012,0.04,abs(x-0.62));
 return clamp(0.15+1.3*(b-0.3),0.0,1.0)*edge*gap;}
vec4 ringPass(vec3 ro,vec3 rd,vec3 axis,out float tr){
 tr=-1.0;float dn=dot(rd,axis);if(abs(dn)<0.0001)return vec4(0.0);
 float t=-dot(ro,axis)/dn;if(t<=0.0)return vec4(0.0);
 vec3 rp=ro+rd*t;float rr=length(rp);float d=ringBand(rr);if(d<=0.002)return vec4(0.0);
 tr=t;
 float sd=dot(uSun,axis);
 float lit=mix(0.30,1.0,smoothstep(0.0,0.5,abs(sd)));
 float shadow=(sph(rp,uSun,1.0).x>0.0)?0.05:1.0;
 vec3 c=mix(cRingA,cRingB,fbm(vec3(rr*20.0,uOff.z*3.0,1.0),3.0));
 return vec4(lin(c)*SUN*lit*shadow+vec3(0.003),d*0.93);}
vec3 surface(vec3 p,vec3 rd){
 vec3 n=normalize(p);
 vec3 o=rotY(rotZ(n,-uTilt),uRot);
 Mat m=material(o,uOct);
 float pix=1.0/(1.7*uRes.y);
 float e=max(pix*max(uDist-1.0,0.06)*1.2,0.00025);
 vec3 t1=normalize(cross(o,vec3(0.0,1.0,0.0))+vec3(0.0001));vec3 t2=cross(o,t1);
 float hx=terrainH(normalize(o+t1*e),uOct),hy=terrainH(normalize(o+t2*e),uOct);
 vec3 gv=(t1*(hx-m.h)+t2*(hy-m.h))/e*(0.3*uRelief)*(1.0-m.water)*(1.0-uGas);
 gv/=1.0+0.6*length(gv);
 vec3 nw=rotZ(rotY(normalize(o-gv),-uRot),uTilt);
 vec3 L=uSun;
 float ndl=dot(nw,L);float ng=dot(n,L);
 float day=smoothstep(-0.10,0.18,ng);
 float lit=clamp((ndl+0.08)/1.08,0.0,1.0)*smoothstep(-0.05,0.12,ng);
 vec3 ac=lin(cAtm);
 vec3 amb=ac*0.05*day+vec3(0.004,0.005,0.009);
 vec3 st=normalize(L-n*ng+vec3(0.0001));
 float shd=cloudAt(rotY(rotZ(normalize(n+st*0.035),-uTilt),uCloudRot));
 float rs=1.0;
 if(uRing>0.5){
  vec3 axis=rotZ(vec3(0.0,1.0,0.0),uTilt);
  float dn=dot(L,axis);
  if(abs(dn)>0.02){float t2r=-dot(p,axis)/dn;if(t2r>0.0){vec3 rp=p+L*t2r;rs=1.0-0.85*ringBand(length(rp));}}
 }
 vec3 base=lin(m.alb);
 float sunI=SUN*rs*(1.0-0.5*shd);
 vec3 col;
 if(m.water>0.5){
  vec3 wv=(vec3(noise(o*46.0+uTime*0.3),noise(o*46.0+17.0-uTime*0.25),noise(o*46.0+31.0+uTime*0.2))-0.5)*0.035*(1.0-m.ice);
  vec3 r=reflect(rd,normalize(n+wv));
  float rl=max(dot(r,L),0.0);
  float spec=(pow(rl,160.0)*1.6+pow(rl,14.0)*0.10)*(1.0-m.ice)*smoothstep(0.0,0.1,ng);
  float fr=0.03+0.97*pow(1.0-max(dot(-rd,n),0.0),5.0);
  col=base*(lit*sunI)+base*amb+ac*fr*0.5*(0.12+0.88*day)+vec3(1.0,0.9,0.78)*spec*sunI*2.0;
 }else{
  col=base*(lit*sunI)+base*amb;
 }
 col+=m.city*(1.0-day)*1.3+m.glow*1.4;
 vec3 cn=rotY(rotZ(n,-uTilt),uCloudRot);
 float cl=cloudAt(cn);
 float cLit=clamp((ng+0.06)/1.06,0.0,1.0)*smoothstep(-0.05,0.1,ng);
 vec3 cc=lin(cCloud)*(SUN*cLit*rs*(1.0-0.55*shd)+ac.x*0.0)+ac*0.05*day+vec3(0.004,0.005,0.009);
 return mix(col,cc,cl*0.88);
}
void main(){
 vec2 uv=(gl_FragCoord.xy-uOrig-0.5*uRes)/uRes.y-uShift;
 vec3 ro=uCam*vec3(0.0,0.0,uDist);
 vec3 rd=normalize(uCam*vec3(uv,-1.7));
 float pix=1.0/(1.7*uRes.y);
 vec2 tp=sph(ro,rd,1.0),ta=sph(ro,rd,1.1);
 float b=dot(ro,rd);vec3 p0=ro-rd*b;float imp=length(p0);
 float pw=pix*sqrt(max(uDist*uDist-1.0,0.01));
 float cov=clamp((1.0-imp)/pw+0.5,0.0,1.0);
 vec3 bg=(uSys>0.5||cov>=1.0)?vec3(0.0):space(rd);
 vec3 col=bg;
 float tPl=1e9;
 if(cov<1.0&&ta.y>0.0)col=atmo(ro,rd,max(ta.x,0.0),ta.y,bg);
 if(cov>0.0){
  vec3 p;float t;
  if(tp.x>0.0){p=ro+rd*tp.x;t=tp.x;}else{p=normalize(p0);t=dot(p-ro,rd);}
  vec3 s=surface(p,rd);
  s=atmo(ro,rd,max(ta.x,0.0),t,s);
  col=(cov>=1.0)?s:mix(col,s,cov);
  tPl=t;
 }
 float tm=-1.0;vec3 mcol=vec3(0.0);
 if(uMoon>0.5){
  vec2 q=sph(ro-uMoonPos,rd,0.27);
  if(q.x>0.0){
   tm=q.x;vec3 pm=ro+rd*q.x;vec3 nm=normalize(pm-uMoonPos);
   float d=max(dot(nm,uSun),0.0);
   float ecl=(sph(pm,uSun,1.0).x>0.0)?0.08:1.0;
   float mt=fbm(nm*5.0+uOff,5.0);
   float crt=smoothstep(0.62,0.78,noise(nm*16.0+uOff))*0.25+smoothstep(0.66,0.8,noise(nm*38.0+uOff))*0.15;
   vec3 mc=mix(vec3(0.30,0.29,0.28),vec3(0.62,0.60,0.57),mt)*(0.85+0.3*noise(nm*80.0))*(1.0-crt*1.5);
   mcol=lin(mc)*(SUN*d*ecl+0.004);
  }
 }
 float tr=-1.0;vec4 rg=vec4(0.0);
 if(uRing>0.5)rg=ringPass(ro,rd,rotZ(vec3(0.0,1.0,0.0),uTilt),tr);
 bool moonOn=tm>0.0&&(cov<0.5||tm<tPl);
 bool ringOn=tr>0.0&&(cov<0.5||tr<tPl);
 if(moonOn&&ringOn){
  if(tm<tr){col=mix(col,rg.rgb,rg.a);col=mcol;}else{col=mcol;col=mix(col,rg.rgb,rg.a);}
 }else if(moonOn){col=mcol;}
 else if(ringOn){col=mix(col,rg.rgb,rg.a);}
 col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);
 col=pow(clamp(col,0.0,1.0),vec3(0.4545));
 if(uSys>0.5){float al=min(1.0,max(col.r,max(col.g,col.b))*6.0);al=max(al,cov);if(ringOn)al=max(al,rg.a);if(moonOn)al=1.0;gl_FragColor=vec4(col*al,al);return;}
 col+=(hash(vec3(gl_FragCoord.xy,fract(uRot)*100.0))-0.5)/255.0;
 gl_FragColor=vec4(col,1.0);
}`;

  const BAKE_FS =
    COMMON +
    `
uniform vec2 uSize;uniform float uRow0,uMode,uStrength,uFlip;
vec3 dirAt(float lat,float lon){float c=cos(lat);return vec3(c*sin(lon),sin(lat),c*cos(lon));}
void main(){
 float g=uRow0+floor(gl_FragCoord.y);
 float lon=((floor(gl_FragCoord.x)+0.5)/uSize.x-0.5)*6.2831853;
 float lat=((g+0.5)/uSize.y-0.5)*3.1415927;
 vec3 o=dirAt(lat,lon);
 vec3 c=vec3(0.0);
 if(uMode<0.5){Mat m=material(o,uOct);c=m.alb;}
 else if(uMode<1.5){
  float h=terrainH(o,uOct);
  float v=floor(clamp((h-0.15)/1.2,0.0,1.0)*65535.0+0.5);
  float hi=floor(v/256.0);
  c=vec3(hi/255.0,(v-hi*256.0)/255.0,0.0);
 }else if(uMode<2.5){
  float h=terrainH(o,uOct);
  if(h<uSea){c=vec3(0.5,0.5,1.0);}
  else{
   float eLon=6.2831853/uSize.x,eLat=3.1415927/uSize.y;
   float hE=terrainH(dirAt(lat,lon+eLon),uOct),hW=terrainH(dirAt(lat,lon-eLon),uOct);
   float hN=terrainH(dirAt(lat+eLat,lon),uOct),hS=terrainH(dirAt(lat-eLat,lon),uOct);
   float dx=(hE-hW)/(2.0*eLon*max(cos(lat),0.02));
   float dy=(hN-hS)/(2.0*eLat);
   vec3 nn=normalize(vec3(-dx*uStrength,-dy*uStrength*uFlip,1.0));
   c=nn*0.5+0.5;
  }
 }else if(uMode<3.5){Mat m=material(o,uOct);c=vec3(clamp(m.rough+0.06*(noise(o*60.0)-0.5),0.0,1.0));}
 else if(uMode<4.5){c=vec3(cloudAt(o));}
 else if(uMode<5.5){Mat m=material(o,uOct);c=m.city*0.9+m.glow*1.2;}
 else{Mat m=material(o,uOct);c=vec3(m.water);}
 gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
}`;

  function sh(t, src) {
    const s = gl.createShader(t);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }
  function link(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "a");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }
  const prog = link(VIEW_FS);
  if (!prog) {
    const n = $("nogl");
    n.textContent =
      "This planet's shader didn't compile on this graphics card. Try another browser or update the graphics driver.";
    n.hidden = false;
    return;
  }
  const bakeProg = link(BAKE_FS);
  const sunProg = link(
    "precision mediump float;uniform vec2 uC;uniform float uR;uniform vec3 uCol;void main(){float t=length(gl_FragCoord.xy-uC)/uR;float a=clamp((1.-t)*uR+.5,0.,1.);vec3 c=t<.55?mix(vec3(1.),uCol,t/.55):mix(uCol,uCol*.85,(t-.55)/.45);gl_FragColor=vec4(c*a,a);}",
  );
  const sunU = sunProg
    ? {
        c: gl.getUniformLocation(sunProg, "uC"),
        r: gl.getUniformLocation(sunProg, "uR"),
        col: gl.getUniformLocation(sunProg, "uCol"),
      }
    : null;
  gl.useProgram(prog);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const PAL_KEYS = [
    "deep",
    "shallow",
    "sand",
    "dry",
    "grass",
    "green",
    "rock",
    "snow",
    "atm",
    "cloud",
    "ringA",
    "ringB",
  ];
  const PAL_U = {
    deep: "cDeep",
    shallow: "cShallow",
    sand: "cSand",
    dry: "cDry",
    grass: "cGrass",
    green: "cGreen",
    rock: "cRock",
    snow: "cSnow",
    atm: "cAtm",
    cloud: "cCloud",
    ringA: "cRingA",
    ringB: "cRingB",
  };
  const SHARED_U = [
    "uTime",
    "uSea",
    "uScale",
    "uMount",
    "uTemp",
    "uWet",
    "uCloud",
    "uAtm",
    "uTilt",
    "uIce",
    "uEmit",
    "uCity",
    "uOct",
    "uGas",
    "uOff",
    "uCOff",
  ].concat(PAL_KEYS.map((k) => PAL_U[k]));
  function locs(p, names) {
    const o = {};
    names.forEach((n) => (o[n] = gl.getUniformLocation(p, n)));
    return o;
  }
  const UV = locs(
    prog,
    SHARED_U.concat([
      "uRes",
      "uOrig",
      "uShift",
      "uSys",
      "uRot",
      "uCloudRot",
      "uDist",
      "uRelief",
      "uRing",
      "uRingIn",
      "uRingOut",
      "uMoon",
      "uCam",
      "uSun",
      "uMoonPos",
      "uNeb",
      "uStarD",
      "uNebA",
      "uNebB",
      "uGal[0]",
      "uFar[0]",
      "uGalC[0]",
      "uFarC[0]",
    ]),
  );
  const UB = bakeProg
    ? locs(
        bakeProg,
        SHARED_U.concat(["uSize", "uRow0", "uMode", "uStrength", "uFlip"]),
      )
    : null;

  /* ================= worlds ================= */
  const CLASSES = [
    {
      id: "temperate",
      name: "Temperate world",
      w: 3,
      ice: 0.14,
      emit: 0,
      cityP: 0.7,
      ringP: 0.1,
      day: [18, 30],
      p: {
        sea: 0.52,
        scale: 1,
        mount: 0.7,
        temp: 0,
        wet: 0.5,
        cloud: 0.5,
        atm: 1,
      },
      c: {
        deep: [0.02, 0.07, 0.2],
        shallow: [0.05, 0.34, 0.46],
        sand: [0.76, 0.68, 0.5],
        dry: [0.55, 0.45, 0.28],
        grass: [0.36, 0.5, 0.17],
        green: [0.12, 0.3, 0.1],
        rock: [0.4, 0.35, 0.31],
        snow: [0.93, 0.95, 0.98],
        atm: [0.35, 0.6, 1],
        cloud: [1, 1, 1],
      },
    },
    {
      id: "ocean",
      name: "Ocean world",
      w: 2,
      ice: 0.1,
      emit: 0,
      cityP: 0.3,
      ringP: 0.1,
      day: [14, 26],
      p: {
        sea: 0.62,
        scale: 1.1,
        mount: 0.55,
        temp: 0,
        wet: 0.6,
        cloud: 0.62,
        atm: 1.1,
      },
      c: {
        deep: [0.01, 0.05, 0.18],
        shallow: [0.03, 0.4, 0.5],
        sand: [0.8, 0.74, 0.58],
        dry: [0.45, 0.5, 0.3],
        grass: [0.28, 0.5, 0.22],
        green: [0.1, 0.34, 0.14],
        rock: [0.35, 0.34, 0.32],
        snow: [0.93, 0.96, 1],
        atm: [0.3, 0.58, 1],
        cloud: [1, 1, 1],
      },
    },
    {
      id: "desert",
      name: "Desert world",
      w: 2,
      ice: 0.02,
      emit: 0,
      cityP: 0,
      ringP: 0.12,
      day: [20, 48],
      p: {
        sea: 0.36,
        scale: 1,
        mount: 0.8,
        temp: 0.1,
        wet: 0.18,
        cloud: 0.16,
        atm: 0.9,
      },
      c: {
        deep: [0.05, 0.12, 0.18],
        shallow: [0.15, 0.4, 0.42],
        sand: [0.85, 0.66, 0.4],
        dry: [0.78, 0.5, 0.3],
        grass: [0.62, 0.5, 0.28],
        green: [0.42, 0.38, 0.2],
        rock: [0.5, 0.32, 0.22],
        snow: [0.95, 0.9, 0.85],
        atm: [0.95, 0.7, 0.45],
        cloud: [1, 0.94, 0.88],
      },
    },
    {
      id: "frozen",
      name: "Frozen world",
      w: 1.5,
      ice: 0.5,
      emit: 0,
      cityP: 0,
      ringP: 0.2,
      day: [10, 40],
      p: {
        sea: 0.5,
        scale: 1,
        mount: 0.8,
        temp: -0.05,
        wet: 0.4,
        cloud: 0.42,
        atm: 1,
      },
      c: {
        deep: [0.03, 0.08, 0.16],
        shallow: [0.25, 0.5, 0.6],
        sand: [0.7, 0.75, 0.8],
        dry: [0.6, 0.65, 0.7],
        grass: [0.5, 0.6, 0.58],
        green: [0.35, 0.5, 0.5],
        rock: [0.35, 0.38, 0.42],
        snow: [0.92, 0.96, 1],
        atm: [0.6, 0.8, 1],
        cloud: [0.96, 0.98, 1],
      },
    },
    {
      id: "exotic",
      name: "Exotic biosphere",
      w: 1.5,
      ice: 0.1,
      emit: 0,
      cityP: 0,
      ringP: 0.4,
      day: [8, 22],
      p: {
        sea: 0.5,
        scale: 1.15,
        mount: 0.9,
        temp: 0,
        wet: 0.55,
        cloud: 0.45,
        atm: 1.2,
      },
      c: {
        deep: [0.08, 0.02, 0.15],
        shallow: [0.1, 0.35, 0.35],
        sand: [0.7, 0.6, 0.75],
        dry: [0.35, 0.5, 0.45],
        grass: [0.6, 0.35, 0.55],
        green: [0.45, 0.15, 0.4],
        rock: [0.25, 0.22, 0.3],
        snow: [0.85, 0.95, 0.9],
        atm: [0.75, 0.45, 1],
        cloud: [0.95, 0.92, 1],
      },
    },
    {
      id: "gas",
      name: "Gas giant",
      w: 0,
      gas: 1,
      ice: -2,
      emit: 0,
      cityP: 0,
      ringP: 0.35,
      day: [9, 18],
      p: {
        sea: 0.5,
        scale: 1,
        mount: 0.5,
        temp: 0,
        wet: 0.3,
        cloud: 0.12,
        atm: 1.3,
      },
      c: {
        deep: [0.1, 0.1, 0.1],
        shallow: [0.2, 0.2, 0.2],
        sand: [0.86, 0.75, 0.58],
        dry: [0.7, 0.46, 0.3],
        grass: [0.6, 0.5, 0.4],
        green: [0.5, 0.4, 0.3],
        rock: [0.5, 0.36, 0.28],
        snow: [0.95, 0.92, 0.86],
        atm: [0.8, 0.7, 0.55],
        cloud: [1, 0.96, 0.9],
      },
    },
    {
      id: "lava",
      name: "Lava world",
      w: 1,
      ice: -2,
      emit: 1.4,
      cityP: 0,
      ringP: 0.1,
      day: [30, 90],
      p: {
        sea: 0.5,
        scale: 1,
        mount: 1.1,
        temp: 0,
        wet: 0.3,
        cloud: 0.3,
        atm: 0.9,
      },
      c: {
        deep: [0.35, 0.05, 0.01],
        shallow: [1, 0.38, 0.06],
        sand: [0.12, 0.1, 0.09],
        dry: [0.2, 0.16, 0.13],
        grass: [0.22, 0.16, 0.13],
        green: [0.16, 0.13, 0.12],
        rock: [0.28, 0.24, 0.22],
        snow: [0.5, 0.48, 0.46],
        atm: [1, 0.5, 0.3],
        cloud: [0.35, 0.3, 0.28],
      },
    },
  ];
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const PRE = [
    "Ka",
    "Ve",
    "Or",
    "Tha",
    "Zu",
    "Mi",
    "Ash",
    "Co",
    "Ny",
    "Se",
    "I",
    "Be",
    "Quo",
    "Te",
    "Dra",
    "Lu",
    "Hal",
    "Ere",
  ];
  const MID = [
    "ra",
    "lo",
    "the",
    "ven",
    "dri",
    "sa",
    "mi",
    "ko",
    "re",
    "na",
    "",
    "",
  ];
  const END = [
    "th",
    "n",
    "ris",
    "x",
    "ra",
    "mor",
    "lia",
    "dor",
    "sus",
    "on",
    "e",
    "is",
    "ae",
  ];
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* adjustable parameters, mirrored by the sliders */
  const P = {
    sea: 0.52,
    scale: 1,
    mount: 0.7,
    relief: 1,
    temp: 0,
    wet: 0.5,
    cloud: 0.5,
    atm: 1,
    sunAz: 100,
    sunEl: 19,
    tilt: 12,
    spin: 1,
    rings: false,
    moon: false,
    cities: false,
    neb: 0.55,
    gal: 0.7,
    stars: 1,
    far: 1,
  };
  let W = {
    cls: CLASSES[0],
    pal: {},
    off: [0, 0, 0],
    coff: [0, 0, 0],
    cityAmt: 0,
    ringIn: 1.5,
    ringOut: 2.1,
    dayH: 24,
    name: "",
    seed: 4417,
    hdata: null,
  };
  const S = {
    sysYaw: 0,
    sysEl: null,
    svy: 0,
    svp: 0,
    shx: 0,
    shy: 0,
    orb: 1,
    labels: true,
    sysZoom: 1,
    yaw: 0.55,
    pitch: 0.18,
    dist: 10.4,
    distTarget: null,
    vy: 0,
    vp: 0,
    rot: 0,
    crot: 0,
    time: 0,
    moonA: 1.2,
    paused: false,
    film: false,
    snap: false,
  };
  let forcedType = "auto";
  let SYS = null,
    mode = "planet",
    sysCtx = null,
    hoverI = -1,
    sysOpts = { n: 0, star: "auto", preset: "random" },
    bgRoll = 0,
    BG = null;

  const GROUPS = [
    [
      "World",
      true,
      [
        ["sea", "Sea level", 0.3, 0.7, 0.005, 2],
        ["scale", "Continents", 0.6, 2.2, 0.01, 2],
        ["mount", "Mountains", 0, 1.6, 0.01, 2],
        ["relief", "Relief shading", 0, 2, 0.01, 2],
      ],
    ],
    [
      "Climate",
      false,
      [
        ["temp", "Warmth", -0.4, 0.4, 0.01, 2],
        ["wet", "Moisture", 0, 1, 0.01, 2],
      ],
    ],
    [
      "Sky",
      false,
      [
        ["cloud", "Clouds", 0, 1, 0.01, 2],
        ["atm", "Atmosphere", 0, 2, 0.01, 2],
      ],
    ],
    [
      "Light and motion",
      false,
      [
        ["sunAz", "Sun direction", 0, 360, 1, 0],
        ["sunEl", "Sun height", -30, 70, 1, 0],
        ["tilt", "Axial tilt", 0, 45, 1, 0],
        ["spin", "Spin", 0, 4, 0.05, 2],
      ],
    ],
    [
      "Space background",
      false,
      [
        ["neb", "Nebulae", 0, 1.5, 0.01, 2],
        ["gal", "Galaxies", 0, 1, 0.01, 2],
        ["stars", "Stars", 0, 2, 0.01, 2],
        ["far", "Far planets", 0, 3, 1, 0],
      ],
      "sgroup",
    ],
    ["System", true, [["orb", "Orbit speed", 0, 4, 0.05, 2]], "ssys"],
  ];
  const MAP_KEYS = { sea: 1, scale: 1, mount: 1, temp: 1, wet: 1, cloud: 1 };
  const uiRefs = {};
  function buildPanel() {
    GROUPS.forEach(([title, open, items, target]) => {
      const root = $(target || "groups");
      const d = document.createElement("details");
      if (open) d.open = true;
      const s = document.createElement("summary");
      s.textContent = title;
      d.appendChild(s);
      items.forEach(([k, label, min, max, step, dec]) => {
        const row = document.createElement("div");
        row.className = "sl";
        const l = document.createElement("label");
        l.htmlFor = "s-" + k;
        l.textContent = label;
        const inp = document.createElement("input");
        inp.type = "range";
        inp.id = "s-" + k;
        inp.min = min;
        inp.max = max;
        inp.step = step;
        inp.value = k === "orb" ? S.orb : P[k];
        const out = document.createElement("output");
        out.htmlFor = "s-" + k;
        inp.addEventListener("input", () => {
          if (k === "orb") S.orb = +inp.value;
          else P[k] = +inp.value;
          out.textContent = (+inp.value).toFixed(dec);
          onParam(k);
        });
        row.append(l, inp, out);
        d.appendChild(row);
        uiRefs[k] = { inp, out, dec };
      });
      root.appendChild(d);
    });
  }
  function syncUI() {
    for (const k in uiRefs) {
      const u = uiRefs[k];
      u.inp.value = k === "orb" ? S.orb : P[k];
      u.out.textContent = (+(k === "orb" ? S.orb : P[k])).toFixed(u.dec);
    }
    $("t-rings").checked = P.rings;
    $("t-moon").checked = P.moon;
    $("t-cities").checked = P.cities;
  }

  const NEBS = [
    [
      [0.55, 0.16, 0.78],
      [0.12, 0.4, 0.85],
    ],
    [
      [0.85, 0.26, 0.2],
      [0.95, 0.62, 0.2],
    ],
    [
      [0.1, 0.62, 0.56],
      [0.32, 0.2, 0.75],
    ],
    [
      [0.85, 0.3, 0.62],
      [0.2, 0.32, 0.92],
    ],
    [
      [0.2, 0.45, 0.9],
      [0.75, 0.9, 1],
    ],
  ];
  const GALT = [
    [1, 0.86, 0.66],
    [0.72, 0.82, 1],
    [0.95, 0.7, 0.9],
  ];
  const FARC = [
    [0.8, 0.55, 0.3],
    [0.4, 0.6, 0.9],
    [0.75, 0.35, 0.28],
    [0.55, 0.75, 0.5],
    [0.85, 0.8, 0.65],
    [0.6, 0.45, 0.8],
  ];
  function genBG() {
    const base =
      (mode === "system" && SYS ? SYS.seed * 3 + 11 : W.seed * 7 + 3) +
      bgRoll * 977;
    const r = mulberry32(base >>> 0);
    const dir = () => {
      const z = r() * 2 - 1,
        a = r() * 6.2832,
        q = Math.sqrt(1 - z * z);
      return [q * Math.cos(a), z, q * Math.sin(a)];
    };
    const nb = NEBS[Math.floor(r() * NEBS.length)];
    const gal = [],
      far = [];
    const ng = Math.ceil(P.gal * 3 - 1e-6),
      nf = Math.round(P.far);
    for (let i = 0; i < 3; i++) {
      const d = dir(),
        sz = 0.05 + r() * 0.09,
        t = GALT[Math.floor(r() * GALT.length)];
      gal.push({ d, sz: i < ng ? sz : 0, t, x: r(), y: r(), rot: r() * 3.14 });
      const d2 = dir(),
        rad = 0.035 + r() * 0.07,
        c = FARC[Math.floor(r() * FARC.length)];
      far.push({
        d: d2,
        rad: i < nf ? rad : 0,
        c,
        x: r(),
        y: r(),
        ring: r() < 0.3,
      });
    }
    const blobs = [];
    for (let i = 0; i < 7; i++)
      blobs.push({ x: r(), y: r(), rad: 0.2 + r() * 0.3, k: r() });
    BG = { nebA: nb[0], nebB: nb[1], gal, far, blobs };
  }
  function pushBG() {
    if (!BG) genBG();
    gl.uniform1f(UV.uNeb, P.neb);
    gl.uniform1f(UV.uStarD, P.stars);
    gl.uniform3fv(UV.uNebA, BG.nebA);
    gl.uniform3fv(UV.uNebB, BG.nebB);
    const gd = [],
      fd = [],
      gc = [],
      fc = [];
    for (let i = 0; i < 3; i++) {
      gd.push(...BG.gal[i].d, BG.gal[i].sz);
      fd.push(...BG.far[i].d, BG.far[i].rad);
      gc.push(...BG.gal[i].t.map((v) => v * 0.55));
      fc.push(...BG.far[i].c);
    }
    gl.uniform4fv(UV["uGal[0]"], gd);
    gl.uniform4fv(UV["uFar[0]"], fd);
    gl.uniform3fv(UV["uGalC[0]"], gc);
    gl.uniform3fv(UV["uFarC[0]"], fc);
  }
  function jitterColor(r, c, amt) {
    const s = 1 + (r() - 0.5) * amt * 2;
    return c.map((v) => clamp(v * s + (r() - 0.5) * amt * 0.3, 0, 1));
  }

  function makeWorld(seed, forceId) {
    seed = clamp(Math.floor(seed) || 1, 1, 99999);
    const r = mulberry32((seed * 2654435761) >>> 0);
    const tot = CLASSES.reduce((s, c) => s + c.w, 0);
    let q = r() * tot;
    let cls = CLASSES[0];
    for (const c of CLASSES) {
      if ((q -= c.w) <= 0) {
        cls = c;
        break;
      }
    }
    if (forceId && forceId !== "auto")
      cls = CLASSES.find((c) => c.id === forceId) || cls;
    const p = { relief: 1, sunAz: 100, sunEl: 19, spin: 1, moon: false },
      w = { cls, seed };
    w.off = [r() * 40, r() * 40, r() * 40];
    w.coff = [r() * 40, r() * 40, r() * 40];
    p.sea = +clamp(cls.p.sea + (r() - 0.5) * 0.06, 0.3, 0.7).toFixed(3);
    p.scale = +(cls.p.scale * (0.85 + r() * 0.3)).toFixed(2);
    p.mount = +(cls.p.mount * (0.8 + r() * 0.4)).toFixed(2);
    p.temp = cls.p.temp;
    p.wet = +clamp(cls.p.wet + (r() - 0.5) * 0.12, 0, 1).toFixed(2);
    p.cloud = +clamp(cls.p.cloud + (r() - 0.5) * 0.2, 0, 1).toFixed(2);
    p.atm = cls.p.atm;
    p.tilt = Math.round(4 + r() * 26);
    p.rings = r() < cls.ringP;
    w.cityAmt = cls.cityP > 0 && r() < cls.cityP ? 1 : 0;
    p.cities = w.cityAmt > 0;
    w.dayH = Math.round(cls.day[0] + r() * (cls.day[1] - cls.day[0]));
    w.pal = {};
    PAL_KEYS.slice(0, 10).forEach((k) => {
      const keep = k === "snow" || k === "cloud" || k === "atm";
      w.pal[k] = jitterColor(r, cls.c[k], keep ? 0.02 : 0.1);
    });
    w.ringIn = 1.32 + r() * 0.3;
    w.ringOut = w.ringIn + 0.45 + r() * 0.55;
    w.pal.ringA = w.pal.sand.map((v) => clamp(v * 1.1 + 0.06, 0, 1));
    w.pal.ringB = w.pal.dry.map((v) => clamp(v * 0.75, 0, 1));
    let nm = pick(r, PRE) + pick(r, MID) + pick(r, END);
    nm = nm.charAt(0).toUpperCase() + nm.slice(1);
    w.name = nm;
    w.rot0 = r() * 6.28;
    return { p, w };
  }
  function showWorld(g) {
    const h = W.hdata;
    Object.assign(P, g.p);
    Object.assign(W, g.w);
    W.hdata = h;
    $("seed").value = W.seed;
    S.rot = W.rot0;
    S.crot = S.rot;
    if (P.rings) S.pitch = 0.5;
    if (mode === "planet") {
      bgRoll = 0;
      genBG();
    }
    syncUI();
    updateCls();
    updateHud();
    updateChrome();
    schedulePreviews();
  }
  const SKEYS = {
    sea: "sea",
    scale: "sc",
    mount: "mt",
    relief: "rl",
    temp: "tp",
    wet: "wt",
    cloud: "cl",
    atm: "am",
    sunAz: "sa",
    sunEl: "se",
    tilt: "tl",
    spin: "sp",
  };
  const BKEYS = { neb: "nb", gal: "gl", stars: "st", far: "fp" };
  function stateHash() {
    const q = new URLSearchParams();
    const f = (v) => +(+v).toFixed(3);
    if (mode === "system" && SYS) {
      q.set("sys", SYS.seed);
      if (sysOpts.preset === "sol") q.set("pre", "sol");
      if (sysOpts.n) q.set("n", sysOpts.n);
      if (sysOpts.star !== "auto") q.set("star", sysOpts.star);
      q.set("z", f(S.sysZoom));
      if (S.orb !== 1) q.set("or", f(S.orb));
      if (S.sysYaw) q.set("ay", f(S.sysYaw));
      if (S.sysEl != null) q.set("ae", f(S.sysEl));
    } else {
      q.set("seed", W.seed);
      if (sysCtx && SYS) {
        q.set("sys", sysCtx.seed);
        q.set("v", sysCtx.i);
        if (sysOpts.preset === "sol") q.set("pre", "sol");
        if (sysOpts.n) q.set("n", sysOpts.n);
        if (sysOpts.star !== "auto") q.set("star", sysOpts.star);
      } else if (forcedType !== "auto") q.set("type", forcedType);
      for (const k in SKEYS) q.set(SKEYS[k], f(P[k]));
      q.set("rg", P.rings ? 1 : 0);
      q.set("mn", P.moon ? 1 : 0);
      q.set("ct", P.cities ? 1 : 0);
      q.set("d", f(S.dist));
      q.set("yw", f(S.yaw));
      q.set("pt", f(S.pitch));
    }
    for (const k in BKEYS) q.set(BKEYS[k], f(P[k]));
    if (bgRoll) q.set("br", bgRoll);
    return q.toString();
  }
  function setHash() {
    try {
      history.replaceState(null, "", "#" + stateHash());
    } catch (e) {}
  }
  let hashTimer = 0;
  function hashSoon() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(setHash, 450);
  }
  function loadFromHash() {
    const h = (location.hash || "").slice(1);
    const hm = h.match(/^sys(\d+)(?:-(\d+))?$/);
    if (hm) {
      openSystem(+hm[1]);
      if (hm[2] != null) visit(+hm[2]);
      return;
    }
    if (h.indexOf("=") < 0) {
      const n = parseInt(h, 10);
      applySeed(n > 0 ? n : 4417);
      return;
    }
    const q = new URLSearchParams(h);
    const num = (k, d) => (q.has(k) && isFinite(+q.get(k)) ? +q.get(k) : d);
    sysOpts.n = clamp(Math.round(num("n", 0)), 0, 8);
    sysOpts.star = q.get("star") || "auto";
    sysOpts.preset = q.get("pre") === "sol" ? "sol" : "random";
    if ($("sys-pre")) {
      $("sys-pre").value = sysOpts.preset;
      $("sys-n").disabled = $("sys-star").disabled = sysOpts.preset === "sol";
    }
    if ($("sys-n")) $("sys-n").value = String(sysOpts.n);
    if ($("sys-star")) $("sys-star").value = sysOpts.star;
    for (const k in BKEYS) P[k] = num(BKEYS[k], P[k]);
    const br = Math.round(num("br", 0));
    if (q.has("sys") && !q.has("seed")) {
      bgRoll = br;
      openSystem(num("sys", 4417), true);
      S.sysZoom = clamp(num("z", 1), 0.4, 10);
      S.orb = clamp(num("or", 1), 0, 4);
      S.sysYaw = num("ay", 0);
      S.sysEl = q.has("ae") ? clamp(num("ae", 0.39), -1.5, 1.5) : null;
      syncUI();
      setHash();
      return;
    }
    if (q.has("sys")) {
      openSystem(num("sys", 4417));
      visit(num("v", 0));
    } else {
      forcedType = q.get("type") || "auto";
      if ($("type")) $("type").value = forcedType;
      applySeed(num("seed", 4417));
    }
    for (const k in SKEYS) P[k] = num(SKEYS[k], P[k]);
    P.rings = num("rg", P.rings ? 1 : 0) > 0;
    P.moon = num("mn", P.moon ? 1 : 0) > 0;
    P.cities = num("ct", P.cities ? 1 : 0) > 0;
    if (P.cities && !W.cityAmt) W.cityAmt = 1;
    for (const k in BKEYS) P[k] = num(BKEYS[k], P[k]);
    bgRoll = br;
    genBG();
    S.dist = q.has("d")
      ? clamp(num("d", S.dist), 1.25, 60)
      : baseDist(P.rings || P.moon);
    S.yaw = num("yw", S.yaw);
    S.pitch = clamp(num("pt", S.pitch), -1.3, 1.3);
    S.distTarget = null;
    syncUI();
    updateCls();
    updateHud();
    schedulePreviews();
    setHash();
  }
  function applySeed(seed) {
    sysCtx = null;
    const g = makeWorld(seed, forcedType);
    mode = "planet";
    showWorld(g);
    setHash(W.seed);
  }

  /* ---------- solar systems ---------- */
  const STARS = [
    {
      id: "yellow",
      name: "Yellow dwarf",
      c: [1, 0.86, 0.58],
      w: 3,
      hz: 0.45,
      size: 1,
    },
    {
      id: "orange",
      name: "Orange dwarf",
      c: [1, 0.66, 0.36],
      w: 2,
      hz: 0.32,
      size: 0.9,
    },
    {
      id: "red",
      name: "Red dwarf",
      c: [1, 0.42, 0.26],
      w: 2,
      hz: 0.2,
      size: 0.75,
    },
    {
      id: "white",
      name: "White star",
      c: [0.86, 0.92, 1],
      w: 1.3,
      hz: 0.62,
      size: 1.2,
    },
    {
      id: "blue",
      name: "Blue giant",
      c: [0.62, 0.76, 1],
      w: 0.7,
      hz: 0.85,
      size: 1.6,
    },
  ];
  const ZONES = [
    [0.5, { lava: 0.6, desert: 0.4 }],
    [0.8, { desert: 0.5, lava: 0.2, temperate: 0.2, exotic: 0.1 }],
    [
      1.25,
      { temperate: 0.35, ocean: 0.3, desert: 0.15, exotic: 0.1, frozen: 0.1 },
    ],
    [
      1.8,
      { frozen: 0.35, ocean: 0.15, exotic: 0.3, desert: 0.1, temperate: 0.1 },
    ],
    [99, { frozen: 0.6, exotic: 0.4 }],
  ];
  function wpick(r, o) {
    const ks = Object.keys(o);
    let t = 0;
    ks.forEach((k) => (t += o[k]));
    let q = r() * t;
    for (const k of ks) {
      if ((q -= o[k]) <= 0) return k;
    }
    return ks[0];
  }
  const SOL = [
    [
      "Mercury",
      "desert",
      11,
      0.55,
      0.24,
      0.39,
      {
        sand: [0.55, 0.53, 0.5],
        dry: [0.42, 0.4, 0.38],
        grass: [0.45, 0.43, 0.4],
        green: [0.4, 0.38, 0.36],
        rock: [0.3, 0.29, 0.28],
        snow: [0.7, 0.7, 0.7],
      },
      { sea: 0, cloud: 0, atm: 0.12, tilt: 0 },
    ],
    [
      "Venus",
      "desert",
      22,
      0.9,
      0.33,
      0.72,
      {
        sand: [0.9, 0.8, 0.55],
        dry: [0.85, 0.7, 0.45],
        grass: [0.8, 0.66, 0.42],
        green: [0.7, 0.58, 0.38],
        rock: [0.6, 0.5, 0.35],
        snow: [0.95, 0.9, 0.8],
        atm: [0.95, 0.8, 0.5],
        cloud: [0.98, 0.92, 0.75],
      },
      { sea: 0, cloud: 0.95, atm: 1.4, tilt: 3 },
    ],
    [
      "Earth",
      "temperate",
      3,
      1,
      0.43,
      1,
      {},
      { sea: 0.55, cloud: 0.45, atm: 1, tilt: 23, moon: true },
    ],
    [
      "Mars",
      "desert",
      44,
      0.65,
      0.53,
      1.52,
      {
        sand: [0.8, 0.45, 0.28],
        dry: [0.72, 0.38, 0.22],
        grass: [0.65, 0.36, 0.22],
        green: [0.55, 0.32, 0.2],
        rock: [0.42, 0.27, 0.2],
        snow: [0.95, 0.93, 0.92],
        atm: [0.85, 0.6, 0.45],
        cloud: [0.95, 0.88, 0.8],
      },
      { sea: 0, cloud: 0.06, atm: 0.35, tilt: 25 },
    ],
    [
      "Jupiter",
      "gas",
      55,
      2.6,
      0.64,
      5.2,
      {
        sand: [0.88, 0.8, 0.66],
        dry: [0.72, 0.45, 0.3],
        rock: [0.55, 0.36, 0.26],
        snow: [0.95, 0.92, 0.86],
      },
      { scale: 1, cloud: 0.1, atm: 1.2, tilt: 3 },
    ],
    [
      "Saturn",
      "gas",
      66,
      2.2,
      0.76,
      9.58,
      {
        sand: [0.9, 0.82, 0.62],
        dry: [0.8, 0.7, 0.5],
        rock: [0.62, 0.52, 0.4],
        snow: [0.95, 0.92, 0.82],
      },
      { scale: 0.8, cloud: 0.1, atm: 1.2, tilt: 27, rings: true },
    ],
    [
      "Uranus",
      "gas",
      77,
      1.55,
      0.88,
      19.2,
      {
        sand: [0.7, 0.88, 0.9],
        dry: [0.6, 0.82, 0.88],
        rock: [0.55, 0.75, 0.85],
        snow: [0.85, 0.95, 0.97],
        atm: [0.5, 0.8, 0.95],
      },
      { scale: 0.35, mount: 0, cloud: 0.05, atm: 1.3, tilt: 30 },
    ],
    [
      "Neptune",
      "gas",
      88,
      1.5,
      1,
      30,
      {
        sand: [0.32, 0.5, 0.92],
        dry: [0.2, 0.34, 0.8],
        rock: [0.16, 0.26, 0.7],
        snow: [0.6, 0.75, 1],
        atm: [0.3, 0.5, 1],
      },
      { scale: 0.5, mount: 0.8, cloud: 0.1, atm: 1.3, tilt: 28 },
    ],
  ];
  function makeSol() {
    const star = Object.assign(
      {},
      STARS.find((c) => c.id === "yellow"),
      { name: "The Sun" },
    );
    const planets = SOL.map(([name, cls, sd, size, a, au, pal, pp], i) => {
      const g = makeWorld(sd, cls);
      Object.assign(g.w.pal, pal);
      if (pal.sand && cls === "gas") {
        g.w.pal.ringA = g.w.pal.sand.map((v) => Math.min(1, v * 1.05));
        g.w.pal.ringB = g.w.pal.dry.map((v) => v * 0.8);
      }
      const { moon, rings, tilt, ...rest } = pp;
      Object.assign(g.p, rest);
      g.p.rings = !!rings;
      g.p.moon = !!moon;
      g.p.tilt = tilt == null ? g.p.tilt : tilt;
      g.p.cities = name === "Earth";
      g.w.cityAmt = name === "Earth" ? 1 : 0;
      g.w.name = name;
      return {
        g,
        clsId: cls,
        seed: sd,
        a,
        ang: i * 0.9 + 0.3,
        om: 0.05 * Math.pow(0.3 / au, 1.5),
        size,
        name,
        sx: 0,
        sy: 0,
        sr: 0,
      };
    });
    const rn = mulberry32(4242);
    const stars = [];
    for (let i = 0; i < 600; i++)
      stars.push([rn(), rn(), 0.3 + rn() * 1.1, 0.25 + rn() * 0.75]);
    return { seed: 1, star, planets, name: "Solar System", stars, sol: true };
  }
  function makeSystem(seed, opts) {
    opts = opts || {};
    seed = clamp(Math.floor(seed) || 1, 1, 99999);
    const r = mulberry32((seed * 40503 + 7919) >>> 0);
    let q = r() * STARS.reduce((s, c) => s + c.w, 0),
      star = STARS[0];
    for (const c of STARS) {
      if ((q -= c.w) <= 0) {
        star = c;
        break;
      }
    }
    if (opts.star && opts.star !== "auto")
      star = STARS.find((c) => c.id === opts.star) || star;
    if (opts.preset === "sol") return makeSol();
    const n0 = 4 + Math.floor(r() * 4),
      n = opts.n || n0;
    const raw = [];
    let a = 0.16;
    for (let i = 0; i < n; i++) {
      raw.push(a);
      a *= 1.3 + r() * 0.22;
    }
    const mx = raw[n - 1];
    const planets = raw.map((au, i) => {
      const t = au / star.hz;
      let zone = ZONES[ZONES.length - 1][1];
      for (const [lim, z] of ZONES) {
        if (t < lim) {
          zone = z;
          break;
        }
      }
      const clsId = wpick(r, zone),
        ps = 1 + Math.floor(r() * 99999);
      const g = makeWorld(ps, clsId);
      return {
        g,
        clsId,
        seed: ps,
        a: 0.24 + 0.76 * ((au - raw[0]) / (mx - raw[0])),
        ang: i * 2.4 + r() * 0.8,
        om: 0.05 * Math.pow(0.3 / au, 1.5),
        size: 0.7 + r() * 0.8 + i * 0.03,
        name: g.w.name,
        sx: 0,
        sy: 0,
        sr: 0,
      };
    });
    const rn = mulberry32(seed * 977 + 13);
    let nm = pick(rn, PRE) + pick(rn, MID) + pick(rn, END);
    nm = nm.charAt(0).toUpperCase() + nm.slice(1);
    const stars = [];
    for (let i = 0; i < 600; i++)
      stars.push([rn(), rn(), 0.3 + rn() * 1.1, 0.25 + rn() * 0.75]);
    return { seed, star, planets, name: nm, stars };
  }
  function openSystem(seed, keepBG) {
    SYS = makeSystem(seed, sysOpts);
    mode = "system";
    S.sysZoom = 1;
    S.sysYaw = 0;
    S.sysEl = null;
    S.svy = 0;
    S.svp = 0;
    sysCtx = null;
    if (!keepBG) bgRoll = 0;
    genBG();
    $("seed").value = SYS.seed;
    setHash("sys" + SYS.seed);
    updateChrome();
  }
  function visit(i) {
    if (!SYS) return;
    i = clamp(i | 0, 0, SYS.planets.length - 1);
    const pl = SYS.planets[i];
    sysCtx = { seed: SYS.seed, i };
    forcedType = pl.clsId;
    $("type").value = pl.clsId;
    mode = "planet";
    showWorld(pl.g);
    S.dist = baseDist(P.rings);
    S.distTarget = null;
    setHash("sys" + SYS.seed + "-" + i);
  }
  function backToSystem() {
    if (!SYS) return;
    mode = "system";
    sysCtx = null;
    $("seed").value = SYS.seed;
    setHash("sys" + SYS.seed);
    updateChrome();
  }
  function updateChrome() {
    const sys = mode === "system";
    stage.classList.toggle("sys", sys);
    $("new").textContent = sys ? "New system" : "New world";
    $("copylink").textContent = sys
      ? "Copy link to this system"
      : "Copy link to this world";
    $("sysbtn").textContent = sysCtx ? "\u2190 System" : "Solar system";
    if (sys && SYS) {
      $("eyel").textContent = "Star system";
      $("cat").textContent = "SY-" + String(SYS.seed).padStart(5, "0");
      $("name").textContent = SYS.name;
      $("cls").textContent =
        SYS.star.name + " \u00b7 " + SYS.planets.length + " planets";
      $("hint").innerHTML =
        "drag to look around \u00b7 click a planet to visit \u00b7 scroll to zoom<br><kbd>G</kbd> new system \u00b7 <kbd>F</kbd> film \u00b7 <kbd>R</kbd> record";
    } else {
      $("eyel").textContent =
        sysCtx && SYS
          ? "Planet " +
            (sysCtx.i + 1) +
            " of " +
            SYS.planets.length +
            " \u00b7 " +
            SYS.name
          : "Catalog entry";
      $("cat").textContent = "SW-" + String(W.seed).padStart(5, "0");
      $("name").textContent = W.name;
      $("hint").innerHTML =
        "drag to turn \u00b7 scroll to zoom<br><kbd>G</kbd> new world \u00b7 <kbd>Space</kbd> pause \u00b7 <kbd>F</kbd> film \u00b7 <kbd>R</kbd> record";
    }
  }
  function updateCls() {
    $("cls").textContent =
      W.cls.name +
      (P.cities && W.cityAmt ? " · inhabited" : "") +
      (P.rings ? " · ringed" : "");
  }
  function oceanFraction() {
    const d = W.hdata;
    if (!d) return null;
    let wsum = 0,
      ws = 0;
    const w = 512,
      h = 256,
      sea = P.sea;
    for (let y = 0; y < h; y++) {
      const wt = Math.cos(((y + 0.5) / h - 0.5) * Math.PI);
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const v = (d[i] * 256 + d[i + 1]) / 65535;
        const hh = 0.15 + v * 1.2;
        wsum += wt;
        if (hh < sea) ws += wt;
      }
    }
    return ws / wsum;
  }
  function updateHud() {
    const o = oceanFraction();
    $("st-ocean").textContent =
      o == null || W.cls.gas ? "—" : Math.round(o * 100) + "%";
    $("st-cloud").textContent = Math.round(P.cloud * 100) + "%";
    $("st-day").textContent = W.dayH + " h";
    $("st-tilt").textContent = Math.round(P.tilt) + "°";
  }
  function onParam(k) {
    hashSoon();
    if (k === "gal" || k === "far") genBG();
    updateHud();
    if (MAP_KEYS[k]) schedulePreviews();
  }

  /* ================= uniforms ================= */
  const D2R = Math.PI / 180;
  function octForView(dist, sc, hpx) {
    dist = dist || S.dist;
    sc = sc || P.scale;
    hpx = hpx || canvas.height;
    const radPerPx = (1 / (1.7 * hpx)) * Math.max(dist - 1, 0.08);
    return clamp(
      Math.floor(Math.log(6.2832 / (5.1 * sc * radPerPx)) / Math.log(2.03)),
      6,
      12,
    );
  }
  function octForBake(w) {
    return clamp(
      Math.floor(
        Math.log(0.5 / ((1.7 * P.scale * 6.2832) / w)) / Math.log(2.03),
      ) + 2,
      5,
      12,
    );
  }
  function pushShared(U, oct, time, p, w) {
    p = p || P;
    w = w || W;
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uSea, p.sea);
    gl.uniform1f(U.uScale, p.scale);
    gl.uniform1f(U.uMount, p.mount);
    gl.uniform1f(U.uTemp, p.temp);
    gl.uniform1f(U.uWet, p.wet);
    gl.uniform1f(U.uCloud, p.cloud);
    gl.uniform1f(U.uAtm, p.atm);
    gl.uniform1f(U.uTilt, p.tilt * D2R);
    gl.uniform1f(U.uIce, w.cls.ice);
    gl.uniform1f(U.uEmit, w.cls.emit);
    gl.uniform1f(U.uGas, w.cls.gas ? 1 : 0);
    gl.uniform1f(U.uCity, p.cities ? w.cityAmt : 0);
    gl.uniform1f(U.uOct, oct);
    gl.uniform3fv(U.uOff, w.off);
    gl.uniform3fv(U.uCOff, w.coff);
    for (const k of PAL_KEYS) gl.uniform3fv(U[PAL_U[k]], w.pal[k]);
  }

  /* ================= controls ================= */
  buildPanel();
  (function () {
    const sd = $("ssys").querySelector("details");
    const mkrow = (label, id, opts) => {
      const r = document.createElement("div");
      r.className = "row";
      const l = document.createElement("label");
      l.htmlFor = id;
      l.textContent = label;
      const sel = document.createElement("select");
      sel.id = id;
      opts.forEach(([v, t]) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        sel.appendChild(o);
      });
      r.append(l, sel);
      sd.insertBefore(r, sd.children[1]);
      return sel;
    };
    const ss = mkrow(
      "Star",
      "sys-star",
      [["auto", "From the seed"]].concat(STARS.map((x) => [x.id, x.name])),
    );
    const sp = mkrow("System", "sys-pre", [
      ["random", "Random"],
      ["sol", "Our Solar System"],
    ]);
    const sn = mkrow("Planets", "sys-n", [
      ["0", "From the seed"],
      ["3", "3"],
      ["4", "4"],
      ["5", "5"],
      ["6", "6"],
      ["7", "7"],
      ["8", "8"],
    ]);
    const regen = () => {
      if (SYS) openSystem(SYS.seed, true);
    };
    const lockSol = () => {
      const s = sysOpts.preset === "sol";
      ss.disabled = sn.disabled = s;
    };
    sp.addEventListener("change", () => {
      sysOpts.preset = sp.value;
      lockSol();
      regen();
      hashSoon();
    });
    ss.addEventListener("change", () => {
      sysOpts.star = ss.value;
      regen();
      hashSoon();
    });
    sn.addEventListener("change", () => {
      sysOpts.n = +sn.value;
      regen();
      hashSoon();
    });
    const tg = document.createElement("div");
    tg.className = "tg";
    tg.innerHTML =
      '<label><input type="checkbox" id="sys-lab" checked>Planet names</label>';
    sd.appendChild(tg);
    tg.querySelector("input").addEventListener("change", (e) => {
      S.labels = e.target.checked;
    });
    const bd = $("sgroup").querySelector("details");
    const rb = document.createElement("div");
    rb.className = "tg";
    rb.innerHTML = '<button type="button" id="bg-roll">Reroll sky</button>';
    bd.appendChild(rb);
    $("bg-roll").addEventListener("click", () => {
      bgRoll++;
      genBG();
      hashSoon();
    });
  })();
  $("t-rings").addEventListener("change", (e) => {
    hashSoon();
    P.rings = e.target.checked;
    if (P.rings && S.dist < baseDist(true) * 0.93)
      S.distTarget = baseDist(true);
    updateCls();
  });
  $("t-moon").addEventListener("change", (e) => {
    hashSoon();
    P.moon = e.target.checked;
    if (P.moon && S.dist < baseDist(true) * 1.1)
      S.distTarget = baseDist(true) * 1.15;
  });
  $("t-cities").addEventListener("change", (e) => {
    hashSoon();
    P.cities = e.target.checked;
    if (P.cities && !W.cityAmt) W.cityAmt = 1;
    updateCls();
    schedulePreviews();
  });
  $("type").addEventListener("change", (e) => {
    forcedType = e.target.value;
    applySeed(W.seed);
  });
  const rnd = () => 1 + Math.floor(Math.random() * 99999);
  function newThing() {
    if (mode === "system") {
      openSystem(rnd());
      return;
    }
    if (sysCtx) {
      forcedType = "auto";
      $("type").value = "auto";
    }
    applySeed(rnd());
  }
  $("new").addEventListener("click", newThing);
  $("seed").addEventListener("change", () => {
    if (mode === "system") openSystem(+$("seed").value);
    else {
      if (sysCtx) {
        forcedType = "auto";
        $("type").value = "auto";
      }
      applySeed(+$("seed").value);
    }
  });
  $("sysbtn").addEventListener("click", () => {
    if (sysCtx) backToSystem();
    else openSystem(W.seed);
  });
  const pauseBtn = $("pause");
  function setPaused(v) {
    S.paused = v;
    pauseBtn.textContent = v ? "Resume" : "Pause";
  }
  pauseBtn.addEventListener("click", () => setPaused(!S.paused));
  function setFilm(v) {
    S.film = v;
    stage.classList.toggle("film", v);
    if (v) {
      try {
        const p = stage.requestFullscreen && stage.requestFullscreen();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    } else if (document.fullscreenElement) {
      try {
        document.exitFullscreen().catch(() => {});
      } catch (e) {}
    }
  }
  $("film").addEventListener("click", () => setFilm(true));
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && S.film) setFilm(false);
  });
  $("shot").addEventListener("click", () => {
    const v = $("shot-size").value;
    if (v === "screen" || mode === "system" || !bakeProg) {
      S.snap = true;
      return;
    }
    const [w, h] = v.split("x").map(Number);
    hiShot(w, h);
  });
  $("rec").addEventListener("click", () => toggleRec());
  $("copylink").addEventListener("click", async () => {
    setHash();
    const url = location.href;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.cssText = "position:fixed;opacity:0;top:0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        ta.remove();
      } catch (e2) {}
    }
    const b = $("copylink");
    if (!ok) {
      window.prompt("Copy this link", url);
      return;
    }
    b.textContent = "Link copied \u2713";
    clearTimeout(b._t);
    b._t = setTimeout(() => updateChrome(), 1800);
  });
  const xm = $("export");
  function xopen(v) {
    xm.hidden = !v;
    if (v) $("x-all").focus();
    else $("totex").focus();
  }
  $("totex").addEventListener("click", () => xopen(true));
  $("x-close").addEventListener("click", () => xopen(false));
  xm.addEventListener("pointerdown", (e) => {
    if (e.target === xm) xopen(false);
  });
  function setPanel(o) {
    stage.classList.toggle("popen", o);
    $("panel").classList.toggle("open", o);
    $("ptoggle").setAttribute("aria-expanded", String(o));
    $("ptoggle").textContent = o ? "Hide" : "Controls";
  }
  $("ptoggle").addEventListener("click", () =>
    setPanel(!$("panel").classList.contains("open")),
  );
  const am = $("about");
  function aopen(v) {
    am.hidden = !v;
    if (v) $("a-close").focus();
    else $("abtn").focus();
  }
  $("abtn").addEventListener("click", () => aopen(true));
  $("a-close").addEventListener("click", () => aopen(false));
  am.addEventListener("pointerdown", (e) => {
    if (e.target === am) aopen(false);
  });
  if (window.matchMedia && window.matchMedia("(max-width:700px)").matches)
    setPanel(false);
  window.addEventListener("keydown", (e) => {
    const t = e.target;
    if (
      t &&
      ((t.tagName === "INPUT" && t.type === "number") || t.tagName === "SELECT")
    )
      return;
    const k = e.key.toLowerCase();
    if (k === "escape") {
      if (!xm.hidden) {
        xopen(false);
        return;
      }
      if (!am.hidden) {
        aopen(false);
        return;
      }
    }
    if (!xm.hidden || !am.hidden) return;
    if (k === "h") {
      setPanel(!$("panel").classList.contains("open"));
      return;
    }
    if (k === "g") newThing();
    else if (k === "r") toggleRec();
    else if (k === " " && (t === document.body || t === canvas)) {
      e.preventDefault();
      setPaused(!S.paused);
    } else if (k === "f") setFilm(!S.film);
    else if (k === "escape" && S.film) setFilm(false);
  });
  const ptrs = new Map();
  let pinch0 = 0,
    dist0 = 0,
    zoom0 = 1,
    moved = 0;
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      dist0 = S.dist;
      zoom0 = S.sysZoom;
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (mode === "system") {
      const i = hitTest(e);
      hoverI = i;
      stage.classList.toggle("hover", i >= 0);
    }
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (mode === "system") {
      if (ptrs.size === 1 && moved >= 4) {
        const k = 2.2 / canvas.clientHeight;
        if (S.sysEl == null) S.sysEl = sysDefEl();
        S.svy = dx * k;
        S.svp = dy * k;
        S.sysYaw += S.svy;
        S.sysEl = clamp(S.sysEl + S.svp, -1.5, 1.5);
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) S.sysZoom = clamp((zoom0 * d) / pinch0, 0.4, 10);
      }
      return;
    }
    if (ptrs.size === 1) {
      const k = 2.2 / canvas.clientHeight;
      S.vy = -dx * k;
      S.vp = dy * k;
      S.yaw += S.vy;
      S.pitch = clamp(S.pitch + S.vp, -1.3, 1.3);
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) {
        S.dist = clamp((dist0 * pinch0) / d, 1.25, 60);
        S.distTarget = null;
      }
    }
  });
  function up(e) {
    hashSoon();
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch0 = 0;
    if (mode === "system" && moved < 6 && e.type === "pointerup") {
      const i = hitTest(e);
      if (i >= 0) {
        visit(i);
        return;
      }
    }
    if (S.film && moved < 6) setFilm(false);
  }
  function sysDefEl() {
    const Wc = canvas.clientWidth,
      Hc = canvas.clientHeight;
    return Math.asin(Hc > Wc * 1.2 ? 0.8 : 0.38);
  }
  function hitTest(e) {
    if (!SYS) return -1;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left,
      y = e.clientY - r.top;
    let best = -1,
      bd = 1e9;
    SYS.planets.forEach((pl, i) => {
      const d = Math.hypot(pl.sx - x, pl.sy - y);
      if (d < pl.sr * 1.4 + 10 && d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      hashSoon();
      if (mode === "system") {
        S.sysZoom = clamp(S.sysZoom * Math.exp(-e.deltaY * 0.0012), 0.4, 10);
        return;
      }
      S.dist = clamp(S.dist * Math.exp(e.deltaY * 0.0012), 1.25, 60);
      S.distTarget = null;
    },
    { passive: false },
  );

  /* ================= render loop ================= */
  const forced = parseFloat(new URLSearchParams(location.search).get("scale"));
  let scale = forced > 0 ? forced : Math.min(window.devicePixelRatio || 1, 1.5),
    maxScale = scale,
    ema = 16,
    cool = 0,
    visible = true,
    last = performance.now();
  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * scale)),
      h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }).observe(stage);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });

  const asp = () =>
    clamp(canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.5, 1);
  const baseDist = (ring) =>
    (ring ? 1.4 : 1) * (asp() < 0.75 ? 5.6 / asp() : 10.4);
  const bgc = $("bg"),
    bgx = bgc.getContext("2d");
  function camMat(yaw, pitch) {
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw),
      cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    const b = [sy * cp, sp, cy * cp];
    let r = [b[2], 0, -b[0]];
    const rl = Math.hypot(...r) || 1;
    r = r.map((v) => v / rl);
    const u = [
      b[1] * r[2] - b[2] * r[1],
      b[2] * r[0] - b[0] * r[2],
      b[0] * r[1] - b[1] * r[0],
    ];
    return {
      r,
      u,
      b,
      m: [r[0], r[1], r[2], u[0], u[1], u[2], b[0], b[1], b[2]],
    };
  }
  function drawPlanetView(
    p,
    w,
    cam,
    res,
    orig,
    sys,
    dist,
    rot,
    crot,
    sun,
    moonA,
    shift,
  ) {
    shift = shift || [0, 0];
    gl.useProgram(prog);
    gl.uniform2f(UV.uShift, shift[0], shift[1]);
    pushShared(UV, octForView(dist, p.scale, res[1]), S.time, p, w);
    gl.uniformMatrix3fv(UV.uCam, false, cam.m);
    gl.uniform2f(UV.uRes, res[0], res[1]);
    gl.uniform2f(UV.uOrig, orig[0], orig[1]);
    gl.uniform1f(UV.uSys, sys ? 1 : 0);
    gl.uniform1f(UV.uRot, rot);
    gl.uniform1f(UV.uCloudRot, crot);
    gl.uniform1f(UV.uDist, dist);
    gl.uniform1f(UV.uRelief, p.relief);
    gl.uniform3f(UV.uSun, sun[0], sun[1], sun[2]);
    if (!sys) pushBG();
    gl.uniform1f(UV.uRing, p.rings ? 1 : 0);
    gl.uniform1f(UV.uRingIn, w.ringIn);
    gl.uniform1f(UV.uRingOut, w.ringOut);
    gl.uniform1f(UV.uMoon, p.moon ? 1 : 0);
    if (p.moon)
      gl.uniform3f(
        UV.uMoonPos,
        3.4 * Math.cos(moonA),
        0.7 * Math.sin(moonA * 0.7),
        3.4 * Math.sin(moonA),
      );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function drawSystem() {
    const Wc = canvas.clientWidth,
      Hc = canvas.clientHeight,
      k = canvas.width / Wc;
    if (bgc.width !== canvas.width || bgc.height !== canvas.height) {
      bgc.width = canvas.width;
      bgc.height = canvas.height;
    }
    const ctx = bgx;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const st = SYS.star,
      sc = st.c.map((v) => Math.round(v * 255));
    ctx.fillStyle = "#04050a";
    ctx.fillRect(0, 0, Wc, Hc);
    let g = ctx.createRadialGradient(
      Wc / 2,
      Hc / 2,
      0,
      Wc / 2,
      Hc / 2,
      Math.max(Wc, Hc) * 0.7,
    );
    g.addColorStop(0, "rgba(" + sc + ",.10)");
    g.addColorStop(1, "rgba(" + sc + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Wc, Hc);
    if (!BG) genBG();
    const nc = BG.nebA.map((v) => Math.round(v * 255)),
      nd = BG.nebB.map((v) => Math.round(v * 255));
    for (const bl of BG.blobs) {
      const rr = bl.rad * Math.max(Wc, Hc),
        c = bl.k < 0.5 ? nc : nd;
      g = ctx.createRadialGradient(
        bl.x * Wc,
        bl.y * Hc,
        0,
        bl.x * Wc,
        bl.y * Hc,
        rr,
      );
      g.addColorStop(0, "rgba(" + c + "," + 0.2 * P.neb + ")");
      g.addColorStop(1, "rgba(" + c + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, Wc, Hc);
    }
    const ns = Math.floor(300 * P.stars);
    for (let i = 0; i < ns && i < SYS.stars.length; i++) {
      const s = SYS.stars[i];
      ctx.globalAlpha = s[3];
      ctx.fillStyle = "#fff";
      ctx.fillRect(s[0] * Wc, s[1] * Hc, s[2], s[2]);
    }
    ctx.globalAlpha = 1;
    for (const ga of BG.gal) {
      if (ga.sz <= 0) continue;
      const gx = ga.x * Wc,
        gy = ga.y * Hc,
        gr = ga.sz * Math.max(Wc, Hc) * 2.2,
        tc = ga.t.map((v) => Math.round(v * 255));
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(ga.rot);
      ctx.scale(1, 0.38);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
      g.addColorStop(0, "rgba(255,245,225,.85)");
      g.addColorStop(0.12, "rgba(" + tc + ",.5)");
      g.addColorStop(0.5, "rgba(" + tc + ",.14)");
      g.addColorStop(1, "rgba(" + tc + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, gr, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }
    for (const fp of BG.far) {
      if (fp.rad <= 0) continue;
      const fx = fp.x * Wc,
        fy = fp.y * Hc,
        fr = fp.rad * Math.min(Wc, Hc) * 1.1,
        fcc = fp.c.map((v) => Math.round(v * 255));
      g = ctx.createRadialGradient(
        fx - fr * 0.35,
        fy - fr * 0.35,
        fr * 0.1,
        fx,
        fy,
        fr,
      );
      g.addColorStop(0, "rgb(" + fcc + ")");
      g.addColorStop(1, "rgb(" + fcc.map((v) => Math.round(v * 0.12)) + ")");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, 6.2832);
      ctx.fill();
    }
    const cx = Wc / 2 + S.shx * Hc,
      cy = Hc / 2 - S.shy * Hc,
      Z = S.sysZoom,
      mn = Math.min(Wc, Hc);
    const freeW = Wc - 2 * Math.max(0, S.shx * Hc);
    const rxMax = Math.min(freeW * 0.46, Hc * 1.0) * Z,
      el = S.sysEl == null ? sysDefEl() : S.sysEl,
      sE = Math.sin(el),
      tilt = Math.max(Math.abs(sE), 0.05),
      cY = Math.cos(S.sysYaw),
      sY = Math.sin(S.sysYaw);
    const proj = (a, th) => {
      const X = Math.cos(th) * a,
        Z = Math.sin(th) * a;
      return [X * cY + Z * sY, -X * sY + Z * cY];
    };
    const sr0 = mn * 0.045 * st.size * Math.pow(Z, 0.6),
      sr = Math.min(sr0 * 5, mn * 0.17);
    const r0 = sr * 1.5,
      apx = (a) => r0 + ((a - 0.24) / 0.76) * Math.max(rxMax - r0, rxMax * 0.3);
    ctx.lineWidth = 1;
    for (const pl of SYS.planets) {
      ctx.strokeStyle = "rgba(236,231,220,.13)";
      ctx.beginPath();
      const ra = apx(pl.a);
      for (let j = 0; j <= 96; j++) {
        const q = proj(ra, (j / 96) * 6.2832);
        j
          ? ctx.lineTo(cx + q[0], cy + q[1] * sE)
          : ctx.moveTo(cx + q[0], cy + q[1] * sE);
      }
      ctx.stroke();
    }
    for (const [rad, al] of [
      [7, 0.1],
      [4, 0.18],
      [2.2, 0.35],
    ]) {
      g = ctx.createRadialGradient(cx, cy, sr * 0.6, cx, cy, sr * rad);
      g.addColorStop(0, "rgba(" + sc + "," + al + ")");
      g.addColorStop(1, "rgba(" + sc + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, sr * rad, 0, 6.2832);
      ctx.fill();
    }
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.55, "rgb(" + sc + ")");
    g.addColorStop(1, "rgb(" + sc.map((v) => Math.round(v * 0.85)) + ")");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, sr, 0, 6.2832);
    ctx.fill();
    const as = SYS.planets.map((q) => apx(q.a)).sort((x, y) => x - y);
    const capOf = (a) => {
      const v = apx(a),
        i = as.indexOf(v);
      const g = Math.min(
        i > 0 ? v - as[i - 1] : 1e9,
        i < as.length - 1 ? as[i + 1] - v : 1e9,
      );
      return Math.max(14, g * 1.5 * Math.max(tilt, 0.62));
    };
    const items = SYS.planets
      .map((pl, i) => {
        const th = pl.ang + S.time * pl.om * S.orb;
        const ra = apx(pl.a),
          q = proj(ra, th);
        const sn =
          (q[1] / ra) * Math.min(1, Math.abs(sE) / 0.38) * (sE < 0 ? -1 : 1);
        const ps = 1 + 0.18 * sn;
        const d = Math.max(
          12,
          Math.min(
            mn * 0.05 * pl.size * ps * Math.pow(Z, 0.4),
            capOf(pl.a) * ps,
            sr0 * Math.max(1.5, pl.size * 1.1),
          ),
        );
        pl.sx = cx + q[0];
        pl.sy = cy + q[1] * sE;
        pl.dep = q[1] * sE;
        pl.sr = d / 2;
        pl.d = d;
        pl.i = i;
        return pl;
      })
      .sort((a, b) => a.dep - b.dep);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const cam = camMat(0, 0.3);
    let sunDone = !sunProg;
    const drawSun = () => {
      sunDone = true;
      gl.useProgram(sunProg);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(sunU.c, cx * k, (Hc - cy) * k);
      gl.uniform1f(sunU.r, sr * k);
      gl.uniform3f(sunU.col, st.c[0], st.c[1], st.c[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    for (const pl of items) {
      if (!sunDone && pl.dep >= 0) drawSun();
      const rg = pl.g.p.rings,
        dd = rg ? 9 : 3.9,
        sz = pl.d / (rg ? 0.384 : 0.9),
        sp = Math.round(sz * k);
      const vx = Math.round((pl.sx - sz / 2) * k),
        vy = Math.round((Hc - pl.sy - sz / 2) * k);
      gl.viewport(vx, vy, sp, sp);
      let dx = cx - pl.sx,
        dy = -(cy - pl.sy);
      const L = Math.hypot(dx, dy) || 1;
      dx /= L;
      dy /= L;
      const v = [dx * 0.93, dy * 0.93, 0.36];
      const sun = [0, 1, 2].map(
        (j) => cam.r[j] * v[0] + cam.u[j] * v[1] + cam.b[j] * v[2],
      );
      const sl = Math.hypot(...sun);
      const sn = sun.map((x) => x / sl);
      const p = pl.g.p,
        w = pl.g.w;
      drawPlanetView(
        p,
        w,
        cam,
        [sp, sp],
        [vx, vy],
        true,
        dd,
        w.rot0 + S.time * 0.12 * p.spin,
        w.rot0 + S.time * 0.135 * p.spin,
        sn,
        0,
      );
    }
    if (!sunDone) drawSun();
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    if (S.labels)
      for (const pl of items) {
        const hov = pl.i === hoverI;
        const ly = pl.sy + pl.sr + 17;
        ctx.fillStyle = hov ? "#ffb877" : "rgba(236,231,220,.92)";
        ctx.font = "600 13px Figtree,system-ui,sans-serif";
        ctx.fillText(pl.name, pl.sx, ly);
        ctx.fillStyle = hov ? "rgba(255,184,119,.9)" : "rgba(154,156,166,.95)";
        ctx.font = '400 10.5px "JetBrains Mono",ui-monospace,monospace';
        ctx.fillText(
          (pl.clsId === "gas"
            ? "gas giant"
            : CLASSES.find((c) => c.id === pl.clsId).name.toLowerCase()) +
            (pl.g.p.rings ? " \u00b7 ringed" : ""),
          pl.sx,
          ly + 14,
        );
      }
  }
  function drawPlanet(now) {
    const cam = camMat(S.yaw, S.pitch);
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const az = P.sunAz * D2R,
      el = P.sunEl * D2R;
    drawPlanetView(
      P,
      W,
      cam,
      [canvas.width, canvas.height],
      [0, 0],
      false,
      S.dist,
      S.rot,
      S.crot,
      [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)],
      S.moonA,
      [S.shx, S.shy],
    );
  }

  /* ---------- screenshot and video ---------- */
  function recGeom(fmt) {
    const cw = canvas.width,
      ch = canvas.height;
    let ar = cw / ch;
    if (fmt === "9:16") ar = 9 / 16;
    else if (fmt === "1:1") ar = 1;
    else if (fmt === "1080p" || fmt === "1440p") ar = 16 / 9;
    let w = cw,
      h = ch;
    if (cw / ch > ar) w = Math.round(ch * ar);
    else h = Math.round(cw / ar);
    const crop = {
      x: Math.round((cw - w) / 2),
      y: Math.round((ch - h) / 2),
      w,
      h,
    };
    let ow = w & ~1,
      oh = h & ~1;
    if (fmt === "9:16") {
      ow = 1080;
      oh = 1920;
    } else if (fmt === "1:1") {
      ow = 1080;
      oh = 1080;
    } else if (fmt === "1080p") {
      ow = 1920;
      oh = 1080;
    } else if (fmt === "1440p") {
      ow = 2560;
      oh = 1440;
    }
    return { crop, ow, oh };
  }
  function compose(ctx, ow, oh, crop) {
    ctx.fillStyle = "#04050a";
    ctx.fillRect(0, 0, ow, oh);
    if (mode === "system")
      ctx.drawImage(bgc, crop.x, crop.y, crop.w, crop.h, 0, 0, ow, oh);
    ctx.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, ow, oh);
  }
  async function hiShotRun(W_, H_) {
    const T = Math.min(1024, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      T,
      T,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    const okf =
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!okf) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      throw new Error("render target");
    }
    const img = new ImageData(W_, H_),
      buf = new Uint8Array(T * T * 4);
    const cam = camMat(S.yaw, S.pitch),
      az = P.sunAz * D2R,
      el = P.sunEl * D2R,
      sun = [
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
        Math.cos(el) * Math.cos(az),
      ];
    const nx = Math.ceil(W_ / T),
      ny = Math.ceil(H_ / T);
    let n = 0;
    try {
      for (let ty = 0; ty < ny; ty++)
        for (let tx = 0; tx < nx; tx++) {
          const x0 = tx * T,
            y0 = ty * T,
            tw = Math.min(T, W_ - x0),
            th = Math.min(T, H_ - y0);
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          gl.disable(gl.BLEND);
          gl.viewport(0, 0, tw, th);
          drawPlanetView(
            P,
            W,
            cam,
            [W_, H_],
            [-x0, -y0],
            false,
            S.dist,
            S.rot,
            S.crot,
            sun,
            S.moonA,
          );
          gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, canvas.width, canvas.height);
          for (let r = 0; r < th; r++) {
            const dst = ((H_ - 1 - (y0 + r)) * W_ + x0) * 4;
            img.data.set(buf.subarray(r * tw * 4, (r + 1) * tw * 4), dst);
          }
          n++;
          $("rec").title = "";
          progress2(n / (nx * ny));
          await tick();
        }
    } finally {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
    }
    const cv = document.createElement("canvas");
    cv.width = W_;
    cv.height = H_;
    cv.getContext("2d").putImageData(img, 0, 0);
    return new Promise((res) => cv.toBlob((b) => res(b), "image/png"));
  }
  function progress2(f) {
    $("shot").textContent =
      f >= 1 ? "Screenshot" : "Rendering " + Math.round(f * 100) + "%";
  }
  let shotBusy = false;
  async function hiShot(w, h) {
    if (shotBusy) return;
    shotBusy = true;
    $("shot").disabled = true;
    try {
      const run = () => hiShotRun(w, h);
      const pr = chain.then(run, run);
      chain = pr.catch(() => {});
      const blob = await pr;
      if (blob)
        saveBlob(blob, slug() + "-" + W.seed + "-" + w + "x" + h + ".png");
    } catch (e) {
      console.error(e);
      S.snap = true;
    }
    shotBusy = false;
    $("shot").disabled = false;
    $("shot").textContent = "Screenshot";
  }
  let rec = null;
  const MIMES = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const recMime = window.MediaRecorder
    ? MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || ""
    : null;
  if (recMime === null) $("rec").hidden = true;
  function recName() {
    return (
      (mode === "system" && SYS
        ? "system-" + SYS.seed
        : slug() + "-" + W.seed) +
      "-" +
      (recMime.indexOf("mp4") >= 0 ? "video.mp4" : "video.webm")
    );
  }
  function toggleRec() {
    if (recMime === null) return;
    if (rec) {
      rec.mr.stop();
      return;
    }
    const fmt = $("rec-fmt").value,
      g = recGeom(fmt);
    const cv = document.createElement("canvas");
    cv.width = g.ow;
    cv.height = g.oh;
    const stream = cv.captureStream(60);
    let mr;
    try {
      mr = new MediaRecorder(
        stream,
        recMime
          ? { mimeType: recMime, videoBitsPerSecond: 14e6 }
          : { videoBitsPerSecond: 14e6 },
      );
    } catch (e) {
      console.error(e);
      return;
    }
    const chunks = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const name = recName();
    mr.onstop = () => {
      const mt = mr.mimeType || recMime || "video/webm";
      saveBlob(
        new Blob(chunks, { type: mt }),
        name.replace(
          /\.(mp4|webm)$/,
          mt.indexOf("mp4") >= 0 ? ".mp4" : ".webm",
        ),
      );
      rec = null;
      $("rec").classList.remove("on");
      $("rec").textContent = "Record video";
      $("rectag").hidden = true;
    };
    rec = {
      mr,
      cv,
      ctx: cv.getContext("2d"),
      fmt,
      ow: g.ow,
      oh: g.oh,
      t0: performance.now(),
    };
    mr.start(500);
    $("rec").classList.add("on");
    $("rectag").hidden = false;
  }
  function recTick(now) {
    if (!rec) return;
    const g = recGeom(rec.fmt);
    compose(rec.ctx, rec.ow, rec.oh, g.crop);
    const t = Math.floor((now - rec.t0) / 1000),
      txt = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
    $("rec").textContent = "Stop " + txt;
    $("rectime").textContent = "REC " + txt;
    if (t >= 180) rec.mr.stop();
  }

  function layoutShift() {
    if (S.film || rec || window.__manual) return [0, 0];
    const cr = canvas.getBoundingClientRect(),
      pr = $("panel").getBoundingClientRect(),
      hr = document.querySelector(".hud").getBoundingClientRect();
    const Wc = cr.width,
      Hc = cr.height,
      open = $("panel").classList.contains("open");
    let cx = Wc / 2,
      cy = Hc / 2;
    if (Wc <= 700) {
      const top = Math.max(0, hr.bottom - cr.top) + 6,
        bot = pr.top - cr.top - 8;
      if (bot > top + 80) cy = (top + bot) / 2;
    } else if (open) {
      cx = (pr.right - cr.left + 30 + Wc) / 2;
    }
    return [(cx - Wc / 2) / Hc, (Hc / 2 - cy) / Hc];
  }
  function renderNow() {
    resize();
    if (mode === "system" && SYS) drawSystem();
    else drawPlanet(0);
  }
  function frame(now) {
    if (window.__manual) return;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    ema = ema * 0.92 + dt * 1000 * 0.08;
    if (!(forced > 0) && --cool <= 0) {
      if (ema > 26 && scale > 0.5) {
        scale *= 0.85;
        cool = 40;
      } else if (ema < 15 && scale < maxScale) {
        scale = Math.min(maxScale, scale * 1.08);
        cool = 60;
      }
    }
    resize();
    {
      const sh = layoutShift(),
        k = Math.min(1, dt * 6);
      S.shx += (sh[0] - S.shx) * k;
      S.shy += (sh[1] - S.shy) * k;
    }
    if (!ptrs.size && mode === "system") {
      S.sysYaw += S.svy;
      if (S.sysEl != null) S.sysEl = clamp(S.sysEl + S.svp, -1.5, 1.5);
      S.svy *= 0.92;
      S.svp *= 0.92;
    }
    if (!ptrs.size) {
      S.yaw += S.vy;
      S.pitch = clamp(S.pitch + S.vp, -1.3, 1.3);
      S.vy *= 0.92;
      S.vp *= 0.92;
    }
    if (S.distTarget) {
      S.dist += (S.distTarget - S.dist) * Math.min(1, dt * 3);
      if (Math.abs(S.distTarget - S.dist) < 0.01) S.distTarget = null;
    }
    if (S.film && mode === "planet") {
      S.yaw += dt * 0.06;
      const base = baseDist(P.rings || P.moon);
      S.dist += (base + Math.sin(now * 0.00015) * 0.25 - S.dist) * dt * 0.4;
      S.pitch += (0.22 - S.pitch) * dt * 0.3;
    }
    if (!S.paused) {
      S.rot += dt * 0.12 * P.spin;
      S.crot += dt * 0.135 * P.spin;
      S.time += dt;
      S.moonA += dt * 0.05;
    }
    if (mode === "system" && SYS) drawSystem();
    else drawPlanet(now);
    if (S.snap) {
      S.snap = false;
      const g = recGeom("screen");
      const cv = document.createElement("canvas");
      cv.width = g.ow;
      cv.height = g.oh;
      compose(cv.getContext("2d"), g.ow, g.oh, g.crop);
      cv.toBlob((bl) => {
        if (bl)
          saveBlob(
            bl,
            (mode === "system" && SYS
              ? "system-" + SYS.seed
              : slug() + "-" + W.seed) + "-view.png",
          );
      }, "image/png");
    }
    recTick(now);
    requestAnimationFrame(frame);
  }

  /* ================= texture export ================= */
  const MAXTEX = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const HLO = 0.15,
    HSPAN = 1.2;
  const slug = () =>
    (W.name || "planet").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  function saveBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  async function bake(mode, w, h, onProg, opt) {
    opt = opt || {};
    const T = Math.max(8, Math.min(h, Math.floor(524288 / w)));
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      w,
      T,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    const ok =
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      throw new Error(
        "This graphics card could not allocate a " +
          w +
          " px wide render target.",
      );
    }
    const out = new Uint8Array(w * h * 4),
      buf = new Uint8Array(w * T * 4);
    const oct = octForBake(w);
    let n = 0;
    try {
      for (let row0 = 0; row0 < h; row0 += T) {
        const th = Math.min(T, h - row0);
        gl.useProgram(bakeProg);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, w, th);
        pushShared(UB, oct, 0);
        gl.uniform2f(UB.uSize, w, h);
        gl.uniform1f(UB.uRow0, row0);
        gl.uniform1f(UB.uMode, mode);
        gl.uniform1f(UB.uStrength, opt.strength || 0.15);
        gl.uniform1f(UB.uFlip, opt.flip || 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, w, th, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(prog);
        gl.viewport(0, 0, canvas.width, canvas.height);
        for (let k = 0; k < th; k++) {
          const dst = (h - 1 - (row0 + k)) * w * 4;
          out.set(buf.subarray(k * w * 4, (k + 1) * w * 4), dst);
        }
        if (onProg && ++n % 3 === 0) {
          onProg(Math.min(1, (row0 + th) / h));
          await tick();
        }
      }
    } finally {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
    }
    return out;
  }
  let chain = Promise.resolve();
  function bakeQ(mode, w, h, onProg, opt) {
    const run = () => bake(mode, w, h, onProg, opt);
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }

  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  async function deflate(u8) {
    const cs = new CompressionStream("deflate");
    const wr = cs.writable.getWriter();
    wr.write(u8);
    wr.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  }
  function pngChunk(type, data) {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  }
  async function encodePNG(w, h, depth, ctype, pix) {
    const bpp = (ctype === 2 ? 3 : 1) * (depth / 8),
      stride = w * bpp;
    const raw = new Uint8Array((stride + 1) * h);
    for (let y = 0; y < h; y++) {
      const s = y * stride,
        d = y * (stride + 1);
      raw[d] = 1;
      for (let x = 0; x < stride; x++)
        raw[d + 1 + x] = (pix[s + x] - (x >= bpp ? pix[s + x - bpp] : 0)) & 255;
    }
    const z = await deflate(raw);
    const ih = new Uint8Array(13);
    const dv = new DataView(ih.buffer);
    dv.setUint32(0, w);
    dv.setUint32(4, h);
    ih[8] = depth;
    ih[9] = ctype;
    const parts = [
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", ih),
      pngChunk("IDAT", z),
      pngChunk("IEND", new Uint8Array(0)),
    ];
    let len = 0;
    parts.forEach((p) => (len += p.length));
    const res = new Uint8Array(len);
    let o = 0;
    parts.forEach((p) => {
      res.set(p, o);
      o += p.length;
    });
    return res;
  }
  async function encodeMap(m, data, w, h) {
    const n = w * h;
    if (m.kind === "rgb") {
      const px = new Uint8Array(n * 3);
      for (let i = 0, j = 0, k = 0; i < n; i++, j += 4, k += 3) {
        px[k] = data[j];
        px[k + 1] = data[j + 1];
        px[k + 2] = data[j + 2];
      }
      return encodePNG(w, h, 8, 2, px);
    }
    if (m.kind === "h16") {
      const px = new Uint8Array(n * 2);
      for (let i = 0, j = 0, k = 0; i < n; i++, j += 4, k += 2) {
        px[k] = data[j];
        px[k + 1] = data[j + 1];
      }
      return encodePNG(w, h, 16, 0, px);
    }
    const px = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) px[i] = data[j];
    return encodePNG(w, h, 8, 0, px);
  }
  function makeZip(files) {
    const enc = new TextEncoder(),
      parts = [],
      cen = [];
    let off = 0;
    const d = new Date();
    const dtime =
      (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const ddate =
      ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const nb = enc.encode(f.name),
        crc = crc32(f.data);
      const lh = new Uint8Array(30 + nb.length);
      const lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, dtime, true);
      lv.setUint16(12, ddate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, f.data.length, true);
      lv.setUint32(22, f.data.length, true);
      lv.setUint16(26, nb.length, true);
      lv.setUint16(28, 0, true);
      lh.set(nb, 30);
      const ch = new Uint8Array(46 + nb.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dtime, true);
      cv.setUint16(14, ddate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, f.data.length, true);
      cv.setUint32(24, f.data.length, true);
      cv.setUint16(28, nb.length, true);
      cv.setUint32(42, off, true);
      ch.set(nb, 46);
      parts.push(lh, f.data);
      cen.push(ch);
      off += lh.length + f.data.length;
    }
    let cl = 0;
    cen.forEach((c) => (cl += c.length));
    const eo = new Uint8Array(22);
    const ev = new DataView(eo.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cl, true);
    ev.setUint32(16, off, true);
    return new Blob([...parts, ...cen, eo], { type: "application/zip" });
  }

  const MAPS = [
    {
      id: "albedo",
      mode: 0,
      kind: "rgb",
      label: "Albedo",
      hint: () => "sRGB colour, no lighting",
    },
    {
      id: "height",
      mode: 1,
      kind: "h16",
      label: "Height",
      hint: () =>
        "16-bit grey, sea level at " +
        Math.round(((P.sea - HLO) / HSPAN) * 100) +
        "%",
    },
    {
      id: "normal",
      mode: 2,
      kind: "rgb",
      label: "Normal",
      hint: () => "tangent space, see format above",
    },
    {
      id: "roughness",
      mode: 3,
      kind: "gray",
      label: "Roughness",
      hint: () => "linear grey, water is smooth",
    },
    {
      id: "clouds",
      mode: 4,
      kind: "gray",
      label: "Clouds",
      hint: () => "linear grey, use as opacity",
    },
    {
      id: "emissive",
      mode: 5,
      kind: "rgb",
      label: "Emissive",
      hint: () => (W.cls.emit > 0 ? "lava glow" : "city lights, night side"),
      cond: () => W.cls.emit > 0 || (P.cities && W.cityAmt > 0),
    },
    {
      id: "ocean",
      mode: 6,
      kind: "gray",
      label: "Ocean mask",
      hint: () => "white is open water",
    },
  ];
  const xsize = () => {
    const w = Math.min(+$("x-size").value, MAXTEX);
    return { w, h: w / 2 };
  };
  const bopt = () => ({
    strength: +$("x-rel").value,
    flip: +$("x-flip").value,
  });
  let busy = false;
  function setBusy(v) {
    busy = v;
    $("x-all").disabled = v;
    document.querySelectorAll(".x-dl").forEach((b) => (b.disabled = v));
  }
  function progress(msg, frac) {
    const bar = $("x-bar");
    $("x-msg").textContent = msg || "";
    if (frac == null) {
      bar.hidden = true;
    } else {
      bar.hidden = false;
      bar.value = frac;
    }
  }
  function fileName(m, w) {
    return slug() + "-" + W.seed + "-" + m.id + "-" + w + ".png";
  }

  function buildCards() {
    const root = $("maps");
    for (const m of MAPS) {
      const fig = document.createElement("figure");
      fig.className = "xcard";
      const cv = document.createElement("canvas");
      cv.width = 512;
      cv.height = 256;
      cv.setAttribute("aria-label", m.label + " map preview");
      const cap = document.createElement("figcaption");
      cap.className = "xcap";
      const tx = document.createElement("div");
      const st = document.createElement("strong");
      st.textContent = m.label;
      const sp = document.createElement("span");
      tx.append(st, sp);
      const bt = document.createElement("button");
      bt.type = "button";
      bt.className = "x-dl";
      bt.textContent = "PNG";
      bt.addEventListener("click", () => downloadOne(m));
      cap.append(tx, bt);
      fig.append(cv, cap);
      root.appendChild(fig);
      m.card = fig;
      m.canvas = cv;
      m.hintEl = sp;
    }
    if (!bakeProg || !UB) {
      $("export").hidden = true;
    }
  }
  function paint(m, data) {
    const ctx = m.canvas.getContext("2d");
    const img = ctx.createImageData(512, 256);
    const o = img.data;
    if (m.kind === "h16") {
      for (let i = 0; i < 512 * 256; i++) {
        const v = data[i * 4];
        o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v;
        o[i * 4 + 3] = 255;
      }
    } else o.set(data);
    ctx.putImageData(img, 0, 0);
  }
  let prevTok = 0,
    prevTimer = 0;
  function schedulePreviews() {
    if (window.__manual) return;
    clearTimeout(prevTimer);
    prevTimer = setTimeout(renderPreviews, 250);
  }
  async function renderPreviews() {
    if (!bakeProg || !UB) return;
    const tok = ++prevTok;
    for (const m of MAPS) {
      const on = !m.cond || m.cond();
      m.card.hidden = !on;
      if (!on) continue;
      m.hintEl.textContent = m.hint();
      let data;
      try {
        data = await bakeQ(m.mode, 512, 256, null, bopt());
      } catch (e) {
        console.error(e);
        return;
      }
      if (tok !== prevTok) return;
      paint(m, data);
      if (m.id === "height") {
        W.hdata = data;
        updateHud();
      }
    }
  }
  ["x-flip", "x-rel"].forEach((id) =>
    $(id).addEventListener("input", () => {
      $("x-relo").textContent = (+$("x-rel").value).toFixed(2);
      schedulePreviews();
    }),
  );

  async function downloadOne(m) {
    if (busy) return;
    setBusy(true);
    try {
      const { w, h } = xsize();
      progress("Baking " + m.label.toLowerCase() + "…", 0);
      const data = await bakeQ(
        m.mode,
        w,
        h,
        (f) =>
          progress(
            "Baking " + m.label.toLowerCase() + " " + Math.round(f * 100) + "%",
            f,
          ),
        bopt(),
      );
      progress("Encoding PNG…", 1);
      await tick();
      const bytes = await encodeMap(m, data, w, h);
      saveBlob(new Blob([bytes], { type: "image/png" }), fileName(m, w));
      progress("Saved " + fileName(m, w), null);
    } catch (e) {
      console.error(e);
      progress("Could not export: " + e.message, null);
    }
    setBusy(false);
  }
  async function downloadAll() {
    if (busy) return;
    setBusy(true);
    try {
      const { w, h } = xsize();
      const list = MAPS.filter((m) => !m.cond || m.cond());
      const files = [];
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        const pre =
          "(" + (i + 1) + "/" + list.length + ") " + m.label.toLowerCase();
        progress(pre + " 0%", i / list.length);
        const data = await bakeQ(
          m.mode,
          w,
          h,
          (f) =>
            progress(
              pre + " " + Math.round(f * 100) + "%",
              (i + f * 0.9) / list.length,
            ),
          bopt(),
        );
        progress(pre + " encoding…", (i + 0.9) / list.length);
        await tick();
        files.push({
          name: fileName(m, w),
          data: await encodeMap(m, data, w, h),
        });
      }
      const info = {
        generator: "Openbench Seedworld",
        url: "https://openbench.fun/seedworld/#" + W.seed,
        name: W.name,
        seed: W.seed,
        type: W.cls.name,
        size: [w, h],
        projection:
          "equirectangular, north at the top, longitude 0 at the centre, wraps left to right",
        seaLevel: +P.sea.toFixed(3),
        seaLevelInHeightMap: +((P.sea - HLO) / HSPAN).toFixed(4),
        settings: {
          continents: P.scale,
          mountains: P.mount,
          warmth: P.temp,
          moisture: P.wet,
          clouds: P.cloud,
        },
        normalFormat:
          +$("x-flip").value === 1 ? "OpenGL (+Y up)" : "DirectX (-Y up)",
        normalStrength: +$("x-rel").value,
        files: files.map((f) => f.name),
      };
      const readme = [
        "Openbench Seedworld texture export",
        "",
        "World: " + W.name + " (" + W.cls.name + "), seed " + W.seed,
        "Open it again: https://openbench.fun/seedworld/#" + W.seed,
        "",
        "Layout: equirectangular, " +
          w +
          " x " +
          h +
          ". North is at the top, longitude 0 is the centre, the left and right edges join seamlessly.",
        "Use them on a standard UV sphere. In Unreal, Unity, Godot and Blender the default sphere mesh uses this layout.",
        "",
        "albedo     sRGB colour without lighting.",
        "height     16-bit grayscale PNG (import as linear, not sRGB). Value = (height - 0.15) / 1.2. Sea level sits at " +
          ((P.sea - HLO) / HSPAN).toFixed(4) +
          " of the range.",
        "normal     Tangent-space normal map, " +
          info.normalFormat +
          ". Import as a normal map. Open water is flat.",
        "roughness  Linear grayscale. Water is smooth, land is rough, ice is in between.",
        "clouds     Linear grayscale cloud density. Use it as opacity on a second sphere slightly larger than the planet.",
        "emissive   Present only for inhabited or lava worlds. sRGB colour for city lights or lava glow.",
        "ocean      Linear grayscale mask, white is open water.",
        "",
        "Free to use in personal and commercial projects. A credit to openbench.fun is welcome but not required.",
      ].join("\n");
      const enc = new TextEncoder();
      files.push(
        { name: "README.txt", data: enc.encode(readme) },
        { name: "info.json", data: enc.encode(JSON.stringify(info, null, 2)) },
      );
      progress("Packing zip…", 1);
      await tick();
      saveBlob(
        makeZip(files),
        slug() + "-" + W.seed + "-textures-" + w + ".zip",
      );
      progress("Saved the zip with " + list.length + " maps", null);
    } catch (e) {
      console.error(e);
      progress("Could not export: " + e.message, null);
    }
    setBusy(false);
  }
  $("x-all").addEventListener("click", downloadAll);
  [...$("x-size").options].forEach((o) => {
    if (+o.value > MAXTEX) o.disabled = true;
  });
  buildCards();

  /* test hook, harmless in production */
  window.__openbench = {
    sysOpts,
    setMode(m) {
      mode = m;
      updateChrome();
    },
    renderNow,
    P,
    W,
    S,
    bakeQ,
    encodeMap,
    makeZip,
    openSystem,
    visit,
    toggleRec,
    hiShot,
    hiShotRun,
    applySeed,
    makeWorld,
    showWorld,
    genBG,
    setPanel,
    setFilm,
    setPaused,
    compose,
    recGeom,
    bgc,
    canvas,
    get SYS() {
      return SYS;
    },
    get mode() {
      return mode;
    },
    set bgRoll(v) {
      bgRoll = v;
    },
    backToSystem,
    get BG() {
      return BG;
    },
  };

  S.dist = baseDist(P.rings);
  try {
    var _p = "seedworld",
      _g = !sessionStorage.getItem("ob_hit"),
      _pc = !!sessionStorage.getItem("ob_hit_" + _p),
      _pf = !localStorage.getItem("ob_seen_" + _p),
      _f = !localStorage.getItem("ob_seen");
    var _r = _pc
      ? fetch("/api/stats")
      : fetch(
          "/api/hit?p=" +
            _p +
            "&u=" +
            (_f ? 1 : 0) +
            "&g=" +
            (_g ? 1 : 0) +
            "&pu=" +
            (_pf ? 1 : 0),
          { method: "POST" },
        );
    _r.then(function (r) {
      return r.json();
    })
      .then(function (d) {
        var x = d && d.pages && d.pages[_p],
          e = document.getElementById("pagevisits");
        if (x && e) {
          e.textContent =
            Number(x.visits || 0).toLocaleString("en-US") + " visits";
          e.hidden = false;
        }
      })
      .catch(function () {});
    sessionStorage.setItem("ob_hit", "1");
    sessionStorage.setItem("ob_hit_" + _p, "1");
    localStorage.setItem("ob_seen", "1");
    localStorage.setItem("ob_seen_" + _p, "1");
  } catch (e) {}
  loadFromHash();
  window.addEventListener("hashchange", () => {
    if (location.hash !== "#" + stateHash()) loadFromHash();
  });
  requestAnimationFrame(frame);
})();
