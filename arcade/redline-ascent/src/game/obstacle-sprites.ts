import bunker from '../assets/sprites/bunker.png';
import crystal from '../assets/sprites/crystal.png';
import domeBig from '../assets/sprites/dome-big.png';
import domeMed from '../assets/sprites/dome-med.png';
import domeSmall from '../assets/sprites/dome-small.png';
import gate from '../assets/sprites/gate.png';
import relayWarden from '../assets/sprites/relay-warden.png';
import ringArch from '../assets/sprites/ring-arch.png';
import silo from '../assets/sprites/silo.png';
import tree from '../assets/sprites/tree-v2.png';

export const OBSTACLE_SPRITES: Record<string, string> = {
  bunker,
  crystal,
  'dome-big': domeBig,
  'dome-med': domeMed,
  'dome-small': domeSmall,
  gate,
  'ring-arch': ringArch,
  silo,
  tree,
};

export const RELAY_WARDEN_SPRITE = relayWarden;
