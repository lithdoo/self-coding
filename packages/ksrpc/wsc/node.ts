import { CrossEnvWebSocket, SyncKWSRPC } from './common'
export * from './common'
import { WebSocket } from 'ws'


export const wrapWebsocket = (ws: WebSocket) => {
    const wrapper: CrossEnvWebSocket = {
        get readyState() {
            return ws.readyState
        },
        send: (data) => {
            if (typeof data === 'string') {
                ws.send(data);
            } else if (data instanceof Blob) {
                // 处理 Blob 类型（Node.js 中需要转换为 Buffer）
                const reader = new FileReader();
                reader.onload = () => {
                    if (reader.result instanceof ArrayBuffer) {
                        ws.send(Buffer.from(reader.result));
                    }
                };
                reader.readAsArrayBuffer(data);
            } else {
                ws.send(Buffer.from(data as any));
            }
        },
        close: (code?, reason?) => ws.close(code, reason),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
    };

    ws.on('open', (event: any) => {
        if (wrapper.onopen) wrapper.onopen(event);
    });

    ws.on('message', (data) => {
        if (wrapper.onmessage) {
            wrapper.onmessage({ data: data.toString(), type: 'message' });
        }
    });

    ws.on('error', (error) => {
        if (wrapper.onerror) wrapper.onerror({ type: 'error', error });
    });

    ws.on('close', (code, reason) => {
        if (wrapper.onclose) {
            wrapper.onclose({ type: 'close', code, reason: reason.toString() });
        }
    });

    return wrapper
}

export class SyncAutoReconnectKWSRPC extends SyncKWSRPC {
    id?: string
    status: 'pending' | 'open' | 'closed' = 'pending'
    constructor(public url: string) {
        super()
    }


    protected connect(): CrossEnvWebSocket {

        const ws = new WebSocket(this.url);
        return wrapWebsocket(ws)
    }
    onOpen?: (wsrpc: this, id: string) => void


    protected async onSocketOpen(ws: CrossEnvWebSocket): Promise<string> {
        if(this.status === 'closed') return
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


