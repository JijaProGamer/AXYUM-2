import { launch } from "./index.js";

function sleep(ms){return new Promise(r => setTimeout(r, ms))}

launch({
    executablePath: "/snap/bin/chromium",
}).then(async (browser) => {
    let page = await browser.newPage()

    /*page.on('request', request => {
        if (request.resourceType() === 'image')
            request.abort();
        else
            request.continue();
    });*/

    await page.goto("https://www.youtube.com/watch?v=oR-mzzIsHVE", { waitUntil: "networkidle0" })
    await sleep(1000)

    await page.screenshot({path: "e.png", fullPage: true})


    console.log("Done")
})