// AI-assisted Three.js scene. All scientific positions come from /data/sky.json.
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const vector=(a)=>new THREE.Vector3(a[0],a[2],-a[1]);
// The body meshes use native y-up coordinates P*ME. P maps (x,y,z) -> (x,z,-y).
const bodyQuaternion=(q)=>new THREE.Quaternion(-q[1],-q[3],q[2],q[0]);
export default function SpaceScene({sky,index,freeze={},view='overview',site,siteData,height=1,onReady}){
 const host=useRef(null),world=useRef(null),latest=useRef({sky,index,freeze,view,site,siteData,height});
 latest.current={sky,index,freeze,view,site,siteData,height};
 const [error,setError]=useState(null);
 useEffect(()=>{
  const el=host.current;let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,logarithmicDepthBuffer:true,powerPreference:'low-power'});}catch{setError('3D is unavailable on this device. The terrain chart and comparisons remain accessible.');return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.setClearColor('#050911');
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive lunar scene. Drag to rotate the camera, scroll to zoom. Use the named camera buttons for keyboard access.');
  const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(42,1,.00001,200000);camera.position.set(0,1.2,5.6);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=1.03;controls.maxDistance=25;
  const texture=new THREE.TextureLoader().load('/assets/moon-lroc-2k.jpg',()=>render());texture.colorSpace=THREE.SRGBColorSpace;
  const moon=new THREE.Mesh(new THREE.SphereGeometry(1,96,64),new THREE.MeshStandardMaterial({map:texture,roughness:1}));scene.add(moon);
  const earthTexture=new THREE.TextureLoader().load('/assets/earth-blue-marble-2004-03.png',()=>render());earthTexture.colorSpace=THREE.SRGBColorSpace;
  const earth=new THREE.Mesh(new THREE.SphereGeometry(.45,40,24),new THREE.MeshStandardMaterial({map:earthTexture,roughness:.8}));scene.add(earth);
  const sunMarker=new THREE.Mesh(new THREE.SphereGeometry(.1,20,16),new THREE.MeshBasicMaterial({color:'#ffda94'}));scene.add(sunMarker);
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.012,16,12),new THREE.MeshBasicMaterial({color:'#ef5258'}));scene.add(marker);
  const terrain=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:'#182232',side:THREE.DoubleSide}));scene.add(terrain);
  const light=new THREE.DirectionalLight('#fff5de',3.2);scene.add(light);scene.add(new THREE.AmbientLight('#7790b5',.025));
  const observer=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();render();});observer.observe(el);
  let previousView='',previousSite='',lookAz=0,lookEl=0,drag=null;
  function render(){
   const {sky,index,freeze,view,site,siteData,height}=latest.current;
   if(sky){
    const i=Math.max(0,Math.min(index,sky.sunPosKm.length-1));
    const mi=freeze.moonRotation??i,ei=freeze.earthPosition??i,eri=freeze.earthRotation??i,si=freeze.sunPosition??i;
    moon.quaternion.copy(bodyQuaternion(sky.moonOrientationQuat[mi]));
    earth.quaternion.copy(bodyQuaternion(sky.earthOrientationQuat[eri]));
    const ep=vector(sky.earthPosKm[ei]),sp=vector(sky.sunPosKm[si]);
    light.position.copy(sp.clone().normalize().multiplyScalar(100));
    const exact=view==='sky';
    earth.position.copy(exact?ep.divideScalar(sky.radiiKm.moon):ep.normalize().multiplyScalar(8));
    earth.scale.setScalar(exact?sky.radiiKm.earth/sky.radiiKm.moon/.45:1);
    sunMarker.position.copy(exact?sp.divideScalar(sky.radiiKm.moon):sp.normalize().multiplyScalar(12));
    sunMarker.scale.setScalar(exact?sky.radiiKm.sun/sky.radiiKm.moon/.1:1);
    let local=new THREE.Vector3(0,1,0);
    if(site){const lat=site.latitudeDeg*Math.PI/180,lon=site.longitudeEastDeg*Math.PI/180;local.set(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon));}
    marker.position.copy(local.clone().multiplyScalar(1.008).applyQuaternion(moon.quaternion));
    marker.visible=!exact;
    const Z=local.clone().applyQuaternion(moon.quaternion).normalize();
    const E=new THREE.Vector3(0,1,0).applyQuaternion(moon.quaternion).cross(Z).normalize();
    const N=Z.clone().cross(E).normalize();
    if(view!==previousView||site?.id!==previousSite){
     camera.fov=exact?20:42;camera.updateProjectionMatrix();
     if(exact){const d=earth.position.clone().sub(Z);lookAz=Math.atan2(d.dot(E),d.dot(N));lookEl=0;}
     else {controls.target.set(0,0,0);camera.up.set(0,1,0);camera.position.set(0,1.2,5.6);controls.minDistance=1.03;controls.maxDistance=25;}
     previousView=view;previousSite=site?.id;
    }
    controls.enabled=!exact;moon.visible=!exact;terrain.visible=exact&&!!siteData;
    if(exact){
     const r=1+((site?.terrainElevationM??0)+height)/(sky.radiiKm.moon*1000);
     camera.position.copy(Z.clone().multiplyScalar(r));camera.up.copy(Z);
     const dir=N.clone().multiplyScalar(Math.cos(lookEl)*Math.cos(lookAz)).addScaledVector(E,Math.cos(lookEl)*Math.sin(lookAz)).addScaledVector(Z,Math.sin(lookEl));
     camera.lookAt(camera.position.clone().add(dir));
     if(siteData){
      const horizon=siteData.horizon.elevationDeg[String(height)],vertices=[];
      function point(a,e){return N.clone().multiplyScalar(Math.cos(e)*Math.cos(a)).addScaledVector(E,Math.cos(e)*Math.sin(a)).addScaledVector(Z,Math.sin(e)).multiplyScalar(10).add(camera.position);}
      for(let j=0;j<horizon.length;j++){
       const a=j*2*Math.PI/horizon.length,b=(j+1)*2*Math.PI/horizon.length;
       const p=point(a,horizon[j]*Math.PI/180),q=point(b,horizon[(j+1)%horizon.length]*Math.PI/180),bottom=point(a,-Math.PI/2);
       vertices.push(...p.toArray(),...q.toArray(),...bottom.toArray());
      }
      terrain.geometry.dispose();terrain.geometry=new THREE.BufferGeometry();terrain.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));terrain.geometry.computeBoundingSphere();
     }
    }
   }
   if(latest.current.view!=='sky')controls.update();renderer.render(scene,camera);
  }
  const down=e=>{if(latest.current.view==='sky'){drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);}};
  const move=e=>{if(!drag)return;lookAz-=(e.clientX-drag.x)*.003;lookEl=THREE.MathUtils.clamp(lookEl+(e.clientY-drag.y)*.003,-1.4,1.4);drag={x:e.clientX,y:e.clientY};render();};
  const up=()=>{drag=null;};
  const wheel=e=>{if(latest.current.view==='sky'){e.preventDefault();camera.fov=THREE.MathUtils.clamp(camera.fov*(e.deltaY>0?1.1:.9),2,90);camera.updateProjectionMatrix();render();}};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  controls.addEventListener('change',render);
  const onLost=(e)=>{e.preventDefault();setError('3D context was interrupted. Reload the page to restore it; comparisons remain available.');};renderer.domElement.addEventListener('webglcontextlost',onLost);
  world.current={render,reset(){previousView='';render();},rotate(dx,dy){if(latest.current.view==='sky'){lookAz+=dx;lookEl=THREE.MathUtils.clamp(lookEl+dy,-1.4,1.4);}else {const offset=camera.position.clone().sub(controls.target);const s=new THREE.Spherical().setFromVector3(offset);s.theta+=dx;s.phi=THREE.MathUtils.clamp(s.phi+dy,.01,Math.PI-.01);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));}render();},zoom(f){if(latest.current.view==='sky'){camera.fov=THREE.MathUtils.clamp(camera.fov*f,2,90);camera.updateProjectionMatrix();}else camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);render();}};
  render();onReady?.();
  return()=>{observer.disconnect();controls.dispose();for(const [event,handler] of [['webglcontextlost',onLost],['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['wheel',wheel]])renderer.domElement.removeEventListener(event,handler);scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});texture.dispose();earthTexture.dispose();renderer.dispose();el.replaceChildren();world.current=null;};
 },[]);
 useEffect(()=>{world.current?.render();},[sky,index,freeze,view,site,siteData,height]);
 return <><div ref={host} className="space-canvas"/>{error?<p role="status" className="scene-error">{error}</p>:null}<div className="camera-controls" aria-label="Camera controls"><button onClick={()=>world.current?.reset()}>Reset view</button><button aria-label="Rotate camera left" onClick={()=>world.current?.rotate(-.25,0)}>Left</button><button aria-label="Rotate camera right" onClick={()=>world.current?.rotate(.25,0)}>Right</button><button aria-label="Rotate camera up" onClick={()=>world.current?.rotate(0,.15)}>Up</button><button aria-label="Rotate camera down" onClick={()=>world.current?.rotate(0,-.15)}>Down</button><button aria-label="Zoom in" onClick={()=>world.current?.zoom(.85)}>+</button><button aria-label="Zoom out" onClick={()=>world.current?.zoom(1.15)}>−</button></div></>;
}
