// index-inline-1 02 — common
// Lines 18-363 of readable/index-inline-1.pretty.js (statement-aligned).
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
