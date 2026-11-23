import { Lesson } from './lessons';

export const BEGINNER_TUTORIAL_LESSON: Lesson = {
  id: 'l9',
  title: 'Lesson 9: Beginner Tutorial & Your First "Hello World" Program',
  category: 'Beginner Tutorial',
  summary: 'A step-by-step beginner tutorial guiding you through writing and running your very first robot program.',
  illustrationIcon: 'play',
  content: `**LESSON 9: BEGINNER TUTORIAL & YOUR FIRST "HELLO WORLD" PROGRAM**

**1. Welcome to Robot Programming**

Welcome to your first hands-on coding tutorial!

In traditional computer programming, the very first program beginners write is called **"Hello World"**, which simply displays the words "Hello, World!" on a screen.

In **robotics**, our version of "Hello World" is commanding our robot to take its very first step forward, execute a movement, and stop safely!

**2. Understanding the EduEaz Virtual Lab**

Before writing code, let's look at your workspace:

• **The Grid Arena:** A 5x5 (or 6x6) map where your robot starts at coordinates (1, 1) facing East.
• **The Target (🏫):** The destination house or laboratory your robot needs to reach.
• **The Coding Blocks / Text Sandbox:** Where you arrange instructions in order.
• **The Simulator:** Where you test your code and watch your robot move step-by-step.

**3. Step-by-Step Tutorial: Your First "Hello World" Program**

Let's program our robot to move forward 1 step and stop:

**Step 1: Open the Coding Workspace**
Tap the **Blocks** tab at the top of the Robotics Lab. You will see the palette of available command blocks.

**Step 2: Add the Move Forward Block**
Tap the **Move Forward** block (colored blue). It will appear in your **Active Program Queue** as Step 1.

**Step 3: Add the Stop Block**
Tap the **Stop** block (colored red). It will appear in your queue as Step 2. Your program now looks like this:
1. Move Forward
2. Stop Robot

**Step 4: Test in the Simulator**
Tap the **Test in Simulator 🚀** button (or switch to the Simulator tab).

**Step 5: Run Your Program**
Tap **▶️ RUN PROGRAM**. Watch your robot move forward 1 step and successfully halt!

**4. Reading the Robot Execution Log**

As your program runs, the simulation log at the bottom displays real-time feedback:
• "Starting robot program execution..."
• "The robot moved forward."
• "The robot has stopped."
• "Program completed successfully."

**5. Summary**

Congratulations! You have just written and executed your very first robotics program ("Hello World").

In the next challenges, you will combine turns (turn_right, turn_left), loops (repeat_3), and obstacle avoidance to solve more complex mazes!`,

  architectureDetails: `TEACHER'S NOTE

For Beginners:
Guide learners through writing a 2-step program (Move Forward + Stop) and running it in the simulator.

For Upper Primary / JHS:
Emphasize the importance of sequence—ensuring the Stop block comes after movement instructions.

Interactive Practice:
Have students export their Hello World program JSON code and share it with a classmate.`,

  keyPoints: [
    'In robotics, "Hello World" is making your robot take its first programmed movement.',
    'Programs consist of instructions arranged in a sequence queue.',
    'Always include a Stop block to finish your program cleanly.',
    'Check the simulation log for real-time execution feedback.'
  ],

  quiz: {
    question: 'What is the robotics equivalent of a traditional "Hello World" program?',
    options: [
      'Making your robot take its first programmed movement and stop',
      'Turning off the computer',
      'Deleting all code blocks',
      'Changing the mascot color'
    ],
    correctIndex: 0,
    explanation: 'In robotics, writing your first basic movement program and seeing the robot execute it is your "Hello World" milestone.'
  }
};
