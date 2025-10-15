import { wrapWebsocket } from "@pkg/ksrpc/wsc/node"
import { KWSRPCServerConversation, SyncKWSRPCServerConnection, KWSRPCServer } from "@pkg/ksrpc/wss"
import { readFileSync } from "fs"
import path from "path"
import WebSocket, { RawData } from "ws"
import { FileWithInfo } from "./base"
import { startFileServer } from './file-server'





class KWSRPCServerSingleClientConversation implements KWSRPCServerConversation {

    constructor(public fileList: FileList) {
        fileList.onListChange = () => {
            this.reload()
        }
        fileList.onDetailChange = () => {
            this.updateDetail()
        }
        try {
            startFileServer(6679)
        } catch (_e) {

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

        this.connection.method({
            name: 'mut-web-view/client/view/event',
            params: ['event', 'payload'],
            call: async (event: any, payload: any) => {
                const [emitName, ...params] = payload

                if (emitName === 'detail') {
                    const filepath = params[0]
                    const fileInfo = this.fileList.list.find(v => v.filepath === filepath)
                    this.fileList.updateDetail(fileInfo ?? null)
                }

                if (emitName === 'search-input') {
                    const input = event?.inputValue
                    if (typeof input === 'string') this.inputValue = input
                }


                if (emitName === 'search-emit') {
                    console.log(this.onSearchChanged)
                    this.onSearchChanged?.(this.inputValue)
                }
            }
        })
    }


    inputValue: string = ''

    onSearchChanged?: (text: string) => void

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
                data: { 'files': [...this.fileList.list], 'detail': this.fileList.detail },
                rootComponent: 'root',
                template: readFileSync(path.resolve(__dirname, './helloworld.xml')).toString()
            }
        })
    }

    updateDetail() {
        this.connection?.request({
            method: 'mut-web-view/server/state/update',
            params: {
                from: this.timestamp,
                to: this.timestamp,
                name: 'detail',
                value: this.fileList.detail
            }
        })
    }

}


class FileList {
    list: FileWithInfo[] = []
    detail: FileWithInfo | null = null
    onListChange?: () => void
    onDetailChange?: () => void
    updateList(list: FileWithInfo[]) {
        this.list = list
        this.detail = null
        this.onListChange?.()
    }

    updateDetail(detail?: FileWithInfo | null) {
        this.detail = detail
        this.onDetailChange?.()
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
                    ?? new KWSRPCServerSingleClientConversation(server.fileList);


                (conversation as KWSRPCServerSingleClientConversation).onSearchChanged = (text) => server.onSearchChanged?.(text)
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



    onSearchChanged?: (text: string) => void
}