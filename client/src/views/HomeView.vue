<script setup lang="ts">
import Button from '@/components/Button.vue';
</script>

<template>
    <div class="view-container">
        <h1>Home View</h1>
        <Button text="click me" />
    </div>
</template>

<style lang="scss" scoped>
.view-container {
    position: relative;
    flex-direction: column;
    @include flexCenterAll;
    flex-grow: 1;
    width: 100%;
    color: $color-text-primary-light;
}
</style>
