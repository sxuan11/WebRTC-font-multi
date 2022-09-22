<template>
  <div>
    <el-button @click="getMixVideo" type="success">获取屏幕共享和视频混合流</el-button>
    <el-button @click="getMixCamera" type="success">获取视频平铺</el-button>
    <el-button @click="stopMixVideo" type="danger">停止混合流</el-button>
  </div>
  <video id="canvasVideo" ref="video" autoplay></video>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { customMediaStream, StreamList } from "@/views/types";

const video = ref<HTMLVideoElement>();
const videoStream = ref<MediaStream>()
const screenStream = ref<MediaStream>()
const canvasEl = ref<HTMLCanvasElement>(document.createElement('canvas'))
const canvasContext = ref<CanvasRenderingContext2D>()
const isStopDraw = ref(false);
const getScreenStream = async () => {
  screenStream.value = await navigator.mediaDevices.getDisplayMedia()
}

const getVideo = async () => {
  videoStream.value = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: 'e9ae60563d15c7e9df5f8302b94665fac9830287a7792501783b8c01d332ab30'
    },
    audio: {
      deviceId: 'bfdae929366b28c29504d9645c3db427da08e8aa3c73b103f5d4a1a4a0542b20' // qq
      // deviceId: '33f80fde244891ad319e988fe9c6ece449e82b14c8d59d7fb7d525346abe28ca' // mic
    }
  })
}

const genVideo = (stream: MediaStream, width = 800, height = 448) => {
  const videoEl = document.createElement('video');
  // videoEl.muted = true;
  // videoEl.volume = 0;
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
  if (video.value) {
    video.value.srcObject = stream!;
  }
}

const stopMixVideo = async () => {
  isStopDraw.value = true;
  video.value?.pause();

  screenStream.value?.getTracks().forEach(t => {
    t.stop();
  })

  videoStream.value?.getTracks().forEach(t => {
    t.stop();
  })

  canvasContext.value?.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height);
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
  if (isStopDraw.value) return;

  canvasContext.value!.drawImage(screenEl, 0, 0, 800, 448);
  canvasContext.value!.drawImage(videoEl, 600, 336, 200, 112);

  setTimeout(drawToCanvasScreenAndVideo.bind(undefined, screenEl, videoEl), 100);
}

// 视频平铺
const getMixCamera = async () => {
  await getVideo();
  await getScreenStream();

  const streamList: StreamList[] = [];
  const screenVideo = genVideo(screenStream.value!)
  const handlerScreenStream = handlerStreamCallBack(screenStream.value!);
  // @ts-ignore
  screenVideo['stream'] = handlerScreenStream;

  const screenObj: StreamList = {
    videoContent: screenVideo,
    text: '屏幕共享'
  }
  streamList.push(screenObj);

  for (let i = 0; i < 3; i++) {
    const name = `名字${i + 1}`;
    const handlerStream = handlerStreamCallBack(videoStream.value!);
    const video = genVideo(handlerStream);
    // @ts-ignore
    video['stream'] = handlerStream;

    const videoObj: StreamList = {
      videoContent: video,
      text: name
    }
    streamList.push(videoObj)
  }

  canvasEl.value.width = 800;
  canvasEl.value.height = 448;
  canvasContext.value = canvasEl.value.getContext('2d')!;

  isStopDraw.value = false;
  startDrawCamera(streamList);

  const stream = canvasEl.value.captureStream();
  if (video.value) {
    video.value.srcObject = stream!;
  }
}

const handlerStreamCallBack = (stream: MediaStream) => {
  const streamHandler = videoStream.value! as customMediaStream;

  streamHandler.onDraw = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, text: string) => {
    context.font = '30px "微软雅黑"';
    context.fillStyle = "red";
    context.fillText(text, x + 50, y + 50)
  }
  return streamHandler;
}

const startDrawCamera = (streamList: Array<StreamList>) => {
  if (isStopDraw.value) return;

  streamList.forEach((item, index) => {
    const width = 800 / 2;
    const height = 448 / 2;
    const x = index % 2 ? width : 0;
    const y = index >= 2 ? height : 0
    canvasContext.value!.drawImage(item.videoContent, x, y, width, height);

    // @ts-ignore
    if (item.videoContent?.stream && typeof item.videoContent.stream.onDraw === 'function') {
      // @ts-ignore
      item.videoContent.stream.onDraw(canvasContext.value, x, y, width, height, item.text);
    }
  })

  setTimeout(startDrawCamera.bind(undefined, streamList), 100);
}
</script>

<style>
#canvasVideo {
  width: 1000px;
  height: 560px;
  aspect-ratio: 16 / 9;
}
</style>
