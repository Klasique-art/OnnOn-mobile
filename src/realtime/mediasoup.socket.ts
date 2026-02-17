import { socketManager } from "@/src/realtime/socket";

export type RouterCapabilitiesResponse = {
  rtpCapabilities?: unknown;
  error?: string;
};

export async function getRouterCapabilities(roomId: string) {
  const socket = socketManager.getSocket();
  if (!socket?.connected) {
    return { error: "Socket not connected" } as RouterCapabilitiesResponse;
  }

  return await new Promise<RouterCapabilitiesResponse>((resolve) => {
    socket.emit("mediasoup:getRouterCapabilities", roomId, (response: RouterCapabilitiesResponse) => {
      resolve(response);
    });
  });
}
