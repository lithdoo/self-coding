import { SyncKWSRPC } from "@pkg/ksrpc/wsc/web"

export class MutClientStore {

}

interface MutStoreVal {
    watch: string[]
    emitChange(): void
}

export class MVClient {
    outputs: MutStoreVal[] = []
    state: Map<string, any> = new Map()
    ts: number = 0
    changedkeys?: Set<string> = new Set()
    update(mutaions: [string, any][], to: number) {
        if (this.changedkeys) {
            mutaions
                .map(v => v[0])
                .forEach(key => this.changedkeys.add(key))
        }
        mutaions.forEach(([key, value]) => {
            if (value === null || value === undefined) {
                this.state.delete(key)
            } else {
                this.state.set(key, value)
            }
        })
        this.ts = to
        setTimeout(() => {
            this.emitChange()
        })
    }

    reload(stateData: { [key: string]: any }, ts: number) {
        this.state.clear()
        Object.entries(stateData).forEach(([key, value]) => {
            this.state.set(key, value)
        })
        this.changedkeys = undefined
        this.emitChange()

    }
    emitChange() {
        const changedkeys = this.changedkeys
        if (!changedkeys) {
            this.outputs.forEach(v => {
                try { v.emitChange() } catch (e) { console.error(e) }
            })
        } else {
            this.outputs.forEach(v => {
                const key = v.watch.find(key => changedkeys.has(key))
                if (key) {
                    try { v.emitChange() } catch (e) { console.error(e) }
                }
            })
        }
        this.changedkeys = new Set()
    }

}


export class MVElementClient extends MVClient {
    container = document.createElement('div')
    rootTemplate: string

    constructor(
        public ws: SyncKWSRPC
    ) { super() }


    async init() {

        this.ws.method({
            name: 'client/mutations',
            params: ['mutations', 'from', 'to'],
            call: async (mutaions: [string, any][], from: number, to: number) => {
                if (from === this.ts) {
                    this.update(mutaions, to)
                } else {
                    this.reloadAllState()
                }
            }
        })

        this.rootTemplate = await this.ws.request({
            method: 'server/template/root', params: []
        })
        this.reloadAllState()
    }

    async reloadAllState() {
        const res = await this.ws.request({
            method: 'server/state/all', params:[]
        }) as any
        const {data,timestamp}  = res
        this.reload(data,timestamp)
    }
}