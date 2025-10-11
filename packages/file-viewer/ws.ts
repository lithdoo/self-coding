import { wrapWebsocket } from "@pkg/ksrpc/wsc/node"
import { KWSRPCServerConversation, SyncKWSRPCServerConnection, KWSRPCServer } from "@pkg/ksrpc/wss"
import { readFileSync } from "fs"
import path from "path"
import WebSocket, { RawData } from "ws"
import { FileWithInfo } from "./base"
import { startFileServer } from './file-server'





class KWSRPCServerSingleClientConversation implements KWSRPCServerConversation {




    constructor(public fileList: FileList) {
        fileList.onChange = () => {
            this.reload()
        }
        try{ 
            startFileServer(6679)
        }catch(_e){

        }
    }

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
                    this.reload()
                })
                return null
            }
        })
    }

    disconnect(connection: SyncKWSRPCServerConnection) {
        if (this.connection === connection) {
            this.connection = undefined
        }
    }


    reload() {
        this.connection?.request({
            method: 'mut-web-view/server/init',
            params: {
                timestamp: this.timestamp,
                data: { 'files': [...this.fileList.list] },
                rootComponent: 'root',
                template: readFileSync(path.resolve(__dirname, './helloworld.xml')).toString()
            }
        })
    }

}


class FileList {
    list: FileWithInfo[] = []
    onChange?: () => void
    update(list: FileWithInfo[]) {
        this.list = list
        this.onChange?.()
    }
}


export class FileViewerRPCServer extends KWSRPCServer<SyncKWSRPCServerConnection> {

    conversations = new Map<string, KWSRPCServerConversation>()
    fileList = new FileList()

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
                    ?? new KWSRPCServerSingleClientConversation(server.fileList)
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