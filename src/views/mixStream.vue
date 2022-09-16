<template>
  <div>
    <el-button @click="getMixVideo" type="success">获取屏幕共享和视频混合流</el-button>
    <el-button @click="stopMixVideo" type="danger">停止混合流</el-button>
    <el-button @click="getMixCamera" type="success">获取视频平铺</el-button>
  </div>
  <video id="canvasVideo" ref="video" autoplay></video>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { customMediaStream } from "@/views/types";
const video = ref<HTMLVideoElement>();
const videoStream = ref<MediaStream>()
const screenStream = ref<MediaStream>()
const canvasEl = ref<HTMLCanvasElement>(document.createElement('canvas'))
const canvasContext = ref<CanvasRenderingContext2D>()
const isStopDraw = ref(false);
const videoList = ref<Array<HTMLVideoElement>>([])

const getScreenStream =  async () => {
  screenStream.value = await navigator.mediaDevices.getDisplayMedia()
}

const getVideo = async () => {
  videoStream.value = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: {
      deviceId: 'ec92dd8d23935c459e1190aa8a4c8133f47b1d63a5c0bdd355eb302f313011d2'
    }
  })
}

const genVideo = (stream: MediaStream, width = 800, height = 448) => {
  const videoEl = document.createElement('video');
  videoEl.muted = true;
  videoEl.volume = 0;
  videoEl.autoplay = true;
  videoEl.srcObject = stream;
  videoEl.width = width;
  videoEl.height = height;
  videoEl.play();
  return videoEl;
}

// 混合视频和屏幕共享
const getMixVideo = async () => {
  isStopDraw.value = false;
  await getScreenStream()
  await getVideo()
  await startMixScreenAndVideo();
  const stream = canvasEl.value.captureStream();
  if(video.value) {
    video.value.srcObject = stream!;
  }
}

const stopMixVideo = async () => {
  isStopDraw.value = true;
  video.value?.pause();
  screenStream.value?.getTracks().forEach(t=> {
    t.stop();
  })
  videoStream.value?.getTracks().forEach(t=> {
    t.stop();
  })
}

const startMixScreenAndVideo = async () => {
  canvasEl.value.width = 800;
  canvasEl.value.height = 448;
  canvasContext.value = canvasEl.value.getContext('2d')!;
  const screenEl = genVideo(screenStream.value!);
  const videoEl = genVideo(videoStream.value!, 200, 112);
  drawToCanvasScreenAndVideo(screenEl, videoEl);
}

const drawToCanvasScreenAndVideo = (screenEl: HTMLVideoElement, videoEl: HTMLVideoElement) => {
  if(isStopDraw.value) return;
  canvasContext.value!.drawImage(screenEl, 0, 0, 800, 448);
  canvasContext.value!.drawImage(videoEl, 600, 336, 200, 112);
  setTimeout(drawToCanvasScreenAndVideo.bind(undefined, screenEl, videoEl), 100);
}

// 视频平铺
const getMixCamera = async () => {
  await getVideo();
  const streamList: customMediaStream[] = [];
  for (let i = 0; i < 4; i++) {
    const stream = handlerStreamCallBack(videoStream.value!, `名字${i+1}`)
    streamList.push(stream)
  }
}

const handlerStreamCallBack = (stream: MediaStream, text: string) => {
  const streamHandler = videoStream.value! as customMediaStream;
  streamHandler.onDraw = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
    context.drawImage()
  }
  return streamHandler;
}
</script>

<style>
#canvasVideo {
  width: 1000px;
  height: 560px;
  aspect-ratio: 16 / 9;
}
</style>
