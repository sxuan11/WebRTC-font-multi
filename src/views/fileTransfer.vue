<template>
  <div>
    <div>一对一文件传输</div>
    <div>
      <div>房间号</div>
      <el-input v-model="room"></el-input>
    </div>
    <div>
      <div>昵称</div>
      <el-input v-model="nick"></el-input>
    </div>
    <el-button type="success" @click="into">进入房间</el-button>
  </div>
  <div>
    <div>聊天区</div>
    <div style="height: 100px; overflow: auto;">
      <div v-for="(item, index) of messagePool" :key="index">
        <el-text class="mx-1" type="primary">{{ item.nick }}：{{ item.message }}</el-text>
      </div>
    </div>
    <div>
      <el-input v-model="textInput" placeholder="请输入文本"></el-input>
      <el-button type="info" @click="sendMessage"> 发送</el-button>
    </div>
  </div>
  <div>
    <div>文件传输区</div>
    <div>
      <input type="file" accept @change="fileChange"/>
      <el-button type="info" @click="startTran"> 开始发送文件</el-button>
      <el-progress :text-inside="true" :stroke-width="26" :percentage="sendPercentage"/>
    </div>
    <div>接收到的文件</div>
    <div v-if="remoteFileInfo">
      <div>{{ remoteFileInfo.name }}</div>
      <el-progress :text-inside="true" :stroke-width="26" :percentage="percentage"/>
    </div>
    <div v-if="isReceived">
      <el-button type="primary" @click="mergeFile">下载文件</el-button>
    </div>
  </div>
  <div @click="getmessage">getmessage</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { v4 as uuid } from 'uuid';
import { io, Socket } from 'socket.io-client';
import { ElMessage } from 'element-plus/es'
import axios from 'axios'

const room = ref('1');
const nick = ref('nick');
const isJoinRoom = ref(false);
const uid = ref(uuid());
const socket = ref<Socket>();
let localPeer: RTCPeerConnection;
let localDatachannel: RTCDataChannel;
let remoteDatachannel: RTCDataChannel;
let fileSelect: File;
let chunkSize = 10240;
let isReceived = ref(false);
let remoteFileInfo = ref<File | undefined>();
let receiveFileBuffer: ArrayBuffer[] = [];
let receiveSize = 0;
let percentage = ref(0);
let sendPercentage = ref(0);

function getmessage() {
  console.log('-> remoteFileInfo', remoteFileInfo.value);
  console.log('-> isReceived', isReceived.value);
  console.log('-> receiveFileBuffer', receiveFileBuffer);
}

let userLists: any[] = [];
const messagePool = ref<{ nick: string, message: string }[]>([]);
const textInput = ref('')

const instance = axios.create({
  baseURL: 'http://localhost:7070',
  timeout: 40000
})

const into = () => {
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
  socket.value = io('http://127.0.0.1:7070', {
    query: {
      room: room.value,
      userId: uid.value,
      nick: nick.value
    }
  });
  isJoinRoom.value = true;
  handlerEvent();
}

const handlerEvent = () => {
  socket.value?.on('join', createOffer)
  socket.value?.on('answer', handleAnswer)
  socket.value?.on('offer', handleOffer)
  socket.value?.on('ICE-candidate', handleIce);
}

