<script setup lang="ts">
import io from 'socket.io-client';
import { ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';

const inputVal = ref('');
const room = ref('');

let socket: typeof io.Socket;

const sendMessage = () => {
  socket.emit('exchange', inputVal.value);
}

const intoRoom = () => {
  if (!room.value) {
    alert('请输入房间号');
    return;
  }
  socket = io('http://127.0.0.1:7001', {
    query: {
      room: room.value,
      userId: `user_${uuidv4()}`,
    },

    transports: ['websocket'],
  });
}
</script>

<template>
  <main>
    <input type="text" v-model="room" placeholder="房间号"/>
    <button @click="intoRoom">进入房间</button>

    <input type="text" v-model="inputVal"/>
    <button @click="sendMessage">发消息</button>
  </main>
</template>
