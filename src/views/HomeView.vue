<script setup lang="ts">
import LocalSteam from './localSteam.vue';
import { io, Socket } from 'socket.io-client';
import { ref } from 'vue';
import { v4 as uuid } from 'uuid';

const inputVal = ref('');
const room = ref('');
const userId = ref(uuid())
const localVideo = ref();
let stream: MediaStream;
let peerConnect: RTCPeerConnection;

let socket: Socket;

const sendMessage = () => {
  socket.emit('speak', inputVal.value, (status: any) => {
    console.log(status);
  });
}


const initPeer = () => {
  peerConnect = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]
  })

  peerConnect.onicecandidate = (candidateInfo: RTCPeerConnectionIceEvent) => {
    console.log('-> onicecandidate', candidateInfo);
    if (candidateInfo.candidate) {
      socket.emit('ICE-candidate', {userId: userId.value, sdp: candidateInfo.candidate}, (res: any) => {
        console.log(res);
      })
    }
  }

  peerConnect.ontrack = (track: RTCTrackEvent) => {
    console.log('-> ontrack', track);
    const id = track.streams[0].id;
    const box = document.querySelector('#remoteVideo');
    let idBox = document.querySelector(`#${id}`)
    if (!idBox) {
      const div = document.createElement('div');
      div.setAttribute('id', id);
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
      audio.play();
    }
  }
}

initPeer();

const intoRoom = async () => {
  // if (!room.value) {
  //   alert('请输入房间号');
  //   return;
  // }
  socket = io('http://127.0.0.1:7070', {
    query: {
      room: room.value,
      userId: userId.value,
    }
  });
  console.log('-> socket', socket);
  socket.on("connection", (socket: any) => {
    console.log(socket.id); //
  });
  handlerEvent();
}

const handlerEvent = () => {
  socket.on('offer', handleOffer)
  socket.on('answer', handleAnswer)
  socket.on('ICE-candidate', handleIce)
}

const gotMediaStream = async (stream: MediaStream) => {
  localVideo.value.srcObject = stream;
  hideTop(true);
  await createOffer(stream);
}

const isHideTop = ref(false);
const hideTop = (status: boolean) => {
  isHideTop.value = status
}


// rtcPeer

const createOffer = async (stream: MediaStream) => {
  stream.getTracks().forEach((track) => {
    peerConnect.addTrack(track, stream)
  })
  const offer = await peerConnect.createOffer();
  console.log('-> offer', offer);
  socket.emit('offer', {userId: userId.value, sdp: offer}, (res: any) => {
    console.log(res);
  });
  await peerConnect.setLocalDescription(offer);
}

const handleOffer = async (offer: { sdp: RTCSessionDescriptionInit, userId: string }) => {
  console.log('-> handleOffer', offer.sdp);
  await peerConnect.setRemoteDescription(offer.sdp);
  const answer = await peerConnect.createAnswer();
  console.log('-> answer', answer);
  await peerConnect.setLocalDescription(answer);
  socket.emit('answer', {userId: userId.value, sdp: answer}, (res: any) => {
    console.log(res);
  })
}

const handleAnswer = async (data: { sdp: RTCSessionDescriptionInit, userId: string }) => {
  console.log('-> handleAnswer', data);
  await peerConnect.setRemoteDescription(data.sdp)
}

const handleIce = async (data: { sdp: RTCIceCandidate, userId: string }) => {
  console.log('-> handleIce', data);
  await peerConnect.addIceCandidate(data.sdp)
}

</script>

<template>
  <div class="header" :class="{
    'header__hide' : isHideTop,
    'header__show' : !isHideTop
  }">
    <LocalSteam @confirm="gotMediaStream"/>
  </div>
  <div v-show="isHideTop" class="showtop" @click="hideTop(false)">
    <span>﹀</span>
  </div>
  <main>
    <input type="text" v-model="room" placeholder="房间号"/>
    <button @click="intoRoom">进入房间</button>

    <input type="text" v-model="inputVal"/>
    <button @click="sendMessage">发消息</button>
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
</style>
