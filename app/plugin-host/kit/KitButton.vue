<script setup lang="ts">
import type { Component } from 'vue'
defineOptions({ inheritAttrs: false })
defineProps<{ icon?: Component; ariaLabel?: string }>()
</script>

<template>
  <UButton v-bind="$attrs" :aria-label="ariaLabel">
    <template v-if="icon" #leading><component :is="icon" class="size-4 shrink-0" aria-hidden="true" /></template>
    <slot />
  </UButton>
</template>
