export enum RPCErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
    ServerError = -32000
}


// 定义JSON-RPC消息的类型
export interface JsonRpcBase {
    type: 'request' | 'response:error' | 'response:result'
    jsonrpc: "2.0";
}

export interface JsonRpcRequest extends JsonRpcBase {
    type: 'request'
    method: string;
    params?: any[] | object;
    id?: number | string | null;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: any;
}

export interface JsonRpcSuccessResponse extends JsonRpcBase {
    type: 'response:result'
    result: any;
    id: number | string | null;
}

export interface JsonRpcErrorResponse extends JsonRpcBase {
    type: 'response:error',
    error: JsonRpcError;
    id: number | string | null;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;
export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse;

// 解析JSON-RPC消息的函数 
export function parseRawContent(jsonString: string): JsonRpcMessage {
    try {
        // 首先解析JSON字符串
        const parsed = JSON.parse(jsonString);

        // 验证基础结构
        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('JSON-RPC消息必须是一个对象');
        }

        if (parsed.jsonrpc !== '2.0') {
            throw new Error('JSON-RPC版本必须为"2.0"');
        }

        // 判断是请求还是响应
        if ('method' in parsed) {
            // 验证请求结构
            if (typeof parsed.method !== 'string') {
                throw new Error('JSON-RPC请求的method必须是字符串');
            }

            // 验证params（如果存在）
            if (parsed.params !== undefined &&
                !Array.isArray(parsed.params) &&
                typeof parsed.params !== 'object' &&
                parsed.params !== null) {
                throw new Error('JSON-RPC请求的params必须是数组、对象或未定义');
            }

            // 验证id（如果存在）
            if (parsed.id !== undefined &&
                parsed.id !== null &&
                typeof parsed.id !== 'number' &&
                typeof parsed.id !== 'string') {
                throw new Error('JSON-RPC请求的id必须是字符串、数字、null或未定义');
            };
            (parsed as JsonRpcRequest).type = 'request'
            return parsed as JsonRpcRequest;
        } else if ('result' in parsed || 'error' in parsed) {
            // 验证响应结构
            if (('result' in parsed && 'error' in parsed) ||
                (!('result' in parsed) && !('error' in parsed))) {
                throw new Error('JSON-RPC响应必须包含result或error，但不能同时包含两者');
            }

            // 验证id
            if (parsed.id === undefined ||
                (parsed.id !== null &&
                    typeof parsed.id !== 'number' &&
                    typeof parsed.id !== 'string')) {
                throw new Error('JSON-RPC响应的id必须是字符串、数字或null');
            }

            // 验证error（如果存在）
            if ('error' in parsed) {
                if (typeof parsed.error !== 'object' || parsed.error === null) {
                    throw new Error('JSON-RPC错误响应的error必须是一个对象');
                }

                if (typeof parsed.error.code !== 'number') {
                    throw new Error('JSON-RPC错误响应的error.code必须是数字');
                }

                if (typeof parsed.error.message !== 'string') {
                    throw new Error('JSON-RPC错误响应的error.message必须是字符串');
                }

                (parsed as JsonRpcErrorResponse).type = 'response:error'
            } else {
                (parsed as JsonRpcSuccessResponse).type = 'response:result'
            }

            return parsed as JsonRpcResponse;
        } else {
            throw new Error('JSON-RPC消息必须包含method（请求）或result/error（响应）');
        }
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`无效的JSON格式: ${error.message}`);
        } else if (error instanceof Error) {
            throw new Error(`JSON-RPC解析错误: ${error.message}`);
        } else {
            throw new Error('解析JSON-RPC消息时发生未知错误');
        }
    }
}

export function dealRequstParams(
    params: JsonRpcRequest['params'],
    argusDef: string[] = []
) {
    if (!params) return []
    if (params instanceof Array) return argusDef
    return argusDef.map(v => (params as { [key: string]: any })[v])
}

export interface RPCMethod {
    name: string,
    params?: string[],
    call: (...argus: any[]) => Promise<any>
}
export interface RPCRequest {
    method: string
    params: { [key: string]: any }
    withoutResult?: boolean
    timeout?: number | Promise<void>
}
export interface RPCConnectClient {
    send(request: RPCRequest): Promise<any>
}

export interface RPCConnectServer {
    methods: { [key: string]: RPCMethod }
}
