"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * Diffusion caméra en direct — WebRTC, signalisation par Supabase Realtime
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Le vendeur capture sa caméra et ouvre une connexion pair-à-pair vers
 * chaque spectateur. Supabase Realtime ne transporte que la signalisation
 * (offres, réponses, candidats ICE) ; la vidéo, elle, va directement d'un
 * appareil à l'autre.
 *
 * Portée réelle de ce montage
 * ───────────────────────────
 * C'est une topologie en étoile depuis le téléphone du vendeur : il encode
 * et téléverse un flux par spectateur. Sur une connexion mobile tunisienne
 * cela tient confortablement jusqu'à ~8 spectateurs simultanés, au-delà la
 * qualité se dégrade pour tout le monde. `MAX_VIEWERS` fait donc barrage,
 * et l'interface propose alors la source Facebook, qui n'a pas cette limite.
 *
 * Pour une audience plus large sans changer d'interface, il suffit
 * d'ajouter une source `hls` alimentée par un SFU (LiveKit, Cloudflare
 * Stream) : le composant lecteur est déjà polymorphe.
 */

export const MAX_VIEWERS = 8;

/** Serveurs ICE. STUN public par défaut ; TURN si configuré (NAT symétrique). */
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }

  return servers;
}

type SignalPayload =
  | { type: "viewer-join"; from: string }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: "broadcast-end"; from: string }
  | { type: "broadcast-full"; to: string };

function channelName(liveId: string) {
  return `live-signal:${liveId}`;
}

export function randomPeerId(): string {
  return crypto.randomUUID();
}

/* ═══════════════════════════════════════════════════════════════════════
   Côté vendeur — diffuseur
   ═══════════════════════════════════════════════════════════════════════ */

export interface BroadcasterHandle {
  peerId: string;
  stream: MediaStream;
  stop: () => Promise<void>;
  switchCamera: () => Promise<void>;
  setMicEnabled: (on: boolean) => void;
  onViewerCountChange: (cb: (n: number) => void) => void;
}

export async function startBroadcast(liveId: string): Promise<BroadcasterHandle> {
  const peerId = randomPeerId();
  let facingMode: "user" | "environment" = "environment";

  // Le MediaStream reste le même objet sur toute la diffusion : la bascule
  // de caméra remplace la piste à l'intérieur, elle ne recrée pas le flux.
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } },
    audio: { echoCancellation: true, noiseSuppression: true },
  });

  const peers = new Map<string, RTCPeerConnection>();
  let viewerCountCallback: ((n: number) => void) | null = null;
  const notifyCount = () => viewerCountCallback?.(peers.size);

  const supabase = createClient();
  const channel: RealtimeChannel = supabase.channel(channelName(liveId), {
    config: { broadcast: { self: false } },
  });

  const send = (payload: SignalPayload) =>
    channel.send({ type: "broadcast", event: "signal", payload });

  async function connectViewer(viewerId: string) {
    if (peers.has(viewerId)) return;

    if (peers.size >= MAX_VIEWERS) {
      await send({ type: "broadcast-full", to: viewerId });
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    peers.set(viewerId, pc);
    notifyCount();

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void send({ type: "ice", from: peerId, to: viewerId, candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        pc.close();
        peers.delete(viewerId);
        notifyCount();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await send({ type: "offer", from: peerId, to: viewerId, sdp: offer });
  }

  channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
    const message = payload as SignalPayload;

    if (message.type === "viewer-join") {
      await connectViewer(message.from);
      return;
    }

    if (message.type === "answer" && message.to === peerId) {
      const pc = peers.get(message.from);
      // Une réponse tardive peut arriver après une renégociation : ne
      // l'appliquer que si l'on attend effectivement une réponse.
      if (pc && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
      }
      return;
    }

    if (message.type === "ice" && message.to === peerId) {
      const pc = peers.get(message.from);
      if (pc?.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        } catch {
          // Candidat obsolète après fermeture : sans conséquence.
        }
      }
    }
  });

  await channel.subscribe();

  return {
    peerId,
    stream,

    async stop() {
      await send({ type: "broadcast-end", from: peerId });
      peers.forEach((pc) => pc.close());
      peers.clear();
      stream.getTracks().forEach((track) => track.stop());
      await supabase.removeChannel(channel);
    },

    /**
     * Bascule avant/arrière. `replaceTrack` évite de renégocier : le flux ne
     * se coupe pas côté spectateurs.
     */
    async switchCamera() {
      facingMode = facingMode === "environment" ? "user" : "environment";

      const replacement = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      const newVideoTrack = replacement.getVideoTracks()[0];
      const oldVideoTrack = stream.getVideoTracks()[0];

      await Promise.all(
        [...peers.values()].map(async (pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(newVideoTrack);
        }),
      );

      if (oldVideoTrack) {
        stream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      stream.addTrack(newVideoTrack);
    },

    setMicEnabled(on: boolean) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = on;
      });
    },

    onViewerCountChange(cb) {
      viewerCountCallback = cb;
      cb(peers.size);
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Côté spectateur
   ═══════════════════════════════════════════════════════════════════════ */

export type ViewerState = "connecting" | "waiting" | "playing" | "full" | "ended" | "error";

export interface ViewerHandle {
  stop: () => Promise<void>;
}

export function joinBroadcast(
  liveId: string,
  handlers: {
    onStream: (stream: MediaStream) => void;
    onState: (state: ViewerState) => void;
  },
): ViewerHandle {
  const peerId = randomPeerId();
  const supabase = createClient();

  let pc: RTCPeerConnection | null = null;
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const channel: RealtimeChannel = supabase.channel(channelName(liveId), {
    config: { broadcast: { self: false } },
  });

  const send = (payload: SignalPayload) =>
    channel.send({ type: "broadcast", event: "signal", payload });

  function teardownPeer() {
    pc?.close();
    pc = null;
  }

  channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
    if (stopped) return;
    const message = payload as SignalPayload;

    if (message.type === "broadcast-full" && message.to === peerId) {
      handlers.onState("full");
      return;
    }

    if (message.type === "broadcast-end") {
      teardownPeer();
      handlers.onState("ended");
      return;
    }

    if (message.type === "offer" && message.to === peerId) {
      teardownPeer();

      pc = new RTCPeerConnection({ iceServers: iceServers() });

      pc.ontrack = (event) => {
        handlers.onStream(event.streams[0]);
        handlers.onState("playing");
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void send({
            type: "ice",
            from: peerId,
            to: message.from,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        if (pc.connectionState === "failed") {
          handlers.onState("error");
        } else if (pc.connectionState === "disconnected") {
          handlers.onState("waiting");
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await send({ type: "answer", from: peerId, to: message.from, sdp: answer });
      return;
    }

    if (message.type === "ice" && message.to === peerId && pc?.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
      } catch {
        // Candidat obsolète : sans conséquence.
      }
    }
  });

  void channel.subscribe(async (status) => {
    if (status !== "SUBSCRIBED" || stopped) return;

    handlers.onState("waiting");
    await send({ type: "viewer-join", from: peerId });

    // Le vendeur peut démarrer sa caméra après l'arrivée du spectateur :
    // on redemande périodiquement tant qu'aucun flux n'est reçu.
    const retry = async () => {
      if (stopped || pc) return;
      await send({ type: "viewer-join", from: peerId });
      retryTimer = setTimeout(retry, 4000);
    };
    retryTimer = setTimeout(retry, 4000);
  });

  return {
    async stop() {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      teardownPeer();
      await supabase.removeChannel(channel);
    },
  };
}
