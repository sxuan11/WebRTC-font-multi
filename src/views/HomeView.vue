<script setup lang="ts">
import LocalSteam from './localSteam.vue';
import axios from "axios";
import { io, Socket } from 'socket.io-client';
import { ref } from 'vue';
import { v4 as uuid } from 'uuid';
import { ElMessage } from 'element-plus';

const instance = axios.create({
  baseURL: 'https://192.160.222.91:7070',
  timeout: 40000
})

const isHideTop = ref(false);
const hideTop = (status: boolean) => {
  isHideTop.value = status
}

const inputVal = ref('');
const room = ref('');
const nick = ref('');
const myUserId = ref(uuid());
const isJoinRoom = ref(false);
const localVideo = ref();
let userList = ref([])
let localStream: MediaStream;
const peerConnectList = new Map();

let socket: Socket;

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
 * 创建Peer
 * @param creatorUserId 发起者ID
 * @param recUserId 接收者ID
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
      video.style.setProperty('width', '400px');
      video.style.setProperty('aspect-ratio', '16 / 9');
      video.setAttribute('id', track.track.id)
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

const intoRoom = async () => {
  if (!room.value) {
    ElMessage.error('请输入房间号');
    return;
  }
  if (!nick.value) {
    ElMessage.error('请输入昵称');
    return;
  }
  if (isJoinRoom.value) {
    ElMessage.error('你已经进入了房间');
    return;
  }

  socket = io('https://192.160.222.91:7070', {
    query: {
      room: room.value,
      userId: myUserId.value,
      nick: nick.value
    }
  });

  socket.on("connection", (socket: any) => {
    console.log(socket.id); //
  });

  handlerEvent();
  isJoinRoom.value = true;

  setInterval(()=>{
    instance.get('/userlist', { params: { room: room.value }}).then((res)=>{
      userList.value = res.data
    })
  }, 1000)
}

const gotMediaStream = async (stream: MediaStream) => {
  if(!isJoinRoom.value) {
    ElMessage.error('请先加入房间，再确认');
    return;
  }

  localVideo.value.srcObject = stream;
  localStream = stream;
  hideTop(true);

  const emitList = userList.value.filter((item) => item[0] !== myUserId.value);
  for (const item of emitList) {
    const peer = await initPeer(myUserId.value, item[0]);
    await createOffer(item[0], peer);
  }
}

/**
 * 有人登录
 * @param recUserId 接收者ID
 */
async function someOneLogin(recUserId: string) {
  if(!localStream) return;
  const peer = await initPeer(myUserId.value, recUserId);
  await createOffer(recUserId, peer);
}

// rtcPeer

/**
 * 发起方创建offer
 * @param recUserId
 * @param peerConnect
 * @param stream
 */
const createOffer = async (recUserId: string, peerConnect: RTCPeerConnection, stream: MediaStream = localStream) => {
  if (!localStream) return;
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

// 一对一offer
const createOneOffer = async (loginUserId: string, peerConnect: RTCPeerConnection) => {
  if (!localStream) return;

  const offer = await peerConnect.createOffer();
  await peerConnect.setLocalDescription(offer);
  console.log('-> oneOffer', offer);

  socket.emit('oneOffer', { userId: myUserId.value, sdp: offer, loginUserId }, (res: any) => {
    console.log(res);
  });
}

/**
 * 接收方处理offer
 * @param offer
 */
const handleOffer = async (offer: { sdp: RTCSessionDescriptionInit, creatorUserId: string, recUserId: string }) => {
  const peer = await initPeer(offer.creatorUserId, offer.recUserId);
  await peer.setRemoteDescription(offer.sdp);

  const answer = await peer.createAnswer();
  console.log('-> answer', answer);
  await peer.setLocalDescription(answer);

  socket.emit('answer', { recUserId: myUserId.value, sdp: answer, creatorUserId: offer.creatorUserId }, (res: any) => {
    console.log(res);
  })
}

/**
 * 发起方处理接收方回复
 * @param data
 */
const handleAnswer = async (data: { sdp: RTCSessionDescriptionInit, recUserId: string, creatorUserId: string }) => {
  const peer = peerConnectList.get(`${data.creatorUserId}_${data.recUserId}`);
  console.log('-> handleAnswer', data);

  if (!peer) {
    console.warn('handleAnswer peer 获取失败')
    return;
  }

  await peer.setRemoteDescription(data.sdp)
}

/**
 * 处理ICE候选
 * @param data
 */
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

<template>
  <div v-if="isJoinRoom" class="header" :class="{
    'header__hide' : isHideTop,
    'header__show' : !isHideTop
  }">
    <LocalSteam @confirm="gotMediaStream"/>
  </div>
  <div v-show="isHideTop" class="showtop" @click="hideTop(false)">
    <span>﹀</span>
  </div>
  <main>
    <el-input type="text" v-model="room" placeholder="房间号" style="width: 200px;" />
    <el-input type="text" v-model="nick" placeholder="昵称" style="width: 200px;" />
    <el-button @click="intoRoom" type="success">进入房间</el-button>

    <div>
      <span>在线列表</span>
      <div v-for="(item) of userList" :key="item[0]">
        <div>{{ item[1].nick }}</div>
      </div>
    </div>
  </main>
  <div class="video">
    <video autoplay playsinline ref="localVideo" class="localVideo"></video>
    <div id="remoteVideo"></div>
  </div>
</template>

<style>
.header__hide {
  transition: height ease-in-out .4s;
  height: 0;
  overflow: hidden;
}

.header__show {
  height: 400px;
  transition: height ease-in-out .4s;
  overflow: hidden;
}

.showtop {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  cursor: pointer;
  margin: 0 auto;
  border-bottom-left-radius: 5px;
  border-bottom-right-radius: 5px;
  background-color: rgba(161, 161, 161, 0.59);
}

.showtop:hover {
  background-color: rgba(161, 161, 161, 0.95);
}

.localVideo {
  width: 400px;
  aspect-ratio: 16 / 9;
}

#remoteVideo {
  display: flex;
  width: 100vw;
  flex-wrap: wrap;
}
#remoteVideo > div {
  margin-right: 5px;
}
</style>
