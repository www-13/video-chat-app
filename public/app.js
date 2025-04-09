const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const joinBtn = document.getElementById("joinBtn");

let localStream;
let peerConnection;
let socket;
let roomCode = "";

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

let candidateQueue = [];

// UI: Show input field when "Join Room" is clicked
joinRoomBtn.addEventListener("click", () => {
  document.querySelector(".room-code").style.display = "block";
});

// UI: Create Room
createRoomBtn.addEventListener("click", async () => {
  roomCode = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Room code:", roomCode);

  await start();
  socket.emit("joinRoom", roomCode);
  alert(`Room created: ${roomCode}`);
});

// UI: Join Room
joinBtn.addEventListener("click", async () => {
  roomCode = roomCodeInput.value.trim();
  if (roomCode) {
    console.log("Joining room with code:", roomCode);
    await start();
    socket.emit("joinRoom", roomCode);
  }
});

async function start() {
  socket = io();

  socket.on("connect", () => {
    console.log("Connected to server via socket:", socket.id);
  });

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection(configuration);

  // Add tracks to peer connection
  localStream.getTracks().forEach((track) =>
    peerConnection.addTrack(track, localStream)
  );

  // Send ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", {
        to: roomCode,
        signal: {
          type: "candidate",
          candidate: event.candidate,
        },
      });
    }
  };

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  socket.on("userJoined", async (socketId) => {
    console.log("User joined:", socketId);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("signal", {
      to: roomCode,
      signal: {
        type: "offer",
        sdp: offer.sdp,
      },
    });
  });

  socket.on("signal", async (data) => {
    const signal = data.signal;

    if (signal.type === "offer") {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: "offer", sdp: signal.sdp })
      );

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("signal", {
        to: roomCode,
        signal: {
          type: "answer",
          sdp: answer.sdp,
        },
      });
    }

    if (signal.type === "answer") {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: signal.sdp })
      );

      // Flush any candidates that arrived early
      candidateQueue.forEach((candidate) =>
        peerConnection.addIceCandidate(candidate)
      );
      candidateQueue = [];
    }

    if (signal.type === "candidate") {
      const iceCandidate = new RTCIceCandidate(signal.candidate);
      if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(iceCandidate);
      } else {
        candidateQueue.push(iceCandidate);
      }
    }
  });
}