const initPeer = async (creatorUserId: string, recUserId: string) => {
  localPeer = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]
  });
  localPeer.onicecandidate = (candidateInfo: RTCPeerConnectionIceEvent) => {
    console.log('-> onicecandidate', candidateInfo);
    if (candidateInfo.candidate) {
      socket.value?.emit('ICE-candidate', { creatorUserId, recUserId, sdp: candidateInfo.candidate }, (res: any) => {
        console.log(res);
      })
    }
  }
  localPeer.ondatachannel = (ev) => {
    remoteDatachannel = ev.channel;
    remoteDatachannel.onopen = (ev) => {
      console.log('remoteDatachannel onopen', ev);
    }
    remoteDatachannel.onclose = (ev) => {
      console.log('remoteDatachannel onclose', ev);
    }
    remoteDatachannel.onmessage = (ev) => {
      // console.log('remoteDatachannel onmessage', ev);
      if (typeof ev.data === 'string') {
        const data = JSON.parse(ev.data);
        if (data.fileInfo) {
          remoteFileInfo.value = data.fileInfo;
          return;
        }
        const sendUser = userLists.filter(item => item[0] === data.uid)[0]
        messagePool.value.push({
          nick: sendUser[1].nick,
          message: data.text,
        })
      } else {
        receiveFileBuffer.push(ev.data)
        receiveSize += ev.data.byteLength;
        percentage.value = parseInt(Math.ceil((receiveSize / remoteFileInfo.value!.size) * 100).toString())
        if (receiveSize === remoteFileInfo.value?.size) {
          isReceived.value = true;
        }
      }
    }
    remoteDatachannel.onclosing = (ev) => {
      console.log('remoteDatachannel onclosing', ev);
    }
    remoteDatachannel.onbufferedamountlow = (ev) => {
      console.log('remoteDatachannel onbufferedamountlow', ev);
    }
  }
  localDatachannel = localPeer.createDataChannel('file', {
    ordered: true,
    maxRetransmits: 50
  });
  localDatachannel.onopen = (ev) => {
    console.log('onopen', ev);
  }
  localDatachannel.onclose = (ev) => {
    console.log('onclose', ev);
  }
  localDatachannel.onmessage = (ev) => {
    console.log('onmessage', ev);
  }
  localDatachannel.onclosing = (ev) => {
    console.log('onclosing', ev);
  }
  localDatachannel.onbufferedamountlow = (ev) => {
    console.log('onbufferedamountlow', ev);
  }
  setInterval(() => {
    instance.get('/userlist', { params: { room: room.value } }).then((res) => {
      userLists = res.data
    })
  }, 1000)
}

const createOffer = async (recUserId: string) => {
  await initPeer(uid.value, recUserId);
  const offer = await localPeer.createOffer();
  await localPeer.setLocalDescription(offer);
  socket.value?.emit('offer', { creatorUserId: uid.value, sdp: offer, recUserId }, (res: any) => {
    console.log(res);
  })

}

const handleAnswer = async (data: { sdp: RTCSessionDescriptionInit, recUserId: string, creatorUserId: string }) => {
  await localPeer.setRemoteDescription(data.sdp)
}

const handleOffer = async (data: { sdp: RTCSessionDescriptionInit, creatorUserId: string, recUserId: string }) => {
  await initPeer(uid.value, data.recUserId)
  await localPeer.setRemoteDescription(data.sdp);
  const answer = await localPeer.createAnswer();
  await localPeer.setLocalDescription(answer);
  socket.value?.emit('answer', { recUserId: uid.value, sdp: answer, creatorUserId: data.creatorUserId }, (res: any) => {
    console.log(res);
  })
}

const handleIce = (ICE: { sdp: RTCIceCandidate, creatorUserId: string, recUserId: string }) => {
  localPeer.addIceCandidate(ICE.sdp)
}

const sendMessage = async () => {
  localDatachannel.send(JSON.stringify({
    text: textInput.value,
    uid: uid.value,
  }));
  messagePool.value.push({
    nick: nick.value,
    message: textInput.value,
  })
  textInput.value = '';
}

const fileChange = async (ev: ProgressEvent<HTMLInputElement>) => {
  if (ev.target?.files) {
    sendPercentage.value = 0;
    console.log(ev.target.files[0], 'fileChange');
    fileSelect = ev.target.files[0]
  }
}

const startTran = async () => {
  let offset = 0;
  localDatachannel.send(JSON.stringify({
    fileInfo: {
      size: fileSelect.size,
      name: fileSelect.name
    }
  }))
  const fileReader = new FileReader()
  // fileReader.readAsArrayBuffer(fileSelect)

  fileReader.onload = (e) => {
    if (e.target?.result) {
      localDatachannel.send(e.target.result);
      offset += e.target.result?.byteLength;
      if (offset < fileSelect.size) {
        sendPercentage.value = parseInt(Math.ceil(offset / fileSelect.size * 100).toString())
        readSlice(offset);
      }
    }
  }

  const readSlice = (len: number) => {
    const slice = fileSelect.slice(offset, len + chunkSize);
    fileReader.readAsArrayBuffer(slice);
  };

  readSlice(0); // 开始读取数据
}

const mergeFile = () => {
  if (!isReceived.value) return;
  let received = new Blob(receiveFileBuffer, { type: 'application/octet-stream' });
  receiveFileBuffer = [];
  receiveSize = 0;

  let a = document.createElement('a');

  a.href = URL.createObjectURL(received);
  a.download = remoteFileInfo.value?.name || 'name';
  a.click();
  a.remove();
  isReceived.value = false;
  remoteFileInfo.value = undefined
}
</script>
