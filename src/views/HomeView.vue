<script setup lang="ts">
import LocalSteam from './localSteam.vue';
import * as echarts from 'echarts';
import axios from "axios";
import { io, Socket } from 'socket.io-client';
import { ref, reactive } from 'vue';
import { v4 as uuid } from 'uuid';
import { ElMessage } from 'element-plus'

const instance = axios.create({
  baseURL: 'http://localhost:7070',
  timeout: 40000
})

const isHideTop = ref(false);
const hideTop = (status: boolean) => {
  isHideTop.value = status
}

const inputVal = ref('');
const room = ref('1');
const nick = ref('asda');
const myUserId = ref(uuid());
const isAddTrack = ref(false);
const isJoinRoom = ref(false);
const localVideo = ref();
let userList = ref([])
let localStream: MediaStream;
const peerConnectList = new Map();
let creatorUserId1: string, recUserId1: string
let remoteEnable = true;
let localEnable = true;
// 存储统计数据
let lastData: Record<string, any>;
let myChartWidth: any;
let myChartHeight: any;
let myChartFrame: any;
const data = {
  time: [] as Array<number>,
  delay: [] as Array<number>,
  width: [] as Array<number>,
  height: [] as Array<number>,
  frame: [] as Array<number>,
}

let socket: Socket;

const sendMessage = () => {
  socket.emit('speak', inputVal.value, (status: any) => {
    console.log(status);
  });
}
const muteRemoteVideo = () => {
  const peer = peerConnectList.get(`${creatorUserId1}_${recUserId1}`);
  const getReceivers = peer.getReceivers();
  let video = peer.getReceivers().find((receiver: RTCRtpReceiver) => receiver.track.kind === 'video');
  video.track.enabled = !remoteEnable;
  remoteEnable = !remoteEnable;
}

const muteLocalVideo = () => {
  localStream.getVideoTracks()[0].enabled = !localEnable;
  localEnable = !localEnable
  // const track = localStream.getVideoTracks()[0];
  // track.stop();
}

const getStatus = () => {
  draw();
  const peer: RTCPeerConnection = peerConnectList.get(`${creatorUserId1}_${recUserId1}`);
  const getReceivers = peer.getReceivers();
  let video = peer.getReceivers().find((receiver: RTCRtpReceiver) => receiver.track.kind === 'video');
  // 获取统计数据
  setInterval(() => {
    peer.getStats(video?.track).then(stats => {
      stats.forEach(report => {
        // 统计发送流和接收流
        if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
          // 获取音频相关的统计信息
          let audioCodec = report.codecId;
          let audioBitrate = Math.round(report.bytesReceived * 8 / (report.timestamp - lastData.timestamp));
          let audioPacketLoss = report.packetsLost / report.packetsReceived * 100;
          let audioJitter = report.jitter;

          // console.log('Audio codec: ' + audioCodec);
          // console.log('Audio bitrate: ' + audioBitrate + ' kbps');
          // console.log('Audio packet loss: ' + audioPacketLoss + '%');
          // console.log('Audio jitter: ' + audioJitter + ' ms');

        }
        else if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          let videoBitrate = Math.round(report.bytesReceived * 8 / (report.timestamp - lastData?.timestamp));
          let videoPacketLoss = report.packetsLost / report.packetsReceived * 100;
          let videoFrameRate = report.framesPerSecond;
          let videoDelay = report.totalProcessingDelay - lastData?.totalProcessingDelay;
          let videoWidth = report.frameWidth;
          let videoHeight = report.frameHeight;

          console.log('Video resolution: ' + videoWidth + 'x' + videoHeight);
          console.log('Video frame rate: ' + videoFrameRate + ' fps');
          console.log('Video delay: ' + videoDelay + ' ms');
          console.log('Video packet loss: ' + videoPacketLoss + '%');
          console.log('Video bitrate: ' + videoBitrate + ' kbps');
          lastData = report;
          data.time.push(report.timestamp);
          data.delay.push(videoDelay);
          data.width.push(videoWidth);
          data.height.push(videoHeight);
          data.frame.push(videoFrameRate);
          myChartWidth.setOption({
            xAxis: {
              data: data.time
            },
            series: [
              {
                name: '宽度',
                data: data.width
              }
            ]
          });
          myChartHeight.setOption({
            xAxis: {
              data: data.time
            },
            series: [
              {
                name: '高度',
                data: data.height
              }
            ]
          });
          myChartFrame.setOption({
            xAxis: {
              data: data.time
            },
            series: [
              {
                name: '帧率',
                data: data.frame
              }
            ]
          });
        }
      });
      // console.log(statsData, 'statsData');
    });
  }, 1000);
}

