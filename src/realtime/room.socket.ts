import { socketManager } from "@/src/realtime/socket";

type RoomMessagePayload = {
  roomId: string;
  text: string;
};

type RoomMessageListener = (payload: {
  roomId: string;
  userId: string;
  displayName: string;
  text: string;
  sentAt: string;
}) => void;

export function joinRoom(roomId: string) {
  const socket = socketManager.getSocket();
  if (!socket?.connected) return;
  socket.emit("room:join", roomId);
}

export function leaveRoom(roomId: string) {
  const socket = socketManager.getSocket();
  if (!socket?.connected) return;
  socket.emit("room:leave", roomId);
}

export function sendRoomMessage(payload: RoomMessagePayload) {
  const socket = socketManager.getSocket();
  if (!socket?.connected) return false;
  socket.emit("room:message", payload);
  return true;
}

export function onRoomMessage(listener: RoomMessageListener) {
  const socket = socketManager.getSocket();
  if (!socket) return () => {};

  socket.on("room:message", listener);
  return () => socket.off("room:message", listener);
}
