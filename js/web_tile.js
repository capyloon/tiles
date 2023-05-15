// <web-tile> custom element: displays an overview card of a Web Tile.
// TODO: l10n

((global) => {
  const css = `
:host {
  border: 2px solid wheat;
  border-radius: 0.5em;
  padding: 0.5em;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  width: fit-content;
  font-family: sans-serif;
  background: linear-gradient(to bottom right, wheat, white);
}

:host .header {
  display: flex;
  align-items: center;
  gap: 0.5em;
  font-weight: bolder;
}

:host .header img {
  width: 36px;
}

:host .description {
  font-size: smaller;
}

:host .actions {
  display: flex;
  justify-content: end;
  gap: 1em;  
}`;

  // Construct a stylesheet that will be shared among
  // <web-tile> instances. 
  const styleSheet = new CSSStyleSheet();
  styleSheet.replaceSync(css);

  class WebTile extends HTMLElement {
    constructor() {
      super();
      console.log("constructor");
      this.shadow = this.attachShadow({ mode: "open" });
      this.shadow.adoptedStyleSheets = [styleSheet];
      // Using innerHTML here is fine since we only use
      // .textContent to populate it later.
      this.shadow.innerHTML = `
      <div class="header">
        <img/>
        <span></span>
      </div>
      <div class="description"></div>
      <div class="actions">
        <button class="action-open">Open</button>
        <button class="action-share">Share</button>
        <button class="action-install">Install</button>
      </div>`;
      this.shadow.querySelector(".action-open").onclick =
        this.onOpen.bind(this);
      this.shadow.querySelector(".action-share").onclick =
        this.onShare.bind(this);
      this.shadow.querySelector(".action-install").onclick =
        this.onInstall.bind(this);
    }

    log(msg) {
      console.log(`WebTile[${this.getAttribute("src")}]: ${msg}`);
    }

    error(msg) {
      console.error(`WebTile[${this.getAttribute("src")}]: ${msg}`);
    }

    onOpen() {
      window.open(this.startUrl, "_blank");
    }

    onShare() {
      navigator.share(this.sharedData);
    }

    onInstall() {
      let installer = new WebActivity("install-tile", {
        manifestUrl: this.manifestUrl,
      });
      installer.start().then(
        (result) => {
          this.log(`onInstall success, installed=${result}`);
        },
        (error) => {
          this.error(`onInstall failed: ${error}`);
        }
      );
    }

    // Use the first icon for now.
    // TODO: select the "best" one for this use case.
    findIcon(manifest) {
      this.log(`findIcon`);
      if (manifest.icons && manifest.icons[0]) {
        this.log(`icon src=${manifest.icons[0].src}`);
        return new URL(manifest.icons[0].src, this.manifestUrl);
      }
      return null;
    }

    // Refresh the display when either the 'src' or 'devmode'
    // attributes are modified.
    attributeChangedCallback(name, oldValue, newValue) {
      if (name === "src" || name === "devmode") {
        this.refresh();
      }
    }

    async refresh() {
      const devMode = this.hasAttribute("devmode");
      const src = this.getAttribute("src");
      this.url = null;
      try {
        this.url = new URL(src, location);
      } catch (e) {
        this.error(`Invalid src: ${src}`);
        return;
      }

      if (this.url.protocol !== "tile:" && !devMode) {
        this.error(`Enable devmode to load tiles from ${this.url}`);
        return;
      }

      // Fetch the manifest.
      this.manifestUrl = new URL("manifest.webmanifest", this.url);
      let response = await fetch(this.manifestUrl);
      let manifest = await response.json();
      this.shadow.querySelector(".header span").textContent = manifest.name;
      this.shadow.querySelector(".description").textContent =
        manifest.description;
      this.shadow.querySelector(".header img").src = this.findIcon(manifest);

      this.startUrl = new URL(manifest.start_url || "", this.manifestUrl);

      this.sharedData = {
        title: manifest.name,
        text: manifest.description,
        url: this.url,
      };
    }

    async connectedCallback() {
      this.log("connectedCallback");
      this.refresh();
    }
  }

  global.customElements.define("web-tile", WebTile);
})(window);
