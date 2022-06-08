<template>
  <div class="norMal">
    <video class="previewVideo" ref="localVideo" autoplay playsinline></video>
    <div class="videoChoose">
      <span>视频源</span>
      <el-select v-model="videoDevice" class="m-2" placeholder="Select" size="large">
        <el-option
          v-for="item in videoInputOptions"
          :key="item.deviceId"
          :label="item.label"
          :value="item.deviceId"
        />
      </el-select>
      <span>音频源</span>
      <el-select v-model="audioDevice" class="m-2" placeholder="Select" size="large">
        <el-option
          v-for="item in audioInputOptions"
          :key="item.deviceId"
          :label="item.label"
          :value="item.deviceId"
        />
      </el-select>
      <span>音频输出</span>
      <el-select v-model="audioOutDevice" class="m-2" placeholder="Select" size="large">
        <el-option
          v-for="item in audioOutputOptions"
          :key="item.deviceId"
          :label="item.label"
          :value="item.deviceId"
        />
      </el-select>
    </div>
    <el-button @click="getLocalVideo" type="primary">获取本地预览视频</el-button>
    <el-button @click="confirm" type="primary">确定当前配置</el-button>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, defineEmits } from 'vue';

const emit = defineEmits<{
  (e: 'confirm', stream: MediaStream): void
}>()
const localVideo = ref();

const videoDevice = ref<MediaDeviceInfo["deviceId"]>('');
const audioDevice = ref<MediaDeviceInfo["deviceId"]>('');
const audioOutDevice = ref<MediaDeviceInfo["deviceId"]>('');

const videoInputOptions = ref<Array<MediaDeviceInfo>>([]);
const audioInputOptions = ref<Array<MediaDeviceInfo>>([]);
const audioOutputOptions = ref<Array<MediaDeviceInfo>>([]);


let stream: MediaStream;

function gotDevices(deviceInfos: Array<MediaDeviceInfo>) {
  for (let i = deviceInfos.length - 1; i >= 0; i--) {
    const deviceInfo = deviceInfos[i];
    if (deviceInfo.kind === 'audioinput') {
      audioInputOptions.value.push(deviceInfo)
      audioDevice.value = deviceInfo.deviceId;
    } else if (deviceInfo.kind === 'audiooutput') {
      audioOutputOptions.value.push(deviceInfo)
      audioOutDevice.value = deviceInfo.deviceId
    } else if (deviceInfo.kind === 'videoinput') {
      videoInputOptions.value.push(deviceInfo)
      videoDevice.value = deviceInfo.deviceId;
    } else {
      console.log('other kind of source/device: ', deviceInfo);
    }

    // if (deviceInfo.deviceId === 'default') {
    //   if (deviceInfo.kind === 'audioinput') {
    //     audioDevice.value = deviceInfo.deviceId;
    //   } else if (deviceInfo.kind === 'videoinput') {
    //     videoDevice.value = deviceInfo.deviceId;
    //   } else if (deviceInfo.kind === 'audiooutput') {
    //     audioOutDevice.value = deviceInfo.deviceId
    //   }
    // }
  }
}

const getLocalVideo = async () => {
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    })
  }
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: audioDevice.value ? { exact: audioDevice.value } : undefined },
    video: {
      deviceId: videoDevice.value ? { exact: videoDevice.value } : undefined ,
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  });
  localVideo.value.srcObject = stream;
  localVideo.value.play();
}

function attachSinkId(element: HTMLMediaElement, sinkId: string) {
  if (typeof element.sinkId !== 'undefined') {
    element.setSinkId(sinkId).then(() => {
        console.log(`Success, audio output device attached: ${sinkId}`);
      }).catch((error: Error) => {
        let errorMessage = error;
        if (error.name === 'SecurityError') {
          errorMessage = `https 打开页面: ${error}`;
        }
        console.error(errorMessage);
      });
  } else {
    console.warn('Browser does not support output device selection.');
  }
}


watch(videoDevice, getLocalVideo)
watch(audioDevice, getLocalVideo)
watch(audioOutDevice, changeOutPut)

function changeOutPut() {
  attachSinkId(localVideo.value, audioOutDevice.value)
}

const firstStart = async () => {
  await navigator.mediaDevices.enumerateDevices().then(gotDevices);
  await getLocalVideo()
}

firstStart()

const confirm = () => {
  emit('confirm', stream)
}
</script>

<style scoped>
.previewVideo {
  width: 350px;
  aspect-ratio: 16 / 9;
}
</style>
