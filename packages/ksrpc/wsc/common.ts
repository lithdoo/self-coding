/**
 * 跨环境 WebSocket 客户端模块
 * 支持浏览器原生 WebSocket 和 Node.js (ws 库)
 */

import { dealRequstParams, JsonRpcErrorResponse, JsonRpcRequest, JsonRpcSuccessResponse, parseRawContent, RPCErrorCode, RPCMethod, RPCRequest } from "../base";
import { ManualPromise } from "../utils";

// 定义统一的 WebSocket 接口，抽象两种环境的差异
export interface CrossEnvWebSocket {
    readyState: number
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
    close(code?: number, reason?: string): void;
    onopen: ((event: Event | { type: 'open' }) => void) | null;
    onmessage: ((event: { data: string | Buffer; type: 'message' }) => void) | null;
    onerror: ((event: Error | { type: 'error'; error: Error }) => void) | null;
    onclose: ((event: { type: 'close'; code: number; reason: string }) => void) | null;
    raw?(): WebSocket
}


export abstract class KWSConnection {



    ws?: CrossEnvWebSocket


    protected abstract onSocketOpen(ws: CrossEnvWebSocket): void
    protected abstract onSocketClose(ws: CrossEnvWebSocket): void
    protected abstract onMessage(ws: CrossEnvWebSocket, message: MessageEvent<any>): void


}



export abstract class KWSRPC extends KWSConnection {
    static TimeoutSignal = Symbol()

    reqTable: Map<string | number, ManualPromise<unknown>> = new Map()
    methods: Map<string, RPCMethod> = new Map()

    async request(request: RPCRequest) {
        const {
            method,
            params,
            withoutResult,
            timeout
        } = request

        const timeoutPromise = (!timeout ? new Promise(_res => { })
            : typeof timeout === 'number' ? new Promise(res => setTimeout(() => res, timeout))
                : Promise.resolve(timeout)
        ).then(() => KWSRPC.TimeoutSignal)

        const id: string = Math.random().toString()
        const data = { jsonrpc: "2.0", method, params, id: id as string | null }
        const promsie = new ManualPromise()

        if (withoutResult) {
            data.id = null
        } else {
            this.reqTable.set(id, promsie)
        }

        if (!this.ws || this.ws.readyState !== 1) {
            throw new Error('websockt is not available!!!')
        }

        this.ws.send(JSON.stringify(data))

        if (!withoutResult) {
            return Promise.race([promsie.target, timeoutPromise])
                .then(data => {
                    if (data === KWSRPC.TimeoutSignal) {
                        throw new Error("request timeout!!!")
                    } else {
                        return data
                    }
                })
        }

    }
    protected onMessage(_ws: CrossEnvWebSocket, message: MessageEvent<any>): void {
        const data = message.data

        console.log({data})

        if (typeof data !== 'string') {
            return
        }

        const json = parseRawContent(data)

        console.log(json)

        if (json.type === 'response:error' && json.id) {
            const promise = this.reqTable.get(json.id)
            const error = json.error
            promise?.reject(new class extends Error {
                data = error.data
                code = error.code
            }(error.message))
            this.reqTable.delete(json.id)
        } else if (json.type === 'response:result' && json.id) {
            const promise = this.reqTable.get(json.id)
            const result = json.result
            promise?.resolve(result)
        } else if (json.type === 'request') {
            this.handle(json)
        }
    }
    protected async handle(msg: JsonRpcRequest) {
        const { id, params, method } = msg
        const rpcMethod = this.methods.get(method)
        if (!rpcMethod && id) {
            const msg: JsonRpcErrorResponse = {
                type: 'response:error',
                jsonrpc: "2.0",
                id, error: { code: RPCErrorCode.MethodNotFound, message: 'Method Not Found' }
            }
            return this.ws?.send(JSON.stringify(msg))
        }

        if (!rpcMethod) return

        try {
            const args = dealRequstParams(params, rpcMethod.params)
            const result = await rpcMethod.call(...args)
            if (id) {
                const msg: JsonRpcSuccessResponse = {
                    type: 'response:result',
                    jsonrpc: '2.0',
                    id, result: result ?? null
                }
                return this.ws?.send(JSON.stringify(msg))
            }
        } catch (e: any) {
            if (id) {
                const msg: JsonRpcErrorResponse = {
                    type: 'response:error',
                    jsonrpc: "2.0",
                    id, error: {
                        code: RPCErrorCode.ServerError,
                        message: e.message ?? 'ServerError',
                        data: e
                    }
                }
                return this.ws?.send(JSON.stringify(msg))
            }
        }
    }

    method(method: RPCMethod) {
        this.methods.set(method.name, method)
        return this
    }
}


// 同步 PRC ，在处理一个任务的时候无法处理其他任务
export abstract class SyncKWSRPC extends KWSRPC {
    taskList: ({
        type: 'recevied'
        waitToHandle: JsonRpcRequest,
        result: ManualPromise<any>
    } | {
        type: 'send',
        waitToSend: RPCRequest,
        result: ManualPromise<any>
    })[] = []


    current: ManualPromise<any> | null = null

    next() {
        if (this.current) return
        if (!this.ws) return
        const task = this.taskList.shift()
        if (!task) return

        if (task.type === 'send') {
            const { waitToSend: request, result } = task

            const promise = super.request(request)

            promise.then((res) => {
                result.resolve(res)
            })

            promise.catch(err => {
                result.reject(err)
            })

            promise.finally(() => {
                this.current = null
                this.next()
            })
            this.current = result
        } else if (task.type = 'recevied') {
            const { waitToHandle: request, result } = task
            const promise = super.handle(request)

            promise.then((res) => {
                result.resolve(res)
            })

            promise.catch(err => {
                result.reject(err)
            })

            promise.finally(() => {
                this.current = null
                this.next()
            })
            this.current = result
        }
    }

    protected handle(msg: JsonRpcRequest): Promise<void> {
        const result = new ManualPromise<any>()
        this.taskList.push({
            type: 'recevied',
            waitToHandle: msg,
            result: result
        })
        this.next()
        return result.target
    }

    request<T = unknown>(request: RPCRequest): Promise<T> {
        const result = new ManualPromise<any>()
        this.taskList.push({
            type: 'send',
            waitToSend: request,
            result: result
        })
        this.next()
        return result.target
    }

}



