import { createWorld, stepWorld, DEFAULT_PARAMS, taskHorizonHrs } from '../src/sim';
const w = createWorld(7, DEFAULT_PARAMS, 'b', 'b');
for (let y=0;y<50;y++){ stepWorld(w,12); if (y%5===4) console.log(2027+y, 'horizon h', taskHorizonHrs(w.techs.ai_agents.cap).toFixed(0), 'models', w.techs.ai_models.cap.toFixed(1), 'agi', w.frontier.agi); }