const getlocalStatus = () => {
  const peer: RTCPeerConnection = peerConnectList.get(`${userList.value[1][0]}_${userList.value[0][0]}`);
  // 获取统计数据
  // setInterval(() => {
  // peer.getStats().then(stats => {
  //     stats.forEach(report => {
  //       // 统计发送流和接收流
  //       if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
  //         console.log('-> report', report);
  //         // 获取音频相关的统计信息
  //         let audioCodec = report.codecId;
  //         let audioBitrate = Math.round(report.bytesReceived * 8 / (report.timestamp - lastTimestamp));
  //         let audioPacketLoss = report.packetsLost / report.packetsReceived * 100;
  //         let audioJitter = report.jitter;
  //
  //         // console.log('Audio codec: ' + audioCodec);
  //         // console.log('Audio bitrate: ' + audioBitrate + ' kbps');
  //         // console.log('Audio packet loss: ' + audioPacketLoss + '%');
  //         // console.log('Audio jitter: ' + audioJitter + ' ms');
  //
  //       }
  //       else if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
  //         console.log('-> report video', report);
  //         // 获取视频相关的统计信息
  //         let videoCodec = report.codecId;
  //         let videoBitrate = Math.round(report.bytesReceived * 8 / (report.timestamp - lastTimestamp));
  //         let videoPacketLoss = report.packetsLost / report.packetsReceived * 100;
  //         let videoFrameRate = report.framesDecoded / (report.timestamp - lastTimestamp) * 1000;
  //         let videoDelay = report.jitterBufferDelay;
  //         let videoWidth = report.frameWidth;
  //         let videoHeight = report.frameHeight;
  //
  //         // console.log('Video codec: ' + videoCodec);
  //         // console.log('Video bitrate: ' + videoBitrate + ' kbps');
  //         // console.log('Video packet loss: ' + videoPacketLoss + '%');
  //         // console.log('Video frame rate: ' + videoFrameRate.toFixed(2) + ' fps');
  //         // console.log('Video delay: ' + videoDelay + ' frames');
  //         // console.log('Video resolution: ' + videoWidth + 'x' + videoHeight);
  //         lastTimestamp = report.timestamp;
  //       }
  //     });
  //     // console.log(statsData, 'statsData');
  //   });
  // }, 1000);
  peer.getSenders()[0].getStats().then(stats => {
    stats.forEach(item => {
      console.log(item, 'RTCReceivedRtpStreamStats')
    })
  })
}

const draw = () => {
  myChartWidth = echarts.init(document.querySelector('#width')!);
  myChartWidth.setOption({
    title: {
      text: '下行宽度'
    },
    tooltip: {},
    xAxis: {
      data: []
    },
    yAxis: {},
    series: [
      {
        name: '宽度',
        type: 'line',
        data: []
      }
    ]
  });
  myChartHeight = echarts.init(document.querySelector('#height')!);
  myChartHeight.setOption({
    title: {
      text: '下行高度'
    },
    tooltip: {},
    xAxis: {
      data: []
    },
    yAxis: {},
    series: [
      {
        name: '高度',
        type: 'line',
        data: []
      }
    ]
  });
  myChartFrame = echarts.init(document.querySelector('#frame')!);
  myChartFrame.setOption({
    title: {
      text: '下行帧率'
    },
    tooltip: {},
    xAxis: {
      data: []
    },
    yAxis: {},
    series: [
      {
        name: '帧率',
        type: 'line',
        data: []
      }
    ]
  });
}

