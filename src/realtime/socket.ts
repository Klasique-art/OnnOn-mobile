import { io, Socket } from "socket.io-client";
import { runtimeConfig } from "@/src/config/runtime";

class SocketManager {
  private socket: Socket | null = null;
  private socketUrl: string | null = null;

  connect(token: string, socketUrl = runtimeConfig.socketUrl) {
    if (this.socket?.connected && this.socketUrl === socketUrl) return this.socket;

    if (this.socket && this.socketUrl !== socketUrl) {
      this.disconnect();
    }

    this.socketUrl = socketUrl;
    this.socket = io(socketUrl, {
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
    this.socketUrl = null;
  }
}

export const socketManager = new SocketManager();
