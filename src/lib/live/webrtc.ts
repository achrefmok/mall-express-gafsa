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
  /* Le spectateur s'en va, ou repart de zéro après un échec. Sans ce message,
     le diffuseur gardait sa connexion morte en mémoire et ignorait la nouvelle
     demande — le spectateur restait alors sur un écran noir définitif. */
  | { type: "viewer-leave"; from: string }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: "broadcast-end"; from: string }
  | { type: "broadcast-full"; to: string };

/* ═══════════════════════════════════════════════════════════════════════
   Candidats ICE — mise en file
   ═══════════════════════════════════════════════════════════════════════

   `addIceCandidate` échoue tant que la description distante n'est pas posée.
   L'ancien code se contentait alors de jeter le candidat.

   Or l'ordre d'arrivée n'est pas garanti : la signalisation passe par un canal
   Supabase, et les candidats du diffuseur partent dès `setLocalDescription`,
   donc souvent avant que le spectateur ait fini de traiter l'offre. Sur une
   même machine ou un même réseau local, la connexion aboutissait quand même
   grâce aux candidats d'hôte, qui suffisent — ce qui donnait l'illusion que
   tout marchait sur PC. Depuis un téléphone, les candidats réellement utiles
   sont ceux qui arrivent tôt, et les perdre laisse la connexion sans issue :
   vidéo jamais reçue, écran noir.

   On les garde donc en file, et on les applique dès la description posée. */

async function addOrQueueCandidate(
  pc: RTCPeerConnection,
  candidate: RTCIceCandidateInit,
  queue: RTCIceCandidateInit[],
) {
  if (!pc.remoteDescription) {
    queue.push(candidate);
    return;
  }
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch {
    // Candidat obsolète après fermeture : sans conséquence.
  }
}

