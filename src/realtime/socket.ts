import { io, Socket } from "socket.io-client";
import { runtimeConfig } from "@/src/config/runtime";

class SocketManager {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) return this.socket;

    this.socket = io(runtimeConfig.socketUrl, {
      transports: ["websocket"],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 15000,
    });

    return this.socket;
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return Boolean(this.socket?.connected);
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }
}

export const socketManager = new SocketManager();