const initPeer = async (creatorUserId: string, recUserId: string) => {
  const peerConnect = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]
  })
  creatorUserId1 = creatorUserId
  recUserId1= recUserId
  peerConnect.onicecandidate = (candidateInfo: RTCPeerConnectionIceEvent) => {
    console.log('-> onicecandidate', candidateInfo);
    if (candidateInfo.candidate) {
      socket.emit('ICE-candidate', { creatorUserId, recUserId, sdp: candidateInfo.candidate }, (res: any) => {
        console.log(res);
      })
    }
  }

  peerConnect.ontrack = (stream: RTCTrackEvent) => {
    const id = stream.streams[0].id;
    const box = document.querySelector('#remoteVideo');
    let idBox = document.querySelector(`#PLV${ id }`)
    if (!idBox) {
      const div = document.createElement('div');
      div.setAttribute('id', `PLV${ id }`);
      box && box.appendChild(div);
      idBox = div;
    }
    if (stream.track.kind === 'video') {
      const video = document.createElement('video');
      video.srcObject = stream.streams[0];
      video.autoplay = true;
      video.style.setProperty('width', '400px');
      video.style.setProperty('aspect-ratio', '16 / 9');
      video.setAttribute('id', stream.track.id)
      idBox.appendChild(video)
    }
    if (stream.track.kind === 'audio') {
      const audio = document.createElement('audio');
      audio.srcObject = stream.streams[0];
      audio.autoplay = true;
      audio.setAttribute('id', stream.track.id)
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
  if(isJoinRoom.value) {
    ElMessage.error('你已经进入了房间');
    return;
  }
  socket = io('http://127.0.0.1:7070', {
    query: {
      room: room.value,
      userId: myUserId.value,
      nick: nick.value
    }
  });
  console.log('-> socket', socket);
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

const handlerEvent = () => {
  socket.on('join', (recUserId: string)=>{
    someOneLogin(recUserId)
  })
  socket.on('offer', handleOffer)
  // socket.on('oneOffer', handleOffer)
  socket.on('answer', handleAnswer)
  socket.on('ICE-candidate', handleIce);
}

const gotMediaStream = async (stream: MediaStream) => {
  if(!isJoinRoom.value) {
    ElMessage.error('请先加入房间，再确认');
    return;
  }
  localVideo.value.srcObject = stream;
  localStream = stream;
  hideTop(true);
  const peer = await initPeer(myUserId.value, '123');
  await createOffer('123', peer);
  const emitList = userList.value.filter((item) => item[0] !== myUserId.value);
  for (const item of emitList) {
    const peer = await initPeer(myUserId.value, item[0]);
    await createOffer(item[0], peer);
  }
}

// 有人登录
async function someOneLogin(recUserId: string) {
  if(!localStream) return;
  const peer = await initPeer(myUserId.value, recUserId);
  await createOffer(recUserId, peer);
}

// rtcPeer

// 发起方创建offer
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
  console.log("=>(HomeView.vue:147) userIds", loginUserId);
  if (!localStream) return;
  const offer = await peerConnect.createOffer();
  await peerConnect.setLocalDescription(offer);
  console.log('-> oneOffer', offer);
  socket.emit('oneOffer', { userId: myUserId.value, sdp: offer, loginUserId }, (res: any) => {
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
    <el-input type="text" v-model="room" placeholder="房间号"/>
    <el-input type="text" v-model="nick" placeholder="昵称"/>
    <el-button @click="intoRoom" type="success">进入房间</el-button>

    <el-input type="text" v-model="inputVal"/>
    <el-button @click="sendMessage">发消息</el-button>

    <div>
      <span>在线列表</span>
      <div v-for="(item) of userList" :key="item[0]">
        <div>{{ item[1].nick }}</div>
      </div>
    </div>
  </main>
  <div style="display: flex;">
    <div id="width" style="width: 600px;height: 300px;"></div>
    <div id="height" style="width: 600px;height: 300px;"></div>
    <div id="frame" style="width: 600px;height: 300px;"></div>
  </div>
  <el-button @click="getStatus">获取数据</el-button>
  <el-button @click="getlocalStatus">获取本地数据</el-button>
  <el-button @click="draw">draw</el-button>
  <div class="video">
    <video autoplay playsinline muted ref="localVideo" class="localVideo"></video>
    <el-button @click="muteRemoteVideo">muteRemoteVideo</el-button>
    <el-button @click="muteLocalVideo">muteLocalVideo</el-button>
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