async function flushCandidates(pc: RTCPeerConnection, queue: RTCIceCandidateInit[]) {
  const waiting = queue.splice(0, queue.length);
  for (const candidate of waiting) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Idem : un candidat périmé ne compromet pas les autres.
    }
  }
}

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
  const pendingIce = new Map<string, RTCIceCandidateInit[]>();
  let viewerCountCallback: ((n: number) => void) | null = null;
  const notifyCount = () => viewerCountCallback?.(peers.size);

  function dropViewer(viewerId: string) {
    peers.get(viewerId)?.close();
    peers.delete(viewerId);
    pendingIce.delete(viewerId);
    notifyCount();
  }

  const supabase = createClient();
  const channel: RealtimeChannel = supabase.channel(channelName(liveId), {
    config: { broadcast: { self: false } },
  });

  const send = (payload: SignalPayload) =>
    channel.send({ type: "broadcast", event: "signal", payload });

  async function connectViewer(viewerId: string) {
    const existing = peers.get(viewerId);
    if (existing) {
      /*
        Une connexion déjà morte ne doit pas bloquer une nouvelle tentative.
        L'ancien code renvoyait dès que le spectateur était connu, donc un
        spectateur dont la connexion avait échoué ne pouvait plus jamais
        revenir : il redemandait, et le diffuseur l'ignorait indéfiniment.
      */
      if (existing.connectionState !== "failed" && existing.connectionState !== "closed") return;
      dropViewer(viewerId);
    }

    if (peers.size >= MAX_VIEWERS) {
      await send({ type: "broadcast-full", to: viewerId });
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    peers.set(viewerId, pc);
    pendingIce.set(viewerId, []);
    notifyCount();

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void send({ type: "ice", from: peerId, to: viewerId, candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      /*
        Ne rien fermer si cette connexion a déjà été remplacée : un spectateur
        qui revient après un échec en ouvre une neuve sous le même identifiant,
        et l'ancienne, en passant à « closed », fermerait sa remplaçante.
      */
      if (peers.get(viewerId) !== pc) return;

      /*
        `disconnected` est le plus souvent passager — un changement de réseau,
        un tunnel, une antenne qui bascule. Le fermer aussitôt, comme avant,
        condamnait un spectateur pour deux secondes d'interruption, sur une
        plateforme qui vise justement des connexions irrégulières. On attend
        `failed`, qui est l'échec définitif prononcé par le navigateur.
      */
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        dropViewer(viewerId);
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

    if (message.type === "viewer-leave") {
      dropViewer(message.from);
      return;
    }

    if (message.type === "answer" && message.to === peerId) {
      const pc = peers.get(message.from);
      // Une réponse tardive peut arriver après une renégociation : ne
      // l'appliquer que si l'on attend effectivement une réponse.
      if (pc && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        // La description est posée : les candidats mis de côté deviennent
        // applicables.
        await flushCandidates(pc, pendingIce.get(message.from) ?? []);
      }
      return;
    }

    if (message.type === "ice" && message.to === peerId) {
      const pc = peers.get(message.from);
      if (!pc) return;

      let queue = pendingIce.get(message.from);
      if (!queue) {
        queue = [];
        pendingIce.set(message.from, queue);
      }
      await addOrQueueCandidate(pc, message.candidate, queue);
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
      pendingIce.clear();
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

/** Négociations ratées tolérées avant d'annoncer l'échec au spectateur. */
const FAILURES_BEFORE_ERROR = 3;

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
  let receiving = false;
  let failures = 0;
  let pendingIce: RTCIceCandidateInit[] = [];
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const channel: RealtimeChannel = supabase.channel(channelName(liveId), {
    config: { broadcast: { self: false } },
  });

  const send = (payload: SignalPayload) =>
    channel.send({ type: "broadcast", event: "signal", payload });

  function teardownPeer() {
    pc?.close();
    pc = null;
    pendingIce = [];
    receiving = false;
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

      const connection = new RTCPeerConnection({ iceServers: iceServers() });
      pc = connection;

      connection.ontrack = (event) => {
        /*
          `event.streams` est vide si le diffuseur a ajouté ses pistes sans les
          associer à un flux. On reconstruit alors le flux à partir de la piste
          reçue, plutôt que de passer `undefined` à la balise vidéo — ce qui
          laissait un écran noir sans le moindre message.
        */
        const media = event.streams[0] ?? new MediaStream([event.track]);
        receiving = true;
        handlers.onStream(media);
        handlers.onState("playing");
      };

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          void send({
            type: "ice",
            from: peerId,
            to: message.from,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      connection.onconnectionstatechange = () => {
        if (stopped || pc !== connection) return;

        if (connection.connectionState === "failed") {
          /*
            Échec définitif de la négociation. On prévient le diffuseur pour
            qu'il oublie cette connexion, on démonte la nôtre, et la boucle de
            reprise redemandera une offre fraîche.

            Sans serveur TURN configuré, c'est ici que se termine la route pour
            un spectateur en données mobiles : les deux pairs sont derrière un
            NAT que le STUN seul ne traverse pas.

            Le message d'échec n'apparaît qu'après plusieurs tentatives. Une
            première négociation ratée se rattrape souvent — annoncer aussitôt
            « connexion impossible » pour la voir disparaître deux secondes plus
            tard apprend au spectateur à ne plus lire nos messages.
          */
          failures += 1;
          void send({ type: "viewer-leave", from: peerId });
          teardownPeer();
          handlers.onState(failures >= FAILURES_BEFORE_ERROR ? "error" : "connecting");
        } else if (connection.connectionState === "disconnected") {
          // Passager la plupart du temps : on le signale sans rien démonter.
          receiving = false;
          handlers.onState("waiting");
        } else if (connection.connectionState === "connected") {
          receiving = true;
          failures = 0; // la route est bonne : on repart d'une ardoise nette
        }
      };

      await connection.setRemoteDescription(new RTCSessionDescription(message.sdp));
      await flushCandidates(connection, pendingIce);

      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await send({ type: "answer", from: peerId, to: message.from, sdp: answer });
      return;
    }

    if (message.type === "ice" && message.to === peerId && pc) {
      await addOrQueueCandidate(pc, message.candidate, pendingIce);
    }
  });

  void channel.subscribe(async (status) => {
    if (status !== "SUBSCRIBED" || stopped) return;

    handlers.onState("waiting");
    await send({ type: "viewer-join", from: peerId });

    /*
      Battement de reprise.

      Le vendeur peut démarrer sa caméra après l'arrivée du spectateur, d'où la
      demande répétée. Mais l'ancienne boucle s'arrêtait dès qu'une connexion
      existait — `if (stopped || pc) return` — et ne repartait jamais. Une
      connexion qui échouait ensuite condamnait donc le spectateur à un écran
      noir jusqu'au rechargement de la page.

      La boucle tourne maintenant tant que rien n'est reçu, quelle qu'en soit la
      raison : diffuseur pas encore prêt, négociation échouée, réseau retombé.
      Le diffuseur ignore une demande venant d'un spectateur déjà connecté, donc
      ce battement ne coûte rien quand tout va bien.
    */
    const heartbeat = async () => {
      if (stopped) return;
      if (!receiving) await send({ type: "viewer-join", from: peerId });
      retryTimer = setTimeout(heartbeat, 4000);
    };
    retryTimer = setTimeout(heartbeat, 4000);
  });

  return {
    async stop() {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      // Prévenir le diffuseur : son compteur de spectateurs reste juste, et il
      // n'encombre pas ses places avec une connexion qui n'existe plus.
      await send({ type: "viewer-leave", from: peerId }).catch(() => undefined);
      teardownPeer();
      await supabase.removeChannel(channel);
    },
  };
}
