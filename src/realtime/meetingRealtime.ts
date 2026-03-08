import { Device } from "mediasoup-client";
import type {
  Consumer,
  DtlsParameters,
  IceCandidate,
  IceParameters,
  Producer,
  RtpCapabilities,
  SctpParameters,
  Transport,
} from "mediasoup-client/types";
import { MediaStream, registerGlobals } from "react-native-webrtc";
import type { Socket } from "socket.io-client";
import { socketManager } from "@/src/realtime/socket";

type AckSuccess<T> = {
  success: true;
  data: T;
  message?: string;
  code?: string;
};

type AckFailure = {
  success: false;
  message?: string;
  code?: string;
};

type AckResponse<T> = AckSuccess<T> | AckFailure;

type IceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

type PresenceParticipant = {
  id: string;
  displayName: string;
  avatar?: string | null;
  isHost: boolean;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing?: boolean;
  joinedAt?: string;
  lastSeenAt?: string;
  media?: {
    micOn?: boolean;
    cameraOn?: boolean;
    screenSharing?: boolean;
  };
};

type JoinRoomAck = {
  meetingId: string;
  participantId: string;
  role: "host" | "attendee";
  participants: PresenceParticipant[];
  existingProducers?: NewProducerPayload[];
};

type SocketReadyPayload = {
  userId: string;
};

type TransportOptionsPayload = {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
  sctpParameters?: SctpParameters;
};

type ProduceAck = {
  producerId: string;
};

type ConsumeAck = {
  id: string;
  producerId: string;
  kind: "audio" | "video";
  rtpParameters: Parameters<Transport["consume"]>[0]["rtpParameters"];
  participantId: string;
  appData?: {
    source?: "camera" | "screen" | "mic";
  };
  producerPaused?: boolean;
};

type NewProducerPayload = {
  producerId: string;
  userId?: string;
  participantId: string;
  kind: "audio" | "video";
  appData?: {
    source?: "camera" | "screen" | "mic";
  };
};

type ProducerClosedPayload = {
  producerId: string;
  participantId?: string;
};

type ParticipantUpdatedPayload = {
  participantId: string;
  isMicOn?: boolean;
  isCameraOn?: boolean;
  isScreenSharing?: boolean;
};

