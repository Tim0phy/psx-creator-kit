// E: drive on this machine does not deliver reliable fs-change events, so
// vite's default watcher keeps serving stale transformed modules after edits
// (sleeves/pants fixes invisible until a server restart). Polling sidesteps
// the broken event stream entirely.
export default {
  server: {
    watch: {
      usePolling: true,
      interval: 250,
    },
  },
};
