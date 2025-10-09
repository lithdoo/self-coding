import WebSocket, { RawData } from "ws"
import { KWSRPCServer, WSSConnection } from "./createServer"
import { CrossEnvWebSocket, SyncKWSRPC } from "../wsc/common"
export * from './createServer'


export interface KWSRPCServerConversation {
    id: string
    connect(connection: WSSConnection): void
    disconnect(connection: WSSConnection): void
}

export abstract class SyncKWSRPCServerConnection extends SyncKWSRPC implements WSSConnection {

    abstract getConversation(id: string): KWSRPCServerConversation

    conversation?: KWSRPCServerConversation

    constructor(public ws: CrossEnvWebSocket) {
        super()
        this.method({
            name: 'connect/open',
            params: ['id'],
            call: async (id?: string) => {
                if (this.conversation) return this.conversation.id
                const conversation = this.getConversation(id)
                this.conversation = conversation
                this.conversation.connect(this)
                return this.conversation.id
            }
        })
    }

    onOpen?: () => void

    onSocketMessage(data: WebSocket.RawData) {
        super.onMessage(this.ws, { data: data.toString() } as any)
    }
    onSocketClose() {
        this.conversation?.disconnect(this)
    }

}



// electron example
export class KWSRPCServerSingleClientConversation implements KWSRPCServerConversation {

    connection?: SyncKWSRPCServerConnection

    readonly id = Math.random().toString()

    connect(connection: SyncKWSRPCServerConnection): void {
        this.connection = connection
        console.log('connection')
        console.log('eval-script/store/call')

        Promise.resolve().then(async () => {
            await this.connection.request({
                method: 'eval-script/store/call',
                params: {
                    func: ['BrowserWindow'],
                    constructor: true,
                    store: ['mainWindow'],
                    argus: [{
                        type: 'json',
                        value: {
                            width: 1200,
                            height: 800,
                            webPreferences: {
                                nodeIntegration: false, // 出于安全考虑默认禁用node集成
                                contextIsolation: true, // 启用上下文隔离
                            },
                        }
                    }]
                }
            })

            await this.connection.request({
                method: 'eval-script/store/call',
                params: {
                    func: ['mainWindow', 'loadURL'],
                    constructor: false,
                    argus: [{
                        type: 'json',
                        value: 'https://www.baidu.com'
                    }]
                }
            })

            await this.connection.request({
                method: 'eval-script/store/call',
                params: {
                    func: ['mainWindow', 'webContents', 'openDevTools'],
                    constructor: false,
                    argus: []
                }
            })
        })
            .catch(e => {
                console.error(e)
            })

    }

    disconnect(connection) {
        if (this.connection === connection) {
            this.connection = undefined
        }
    }

}



