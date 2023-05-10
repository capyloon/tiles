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
      "waiting-for-peer",
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
    param: ["js/tile.js", ["TileHelper", "TileRpcClient"]],
    deps: ["shared-api-daemon"],
  },
  {
    name: "waiting-for-peer",
    kind: "virtual",
    deps: [
      "shoelace-progress-ring",
      "shoelace-button",
      "shoelace-icon",
      "shoelace-range",
    ],
  },
];

// Possible UI States. Can be:
// - Waiting for the remote peer to connect.
// - Peer connected, waiting to pick a media.
// - Controlling a media remotely.
const WAITING_FOR_PEER = "waiting-for-peer";
const PICKING_MEDIA = "picking-media";
const CONTROLLING_MEDIA = "controlling-media";

var uiState = WAITING_FOR_PEER;
var sections = new Map();

class WaitingForPeerSection {
  constructor() {
    this.section = document.querySelector("section.waiting-for-peer");
    this.ring = this.section.querySelector("sl-progress-ring");
    this.cancel = this.section.querySelector("sl-button");
    this.cancel.onclick = () => {
      window.close();
    };
    this.ring.value = 0;
    this.interval = null;
  }

  show() {
    this.section.classList.remove("hidden");
    if (this.interval) {
      window.clearInterval(this.interval);
    }
    this.interval = window.setInterval(() => {
      this.ring.value += 5;
      if (this.ring.value > 100) {
        this.ring.value = 0;
      }
    }, 250);
  }

  hide() {
    this.section.classList.add("hidden");
    if (this.interval) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
  }
}

class PickingMediaSection {
  constructor(client) {
    this.client = client;
    this.section = document.querySelector("section.picking-media");
    this.section.querySelector("#pick-button").onclick =
      this.pickMedia.bind(this);
    this.playButton = this.section.querySelector("#start-playing");
    this.playButton.onclick = this.startPlaying.bind(this);
    this.title = this.section.querySelector(".title");
  }

  async pickMedia() {
    let picker = new WebActivity("pick", {
      type: "video",
      forBroadcast: true,
    });
    try {
      this.media = await picker.start();
      log(`Will use resource ${this.media.name}: ${this.media.ticket}`);
      this.title.textContent = this.media.name;
      this.playButton.disabled = false;
    } catch (e) {
      console.error(e);
      log(e);
    }
  }

  async startPlaying() {
    log(`start playing`);
    try {
      let ready = await this.client.configure(
        this.media.name,
        this.media.ticket
      );
      if (ready) {
        log(`configure done!`);
        switchUiState(CONTROLLING_MEDIA);
      } else {
        // TODO: manage error??
      }
    } catch (e) {
      console.error(e);
      log(e);
    }
  }

  show() {
    this.section.classList.remove("hidden");
    this.playButton.disabled = true;
    this.title.textContent = "";
    document.l10n.translateFragment(this.section);
  }

  hide() {
    this.section.classList.add("hidden");
  }
}

const PLAYBACK_EVENTS = ["durationchange", "timeupdate", "play", "pause"];

class ControllingMediaSection {
  constructor(client) {
    this.client = client;
    this.section = document.querySelector("section.controlling-media");
    this.playPauseButton = this.section.querySelector("#ctrl-start-pause");
    this.playPauseButton.onclick = this.onPlayPause.bind(this);
    this.skipBackButton = this.section.querySelector("#ctrl-skip-back");
    this.skipBackButton.onclick = this.onSkipBack.bind(this);
    this.skipFwdButton = this.section.querySelector("#ctrl-skip-fwd");
    this.skipFwdButton.onclick = this.onSkipFwd.bind(this);

    this.currentTime = this.section.querySelector(".current-time");
    this.duration = this.section.querySelector(".duration");

    this.timeRange = this.section.querySelector(".time-range");
    this.timeRange.tooltipFormatter = this.formatTime;
    this.timeRange.addEventListener("sl-change", async (event) => {
      await this.client.seekTo(this.timeRange.value);
    });

    PLAYBACK_EVENTS.forEach((message) => {
      this.client.addEventListener(message, this);
    });

    this.reset();
  }

  handleEvent(event) {
    // log(`ControllingMediaSection event: ${event.type} ${JSON.stringify(event.detail)}`);
    this.state = event.detail;
    this.updateUi();
  }

