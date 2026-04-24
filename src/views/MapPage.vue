<template>
  <MapView :countries="VISITED_COUNTRIES" />
</template>

<script>
import MapView from '@/components/MapView.vue';
import { VISITED_COUNTRIES } from '@/data/countries.js';

export default {
  name: 'MapPage',
  components: { MapView },
  data() {
    return { VISITED_COUNTRIES };
  },
};
</script>
