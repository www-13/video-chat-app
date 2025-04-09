const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const joinBtn = document.getElementById("joinBtn");

let localStream;
let peerConnection;
let socket;
let roomCode = '';
let isHost = false;

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

joinRoomBtn.addEventListener("click", () => {
  document.querySelector(".room-code").style.display = "block";
});

createRoomBtn.addEventListener("click", async () => {
  roomCode = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Room Code:", roomCode);
  await start(true); // isHost = true
});

joinBtn.addEventListener("click", async () => {
  roomCode = roomCodeInput.value.trim();
  if (roomCode) {
    console.log(`Joining room with code: ${roomCode}`);
    await start(false); // isHost = false
  }
});

async function start(host) {
  isHost = host;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  socket = io();

  socket.emit('joinRoom', roomCode);

  socket.on('userJoined', async (userId) => {
    console.log("User joined:", userId);
    if (isHost) {
      await createOffer();
    }
  });

  socket.on('signal', async (data) => {
    const { signal, from } = data;

    if (signal.type === 'offer') {
      await createAnswer(signal);
    } else if (signal.type === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (signal.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  });

  setupPeerConnection();
}

function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', {
        to: roomCode,
        signal: { candidate: event.candidate }
      });
    }
  };
}

async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', {
    to: roomCode,
    signal: offer
  });
}

async function createAnswer(offer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('signal', {
    to: roomCode,
    signal: answer
  });
}
