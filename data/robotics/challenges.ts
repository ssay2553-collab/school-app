export interface ChallengeLevel {
  id: number;
  title: string;
  description: string;
  checkpointX?: number;
  checkpointY?: number;
  targetX: number;
  targetY: number;
  obstacles?: Array<{ x: number; y: number }>;
  requiredCommands: string[];
  maxBlocks: number;
  points: number;
  badge: string;
  isCooperative?: boolean;
  switchX?: number;
  switchY?: number;
  gateX?: number;
  gateY?: number;
  robotBStartX?: number;
  robotBStartY?: number;
}

export const CHALLENGES: ChallengeLevel[] = [
  { id: 1, title: 'Level 1: Move Forward', description: 'Program the robot to move forward 2 steps to reach the target tile.', targetX: 3, targetY: 1, obstacles: [], requiredCommands: ['move_forward', 'move_forward', 'stop'], maxBlocks: 4, points: 50, badge: '🤖 Novice Mover' },
  { id: 2, title: 'Level 2: Simple Path', description: 'Navigate past the corner by moving forward and turning right.', targetX: 3, targetY: 3, obstacles: [{ x: 3, y: 2 }], requiredCommands: ['move_forward', 'turn_right', 'move_forward', 'stop'], maxBlocks: 5, points: 100, badge: '🧭 Pathfinder' },
  { id: 3, title: 'Level 3: Avoid Obstacles', description: 'Maneuver around the wall obstacles to reach the classroom door.', targetX: 4, targetY: 2, obstacles: [{ x: 3, y: 1 }, { x: 3, y: 2 }], requiredCommands: ['move_forward', 'turn_right', 'move_forward', 'turn_left', 'move_forward', 'stop'], maxBlocks: 7, points: 150, badge: '🛡️ Obstacle Dodger' },
  { id: 4, title: 'Level 4: Mini Maze', description: 'Navigate through the corridor maze to deliver the science kit.', targetX: 4, targetY: 4, obstacles: [{ x: 2, y: 2 }, { x: 4, y: 3 }], requiredCommands: ['move_forward', 'turn_right', 'move_forward', 'turn_right', 'move_forward', 'move_forward', 'stop'], maxBlocks: 8, points: 200, badge: '🌀 Maze Runner' },
  { id: 5, title: 'Level 5: Repeat Loop', description: 'Use repeat commands to travel a long hallway blocked by barriers.', targetX: 5, targetY: 1, obstacles: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }], requiredCommands: ['repeat_5', 'move_forward', 'stop'], maxBlocks: 4, points: 250, badge: '🔄 Loop Master' },
  { id: 6, title: 'Level 6: Conditional Logic', description: 'Use sensor checks and turns to navigate through tactical junctions.', targetX: 3, targetY: 5, obstacles: [{ x: 2, y: 3 }, { x: 4, y: 3 }], requiredCommands: ['if_obstacle', 'turn_left', 'move_forward', 'stop'], maxBlocks: 5, points: 300, badge: '💡 Logic Wizard' },
  { id: 7, title: 'Level 7: Rescue Mission (Double Destination)', description: 'First rescue the stranded item (💎) at (3,3), then deliver it to the final destination (🏫) at (5,5)!', checkpointX: 3, checkpointY: 3, targetX: 5, targetY: 5, obstacles: [{ x: 2, y: 2 }, { x: 4, y: 2 }], requiredCommands: ['move_forward', 'turn_right', 'move_forward', 'move_forward', 'turn_left', 'move_forward', 'stop'], maxBlocks: 10, points: 400, badge: '🚑 Rescue Hero' },
  { id: 8, title: 'Level 8: Master Architect', description: 'Build a complete competitive program for full labyrinth navigation.', targetX: 5, targetY: 5, obstacles: [{ x: 2, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 3 }, { x: 3, y: 1 }], requiredCommands: ['move_forward', 'turn_right', 'move_forward', 'turn_right', 'move_forward', 'turn_left', 'move_forward', 'move_forward', 'stop'], maxBlocks: 11, points: 500, badge: '🏆 Robotics Grandmaster' },

    {
      id: 9,
      title: 'Level 9: The Long Corridor',
      description: 'Navigate the long corridor, turn at the correct junction, and reach the destination without wasting commands.',
      targetX: 5,
      targetY: 3,
      obstacles: [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 2, y: 5 }],
      requiredCommands: ['move_forward', 'move_forward', 'move_forward', 'move_forward', 'turn_left', 'move_forward', 'move_forward', 'stop'],
      maxBlocks: 9,
      points: 300,
      badge: '🚀 Corridor Commander',
    },
    {
      id: 10,
      title: 'Level 10: The Four-Turn Challenge',
      description: 'Navigate a winding passage by combining left and right turns.',
      targetX: 3,
      targetY: 3,
      obstacles: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 1, y: 4 }],
      requiredCommands: ['move_forward', 'move_forward', 'turn_left', 'move_forward', 'turn_right', 'move_forward', 'turn_left', 'move_forward', 'turn_right', 'move_forward', 'stop'],
      maxBlocks: 11,
      points: 350,
      badge: '🧭 Navigation Expert',
    },
    {
      id: 11,
      title: 'Level 11: The Narrow Passage',
      description: 'The robot must navigate a narrow passage with barriers on both sides.',
      targetX: 5,
      targetY: 5,
      obstacles: [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }],
      requiredCommands: ['move_forward', 'move_forward', 'move_forward', 'move_forward', 'turn_left', 'move_forward', 'move_forward', 'move_forward', 'move_forward', 'stop'],
      maxBlocks: 10,
      points: 400,
      badge: '🧱 Barrier Breaker',
    },
    {
      id: 12,
      title: 'Level 12: The Zigzag Maze',
      description: 'Navigate a zigzag maze using alternating left and right turns.',
      targetX: 5,
      targetY: 5,
      obstacles: [{ x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 2 }, { x: 1, y: 4 }, { x: 4, y: 5 }],
      requiredCommands: ['move_forward', 'move_forward', 'turn_left', 'move_forward', 'turn_right', 'move_forward', 'turn_left', 'move_forward', 'turn_right', 'move_forward', 'move_forward', 'stop'],
      maxBlocks: 12,
      points: 450,
      badge: '🌀 Zigzag Champion',
    },
    {
      id: 13,
      title: 'Level 13: The Robot Delivery',
      description: 'Deliver a science package to the laboratory through dense barriers.',
      targetX: 4,
      targetY: 5,
      obstacles: [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 1, y: 3 }, { x: 4, y: 2 }],
      requiredCommands: ['move_forward', 'move_forward', 'move_forward', 'turn_left', 'move_forward', 'move_forward', 'move_forward', 'move_forward', 'turn_right', 'move_forward', 'stop'],
      maxBlocks: 11,
      points: 500,
      badge: '📦 Delivery Specialist',
    },
    {
      id: 14,
      title: 'Level 14: The Reverse Route (Double Destination)',
      description: 'Collect the package (📦) at (2,2) before navigating to the final destination (🏫) at (2,5)!',
      checkpointX: 2,
      checkpointY: 2,
      targetX: 2,
      targetY: 5,
      obstacles: [{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 1, y: 2 }, { x: 3, y: 5 }],
      requiredCommands: ['move_forward', 'move_forward', 'turn_left', 'move_forward', 'stop'],
      maxBlocks: 13,
      points: 550,
      badge: '🧭 Direction Master',
    },
    {
      id: 15,
      title: 'Level 15: The Loop Challenge',
      description: 'Use repeat commands to travel a long hallway blocked by heavy barriers.',
      targetX: 5,
      targetY: 1,
      obstacles: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }],
      requiredCommands: ['repeat_5', 'move_forward', 'stop'],
      maxBlocks: 4,
      points: 600,
      badge: '🔁 Loop Champion',
    },
    {
      id: 16,
      title: 'Level 16: The Sensor Mission',
      description: 'Use conditional logic and turns to navigate a heavily defended passage.',
      targetX: 5,
      targetY: 3,
      obstacles: [{ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 1, y: 3 }, { x: 5, y: 3 }, { x: 2, y: 5 }],
      requiredCommands: ['move_forward', 'move_forward', 'turn_left', 'move_forward', 'move_forward', 'turn_right', 'move_forward', 'move_forward', 'stop'],
      maxBlocks: 10,
      points: 650,
      badge: '💡 Sensor Specialist',
    },
    {
      id: 17,
      title: 'Level 17: The Broken Bridge',
      description: 'A bridge is blocked by dense barriers. Find a safe alternative route.',
      targetX: 5,
      targetY: 5,
      obstacles: [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 1, y: 2 }, { x: 5, y: 2 }, { x: 2, y: 4 }],
      requiredCommands: ['move_forward', 'move_forward', 'turn_left', 'move_forward', 'move_forward', 'move_forward', 'move_forward', 'turn_right', 'move_forward', 'move_forward', 'move_forward', 'move_forward', 'stop'],
      maxBlocks: 14,
      points: 700,
      badge: '🌉 Bridge Navigator',
    },
    {
      id: 18,
      title: 'Level 18: The Emergency Escape',
      description: 'The robot is trapped inside a high-security hazard zone.',
      targetX: 1,
      targetY: 5,
      obstacles: [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 3, y: 3 }],
      requiredCommands: ['move_forward', 'move_forward', 'move_forward', 'move_forward', 'turn_left', 'move_forward', 'move_forward', 'move_forward', 'move_forward', 'stop'],
      maxBlocks: 11,
      points: 750,
      badge: '🚨 Emergency Navigator',
    },
    {
      id: 19,
      title: 'Level 19: The Ultimate Maze',
      description: 'Navigate the ultimate multi-turn maze packed with obstacles.',
      targetX: 5,
      targetY: 5,
      obstacles: [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 3, y: 2 }, { x: 3, y: 4 }],
      requiredCommands: ['move_forward', 'move_forward', 'move_forward', 'turn_left', 'move_forward', 'move_forward', 'move_forward', 'move_forward', 'turn_right', 'move_forward', 'move_forward', 'move_forward', 'move_forward', 'stop'],
      maxBlocks: 15,
      points: 800,
      badge: '🏆 Ultimate Maze Solver',
    },
    {
      id: 20,
      title: 'Level 20: Grandmaster Double-Drop',
      description: 'Retrieve the energy core (🔋) at (2,4) and deliver it to the master laboratory (🏫) at (5,5)!',
      checkpointX: 2,
      checkpointY: 4,
      targetX: 5,
      targetY: 5,
      obstacles: [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 4, y: 3 }, { x: 3, y: 4 }],
      requiredCommands: ['move_forward', 'turn_left', 'move_forward', 'move_forward', 'stop'],
      maxBlocks: 12,
      points: 1000,
      badge: '👑 Robotics Grandmaster',
    },
];
