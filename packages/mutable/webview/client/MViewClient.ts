import type { RenderTemplateContext } from "../../view/xml/base";
import { MutComputed, MutVal, type Mutable } from "../../base";
import { MVRenderer, type MutRootFragment } from "../../view/render";
import { XMLParserTask } from "../../view/xml/xmlParser";
import { SyncAutoReconnectKWSRPC } from "@pkg/ksrpc/wsc/web";



export class ClientStore {
    state: Map<string, Mutable<any>> = new Map()
    ts: number = 0
    rootFragment?: MutRootFragment
    renderOption?: {
        rootComponent: string,
        template: RenderTemplateContext
    }


    constructor(public container: HTMLElement | ShadowRoot) {

    }

    onRootChanged?(): void
    reload(data: { [key: string]: any }, ts: number) {
        this.state = new Map();
        Object.entries(data).forEach(([key, value]) => {
            this.state.set(key, new MutVal(value))
        })
        this.ts = ts
        this.rerender()
    }

    setOption(rootName: string, template: string) {
        this.renderOption = {
            rootComponent: rootName,
            template: new XMLParserTask(template)
        }
        this.rerender()
    }

    rerender() {
        this.rootFragment?.destroy()
        if (this.renderOption) {
            this.rootFragment = new MVRenderer(
                this.renderOption.template
            ).renderRoot(
                this.renderOption.rootComponent,
                [...this.state.entries()].reduce((res, [key, val]) => {
                    res[key] = new MutComputed(binder => binder(val))
                    return res
                }, {} as { [key: string]: MutComputed<any> }),
                () => { }
            )
            this.rootFragment.bind(this.container)
        }
        this.onRootChanged?.()
    }
}


export class MutWebViewClient extends ClientStore {
    rpc: SyncAutoReconnectKWSRPC
    constructor(
        public ws: string,
        public container: HTMLElement | ShadowRoot
    ) {
        super(container)

        const rpc = new SyncAutoReconnectKWSRPC(ws)

        rpc.onOpen = () => {
            this.init()
        }

        rpc.method({
            name: 'mut-web-view/server/init',
            params: [
                'timestamp',
                'data',
                'rootComponent',
                'template'
            ],
            call: async (
                timestamp: number,
                data: { [key: string]: any },
                rootComponent: string,
                template: string
            ) => {
                try {
                    this.renderOption = undefined
                    this.reload(data, timestamp)
                    this.setOption(rootComponent, template)
                } catch (e) {
                    console.error(e)
                }
            }
        })


        this.rpc = rpc
        this.rpc.open()
    }

    init() {
        this.rpc.request({
            method: 'mut-web-view/client/reload',
            params: {},
        })
    }

    destroy() {
        this.rpc.close()
        this.rootFragment?.destroy()
    }

}