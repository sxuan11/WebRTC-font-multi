<template>
  <div>
    <el-button @click="getVideo" type="success">获取音视频</el-button>
    <el-button @click="stopStream" type="danger">停止音视频</el-button>
    <el-button @click="changePIP">切换画中画模式</el-button>
    <el-button @click="startVideoTrack">开启视频轨道</el-button>
    <el-button @click="stopVideoTrack">停止视频轨道</el-button>
    <el-button @click="startAudioTrack">开启音频轨道</el-button>
    <el-button @click="stopAudioTrack">停止音频轨道</el-button>
    <video id="camera" ref="camera" autoplay></video>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
const camera = ref<HTMLVideoElement>();
const stream = ref<MediaStream>()
const isCamOn = ref(true)
const isMicOn = ref(true)

const getVideo = async () => {
  stream.value = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: 'e9ae60563d15c7e9df5f8302b94665fac9830287a7792501783b8c01d332ab30'
    },
    audio: {
      deviceId: 'ec92dd8d23935c459e1190aa8a4c8133f47b1d63a5c0bdd355eb302f313011d2'
    }
  })
  camera.value!.srcObject = stream.value;
  // @ts-ignore
  navigator.mediaSession.setCameraActive(isCamOn.value)
  // @ts-ignore
  navigator.mediaSession.setMicrophoneActive(isMicOn.value)
}

const startVideoTrack = async () => {
  const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
  const track = videoStream.getVideoTracks()[0];
  stream.value?.addTrack(track)
}

const stopVideoTrack = async () => {
  const videoTracks = stream.value?.getVideoTracks()
  if(videoTracks?.length) {
    videoTracks.forEach(item => {
      item.stop();
      stream.value?.removeTrack(item)
    })
  }
}

const startAudioTrack = async () => {
  const audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: 'ec92dd8d23935c459e1190aa8a4c8133f47b1d63a5c0bdd355eb302f313011d2'
    }
  })
  const track = audioStream.getAudioTracks()[0];
  stream.value?.addTrack(track)
}

const stopAudioTrack = async () => {
  const audioTracks = stream.value?.getAudioTracks()
  if(audioTracks?.length) {
    audioTracks.forEach(item => {
      item.stop();
      stream.value?.removeTrack(item)
    })
  }
}

const stopStream = async () => {
  const tracks = stream.value?.getTracks()
  if(tracks?.length) {
    tracks.forEach(item => {
      item.stop();
    })
  }
}

const changePIP = async () => {
  if (camera.value !== document.pictureInPictureElement) {
    await camera.value!.requestPictureInPicture();
  } else {
    await document.exitPictureInPicture()
  }
}

onMounted(()=> {
  startAction();
  console.log('执行')
})

const startAction = () => {
  // "hangup" | "nexttrack" | "pause" | "play" | "previoustrack" | "seekbackward" | "seekforward" | "seekto" | "skipad" | "stop" | "togglecamera" | "togglemicrophone";
  navigator.mediaSession.setActionHandler('hangup', () => {
    changePIP();
    stopStream();
  })
  navigator.mediaSession.setActionHandler('togglecamera', () => {
    if(isCamOn.value) {
      stopVideoTrack();
      isCamOn.value = false;
    } else {
      startVideoTrack();
      isCamOn.value = true;
    }
    // @ts-ignore
    navigator.mediaSession.setCameraActive(isCamOn.value)
  })
  navigator.mediaSession.setActionHandler('togglemicrophone', () => {
    if(isMicOn.value) {
      stopAudioTrack();
      isMicOn.value = false;
    } else {
      startAudioTrack();
      isMicOn.value = true;
    }
    // @ts-ignore
    navigator.mediaSession.setMicrophoneActive(isMicOn.value)
  })
}
</script>

<style>
#camera {
  width: 300px;
  height: 200px;
  aspect-ratio: 16 / 9;
}
</style>
