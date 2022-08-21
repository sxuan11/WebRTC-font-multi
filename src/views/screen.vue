<template>
  <div className="screen">
    <el-button v-if="type === 'host'" @click="startScreenShare">屏幕共享</el-button>
    <el-button v-if="type === 'host'" @click="startCamera">摄像头</el-button>
    <el-input v-if="!isConnect" v-model="room"></el-input>
    <el-button v-if="!isConnect" @click="intoRoom">进入房间</el-button>
    <video v-if="type === 'host'"  autoplay ref="screenVideo" id="screenVideo"></video>
    <div id="remoteVideo"></div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { io, Socket } from 'socket.io-client';
import { useRoute } from 'vue-router'
import { onMounted, ref, } from "vue";
import { v4 as uuid } from "uuid";
const route = useRoute()
const room = ref(route.query.room);
const type = ref(route.query.type);
const myUserId = ref(uuid());
const nick = ref(Math.random());
const screenVideo = ref();
const peerConnectList = new Map();
const isConnect = ref(false);
let socket: Socket;
let screenStream: MediaStream;
let userList = ref([])
const instance = axios.create({
  baseURL: 'https://114.55.34.57:7070/',
  timeout: 40000
})

const startScreenShare = async () => {
  screenStream =  await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: {
      width: 1920,
      height: 1080,
      frameRate: 60
    }
  });
  screenVideo.value.srcObject = screenStream;
  screenVideo.value.play();
  const emitList = userList.value.filter((item) => item[0] !== myUserId.value);
  for (const item of emitList) {
    const peer = await initPeer(myUserId.value, item[0]);
    await createOffer(item[0], peer);
  }
}

const startCamera = async () => {
  screenStream = await navigator.mediaDevices.getUserMedia({ video: true , audio: true});
  screenVideo.value.srcObject = screenStream;
  screenVideo.value.play();
  const emitList = userList.value.filter((item) => item[0] !== myUserId.value);
  for (const item of emitList) {
    const peer = await initPeer(myUserId.value, item[0]);
    await createOffer(item[0], peer);
  }
}

const intoRoom = () => {
  socket = io('https://114.55.34.57:7070/', {
    query: {
      room: room.value,
      userId: myUserId.value,
      nick: nick.value
    }
  });
  handlerEvent();
  isConnect.value = true;
}

const handlerEvent = () => {
  socket.on('join', (recUserId: string)=>{
    someOneLogin(recUserId)
  })
  socket.on('offer', handleOffer)
  // socket.on('oneOffer', handleOffer)
  socket.on('answer', handleAnswer)
  socket.on('ICE-candidate', handleIce);
}

/**
 * 创建RTCPeer
 * @param creatorUserId 创建者id，本人
 * @param recUserId 接收者id
 */
const initPeer = async (creatorUserId: string, recUserId: string) => {
  const peerConnect = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]
  })

  peerConnect.onicecandidate = (candidateInfo: RTCPeerConnectionIceEvent) => {
    // console.log(peerConnect.connectionState, 'connectionState')
    // console.log(peerConnect.currentLocalDescription, 'currentLocalDescription')
    // if(!peerConnect.currentRemoteDescription) return;
    console.log('-> onicecandidate', candidateInfo);
    if (candidateInfo.candidate) {
      socket.emit('ICE-candidate', { creatorUserId, recUserId, sdp: candidateInfo.candidate }, (res: any) => {
        console.log(res);
      })
    }
  }

  peerConnect.ontrack = (track: RTCTrackEvent) => {
    const id = track.streams[0].id;
    const box = document.querySelector('#remoteVideo');
    let idBox = document.querySelector(`#PLV${ id }`)
    if (!idBox) {
      const div = document.createElement('div');
      div.setAttribute('id', `PLV${ id }`);
      box && box.appendChild(div);
      idBox = div;
    }
    if (track.track.kind === 'video') {
      const video = document.createElement('video');
      video.srcObject = track.streams[0];
      video.autoplay = true;
      video.style.setProperty('width', '100vw');
      video.style.setProperty('height', '100vh');
      video.style.setProperty('aspect-ratio', '16 / 9');
      video.setAttribute('id', track.track.id)
      video.setAttribute('auto-play', 'true')
      idBox.appendChild(video)
    }
    if (track.track.kind === 'audio') {
      const audio = document.createElement('audio');
      audio.srcObject = track.streams[0];
      audio.autoplay = true;
      audio.setAttribute('id', track.track.id)
      idBox.appendChild(audio)
    }
  }

  peerConnect.onconnectionstatechange = ev => {
    console.log(peerConnect.connectionState, 'onconnectionstatechange');
  }

  peerConnectList.set(`${creatorUserId}_${recUserId}`, peerConnect);

  return peerConnect;
}

setInterval(()=>{
  instance.get('/userlist', { params: { room: room.value }}).then((res)=>{
    userList.value = res.data
  })
}, 1000)

// 有人登录
async function someOneLogin(recUserId: string) {
  if(!screenStream) return;
  const peer = await initPeer(myUserId.value, recUserId);
  await createOffer(recUserId, peer);
}

// 发起方创建offer
const createOffer = async (recUserId: string, peerConnect: RTCPeerConnection, stream: MediaStream = screenStream) => {
  if (!screenStream) return;
  stream.getTracks().forEach((track) => {
    peerConnect.addTrack(track, stream)
  })
  const offer = await peerConnect.createOffer();
  await peerConnect.setLocalDescription(offer);
  console.log('-> offer', offer);
  socket.emit('offer', { creatorUserId: myUserId.value, sdp: offer, recUserId }, (res: any) => {
    console.log(res);
  });
}

// 发起方offer
const handleOffer = async (offer: { sdp: RTCSessionDescriptionInit, creatorUserId: string, recUserId: string }) => {
  const peer = await initPeer(offer.creatorUserId, offer.recUserId);
  console.log('-> handleOffer', offer.sdp);
  await peer.setRemoteDescription(offer.sdp);
  const answer = await peer.createAnswer();
  console.log('-> answer', answer);
  await peer.setLocalDescription(answer);
  socket.emit('answer', { recUserId: myUserId.value, sdp: answer, creatorUserId: offer.creatorUserId }, (res: any) => {
    console.log(res);
  })
}

// 应答方回复
const handleAnswer = async (data: { sdp: RTCSessionDescriptionInit, recUserId: string, creatorUserId: string }) => {
  const peer = peerConnectList.get(`${data.creatorUserId}_${data.recUserId}`);
  console.log('-> handleAnswer', data);
  if (!peer) {
    console.warn('handleAnswer peer 获取失败')
    return;
  }
  await peer.setRemoteDescription(data.sdp)
}

// ICE候选
const handleIce = async (data: { sdp: RTCIceCandidate, creatorUserId: string, recUserId: string }) => {
  const peer = peerConnectList.get(`${data.creatorUserId}_${data.recUserId}`);
  console.log('-> handleIce', data);
  if (!peer) {
    console.warn('handleIce peer 获取失败')
    return;
  }
  await peer.addIceCandidate(data.sdp)
}

</script>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
#screenVideo {
  height: 100vh;
  width: 100vw;
  object-fit: contain;
}
</style>
