//import { JSDOM, ResourceLoader, CookieJar } from "jsdom";
import { JSDOM, ResourceLoader, CookieJar } from "../../custom-jsdom/lib/api.js";

import { existsSync } from "fs";
import {default as puppeteer} from "puppeteer-extra"
import { Script, runInContext } from "vm";
import { Cookie } from "tough-cookie";
import { HTTPRequest } from "../Networking/index.js";

class Page {
  #vm;
  #dom;
  #window;
  #console;
  #cookieJar;
  #resourceLoader;

  #url;
  #browser;

  #eventLoop = [
    {
      name: "request",
      default: true,
      func: (request) => {
        request.continue();
      },
    },
  ];

  setRequestInterception() {}

  setViewport(viewport) {}

  screenshot(options) {
    return new Promise((resolve, reject) => {
        if(!(this.#browser.options.executablePath && existsSync(this.#browser.options.executablePath)))
          throw new Error("You need to provide executablePath at launch for the ability to screenshot")
        
        puppeteer.launch({
          headless: "new",
          executablePath: this.#browser.options.executablePath
        }).then(async (browser) => {
          try {
            function cancel(err) {throw new Error(err)}

            let page = await browser.newPage().catch(cancel)
            await page.setJavaScriptEnabled(false).catch(cancel)
            await page.setContent(this.#dom.serialize()).catch(cancel)

            resolve(await page.screenshot(options).catch(cancel))

            await browser.close().catch(cancel)
          } catch (err) {
            reject(err)
          }
        })
    })
  }

  type(selector, text) {}

  waitForSelector(selector, options) {}

  click(selector) {
    return new Promise((resolve, reject) => {
      let element = this.$(selector)
      if(!element) reject(new Error("Element with this selector doesn't exist"))

      try {
        var evt = this.#window.document.createEvent("HTMLEvents");
        evt.initEvent("click", false, true);

        element.dispatchEvent(evt)
        resolve()
      } catch(err) {
        reject(new Error(`Unable to click. Error: ${err}`))
      }
    })
  }

  content() {
    return this.#dom.serialize()
  }

  evaluate(func) {
    if (typeof func !== "function")
      throw new Error("AXYUM only supports evaluating function");
    
    return runInContext(`(${func})()`, this.#vm)
  }

  $(selector) {
    return this.#window.document.querySelector(selector)
  }

  $$(selector) {}

  $x(Xpath) {}

  setCookies(cookies) {
    let list = [];
    for (let cookie of cookies) {
      let newCookie = new Cookie(cookie);

      list.push(
        this.#cookieJar.setCookie(
          newCookie,
          `${newCookie.secure ? "https" : "http"}://www.${newCookie.domain}`
        )
      );
    }

    return Promise.all(list);
  }

  deleteCookie(cookie) {
    let newCookie = new Cookie({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      expires: new Date(0),
    });

    return this.#cookieJar.setCookie(
      newCookie,
      `${newCookie.secure ? "https" : "http"}://www.${newCookie.domain}`
    );
  }

  async getCookies(url) {
    return this.#cookieJar.getCookies(url);
  }

  async navigate(url, oldUrl) {
    let oldCookies = [];

    if (this.#cookieJar) {
      //oldCookies = await this.getCookies()
    }

    this.#url = url;
    this.#cookieJar = new CookieJar(null);
    this.setCookies(oldCookies);

    return new Promise((resolve, reject) => {
      let newRequest = new HTTPRequest(
        url,
        this,
        true,
        "document",
        "GET",
        null,
        this.#browser.proxy || "",
        {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7,he;q=0.6",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
          "upgrade-insecure-requests": "1",
        },
        (result) => {
          if (result.status.toString()[0] !== "2") {
            reject(new Error("Server send non 2xx status code"))
          } else {
            class CustomResourceLoader extends ResourceLoader {
              constructor(options, window) {
                console.log(options);
                super(options);
              }

              fetch(rURL, options) {
                return new Promise((resolve, reject) => {
                  let request = new HTTPRequest(
                    rURL,
                    this,
                    false,
                    "document",
                    "GET",
                    null,
                    this.#browser.proxy || "",
                    {
                      accept:
                        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                      "accept-encoding": "gzip, deflate, br",
                      "accept-language":
                        "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7,he;q=0.6",
                      "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
                      "upgrade-insecure-requests": "1",
                    },
                    (result) => {
                      if (result.status.toString()[0] !== "2") {
                        resolve(`ERROR ${result.status}`);
                      } else {
                        resolve(result.body);
                      }
                    }
                  );

                  this.emit("request", request);
                });
              }
            }

            const dom = new JSDOM(result.body, {
              url: url,
              referrer: oldUrl || url,
              contentType: "text/html",
              //includeNodeLocations: true,
              storageQuota: 5000000,
              runScripts: "dangerously",
              cookieJar: this.#cookieJar,
              pretendToBeVisual: true,
              //resources: new CustomResourceLoader()
              beforeParse(window) {},
            });

            this.#vm = dom.getInternalVMContext();
            this.#dom = dom;
            this.#window = dom.window;

            dom.virtualConsole.on("jsdomError", (text) =>
              this.emit("console", { type: () => "error", text: () => text })
            );
            dom.virtualConsole.on("error", (text) =>
              this.emit("console", { type: () => "error", text: () => text })
            );
            dom.virtualConsole.on("warn", (text) =>
              this.emit("console", { type: () => "warning", text: () => text })
            );
            dom.virtualConsole.on("info", (text) =>
              this.emit("console", { type: () => "info", text: () => text })
            );
            dom.virtualConsole.on("dir", (text) =>
              this.emit("console", { type: () => "info", text: () => text })
            );

            resolve();
          }
        }
      );

      this.emit("request", newRequest);
    });
  }

  goto(newPage) {
    return this.navigate(newPage, this.#url);
  }

  url() {
    return this.#url;
  }

  on(name, func) {
    this.#eventLoop = this.#eventLoop.filter(
      (v) => !(v.default && name == v.name)
    );
    this.#eventLoop.push({ name, func });
  }

  emit() {
    let args = [...arguments];
    let name = args.shift();
    let possibleEvents = this.#eventLoop.filter((e) => e.name == name);
    for (let event of possibleEvents) {
      event.func(...args);
    }
  }

  constructor(browser) {
    this.#browser = browser;
    this.navigate("about:blank");
  }
}

export { Page };
