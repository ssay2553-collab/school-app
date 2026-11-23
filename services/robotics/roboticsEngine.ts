// services/robotics/roboticsEngine.ts

/**
 * EduEaz Robotics Engine
 *
 * Handles:
 * - Robot movement
 * - Left and right turns
 * - Grid boundaries
 * - Obstacles
 * - Repeat commands
 * - Conditional commands
 * - Stop commands
 * - Waiting
 * - Challenge completion checks
 */

export type Direction = "N" | "E" | "S" | "W";

export type RoboticsCommand =
  | "move_forward"
  | "turn_left"
  | "turn_right"
  | "repeat_5"
  | "if_obstacle"
  | "stop"
  | "wait";

export interface RobotPosition {
  x: number;
  y: number;
  direction: Direction;
}

export interface RoboticsStep {
  position: RobotPosition;
  action: string;
  message: string;
  delay: number;
  success: boolean;
  stopped?: boolean;
}

export interface RoboticsEngineOptions {
  gridSize?: number;
  obstacles?: Array<{ x: number; y: number }>;
  startPosition?: RobotPosition;
}

export interface RoboticsExecutionResult {
  steps: RoboticsStep[];
  finalPosition: RobotPosition;
  success: boolean;
  stopped: boolean;
  message: string;
}

const DEFAULT_POSITION: RobotPosition = {
  x: 1,
  y: 1,
  direction: "E",
};

const DEFAULT_GRID_SIZE = 5;

const DIRECTION_ORDER: Direction[] = ["N", "E", "S", "W"];

function clonePosition(position: RobotPosition): RobotPosition {
  return { ...position };
}

function getNextPosition(
  position: RobotPosition
): RobotPosition {
  const next = clonePosition(position);

  switch (position.direction) {
    case "N":
      next.y -= 1;
      break;

    case "E":
      next.x += 1;
      break;

    case "S":
      next.y += 1;
      break;

    case "W":
      next.x -= 1;
      break;
  }

  return next;
}

function isInsideGrid(
  position: RobotPosition,
  gridSize: number
): boolean {
  return (
    position.x >= 1 &&
    position.y >= 1 &&
    position.x <= gridSize &&
    position.y <= gridSize
  );
}

function isObstacle(
  position: RobotPosition,
  obstacles: Array<{ x: number; y: number }>
): boolean {
  return obstacles.some(
    obstacle =>
      obstacle.x === position.x &&
      obstacle.y === position.y
  );
}

function turnLeft(position: RobotPosition): RobotPosition {
  const currentIndex = DIRECTION_ORDER.indexOf(
    position.direction
  );

  const newIndex =
    (currentIndex + 3) % 4;

  return {
    ...position,
    direction: DIRECTION_ORDER[newIndex],
  };
}

function turnRight(position: RobotPosition): RobotPosition {
  const currentIndex = DIRECTION_ORDER.indexOf(
    position.direction
  );

  const newIndex =
    (currentIndex + 1) % 4;

  return {
    ...position,
    direction: DIRECTION_ORDER[newIndex],
  };
}

/**
 * Builds an execution plan from the student's blocks.
 *
 * repeat_5:
 * Repeats the next executable command five times.
 *
 * if_obstacle:
 * Executes the next command only when an obstacle
 * is directly in front of the robot.
 */

