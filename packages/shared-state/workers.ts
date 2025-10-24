// 存储所有连接的端口
const portPool: MessagePort[] = [];

// 定义全局作用域，在Shared Worker中为SharedWorkerGlobalScope
const _self: SharedWorkerGlobalScope = self as any;

_self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  portPool.push(port);

  port.postMessage({ event: 'connected' });

  port.onmessage = (e: MessageEvent) => {
    // 处理来自页面的消息
    // 例如，广播到所有端口
    portPool.forEach((p) => {
      if (p !== port) {
        // 可选：不发送回源端口
        p.postMessage(e.data);
      }
    });
  };
};
