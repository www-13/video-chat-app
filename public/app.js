const socket = io();

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const joinBtn = document.getElementById("joinBtn");

let localStream;
let peerConnection;
let currentRoom = null;
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

joinRoomBtn.addEventListener("click", () => {
  document.querySelector(".room-code").style.display = "block";
});

async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error("Error getting media:", err);
  }
}

createRoomBtn.addEventListener("click", async () => {
  const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
  currentRoom = roomCode;
  await getMedia();
  socket.emit('joinRoom', roomCode);
  document.querySelector(".room-code").style.display = "block";
  roomCodeInput.value = roomCode;
});

joinBtn.addEventListener("click", async () => {
  const roomCode = roomCodeInput.value.trim();
  if (roomCode) {
    currentRoom = roomCode;
    await getMedia();
    socket.emit('joinRoom', roomCode);
  }
});

socket.on('userJoined', async (userId) => {
  console.log('User joined:', userId);
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('signal', {
        to: userId,
        signal: { type: 'candidate', candidate: e.candidate }
      });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('signal', {
    to: userId,
    signal: { type: 'offer', sdp: offer }
  });
});

socket.on('signal', async ({ from, signal }) => {
  if (!peerConnection) {
    peerConnection = new RTCPeerConnection(config);

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', {
          to: from,
          signal: { type: 'candidate', candidate: e.candidate }
        });
      }
    };

    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
    };

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  if (signal.type === 'offer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('signal', {
      to: from,
      signal: { type: 'answer', sdp: answer }
    });
  } else if (signal.type === 'answer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
  } else if (signal.type === 'candidate') {
    await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }
});
