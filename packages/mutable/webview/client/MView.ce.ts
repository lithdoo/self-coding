import { MutWebViewClient } from "./MViewClient"





class MutWebViewElement extends HTMLElement {

    wsUrl?: string
    connectId?: string
    client?: MutWebViewClient

    constructor() {
        super()
        // 2. 创建 Shadow DOM
        this.attachShadow({ mode: 'open' });
    }

    // 8. 属性变化观察器
    static get observedAttributes() {
        return ['ws-url', 'connecti-id'];
    }


    attributeChangedCallback(name: string, oldVal: string, newVal: string) {
        if (name === 'ws-url') {
            this.wsUrl = newVal
            this.initGraph()
        }

        // if (name === 'id') {
        //     this.connectId = newVal
        //     this.initGraph()
        // }
    }

    initGraph() {
        if (this.client) {
            this.client.destroy()
            this.client = undefined
        }
        if (!this.wsUrl) return
        this.client = new MutWebViewClient(
            this.wsUrl,
            this.shadowRoot
        )
        
            console.log(this.client)
    }

}


customElements.define('mut-view', MutWebViewElement);