  // Format as HH::MM::SS a duration in seconds.
  // The HH part is skipped if the duration is less than an hour.
  formatTime(duration) {
    let hours = "";
    if (duration > 3600) {
      hours = Math.floor(duration / 3600).toString().padStart(2, "0") + ":";
    }
    let minutes = Math.floor((duration % 3600) / 60)
      .toString()
      .padStart(2, "0");
    let seconds = Math.floor(duration % 60)
      .toString()
      .padStart(2, "0");
    return `${hours}${minutes}:${seconds}`;
  }

  updateUi() {
    if (!this.timeRange.max) {
      this.timeRange.max = this.state.duration;
    }

    if (this.state.paused) {
      this.playPauseButton.firstElementChild.setAttribute("name", "play");
    } else {
      this.playPauseButton.firstElementChild.setAttribute("name", "pause");
    }

    this.currentTime.textContent = this.formatTime(this.state.currentTime);
    this.duration.textContent = this.formatTime(this.state.duration);
    this.timeRange.value = this.state.currentTime;
  }

  reset() {
    this.state = {
      duration: 0,
      currentTime: 0,
      paused: true,
    };
    this.timeRange.max = null;
    this.timeRange.value = 0;
  }

  async onPlayPause() {
    if (this.state.paused) {
      await this.client.play();
    } else {
      await this.client.pause();
    }
  }

  async onSkipBack() {
    await this.client.seekBy(-30);
  }

  async onSkipFwd() {
    await this.client.seekBy(30);
  }

  show() {
    this.section.classList.remove("hidden");
    document.l10n.translateFragment(this.section);
    this.reset();
    this.updateUi();
  }

  hide() {
    this.section.classList.add("hidden");
  }
}

function log(msg) {
  console.log(`MediaPlayer[${location.hostname}] ${msg}`);
}

document.addEventListener("DOMContentLoaded", async () => {
  log("DOM ready");

  await depGraphLoaded;
  const graph = new ParallelGraphLoader(addSharedDeps(addShoelaceDeps(kDeps)));

  await graph.waitForDeps("main");
  // Configure activity handlers.
  let _activities = new ActivityManager({
    "p2p-tile-start": onStart,
  });

  sections.set(WAITING_FOR_PEER, new WaitingForPeerSection());
  sections.set(PICKING_MEDIA, new PickingMediaSection());

  if (location.protocol == "http:") {
    onStart({});
  }
});

class RemoteClient extends EventTarget {
  constructor(client) {
    super();
    this.client = client;
    // Add message listeners and matching event handlers.
    PLAYBACK_EVENTS.forEach((message) => {
      client.addMessageListener(message);

      client.addEventListener(message, (event) => {
        // log(`Received ${message} ${JSON.stringify(event.detail)}`);
        this.dispatchEvent(new CustomEvent(message, { detail: event.detail }));
      });
    });
  }

  configure(name, ticket) {
    return this.client.callFunc("configure", { name, ticket });
  }

  play() {
    return this.client.callFunc("play");
  }

  pause() {
    return this.client.callFunc("pause");
  }

  seekBy(delta) {
    return this.client.callFunc("seekBy", delta);
  }

  seekTo(pos) {
    return this.client.callFunc("seekTo", pos);
  }
}

function switchUiState(newState) {
  sections.get(uiState)?.hide();
  sections.get(newState)?.show();
  uiState = newState;
}

// Function called when the app start in "initiating mode".
async function onStart(data) {
  log(`onStart data=${JSON.stringify(data)}`);
  data.desc = "Media Player";

  switchUiState(WAITING_FOR_PEER);

  let helper = new TileHelper(data);

  helper.addEventListener("open", (event) => {
    log(`helper: open event`);
    let channel = event.detail.channel;

    let rpcClient = new TileRpcClient(channel);
    let client = new RemoteClient(rpcClient);

    sections.set(PICKING_MEDIA, new PickingMediaSection(client));
    sections.set(CONTROLLING_MEDIA, new ControllingMediaSection(client));

    switchUiState(PICKING_MEDIA);
  });

  helper.addEventListener("close", () => {
    log(`helper: close event`);
    // TODO: switch to "the end" screen.
  });

  try {
    helper.onStart();
  } catch (e) {
    onError(e.value);
    log(`onStart Oops ${JSON.stringify(e)}`);
    throw e;
  }
}
