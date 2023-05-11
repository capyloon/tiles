const kDeps = [
  {
    name: "main",
    kind: "virtual",
    deps: [
      "shared-fluent",
      "activity manager",
      "tile helper",
      "shoelace-light-theme",
      "shoelace-setup",
      "shoelace-progress-ring",
      "shoelace-button",
      "shoelace-icon",
    ],
  },
  {
    name: "activity manager",
    kind: "sharedModule",
    param: ["js/activity_manager.js", ["ActivityManager"]],
  },
  {
    name: "tile helper",
    kind: "sharedModule",
    param: ["js/tile.js", ["TileHelper", "TileRpcServer"]],
    deps: ["shared-api-daemon"],
  },
];

function log(msg) {
  console.log(`MediaPlayer[${location.hostname}] ${msg}`);
}

document.addEventListener("DOMContentLoaded", async () => {
  log("DOM ready");

  await depGraphLoaded;
  graph = new ParallelGraphLoader(addSharedDeps(addShoelaceDeps(kDeps)));

  await graph.waitForDeps("main");
  // Configure activity handlers.
  let _activities = new ActivityManager({
    "p2p-tile-called": onCalled,
  });

  if (location.protocol == "http:") {
    onCalled({});
  }
});

// Function called when the app start in "receiving" mode.
async function onCalled(data) {
  log(`onCalled`);
  let helper = new TileHelper(data);

  let progressRing = document.querySelector("sl-progress-ring");
  let ringInterval = window.setInterval(() => {
    progressRing.value += 5;
    if (progressRing.value > 100) {
      progressRing.value = 0;
    }
  }, 250);

  helper.addEventListener("open", (event) => {
    log(`Connected`);

    class RemoteServer extends TileRpcServer {
      constructor(channel) {
        super(channel);
        this.player = document.getElementById("player");

        const playerEventHandler = this.playerEvent.bind(this);

        this.lastTimeUpdate = Date.now();

        ["durationchange", "timeupdate", "play", "pause"].forEach((event) => {
          this.player.addEventListener(event, playerEventHandler);
        });
      }

      // Sends the current player state to the controller.
      updatePlayerState(name) {
        let detail = {
          duration: this.player.duration,
          currentTime: this.player.currentTime,
          paused: this.player.paused,
          muted: this.player.muted,
        };
        this.broadcastMessage({ name, detail });
      }

      playerEvent(event) {
        // Throttle timeupdate events to 1Hz
        let now = Date.now();
        if (event.type === "timeupdate") {
          if (now - this.lastTimeUpdate < 1000) {
            return;
          } else {
            this.lastTimeUpdate = now;
          }
        }

        this.updatePlayerState(event.type);
      }

      async configure({ name, ticket }) {
        log(`configure ${ticket}`);
        this.player.src = `http://localhost:${config.port}/dweb/${ticket}`;

        window.clearInterval(ringInterval);
        progressRing.classList.add("hidden");

        let title = document.querySelector("h3");
        title.classList.remove("hidden");
        title.dataset.l10nArgs = JSON.stringify({ name });
        document.body.classList.add("film-bg");

        return true;
      }

      async play() {
        document.querySelector("h3").classList.add("hidden");
        document.querySelector("video").classList.remove("hidden");
        document.body.classList.remove("film-bg");

        this.player.play();
      }

      async pause() {
        this.player.pause();
      }

      async seekBy(delta) {
        log(`seekBy ${delta}`);
        let old = this.player.currentTime;
        this.player.currentTime += delta;
        log(`  ${old} -> ${this.player.currentTime}`);
      }

      async seekTo(pos) {
        log(`seekTo ${pos}`);
        let old = this.player.currentTime;
        this.player.currentTime = pos;
        log(`  ${old} -> ${this.player.currentTime}`);
      }

      async setMuted(muted) {
        this.player.muted = muted;
        let indicator = document.querySelector(".muted-indicator").classList;
        if (muted) {
          indicator.remove("hidden");
        } else {
          indicator.add("hidden");
        }

        // We update the state right away to allow the muted state to sync
        // properly even if the playback is paused.
        // TODO: use a custom event name instead of hijacking 'timeupdate'.
        this.updatePlayerState("timeupdate");
      }
    }

    const server = new RemoteServer(event.detail.channel);
  });

  try {
    let answer = await helper.onCalled();
    return answer;
  } catch (e) {
    console.error(e);
    log(`onRespond Oops ${JSON.stringify(e)}`);
    throw e;
  }
}
