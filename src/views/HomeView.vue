<script setup lang="ts">
import LocalSteam from './localSteam.vue';
import io from 'socket.io-client';
import { ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';

const inputVal = ref('');
const room = ref('');
const localVideo = ref();
let stream: MediaStream;

let socket: typeof io.Socket;

const sendMessage = () => {
  socket.emit('exchange', inputVal.value);
}

const intoRoom = async () => {
  if (!room.value) {
    alert('请输入房间号');
    return;
  }
  socket = io('http://127.0.0.1:7070', {
    query: {
      room: room.value,
      userId: `user_${uuidv4()}`,
    },

    transports: ['websocket'],
  });
  stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  })
  localVideo.value.srcObject = stream;
  localVideo.value.play();
}

const gotMediaStream = (stream: MediaStream) =>{
  localVideo.value.srcObject = stream;
}
</script>

<template>
  <div class="header" v-show="">
    <LocalSteam @confirm="gotMediaStream"/>
  </div>
  <main>
    <input type="text" v-model="room" placeholder="房间号"/>
    <button @click="intoRoom">进入房间</button>

    <input type="text" v-model="inputVal"/>
    <button @click="sendMessage">发消息</button>
  </main>
  <div class="video">
    <video autoplay playsinline ref="localVideo" class="localVideo"></video>
  </div>
</template>

<style>
.header {
  height: 400px;
}
.localVideo {
  width: 400px;
  aspect-ratio: 16 / 9;
}
</style>
