//phase of the game
export type Phase = 'running' | 'gameover' | 'finished';

//constants of the game
export type Constants = Readonly<{
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  PIPE_WIDTH: number;
  TICK_RATE_MS: number;
  SPEED: number;
  BOUNCE_LB: number;
  BOUNCE_UB: number;

  BIRB_WIDTH: number;
  BIRB_HEIGHT: number;

  BIRD_X: number;
  BIRD_RADIUS: number;
  GRAVITY: number;
  FLAP_IMPULSE: number;

  KEYS: Readonly<{ flap: string; restart: string }>;
}>;

//bird state
export type Bird = Readonly<{
  y: number;
  vy: number;
  lives: number;
}>;

//entire game state
export type State = Readonly<{
  time: number;
  phase: Phase;
  bird: Bird;
  pipes: ReadonlyArray<Pipe>;
  pipeIdCounter: number;
  score: number;
  rng: number;
  pipesDone: boolean
}>;

//all possible actions that can change the state
export type Action = 
  | { type: 'tick'; dt: number}
  | { type: 'flap'}
  | { type: 'restart'}
  | { type: 'pipe_on_screen'; pipe: Omit<Pipe, 'id'>}
  | { type: 'pipe_passed'; pipeId: number }
  | { type: 'pipes_done'};

//a row from the CSV file
export type PipesMap = {
  gap_y: number; 
  gap_height: number; 
  time: number;
}

//a pipe in the game
export type Pipe = Readonly<{
  id: number; 
  x: number; 
  gap_y: number;
  gap_height: number;           
  width: number;
  passed: boolean;
}>;

//the result of a collision detection
export type Hit = 
  | {kind: 'topCanvas'; targetY: number; bounce: 'down'}
  | {kind: 'bottomCanvas'; targetY: number; bounce: 'up'}
  | {kind: 'pipeTop'; targetY: number; bounce: 'down'}
  | {kind: 'pipeBottom'; targetY: number; bounce: 'up'}