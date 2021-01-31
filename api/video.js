const chromium = require("chrome-aws-lambda");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 *# orz token is JWT token
 *# header: base64 encoded of {"orz":[cookie.l_ortkn]}
 *# payload: base64 encoded of {"orz":[cookie.l_ortkn]}
 *# signature: base64 encoded of {"orz":[cookie.l_ortkn]}
 *# post to https://live.fc2.com/api/getControlServer.php
 *#   with: channel_id: video_id
 *#   with: mode: "mode"
 *#   with: orz: ***
 *#   with: channel_version: "33fe385c-5eed-4e15-bb04-a6b5ae438d8e"
 *#   with: client_version: "2.0.0\n+[1]"
 *#   with: client_type: "pc"
 *#   with: client_app: "browser_hls"
 *#   with: ipv6: ""
 *# websocket to [url]?control_token=[control_token]
 *# send {"name":"get_hls_information","arguments":{},"id":1}
 *# test against .argumtnts.playlists[].url
 *# done
 */

module.exports = async (req, res) => {
  const { id, take } = req.query;
  const { puppeteer } = chromium;
  const browser = await puppeteer.launch({
    args: [...chromium.args, "--autoplay-policy=no-user-gesture-required"],
    executablePath: (await chromium.executablePath) || process.env.CHROMIUM_PATH,
    env: process.env,
  });
  const page = await browser.newPage();
  let data = null;
  try {
    data = await new Promise((resolve, reject) => {
      (async () => {
        page
          .on("console", (message) => console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
          .on("pageerror", ({ message }) => console.log(message))
          .on("response", (response) => console.log(`${response.status()} ${response.url()}`))
          .on("requestfailed", (request) => console.log(`${request.failure().errorText} ${request.url()}`));
        await page.setRequestInterception(true);
        page._client.on("Network.webSocketFrameReceived", (data) => {
          console.log(data);
          resolve(data);
          res.send(data.response.payloadData);
        });
        try {
          await page.goto(`https://live.fc2.com/${id}/`, {
            timeout: 2000,
          });
        } catch (e) {}
        console.log("loaded");
        if (take == "yes" || take == "take") {
          // send screenshot for debugging
          const img = await page.screenshot({ type: "png" });
          res.setHeader("Content-Type", "image/png");
          res.send(img);
        }
      })().catch(reject);
    });
  } finally {
    await page.close();
    await browser.close();
  }
};
