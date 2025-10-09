import { wrapWebsocket } from "@pkg/ksrpc/wsc/node"
import { KWSRPCServer, KWSRPCServerConversation, SyncKWSRPCServerConnection } from "@pkg/ksrpc/wss"
import { readFileSync } from "fs"
import path from "path"
import WebSocket, { RawData } from "ws"




// electron example
export class KWSRPCServerSingleClientConversation implements KWSRPCServerConversation {

    connection?: SyncKWSRPCServerConnection

    readonly id = Math.random().toString()

    timestamp = new Date().getTime()

    connect(connection: SyncKWSRPCServerConnection): void {
        this.connection = connection
        console.log('connection')
        console.log('eval-script/store/call')


        this.connection.method({
            name: 'mut-web-view/client/reload',
            params: [],
            call: async () => {
                setTimeout(() => {
                    this.connection.request({
                        method: 'mut-web-view/server/init',
                        params: {
                            timestamp: this.timestamp,
                            data: { 'time': '123' },
                            rootComponent: 'root',
                            template: readFileSync(path.resolve(__dirname, './helloworld.xml')).toString()
                        }
                    })
                })
                return null
            }
        })
    }

    disconnect(connection) {
        if (this.connection === connection) {
            this.connection = undefined
        }
    }


    reload() {

    }

}




const server = new class extends KWSRPCServer<SyncKWSRPCServerConnection> {

    conversations = new Map<string, KWSRPCServerConversation>()

    constructor() {
        super(6678)
    }

    createConnect(ws: WebSocket) {
        const server = this
        return new class extends SyncKWSRPCServerConnection {
            constructor() {
                super(wrapWebsocket(ws))
            }

            onSocketOpen() { }

            getConversation(id: string): KWSRPCServerConversation {
                const conversation = server.conversations.get(id)
                    ?? new KWSRPCServerSingleClientConversation()
                server.conversations.set(id, conversation)
                return conversation
            }
            onSocketClose(): void {
                console.log('close')
                super.onSocketClose?.()
            }
            onSocketMessage(data: RawData): void {
                console.log('data:')
                console.log(data.toString())
                super.onSocketMessage?.(data)
            }
        }
    }
}

server.start()