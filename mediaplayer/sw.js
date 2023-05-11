const HAS_RETURN_VALUE_ACTIVITIES = ["p2p-tile-called"];
const ACTIVITIES_URL = {
  "p2p-tile-called": "/remote.html",
  "p2p-tile-start": "/index.html",
};
const ACTIVITIES_DISPOSITION = {
  "p2p-tile-called": "fullscreen",
};

try {
  importScripts(`http://shared.localhost/js/activity_sw.js`);
} catch (e) {
  // If the load from port 80 fails, fallback to port 8081.
  // TODO: smarter detection of which port to use.
  importScripts(`http://shared.localhost:8081/js/activity_sw.js`);
}
