// /utils/ChatMemory.ts
export type ChatMessage = {
  id: string;
  sender: "admin" | "parent";
  text?: string;
  audioUri?: string;
  time: string;
};

type ChatThread = {
  [parentId: string]: ChatMessage[];
};

class ChatMemory {
  private static instance: ChatMemory;
  private threads: ChatThread = {};

  static getInstance() {
    if (!ChatMemory.instance) {
      ChatMemory.instance = new ChatMemory();
    }
    return ChatMemory.instance;
  }

  getMessages(parentId: string) {
    return this.threads[parentId] || [];
  }

  addMessage(parentId: string, message: ChatMessage) {
    if (!this.threads[parentId]) this.threads[parentId] = [];
    this.threads[parentId].push(message);
  }

  clearMessages(parentId: string) {
    delete this.threads[parentId];
  }

  clearAll() {
    this.threads = {};
  }
}

export const chatMemory = ChatMemory.getInstance();
