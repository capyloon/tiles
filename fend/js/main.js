
function log(msg) {
  console.log(`Fend[${location.hostname}] ${msg}`);
}

document.addEventListener("DOMContentLoaded", async () => {
  log("DOM ready");
  
  let input = document.getElementById("input");

  document.getElementById("btn-search").onclick = async () => {
    let provider = new WebActivity("search-provider", { input: input.value });
    try {
      let result = await provider.start();
      console.log(result);
      document.getElementById("result").textContent = JSON.stringify(result);
    } catch (e) {
      log(e);
    }
  };
});
