const kDeps = [
  {
    name: "main",
    kind: "virtual",
    deps: ["activity manager"],
  },
  {
    name: "activity manager",
    kind: "sharedModule",
    param: ["js/activity_manager.js", ["ActivityManager"]],
  },
];

function log(msg) {
  console.log(`ImageProc[${location.hostname}] ${msg}`);
}

document.addEventListener("DOMContentLoaded", async () => {
  log("DOM ready");

  // Test mode when loading over http.
  if (location.protocol == "http:") {
    testMode();
  }

  await depGraphLoaded;
  graph = new ParallelGraphLoader(addSharedDeps(addShoelaceDeps(kDeps)));

  await graph.waitForDeps("main");
  // Configure activity handlers.
  let _activities = new ActivityManager({
    "process-image": processImage,
  });
});

async function testMode() {
  let resource = await fetch("resources/test.png");
  let blob = await resource.blob();
  console.log(`Got blob, ${blob.type}`);
  await processImage({ blob });
  console.log(`Done!`);
}

class ConsoleImpl {
  constructor(name) {
    this.name = name;
  }

  consoleLog(msg) {
    console.log(`${this.name}:`, msg);
  }

  consoleError(msg) {
    console.error(`${this.name}:`, msg);
  }
}

class ImageProcessor {
  constructor(blob) {
    this.blob = blob;
    this.resultBlob = blob;
    this.img = document.getElementById("canvas");

    this.img.src = this.createObjectURL(blob);

    this.wasmReady = false;
    this.defered = null;
  }

  async init() {
    await this.ensureModules();

    let footer = document.body.querySelector("footer");
    this.algorithms.forEach(({ name }) => {
      let button = document.createElement("button");
      button.textContent = name;
      button.onclick = () => {
        this.applyAlgorithm(name);
      };
      footer.append(button);
    });

    let undoButton = document.createElement("button");
    undoButton.textContent = "Undo";
    undoButton.onclick = this.onUndo.bind(this);
    footer.append(undoButton);

    let doneButton = document.createElement("button");
    doneButton.textContent = "Done!";
    doneButton.onclick = this.onDone.bind(this);
    footer.append(doneButton);
  }

  async ensureModules() {
    if (this.wasmReady) {
      return;
    }

    console.log(`Loading effect list...`);

    const { ImageModule } = await import(`/js/image_module.js`);
    const { addConsoleToImports } = await import(`/js/console.js`);

    this.module = new ImageModule();

    let imports = {};
    addConsoleToImports(imports, new ConsoleImpl("ImageModule"), (what) => {
      if (what == "memory") {
        return this.module._exports.memory;
      } else {
        console.error("Unsupport get_export() parameter: ", what);
      }
    });

    const wasmUrl = "/resources/images.wasm";
    await this.module.instantiate(fetch(wasmUrl), imports);
    console.log(`Module instanciated`);
    this.algorithms = this.module.algorithms(navigator.language);
    console.log(
      `Algorithms for ${wasmUrl}: `,
      this.algorithms.map((algo) => algo.name).join(",")
    );

    this.wasmReady = true;
  }

  asCanvas() {
    let canvas = new OffscreenCanvas(
      this.img.naturalWidth,
      this.img.naturalHeight
    );
    let ctxt = canvas.getContext("2d");

    ctxt.drawImage(
      this.img,
      0,
      0,
      this.img.naturalWidth,
      this.img.naturalHeight
    );
    return { canvas, ctxt };
  }

  async applyAlgorithm(algo) {
    console.log(`Applying '${algo}'`);

    await this.ensureModules();

    let { canvas, ctxt } = this.asCanvas();
    let dx = canvas.width;
    let dy = canvas.height;
    let imageData = ctxt.getImageData(0, 0, dx, dy);
    let newData = this.module.processImage(algo, imageData.data, dx, dy);
    let buffer = newData.buffer;
    let res = new Uint8ClampedArray(buffer, 0, buffer.byteLength);
    ctxt.putImageData(new ImageData(res, dx, dy), 0, 0);

    this.resultBlob = await canvas.convertToBlob();
    this.img.src = this.createObjectURL(this.resultBlob);
  }

  createObjectURL(blob) {
    if (this.revokable) {
      URL.revokeObjectURL(this.revokable);
    }
    this.revokable = URL.createObjectURL(blob);
    return this.revokable;
  }

  onUndo() {
    this.img.src = this.createObjectURL(this.blob);
  }

  onDone() {
    // Resolve the defered promise with a blob.
    console.log(`Resolving with ${this.resultBlob}`);
    this.defered(this.resultBlob);
    window.close();
  }

  getResult() {
    return new Promise((resolve) => {
      this.defered = resolve;
    });
  }
}

async function processImage(data) {
  let processor = new ImageProcessor(data.blob);
  await processor.init();

  return await processor.getResult();
}
