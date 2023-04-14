// A search engine powered by https://github.com/printfn/fend
// Currently using revision 685110de575f54a872a64a20b9a17abb1b4a457b
//
// Generate by running `wasm-pack build --release --no-typescript --target no-modules` in the
// wasm directory and replacing wasm_bindgen with fend_wasm in fend_wasm.js
importScripts(["./js/fend_wasm.js"]);

function log(msg) {
  console.log(`${self.location} ${msg}`);
}

function error(msg) {
  console.error(`${self.location} ${msg}`);
}

self.addEventListener("install", (event) => {
  // Perform install steps
  event.waitUntil(self.skipWaiting());
  log(`is now installed`);
});

self.addEventListener("activate", (event) => {
  // Perform activation steps
  event.waitUntil(self.clients.claim());
  log(`is now activated`);
});

self.addEventListener("systemmessage", async (event) => {
  log(`system message: ${event.name}`);

  let resolver;
  let promise = new Promise((resolve) => {
    resolver = resolve;
  });
  event.waitUntil(promise);

  if (event.name === "activity") {
    await handleActivity(event.data.webActivityRequestHandler());
  } else {
    error(`Unexpected system message: ${event.name}`);
  }

  resolver();
});

let wasmReady = false;

async function initWasm() {
  if (wasmReady) {
    return;
  }

  await fend_wasm("/js/fend_wasm_bg.wasm");
  fend_wasm.initialise();

  wasmReady = true;
}

async function handleActivity(handler) {
  let source = handler.source;
  let activityName = source.name;

  if (activityName !== "search-provider") {
    error(`Unexpected activity: ${activityName}`);
    return;
  }

  try {
    await initWasm();
  } catch (e) {
    error(`${e}`);
  }

  // log(`Got activity call '${source.data.input}'`);
  try {
    let result = await fend_wasm.evaluateFendWithVariablesJson(
      source.data.input,
      500,
      ""
    );

    // console.log(result);
    result = JSON.parse(result);

    if (result.ok) {
      handler.postResult([
        {
          source: "Universal Converter",
          results: [{ text: result.result }],
        },
      ]);
    } else {
      handler.postError(null);
    }
  } catch (e) {
    error(e);
    handler.postError(null);
  }
}
