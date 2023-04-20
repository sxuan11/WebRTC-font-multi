<template>
  <el-tabs v-model="activeName" class="demo-tabs" lazy>
    <el-tab-pane label="连麦" name="rtc">
      <HomeView />
    </el-tab-pane>
    <el-tab-pane label="文件传输" name="file">
      <FileTransfer />
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import HomeView from '@/views/HomeView.vue'
import FileTransfer from '@/views/fileTransfer.vue'
import { ref } from 'vue'
const activeName = ref('file')

</script>

