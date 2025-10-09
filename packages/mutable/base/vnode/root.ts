import { MutViewNode } from "./view"
import { WrapedNode } from "./wraped"

export class MutNodeRoot {
    shadow: ShadowRoot
    viewNode?: MutViewNode

    private updateFn = () => { this.update() }
    constructor(
        public cntr = document.createElement('div')
    ) {
        this.cntr.style.height = '100%'
        this.shadow = this.cntr.attachShadow({ mode: 'open' })
    }

    private caches: WrapedNode[] = []

    inject(viewNode: MutViewNode) {
        if (this.viewNode) {
            this.viewNode.target.off(this.updateFn)
        }
        this.viewNode = viewNode
        this.viewNode.target.on(this.updateFn)
        this.update()
    }

    update() {
        const blank = document.createElement('div')
        this.caches.forEach(node => node.appendTo(blank))
        this.caches = []
        this.viewNode?.target.val().forEach(node => {
            node.appendTo(this.shadow)
            this.caches.push(node)
        })
    }
}
