import { MU, circularSpeed, components, createMission, rocketBurn, impulse, propagate, burnDuration } from './apollo-flight-engine.js';
export const MISSION_KEY='grove.apollo.flight.v1';
export function newFlight(seed=Date.now()>>>0){const mission=createMission(seed);return {version:1,seed,mission,state:{...mission.initial},status:'complete',commands:[],history:[],path:[],assisted:false,awarded:false};}
export function beacon(flight,time=flight.state.t){const m=flight.mission,angle=m.targetPhase+Math.sqrt(MU/m.targetRadius**3)*time*180/Math.PI;const p=components(m.targetRadius,angle),v=components(circularSpeed(m.targetRadius),angle+90);return {x:p.x,y:p.y,vx:v.x,vy:v.y};}
export function flightMetrics(flight){const b=beacon(flight),s=flight.state;const separation=Math.hypot(s.x-b.x,s.y-b.y),relativeSpeed=Math.hypot(s.vx-b.vx,s.vy-b.vy);return {beacon:b,separation,relativeSpeed,success:flight.status!=='impact'&&separation<=25&&relativeSpeed<=.04};}
function bounded(value,min,max,label){if(!Number.isFinite(value)||value<min||value>max)throw new Error(`${label} must be between ${min} and ${max}.`);return value;}
export function planBurn(flight,{heading,throttle,duration}){bounded(heading,-36000,36000,'Bearing');bounded(throttle,.01,1,'Throttle');bounded(duration,.001,600,'Firing time (seconds)');const result=rocketBurn({...flight.state,...flight.mission.engine,throttle,duration});if(result.deltaV<=0)throw new Error('No propellant remains for this burn.');return {...result,heading};}
export function executeFlight(flight,command){
  if(flight.status==='impact')throw new Error('The spacecraft reached Earth’s surface. Undo or restart this mission.');
  if(flight.commands.length>=80)throw new Error('Flight log is full. Restart or choose a new mission.');
  const history=[...flight.history,{state:{...flight.state},status:flight.status,path:flight.path}];
  let state,path=[],status='complete',detail;
  if(command.type==='burn'){
    const burn=planBurn(flight,command);
    state=impulse(flight.state,burn.deltaV,burn.heading,flight.mission.engine).state;
    detail=`Burn ${burn.deltaV.toFixed(5)} km/s at ${((burn.heading%360+360)%360).toFixed(2)}° · ${burn.duration.toFixed(3)} s equivalent firing · ${burn.fuelUsed.toFixed(1)} kg propellant${burn.duration<command.duration-1e-8?' · dry-mass cutoff':''}.`;
  }else if(command.type==='coast'){
    bounded(command.seconds,.01,20000,'Coast time (seconds)');
    if(flight.state.t+command.seconds>172800)throw new Error('This training flight is limited to 48 hours. Start a fresh mission.');
    const result=propagate(flight.state,command.seconds,{maxStep:8});state=result.state;path=result.path;status=result.status;
    detail=`Coasted ${(state.t-flight.state.t).toFixed(2)} s${status==='impact'?' · surface impact':''}.`;
  }else throw new Error('Unknown flight command.');
  return {...flight,state,path,status,history,commands:[...flight.commands,{...command,detail}],awarded:flight.awarded};
}
export function undoFlight(flight){if(!flight.history.length)return flight;const previous=flight.history.at(-1);return {...flight,...previous,history:flight.history.slice(0,-1),commands:flight.commands.slice(0,-1)};}
/** Preview through the same command path, without changing the actual flight or log. */
export function previewFlight(flight,{burn=null,seconds=0}={}){
  let projected=flight;
  if(burn)projected=executeFlight(projected,{...burn,type:'burn'});
  // A burn-only preview needs no coast; an explicit coast must obey its limits.
  if(seconds!==0||!burn)projected=executeFlight(projected,{type:'coast',seconds});
  return {state:projected.state,path:projected.path,status:projected.status,beacon:beacon(projected)};
}
export function referencePlan(flight,throttle=1){const {mission:m}=flight;const first=impulse(m.initial,m.reference.departureDv,90,m.engine);return {departureDuration:burnDuration(m.reference.departureDv,m.initial.mass,m.engine.thrust,m.engine.isp,throttle),arrivalDuration:burnDuration(m.reference.arrivalDv,first.state.mass,m.engine.thrust,m.engine.isp,throttle),departureMass:first.state.mass,...m.reference};}
export function saveFlight(storage,flight){try{storage.setItem(MISSION_KEY,JSON.stringify({version:1,seed:flight.seed,commands:flight.commands.map(({detail,...c})=>c),assisted:flight.assisted,awarded:flight.awarded}));return true;}catch{return false;}}
export function readFlight(storage){try{const data=JSON.parse(storage.getItem(MISSION_KEY));if(data?.version!==1||!Number.isInteger(data.seed)||!Array.isArray(data.commands)||data.commands.length>80)return newFlight();let flight=newFlight(data.seed);for(const c of data.commands)flight=executeFlight(flight,c);flight.assisted=!!data.assisted;flight.awarded=!!data.awarded;return flight;}catch{return newFlight();}}
