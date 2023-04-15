const HAS_RETURN_VALUE_ACTIVITIES = ["process-image"];
const ACTIVITIES_URL = {
  "process-image": "/index.html",
};
const ACTIVITIES_DISPOSITION = {
  "process-image": "inline",
};

try {
  importScripts(`http://shared.localhost/js/activity_sw.js`);
} catch (e) {
  // If the load from port 80 fails, fallback to port 8081.
  // TODO: smarter detection of which port to use.
  importScripts(`http://shared.localhost:8081/js/activity_sw.js`);
}
