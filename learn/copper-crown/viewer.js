import * as THREE from 'three';
import {OrbitControls} from './vendor/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from './vendor/examples/jsm/loaders/GLTFLoader.js';
window.crownViewerStarted=true;
const frame=document.getElementById('viewer-frame'),poster=document.getElementById('viewer-poster'),status=document.getElementById('viewer-status'),reset=document.getElementById('reset-view'),turn=document.getElementById('turn-view'),explode=document.getElementById('explode-view');
try{
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;frame.appendChild(renderer.domElement);
 let onScreen=true;const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;}).observe(frame);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.01,1000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;if(matchMedia('(pointer: coarse)').matches)renderer.domElement.style.touchAction='pan-y';controls.minPolarAngle=.15;controls.maxPolarAngle=Math.PI*.53;
 // A small virtual studio provides broad reflections for the copper, brass and steel.
 // It is generated locally, without loading an external HDR image.
 try {
  const studio=new THREE.Scene();studio.background=new THREE.Color(0x313a35);
  const panels=[];
  function softbox(position,width,height,color,strength){
   const surface=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(strength),side:THREE.DoubleSide,toneMapped:false}));
   surface.position.set(...position);surface.lookAt(0,0,0);studio.add(surface);panels.push(surface);
  }
  softbox([-6,5,5],5.2,5.0,0xffd8aa,3.0);
  softbox([5,3,4],2.2,5.5,0xc8e5df,2.2);
  softbox([1,7,-3],6.5,3.0,0xffe2b8,2.4);
  softbox([-3,2,-6],3.0,4.0,0xa6c5bb,1.2);
  const pmrem=new THREE.PMREMGenerator(renderer),studioMap=pmrem.fromScene(studio,.04);
  scene.environment=studioMap.texture;scene.environmentIntensity=.85;
  pmrem.dispose();for(const surface of panels){surface.geometry.dispose();surface.material.dispose();}
 }catch(error){renderer.setRenderTarget(null);console.warn('Studio reflections unavailable; using direct lights.',error);}
 scene.add(new THREE.HemisphereLight(0xffedcd,0x384341,1.35));
 const key=new THREE.DirectionalLight(0xffd6a0,2.7);key.position.set(-5,8,7);scene.add(key);
 const fill=new THREE.DirectionalLight(0xb9dfd8,1.35);fill.position.set(6,5,-7);scene.add(fill);
 const front=new THREE.DirectionalLight(0xffffff,.8);front.position.set(2,3,8);scene.add(front);
 let initialPosition,initialTarget,model,selectedPart=null,span=1,exploded=false;
 const separation=[[/^00/, [0,-.14,0]],[/^01/,[-.12,0,0]],[/^02b/i,[-.12,.27,0]],[/^02/,[-.12,.12,0]],[/^03b/i,[-.26,.2,0]],[/^03c/i,[.02,.1,.2]],[/^03/,[-.04,.43,0]],[/^04/,[.14,0,0]],[/^05/,[.14,.2,0]],[/^06/,[.22,-.02,0]]];
 const groupFor={boiler:/^01/,crown:/^02 /,cap:/^02b/i,vent:/^03b/i,coil:/^03 |^04|^05/,receiver:/^06|^03c/i};
 function highlightPart(part){selectedPart=part;if(!model)return;const selected=groupFor[part];for(const group of model.children){const active=selected&&selected.test(group.name);group.traverse(node=>{if(!node.isMesh)return;for(const material of (Array.isArray(node.material)?node.material:[node.material])){if(!material.emissive)continue;if(!material.userData.originalEmissive)material.userData.originalEmissive=material.emissive.clone();material.emissive.copy(material.userData.originalEmissive);if(active)material.emissive.add(new THREE.Color(.28,.13,.035));}});}status.textContent=parts[part]?`${parts[part].title} highlighted`:'';}
 window.addEventListener('crown-part',event=>highlightPart(event.detail));
 function resize(){const w=frame.clientWidth,h=frame.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(frame);resize();
 const encodedModel=document.getElementById('copper-crown-model').textContent.trim();
 // Decode in bounded chunks so the embedded model does not require a second
 // multi-megabyte binary string. The GLB contains its own material textures.
 const padding=encodedModel.endsWith('==')?2:encodedModel.endsWith('=')?1:0;
 const modelBytes=new Uint8Array(encodedModel.length/4*3-padding);
 for(let input=0,output=0;input<encodedModel.length;input+=65536){
  const chunk=atob(encodedModel.slice(input,input+65536));
  for(let i=0;i<chunk.length;i++)modelBytes[output++]=chunk.charCodeAt(i);
 }
 // The download uses the same embedded bytes when the HTML is moved alone.
 const download=document.getElementById('download-model');
 if(download){download.href=URL.createObjectURL(new Blob([modelBytes],{type:'model/gltf-binary'}));download.download='copper-crown.glb';}
 const gltfLoader=new GLTFLoader();
 // Decode embedded texture Blob URLs through image elements, avoiding any
 // fetch of local files when the page is opened directly from disk.
 gltfLoader.register(parser=>{
  parser.textureLoader=new THREE.TextureLoader(parser.options.manager);
  parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
  return {name:'COPPER_CROWN_EMBEDDED_TEXTURES'};
 });
 gltfLoader.parse(modelBytes.buffer,'',g=>{model=g.scene;for(const group of model.children){const copies=new Map();const scoped=m=>{if(!copies.has(m))copies.set(m,m.clone());return copies.get(m);};group.traverse(node=>{if(node.isMesh)node.material=Array.isArray(node.material)?node.material.map(scoped):scoped(node.material);});}scene.add(model);if(selectedPart)highlightPart(selectedPart);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());span=Math.max(size.x,size.y,size.z);for(const group of model.children){group.userData.assembled=group.position.clone();const found=separation.find(([pattern])=>pattern.test(group.name));group.userData.separation=found?new THREE.Vector3(...found[1]).multiplyScalar(span):new THREE.Vector3();}const distance=span/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.15*Math.max(1,1/camera.aspect);camera.position.copy(center).add(new THREE.Vector3(.8,.42,.9).normalize().multiplyScalar(distance));camera.near=span/100;camera.far=span*100;camera.updateProjectionMatrix();controls.target.copy(center);controls.minDistance=span*.7;controls.maxDistance=span*8;controls.update();initialPosition=camera.position.clone();initialTarget=center.clone();poster.hidden=true;if(!selectedPart)status.textContent='3D model · ready to explore';setTimeout(()=>{if(status.textContent==='3D model · ready to explore')status.textContent='';},3500);},()=>{renderer.domElement.remove();status.textContent='3D view unavailable. The still image and film remain available.';reset.disabled=true;turn.disabled=true;explode.disabled=true;});
 reset.addEventListener('click',()=>{if(!initialPosition)return;camera.position.copy(initialPosition);controls.target.copy(initialTarget);controls.update();});explode.addEventListener('click',()=>{if(!model)return;exploded=!exploded;explode.setAttribute('aria-pressed',String(exploded));explode.textContent=exploded?'Reassemble':'Explode';camera.position.copy(initialTarget).add(initialPosition.clone().sub(initialTarget).multiplyScalar(exploded?1.5:1));controls.target.copy(initialTarget);controls.update();});turn.addEventListener('click',()=>{controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=1.4;turn.setAttribute('aria-pressed',String(controls.autoRotate));});
 function render(){requestAnimationFrame(render);if(!onScreen)return;if(model){for(const group of model.children){const target=group.userData.assembled.clone();if(exploded)target.add(group.userData.separation);group.position.lerp(target,motionPreference.matches?1:.1);}}controls.update();renderer.render(scene,camera);}render();
}catch(error){status.textContent='3D view unavailable. The still image and film remain available.';reset.disabled=true;turn.disabled=true;explode.disabled=true;}
