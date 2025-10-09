import Koa from 'koa';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';



export interface WsServerOption {
    readonly clients: Set<WebSocket.WebSocket>;
    readonly port: number,
    onWsOpen?(ws: WebSocket.WebSocket): void
    onWsClose?(ws: WebSocket.WebSocket): void
    onWsMessage?(ws: WebSocket.WebSocket, data: WebSocket.RawData): void
    onWsError?(ws: WebSocket.WebSocket, error: Error): void
}

export const createServer = (option: WsServerOption) => {
    console.log('createServer')

    const { clients, port } = option

    // 创建Koa应用
    const app = new Koa();

    // 创建HTTP服务器
    const server = http.createServer(app.callback());

    // 创建WebSocket服务器，附加到HTTP服务器
    const wss = new WebSocketServer({ server });

    // 处理HTTP请求
    app.use(async (ctx) => {
        ctx.body = 'Koa WebSocket服务器运行中\n';
    });

    // 处理WebSocket连接
    wss.on('connection', (ws: WebSocket.WebSocket) => {
        console.log('新客户端连接');
        // 将新客户端添加到集合
        clients.add(ws);
        option.onWsOpen?.(ws)
        // 处理客户端发送的消息
        ws.on('message', (data: WebSocket.RawData) => {
            try {
                option.onWsMessage?.(ws, data)
            } catch (e) {
                console.error(e)
            }

        });

        // 处理连接关闭
        ws.on('close', () => {
            console.log('客户端断开连接');
            option.onWsClose?.(ws)
            clients.delete(ws);

            // 通知其他客户端有用户离开
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'system',
                        message: '有客户端断开连接'
                    }));
                }
            });
        });

        // 处理错误
        ws.on('error', (error) => {
            option.onWsError?.(ws, error)
            console.error('WebSocket错误:', error);
        });
    });

    console.log('createServer')

    // 启动服务器
    server.listen(port, () => {
        console.log(`服务器运行在 http://localhost:${port}`);
        console.log(`WebSocket服务器运行在 ws://localhost:${port}`);
    });

}


export interface WSSConnection {
    onSocketMessage(data: WebSocket.RawData): void
    onSocketClose(): void
}



export abstract class KWSRPCServer<Connection extends WSSConnection> implements WsServerOption {

    clients = new Set<WebSocket>()
    connection: WeakMap<WebSocket, Connection> = new WeakMap()

    constructor(public readonly port: number) {

    }

    abstract createConnect(websocket: WebSocket): Connection

    onWsOpen(ws: WebSocket) {
        const connection = this.createConnect(ws)
        this.connection.set(ws, connection)
    }

    onWsClose(ws: WebSocket): void {
        const connect = this.connection.get(ws)
        if (connect) connect.onSocketClose()
        this.connection.delete(ws)
    }

    onWsMessage(ws: WebSocket, data: WebSocket.RawData) {
        const connect = this.connection.get(ws)
        if (connect) connect.onSocketMessage(data)
    }

    start() {
        createServer(this)
    }
}


