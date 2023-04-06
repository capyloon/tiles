const kDeps = [
  {
    name: "main",
    kind: "virtual",
    deps: ["activity manager", "tile helper"],
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
    "p2p-tile-start": onStart,
  });

  document.getElementById("pick-button").onclick = async () => {
    let picker = new WebActivity("pick", { type: "video", forBroadcast: true });
    try {
      let { ticket, name } = await picker.start();
      log(`Will use resource ${name}: ${ticket}`);
      document.getElementById("title").textContent = name;
    } catch (e) {
      log(e);
    }
  };
});

function setStatus(msg) {
  document.getElementById("status").textContent = msg;
}

class RemoteClient {
  constructor(client) {
    this.client = client;
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
}

function updateUi(state) {
  const playPauseButton = document.getElementById("ctrl-start-pause");
  const status = document.getElementById("status");

  if (state.paused) {
    playPauseButton.textContent = "Play";
  } else {
    playPauseButton.textContent = "Pause";
  }

  status.textContent = `${state.paused ? "Paused -" : "Playing -"}
  ${state.currentTime} / ${state.duration}`;
}

// Function called when the app start in "initiating mode".
async function onStart(data) {
  log(`onStart data=${JSON.stringify(data)}`);
  data.desc = "Media Player";

  let helper = new TileHelper(data);

  helper.addEventListener("open", (event) => {
    setStatus("Peer available");
    let channel = event.detail.channel;

    let state = {
      duration: 0,
      currentTime: 0,
      paused: true,
    };

    let rpcClient = new TileRpcClient(channel);
    // Add message listeners and matching event handlers.
    ["durationchange", "timeupdate", "play", "pause"].forEach((message) => {
      rpcClient.addMessageListener(message);

      rpcClient.addEventListener(message, (event) => {
        state = event.detail;
        updateUi(state);
      });
    });
    let client = new RemoteClient(rpcClient);

    document.getElementById("pick-button").onclick = async () => {
      let picker = new WebActivity("pick", {
        type: "video",
        forBroadcast: true,
      });
      try {
        let { ticket, name } = await picker.start();
        log(`Will use resource ${name}: ${ticket}`);
        document.getElementById("title").textContent = name;
        let ready = await client.configure(name, ticket);
        if (ready) {
          setStatus("Remote player ready");
        } else {
          setStatus("Remote player configuration failed");
        }
      } catch (e) {
        console.error(e);
        log(e);
      }
    };

    const playPauseButton = document.getElementById("ctrl-start-pause");
    playPauseButton.onclick = async () => {
      if (state.paused) {
        await client.play();
      } else {
        await client.pause();
      }
    };
  });

  helper.addEventListener("close", () => {
    setStatus("Remote player closed the connection");
  });

  try {
    helper.onStart();
  } catch (e) {
    onError(e.value);
    log(`onStart Oops ${JSON.stringify(e)}`);
    throw e;
  }
}