export function executeRoboticsProgram(
  commands: RoboticsCommand[],
  options: RoboticsEngineOptions = {}
): RoboticsExecutionResult {
  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE;

  const obstacles = options.obstacles ?? [];

  let position = clonePosition(
    options.startPosition ?? DEFAULT_POSITION
  );

  const steps: RoboticsStep[] = [];

  let stopped = false;
  let success = true;
  let message = "Program completed successfully.";

  const addStep = (
    action: string,
    description: string,
    delay = 700,
    stepSuccess = true,
    stop = false
  ) => {
    steps.push({
      position: clonePosition(position),
      action,
      message: description,
      delay,
      success: stepSuccess,
      stopped: stop,
    });
  };

  const moveForward = (): boolean => {
    const nextPosition = getNextPosition(position);

    if (!isInsideGrid(nextPosition, gridSize)) {
      addStep(
        "collision",
        "Oops! The robot cannot move outside the grid.",
        700,
        false
      );

      return false;
    }

    if (isObstacle(nextPosition, obstacles)) {
      addStep(
        "collision",
        "Obstacle detected! The robot cannot move forward.",
        700,
        false
      );

      return false;
    }

    position = nextPosition;

    addStep(
      "move_forward",
      "The robot moved forward.",
      700
    );

    return true;
  };

  const executeSingleCommand = (
    command: RoboticsCommand
  ): boolean => {
    switch (command) {
      case "move_forward":
        return moveForward();

      case "turn_left":
        position = turnLeft(position);

        addStep(
          "turn_left",
          "The robot turned left.",
          500
        );

        return true;

      case "turn_right":
        position = turnRight(position);

        addStep(
          "turn_right",
          "The robot turned right.",
          500
        );

        return true;

      case "wait":
        addStep(
          "wait",
          "The robot is waiting...",
          1500
        );

        return true;

      case "stop":
        stopped = true;

        addStep(
          "stop",
          "The robot has stopped.",
          500,
          true,
          true
        );

        return true;

      default:
        return true;
    }
  };

  const isExecutableCommand = (
    command: RoboticsCommand
  ): boolean => {
    return [
      "move_forward",
      "turn_left",
      "turn_right",
      "wait",
      "stop",
    ].includes(command);
  };

  for (let i = 0; i < commands.length; i++) {
    if (stopped || !success) break;

    const command = commands[i];

    // REPEAT N TIMES (e.g. repeat_2, repeat_3, repeat_4, repeat_5)
    if (command.startsWith("repeat_")) {
      const repeatCount = parseInt(command.replace("repeat_", "")) || 3;
      const nextCommand = commands[i + 1];

      if (
        !nextCommand ||
        !isExecutableCommand(nextCommand)
      ) {
        addStep(
          "error",
          "The repeat block needs an action after it.",
          500,
          false
        );

        success = false;
        message = "Incomplete repeat instruction.";
        break;
      }

      addStep(
        command,
        `Repeating the next instruction ${repeatCount} times.`,
        500
      );

      for (let repeat = 0; repeat < repeatCount; repeat++) {
        if (stopped || !success) break;

        success = executeSingleCommand(nextCommand);
      }

      i++;
      continue;
    }

    // IF OBSTACLE
    if (command === "if_obstacle") {
      const nextCommand = commands[i + 1];

      if (
        !nextCommand ||
        !isExecutableCommand(nextCommand)
      ) {
        addStep(
          "error",
          "The obstacle condition needs an action after it.",
          500,
          false
        );

        success = false;
        message = "Incomplete obstacle instruction.";
        break;
      }

      const nextPosition = getNextPosition(position);

      const obstacleAhead =
        !isInsideGrid(nextPosition, gridSize) ||
        isObstacle(nextPosition, obstacles);

      if (obstacleAhead) {
        addStep(
          "if_obstacle",
          "Obstacle detected! Executing the conditional instruction.",
          500
        );

        success = executeSingleCommand(nextCommand);
      } else {
        addStep(
          "if_obstacle",
          "No obstacle detected. Skipping the conditional instruction.",
          500
        );
      }

      i++;
      continue;
    }

    // NORMAL COMMAND
    success = executeSingleCommand(command);
  }

  if (!success) {
    message = "The program encountered an error.";
  } else if (stopped) {
    message = "The robot stopped successfully.";
  }

  return {
    steps,
    finalPosition: clonePosition(position),
    success,
    stopped,
    message,
  };
}

/**
 * Checks whether the robot has reached its target.
 */

export function hasReachedTarget(
  position: RobotPosition,
  target: { x: number; y: number }
): boolean {
  return (
    position.x === target.x &&
    position.y === target.y
  );
}