type MeetingRealtimeCallbacks = {
  onRoomJoined?: (payload: JoinRoomAck) => void;
  onParticipantJoined?: (participant: PresenceParticipant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onParticipantUpdated?: (payload: ParticipantUpdatedPayload) => void;
  onMeetingEnded?: (reason?: string) => void;
  onRemoteStreamAdded?: (payload: {
    participantId: string;
    producerId: string;
    source: "camera" | "screen" | "mic";
    stream: MediaStream;
  }) => void;
  onRemoteStreamRemoved?: (payload: {
    participantId?: string;
    producerId: string;
    source?: "camera" | "screen" | "mic";
  }) => void;
  onConnectionStateChange?: (state: "connecting" | "connected" | "reconnecting" | "disconnected" | "failed") => void;
};

type MeetingRealtimeStartOptions = {
  authToken: string;
  socketUrl?: string;
  roomId: string;
  sessionToken: string;
  routerRtpCapabilities?: RtpCapabilities;
  iceServers?: IceServer[];
  callbacks?: MeetingRealtimeCallbacks;
};

type ConsumerEntry = {
  consumer: Consumer;
  stream: MediaStream;
  participantId: string;
  source: "camera" | "screen" | "mic";
};

type LocalMediaTrack = ReturnType<MediaStream["getTracks"]>[number];

const SOCKET_ACK_TIMEOUT_MS = 15000;

async function emitAck<TResponse>(
  socket: Socket,
  event: string,
  payload?: unknown
): Promise<TResponse> {
  return await new Promise<TResponse>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${event} ack timed out`));
    }, SOCKET_ACK_TIMEOUT_MS);

    const finish = (value: unknown) => {
      clearTimeout(timeout);
      resolve(value as TResponse);
    };

    if (payload === undefined) {
      socket.emit(event, finish);
      return;
    }

    socket.emit(event, payload, finish);
  });
}

function assertAckSuccess<T>(response: AckResponse<T>, fallbackMessage: string): T {
  if (response?.success) {
    return response.data;
  }

  throw new Error(response?.message || fallbackMessage);
}

export class MeetingRealtimeController {
  private callbacks: MeetingRealtimeCallbacks;
  private socket: Socket | null = null;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private audioProducer: Producer | null = null;
  private videoProducer: Producer | null = null;
  private screenProducer: Producer | null = null;
  private consumersByProducerId = new Map<string, ConsumerEntry>();
  private localStream: MediaStream | null = null;
  private screenShareStream: MediaStream | null = null;
  private micEnabled = true;
  private cameraEnabled = true;
  private startOptions: MeetingRealtimeStartOptions | null = null;
  private reconnecting = false;
  private started = false;
  private pendingProducerIds = new Set<string>();

  constructor(callbacks: MeetingRealtimeCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async start(options: MeetingRealtimeStartOptions) {
    this.startOptions = options;
    this.callbacks = options.callbacks || this.callbacks;
    registerGlobals();
    this.callbacks.onConnectionStateChange?.("connecting");

    const socket = socketManager.connect(options.authToken, options.socketUrl);
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      if (socket.connected) {
        resolve();
        return;
      }
      const onConnect = () => {
        socket.off("connect_error", onError);
        resolve();
      };
      const onError = (error: Error) => {
        socket.off("connect", onConnect);
        reject(error);
      };
      socket.once("connect", onConnect);
      socket.once("connect_error", onError);
    });

    socket.on("socket:ready", this.handleSocketReady);
    socket.on("room:joined", this.handleRoomJoined);
    socket.on("room:participant-joined", this.handleParticipantJoined);
    socket.on("room:participant-left", this.handleParticipantLeft);
    socket.on("room:participant-updated", this.handleParticipantUpdated);
    socket.on("room:ended", this.handleRoomEnded);
    socket.on("mediasoup:newProducer", this.handleNewProducer);
    socket.on("mediasoup:producerClosed", this.handleProducerClosed);
    socket.on("disconnect", this.handleDisconnect);
    socket.on("connect", this.handleReconnectConnect);

    await this.joinRoom();
    await this.loadDeviceAndTransports();
    await this.syncProducers();
    this.started = true;
    this.callbacks.onConnectionStateChange?.("connected");
  }

  async stop() {
    this.started = false;
    if (this.socket) {
      this.socket.off("socket:ready", this.handleSocketReady);
      this.socket.off("room:joined", this.handleRoomJoined);
      this.socket.off("room:participant-joined", this.handleParticipantJoined);
      this.socket.off("room:participant-left", this.handleParticipantLeft);
      this.socket.off("room:participant-updated", this.handleParticipantUpdated);
      this.socket.off("room:ended", this.handleRoomEnded);
      this.socket.off("mediasoup:newProducer", this.handleNewProducer);
      this.socket.off("mediasoup:producerClosed", this.handleProducerClosed);
      this.socket.off("disconnect", this.handleDisconnect);
      this.socket.off("connect", this.handleReconnectConnect);
    }

    await this.closeAllConsumers();
    await this.closeProducer("mic");
    await this.closeProducer("camera");
    await this.closeProducer("screen");
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.sendTransport = null;
    this.recvTransport = null;
    this.device = null;
    this.socket = null;
    this.pendingProducerIds.clear();
    socketManager.disconnect();
  }

  async updateLocalMedia(args: {
    localStream: MediaStream | null;
    screenShareStream: MediaStream | null;
    micEnabled: boolean;
    cameraEnabled: boolean;
  }) {
    this.localStream = args.localStream;
    this.screenShareStream = args.screenShareStream;
    this.micEnabled = args.micEnabled;
    this.cameraEnabled = args.cameraEnabled;

    if (!this.started || !this.sendTransport) return;
    await this.syncProducers();
  }

  private handleSocketReady = (_payload: AckSuccess<SocketReadyPayload>) => {};

  private handleRoomJoined = (payload: JoinRoomAck) => {
    this.callbacks.onRoomJoined?.(payload);
  };

  private handleParticipantJoined = (payload: { participant: PresenceParticipant }) => {
    this.callbacks.onParticipantJoined?.(payload.participant);
  };

  private handleParticipantLeft = (payload: { participantId: string }) => {
    this.callbacks.onParticipantLeft?.(payload.participantId);
  };

  private handleParticipantUpdated = (payload: ParticipantUpdatedPayload) => {
    this.callbacks.onParticipantUpdated?.(payload);
  };

  private handleRoomEnded = (payload: { reason?: string }) => {
    this.callbacks.onMeetingEnded?.(payload.reason);
  };

  private handleDisconnect = () => {
    if (!this.started) return;
    this.callbacks.onConnectionStateChange?.("reconnecting");
  };

  private handleReconnectConnect = () => {
    if (!this.started) return;
    void this.reconnect();
  };

  private handleNewProducer = (payload: NewProducerPayload) => {
    void this.consumeProducer(payload);
  };

  private handleProducerClosed = (payload: ProducerClosedPayload) => {
    void this.removeConsumerByProducerId(payload.producerId, payload.participantId);
  };

  private async reconnect() {
    if (this.reconnecting || !this.startOptions || !this.socket?.connected) return;
    this.reconnecting = true;
    try {
      await this.closeAllConsumers();
      this.sendTransport?.close();
      this.recvTransport?.close();
      this.sendTransport = null;
      this.recvTransport = null;
      this.device = null;
      await this.joinRoom();
      await this.loadDeviceAndTransports();
      await this.syncProducers();
      this.callbacks.onConnectionStateChange?.("connected");
    } catch {
      this.callbacks.onConnectionStateChange?.("failed");
    } finally {
      this.reconnecting = false;
    }
  }

  private async joinRoom() {
    if (!this.socket || !this.startOptions) return;
    const response = await emitAck<AckResponse<JoinRoomAck>>(this.socket, "room:join", {
      roomId: this.startOptions.roomId,
      sessionToken: this.startOptions.sessionToken,
    });
    const data = assertAckSuccess(response, "Could not join realtime room.");
    this.callbacks.onRoomJoined?.(data);
    for (const producer of data.existingProducers || []) {
      void this.consumeProducer(producer);
    }
  }

  private async loadDeviceAndTransports() {
    if (!this.socket || !this.startOptions) return;

    const routerRtpCapabilities =
      this.startOptions.routerRtpCapabilities || (await this.fetchRouterCapabilities());

    const device = new Device({ handlerName: "ReactNative106" });
    await device.load({ routerRtpCapabilities });
    this.device = device;

    const sendOptions = await this.createTransport("mediasoup:createSendTransport");
    const recvOptions = await this.createTransport("mediasoup:createRecvTransport");

    this.sendTransport = device.createSendTransport({
      ...sendOptions,
      iceServers: this.startOptions.iceServers,
    });
    this.recvTransport = device.createRecvTransport({
      ...recvOptions,
      iceServers: this.startOptions.iceServers,
    });

    this.sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      void this.connectTransport("mediasoup:connectSendTransport", sendOptions.id, dtlsParameters)
        .then(callback)
        .catch((error) => errback(error as Error));
    });

    this.recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      void this.connectTransport("mediasoup:connectRecvTransport", recvOptions.id, dtlsParameters)
        .then(callback)
        .catch((error) => errback(error as Error));
    });

    this.sendTransport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
      void this.produceTrack(sendOptions.id, kind, rtpParameters, appData)
        .then(({ id }) => callback({ id }))
        .catch((error) => errback(error as Error));
    });

    this.sendTransport.on("connectionstatechange", (state) => {
      if (state === "connected") this.callbacks.onConnectionStateChange?.("connected");
      if (state === "connecting") this.callbacks.onConnectionStateChange?.("connecting");
      if (state === "failed") this.callbacks.onConnectionStateChange?.("failed");
      if (state === "disconnected") this.callbacks.onConnectionStateChange?.("reconnecting");
    });
  }

  private async fetchRouterCapabilities() {
    if (!this.socket || !this.startOptions) {
      throw new Error("Realtime socket unavailable.");
    }
    const response = await emitAck<AckResponse<{ rtpCapabilities: RtpCapabilities }>>(
      this.socket,
      "mediasoup:getRouterCapabilities",
      { roomId: this.startOptions.roomId }
    );
    return assertAckSuccess(response, "Could not fetch router capabilities.").rtpCapabilities;
  }

  private async createTransport(event: string) {
    if (!this.socket) {
      throw new Error("Realtime socket unavailable.");
    }
    const response = await emitAck<AckResponse<TransportOptionsPayload>>(this.socket, event, {});
    return assertAckSuccess(response, `Could not create transport via ${event}.`);
  }

  private async connectTransport(
    event: string,
    transportId: string,
    dtlsParameters: DtlsParameters
  ) {
    if (!this.socket) throw new Error("Realtime socket unavailable.");
    const response = await emitAck<AckResponse<Record<string, never>>>(this.socket, event, {
      transportId,
      dtlsParameters,
    });
    assertAckSuccess(response, `Could not connect transport via ${event}.`);
  }

  private async produceTrack(
    transportId: string,
    kind: string,
    rtpParameters: unknown,
    appData: unknown
  ) {
    if (!this.socket) throw new Error("Realtime socket unavailable.");
    const response = await emitAck<AckResponse<ProduceAck>>(this.socket, "mediasoup:produce", {
      transportId,
      kind,
      rtpParameters,
      appData,
    });
    const data = assertAckSuccess(response, "Could not produce track.");
    return { id: data.producerId };
  }

  private getLocalTrack(kind: "audio" | "video") {
    return this.localStream?.getTracks().find((track) => track.kind === kind) || null;
  }

  private getScreenTrack() {
    return this.screenShareStream?.getVideoTracks?.()[0] || null;
  }

  private async syncProducers() {
    if (!this.sendTransport) return;

    await this.syncSingleProducer({
      producer: this.audioProducer,
      source: "mic",
      enabled: this.micEnabled,
      track: this.getLocalTrack("audio"),
      assign: (producer) => {
        this.audioProducer = producer;
      },
    });

    await this.syncSingleProducer({
      producer: this.videoProducer,
      source: "camera",
      enabled: this.cameraEnabled,
      track: this.getLocalTrack("video"),
      assign: (producer) => {
        this.videoProducer = producer;
      },
    });

    await this.syncSingleProducer({
      producer: this.screenProducer,
      source: "screen",
      enabled: Boolean(this.getScreenTrack()),
      track: this.getScreenTrack(),
      assign: (producer) => {
        this.screenProducer = producer;
      },
    });
  }

  private async syncSingleProducer(args: {
    producer: Producer | null;
    source: "mic" | "camera" | "screen";
    enabled: boolean;
    track: LocalMediaTrack | null;
    assign: (producer: Producer | null) => void;
  }) {
    const { producer, source, enabled, track, assign } = args;

    if (!track) {
      if (producer) {
        await this.closeProducer(source);
      }
      return;
    }

    if (!producer) {
      const nextProducer = await this.sendTransport?.produce({
        track: track as unknown as MediaStreamTrack,
        stopTracks: false,
        disableTrackOnPause: false,
        appData: {
          source,
        },
      });
      assign(nextProducer || null);
      if (nextProducer && !enabled) {
        nextProducer.pause();
      }
      return;
    }

    if (producer.track?.id !== track.id) {
      await producer.replaceTrack({ track: track as unknown as MediaStreamTrack });
    }

    if (enabled && producer.paused) {
      producer.resume();
    }

    if (!enabled && !producer.paused) {
      producer.pause();
    }
  }

  private async closeProducer(source: "mic" | "camera" | "screen") {
    const producer =
      source === "mic"
        ? this.audioProducer
        : source === "camera"
          ? this.videoProducer
          : this.screenProducer;

    if (!producer) return;

    if (this.socket) {
      try {
        await emitAck<AckResponse<Record<string, never>>>(this.socket, "mediasoup:closeProducer", {
          producerId: producer.id,
        });
      } catch {
        // Ignore close-ack failures during teardown.
      }
    }

    producer.close();

    if (source === "mic") this.audioProducer = null;
    if (source === "camera") this.videoProducer = null;
    if (source === "screen") this.screenProducer = null;
  }

  private async consumeProducer(payload: NewProducerPayload) {
    if (
      !this.recvTransport ||
      !this.device ||
      this.consumersByProducerId.has(payload.producerId) ||
      this.pendingProducerIds.has(payload.producerId)
    ) {
      return;
    }

    if (!this.socket) {
      throw new Error("Realtime socket unavailable.");
    }

    this.pendingProducerIds.add(payload.producerId);

    try {
      const response = await emitAck<AckResponse<ConsumeAck>>(this.socket, "mediasoup:consume", {
        transportId: this.recvTransport.id,
        producerId: payload.producerId,
        rtpCapabilities: this.device.recvRtpCapabilities,
      });
      const data = assertAckSuccess(response, "Could not consume remote producer.");
      const consumer = await this.recvTransport.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
        appData: {
          participantId: data.participantId,
          source: data.appData?.source || payload.appData?.source || "camera",
        },
      });
      const stream = new MediaStream([consumer.track as unknown as LocalMediaTrack]);
      const source = (data.appData?.source || payload.appData?.source || "camera") as
        | "camera"
        | "screen"
        | "mic";

      this.consumersByProducerId.set(payload.producerId, {
        consumer,
        stream,
        participantId: data.participantId,
        source,
      });

      consumer.on("transportclose", () => {
        void this.removeConsumerByProducerId(payload.producerId, data.participantId);
      });
      consumer.on("trackended", () => {
        void this.removeConsumerByProducerId(payload.producerId, data.participantId);
      });

      if (source !== "mic") {
        this.callbacks.onRemoteStreamAdded?.({
          participantId: data.participantId,
          producerId: payload.producerId,
          source,
          stream,
        });
      }

      const resumeResponse = await emitAck<AckResponse<Record<string, never>>>(
        this.socket,
        "mediasoup:resumeConsumer",
        { consumerId: data.id }
      );
      assertAckSuccess(resumeResponse, "Could not resume consumer.");
      consumer.resume();
    } finally {
      this.pendingProducerIds.delete(payload.producerId);
    }
  }

  private async removeConsumerByProducerId(producerId: string, participantId?: string) {
    const entry = this.consumersByProducerId.get(producerId);
    if (!entry) return;
    entry.consumer.close();
    entry.stream.release(false);
    this.consumersByProducerId.delete(producerId);
    this.callbacks.onRemoteStreamRemoved?.({
      participantId: participantId || entry.participantId,
      producerId,
      source: entry.source,
    });
  }

  private async closeAllConsumers() {
    const producerIds = Array.from(this.consumersByProducerId.keys());
    for (const producerId of producerIds) {
      await this.removeConsumerByProducerId(producerId);
    }
  }
}
