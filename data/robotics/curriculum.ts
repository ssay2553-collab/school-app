export interface CurriculumModule {
  moduleId: string;
  moduleTitle: string;
  description: string;
  estimatedWeeks: number;
  topics: string[];
}

export const ROBOTICS_CURRICULUM: CurriculumModule[] = [
  {
    moduleId: 'm1',
    moduleTitle: 'Module 1: Foundations of Robotics',
    description: 'Introduction to robotics concepts, history, and real-world applications.',
    estimatedWeeks: 2,
    topics: ['What is a Robot?', 'Parts of a Robot', 'Everyday Robotics']
  },
  {
    moduleId: 'm2',
    moduleTitle: 'Module 2: Sensors & Electronics',
    description: 'Understanding inputs, outputs, actuators, and power sources.',
    estimatedWeeks: 2,
    topics: ['Sensors & Actuators', 'Motors & Mobility', 'Power Management']
  },
  {
    moduleId: 'm3',
    moduleTitle: 'Module 3: Visual Programming & Logic',
    description: 'Block-based coding, algorithms, sequencing, and conditional logic.',
    estimatedWeeks: 3,
    topics: ['Block Coding Basics', 'Loops & Repetition', 'If-Else Conditions']
  },
  {
    moduleId: 'm4',
    moduleTitle: 'Module 4: Autonomous Navigation',
    description: 'Grid-based simulation, obstacle avoidance, and maze solving.',
    estimatedWeeks: 3,
    topics: ['Virtual Simulator', 'Pathfinding', 'Advanced Rescue Missions']
  }
];
