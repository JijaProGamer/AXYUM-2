function getAllChildNodes(node){
    const nodes = [];

    nodes.push(node);

    if (node.childNodes.length > 0) {
      node.childNodes.forEach(childNode => {
        nodes.push(...getAllChildNodes(childNode))
      })
    }

    return nodes;
}

class Sandbox {
    #vm;
    #DOM;
    #page;

    #document;

    setDocument(options) {
        let nodes = getAllChildNodes(options.document)

        for(let node of nodes){
            if(node.tagName == "LINK"){
                //console.log(node.innerHTML, node.attributes)
                console.log(node.attributes)
            }

            if(node.tagName == "SCRIPT"){ // Implement a order of things being run
                this.#DOM.runCode(node.innerHTML).catch(() => {})
            }
        }
    }

    constructor(options) {
        this.#vm = options.vm
        this.#DOM = options.DOM
        this.#page = options.page

        let vmSandbox = {
            window: {},
            globalThis: {},
            location: {},
            URL,
            setInterval: (func, time) => {
                let id = setInterval(() => this.runCode(func), time)
                this.#DOM.intervals.push(id)
            },
            setTimeout: (func) => {
                let id = setTimeout(() => this.runCode(func))
                this.#DOM.timeouts.push(id)
            },
            console: {
                log: (...args) => {
                    for (let arg of args) {
                        this.#DOM.page.emit("console", { type: () => "info", text: () => arg })
                    }
                },
                error: (...args) => {
                    for (let arg of args) {
                        this.#DOM.page.emit("console", { type: () => "error", text: () => arg })
                    }
                },
                assert: (...args) => {
                    if (!args.shift()) return;

                    for (let arg of args) {
                        this.#DOM.page.emit("console", { type: () => "info", text: () => arg })
                    }
                },
                count: (label = "default") => {
                    if (!this.#DOM.consoleCounts[label])
                        this.#DOM.consoleCounts[label] = 0

                    this.#DOM.consoleCounts[label] += 1
                    this.#DOM.page.emit("console", { type: () => "info", text: () => `${label}: ${this.#DOM.consoleCounts[label]}` })
                } // add all console methods
            }
        }

        for (let [name, value] of Object.entries(vmSandbox)) {
            this.#vm.freeze(value, name)
        }

        this.#DOM.runCode(() => {
            window = globalThis = global
            global = undefined
        })

        console.log(this.#DOM.runCode(() => console.log(true) ))
        //this.#DOM.runCode(() => {setInterval(() => console.log("OK!!"), 1000)} )
    }
}

export { Sandbox };
