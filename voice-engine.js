// ============================================
// NEXUS CHAT — WebRTC Voice Engine
// Handles peer-to-peer voice communication
// ============================================

const VoiceEngine = (() => {
  // State
  let localStream = null;
  let currentChannelId = null;
  let currentUserId = null;
  const peerConnections = new Map(); // peerId -> RTCPeerConnection
  const remoteAudios = new Map();   // peerId -> HTMLAudioElement
  let isMuted = false;
  let isDeafened = false;
  let isConnected = false;

  // ICE servers for NAT traversal
  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ]
  };

  // ============ MICROPHONE ACCESS ============

  async function acquireMicrophone() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      });
      console.log('[Voice] Microphone acquired');
      return true;
    } catch (err) {
      console.error('[Voice] Microphone access denied:', err.message);
      return false;
    }
  }

  function releaseMicrophone() {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
      console.log('[Voice] Microphone released');
    }
  }

  // ============ PEER CONNECTION MANAGEMENT ============

  function createPeerConnection(peerId) {
    if (peerConnections.has(peerId)) {
      peerConnections.get(peerId).close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local audio tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming audio
    pc.ontrack = (event) => {
      console.log(`[Voice] Received audio from ${peerId}`);
      let audio = remoteAudios.get(peerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.volume = isDeafened ? 0 : 1;
        remoteAudios.set(peerId, audio);
      }
      audio.srcObject = event.streams[0];
      audio.play().catch(err => console.warn('[Voice] Audio play error:', err.message));

      // Dispatch event for UI
      window.dispatchEvent(new CustomEvent('voice:peer-audio', {
        detail: { peerId, stream: event.streams[0] }
      }));
    };

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        NexusAPI.sendIceCandidate(peerId, event.candidate, currentChannelId);
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[Voice] Peer ${peerId} connection: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        removePeer(peerId);
        window.dispatchEvent(new CustomEvent('voice:peer-disconnected', {
          detail: { peerId }
        }));
      }
      if (pc.connectionState === 'connected') {
        window.dispatchEvent(new CustomEvent('voice:peer-connected', {
          detail: { peerId }
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Voice] Peer ${peerId} ICE: ${pc.iceConnectionState}`);
    };

    peerConnections.set(peerId, pc);
    return pc;
  }

  function removePeer(peerId) {
    const pc = peerConnections.get(peerId);
    if (pc) {
      pc.close();
      peerConnections.delete(peerId);
    }
    const audio = remoteAudios.get(peerId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      remoteAudios.delete(peerId);
    }
  }

  // ============ SIGNALING ============

  async function createOffer(peerId) {
    const pc = createPeerConnection(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      NexusAPI.sendVoiceOffer(peerId, offer, currentChannelId);
      console.log(`[Voice] Sent offer to ${peerId}`);
    } catch (err) {
      console.error(`[Voice] Create offer error for ${peerId}:`, err.message);
    }
  }

  async function handleOffer(fromUserId, offer) {
    const pc = createPeerConnection(fromUserId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      NexusAPI.sendVoiceAnswer(fromUserId, answer, currentChannelId);
      console.log(`[Voice] Sent answer to ${fromUserId}`);
    } catch (err) {
      console.error(`[Voice] Handle offer error from ${fromUserId}:`, err.message);
    }
  }

  async function handleAnswer(fromUserId, answer) {
    const pc = peerConnections.get(fromUserId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`[Voice] Set answer from ${fromUserId}`);
      } catch (err) {
        console.error(`[Voice] Handle answer error from ${fromUserId}:`, err.message);
      }
    }
  }

  async function handleIceCandidate(fromUserId, candidate) {
    const pc = peerConnections.get(fromUserId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        // Ignore non-critical ICE errors
        if (!err.message.includes('end-of-candidates')) {
          console.warn(`[Voice] ICE candidate error from ${fromUserId}:`, err.message);
        }
      }
    }
  }

  // ============ JOIN / LEAVE ============

  async function joinChannel(channelId, userId) {
    // Leave current channel first
    if (isConnected && currentChannelId) {
      await leaveChannel();
    }

    currentChannelId = channelId;
    currentUserId = userId;

    // Get microphone
    const micOk = await acquireMicrophone();
    if (!micOk) {
      window.dispatchEvent(new CustomEvent('voice:error', {
        detail: { message: 'Could not access microphone. Please check permissions.' }
      }));
      return false;
    }

    isConnected = true;
    isMuted = false;
    isDeafened = false;

    // Tell server we joined
    NexusAPI.joinVoice(channelId);

    // Request list of peers already in the channel
    NexusAPI.getVoicePeers(channelId);

    console.log(`[Voice] Joined channel ${channelId}`);
    window.dispatchEvent(new CustomEvent('voice:joined', {
      detail: { channelId }
    }));

    return true;
  }

  async function leaveChannel() {
    if (!isConnected) return;

    const channelId = currentChannelId;

    // Tell server we left
    NexusAPI.leaveVoice(currentChannelId);

    // Close all peer connections
    for (const [peerId, pc] of peerConnections) {
      pc.close();
    }
    peerConnections.clear();

    // Stop all remote audio
    for (const [peerId, audio] of remoteAudios) {
      audio.srcObject = null;
      audio.remove();
    }
    remoteAudios.clear();

    // Release microphone
    releaseMicrophone();

    isConnected = false;
    currentChannelId = null;
    currentUserId = null;
    isMuted = false;
    isDeafened = false;

    console.log(`[Voice] Left channel ${channelId}`);
    window.dispatchEvent(new CustomEvent('voice:left', {
      detail: { channelId }
    }));
  }

  // ============ MUTE / DEAFEN ============

  function toggleMute() {
    isMuted = !isMuted;
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
    if (currentChannelId) {
      NexusAPI.setVoiceMute(currentChannelId, isMuted);
    }
    window.dispatchEvent(new CustomEvent('voice:mute-changed', {
      detail: { muted: isMuted }
    }));
    return isMuted;
  }

  function toggleDeafen() {
    isDeafened = !isDeafened;
    // Mute all remote audio
    for (const [peerId, audio] of remoteAudios) {
      audio.volume = isDeafened ? 0 : 1;
    }
    // Also mute self when deafened
    if (isDeafened && !isMuted) {
      isMuted = true;
      if (localStream) {
        localStream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      if (currentChannelId) {
        NexusAPI.setVoiceMute(currentChannelId, true);
      }
    }
    if (currentChannelId) {
      NexusAPI.setVoiceDeafen(currentChannelId, isDeafened);
    }
    window.dispatchEvent(new CustomEvent('voice:deafen-changed', {
      detail: { deafened: isDeafened, muted: isMuted }
    }));
    return isDeafened;
  }

  // ============ HANDLE PEER EVENTS ============

  function handlePeerJoined(peerId) {
    if (peerId === currentUserId) return;
    if (!isConnected) return;
    console.log(`[Voice] Peer joined: ${peerId}, creating offer`);
    createOffer(peerId);
  }

  function handlePeerLeft(peerId) {
    console.log(`[Voice] Peer left: ${peerId}`);
    removePeer(peerId);
  }

  function handlePeersList(peers) {
    if (!isConnected) return;
    // Connect to all existing peers in the channel
    for (const peer of peers) {
      if (peer.user_id !== currentUserId) {
        console.log(`[Voice] Connecting to existing peer: ${peer.user_id}`);
        createOffer(peer.user_id);
      }
    }
  }

  // ============ SPEAKING DETECTION ============

  function createSpeakingDetector(callback) {
    if (!localStream) return null;

    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(localStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let speaking = false;

      const interval = setInterval(() => {
        if (!isConnected) {
          clearInterval(interval);
          audioContext.close();
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const nowSpeaking = avg > 15 && !isMuted;
        if (nowSpeaking !== speaking) {
          speaking = nowSpeaking;
          callback(speaking);
        }
      }, 100);

      return { interval, audioContext };
    } catch (err) {
      console.warn('[Voice] Speaking detector error:', err.message);
      return null;
    }
  }

  // ============ PUBLIC API ============

  return {
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleDeafen,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handlePeerJoined,
    handlePeerLeft,
    handlePeersList,
    createSpeakingDetector,

    get isConnected() { return isConnected; },
    get isMuted() { return isMuted; },
    get isDeafened() { return isDeafened; },
    get channelId() { return currentChannelId; },
    get peerCount() { return peerConnections.size; },
  };
})();