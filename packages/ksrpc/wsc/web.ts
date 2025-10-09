import { CrossEnvWebSocket, SyncKWSRPC } from './common'
export * from './common'



export class SyncAutoReconnectKWSRPC extends SyncKWSRPC {
    id?: string

    status: 'pending' | 'open' | 'closed' = 'pending'
    constructor(public url: string) {
        super()
    }


    protected connect(): CrossEnvWebSocket {
        return new (globalThis as any).WebSocket(this.url)
    }



    onOpen?: (wsrpc: this, id: string) => void

    protected async onSocketOpen(ws: CrossEnvWebSocket): Promise<string> {
        if (this.status === 'closed') return
        console.log('onSocketOpen')
        return this
            .request<string>({
                method: 'connect/open',
                params: { id: this.id ?? null }
            })
            .then((id) => {
                this.id = id
                this.onOpen?.(this, id)
                this.status = 'open'
                return id
            })
    }

    protected waittingToReconnect?: Promise<void>
    protected onSocketClose(ws: CrossEnvWebSocket): void {
        if(this.status === 'closed') return
        if (this.waittingToReconnect) return

        this.ws = undefined
        this.status = 'pending'

        if (this.current) {
            this.current.reject(new Error('websocket close'))
            this.current = null
        }

        this.waittingToReconnect = new Promise(async res => {
            await new Promise(res => setTimeout(res, 2000))
            this.open()
            res(null)
        }).then(() => {
            this.waittingToReconnect = undefined
        })
    }

    open() {
        if (this.ws) { this.ws.close() }
        if(this.status === 'closed') return
        const ws = this.connect()
        ws.onclose = () => this.onSocketClose(ws)
        ws.onopen = () => this.onSocketOpen(ws)
        ws.onmessage = (ev: any) => this.onMessage(ws, ev)
        this.ws = ws
    }
    
    close(){
        this.status = 'closed'
        this.ws?.close()
    }
}


