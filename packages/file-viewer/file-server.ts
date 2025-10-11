import Koa from 'koa';
import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { promisify } from 'util';



export const startFileServer = (port:number) => {
    // 初始化Koa应用
    const app = new Koa();

    // 转换fs.stat为Promise形式，方便使用async/await
    const stat = promisify(fs.stat);

    // 主路由处理/file请求
    app.use(async (ctx) => {
        // 只处理GET方法的/file路径
        if (ctx.method === 'GET' && ctx.path === '/file') {
            try {
                // 从查询参数中获取文件路径
                const filePath = ctx.query.path as string;

                // 验证路径参数是否存在
                if (!filePath) {
                    ctx.status = 400;
                    ctx.body = '请提供文件路径参数: ?path=文件路径';
                    return;
                }

                // 解析绝对路径，防止路径遍历攻击
                const resolvedPath = path.resolve(filePath);

                // 检查文件是否存在且是一个文件
                const stats = await stat(resolvedPath);
                if (!stats.isFile()) {
                    ctx.status = 400;
                    ctx.body = '提供的路径不是一个有效的文件';
                    return;
                }

                // 设置响应头
                ctx.set('Content-Type', 'application/octet-stream');
                ctx.set('Content-Length', stats.size.toString());

                // 以流的形式返回文件内容
                ctx.body = createReadStream(resolvedPath);

            } catch (error) {
                // 处理文件不存在的情况
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    ctx.status = 404;
                    ctx.body = '文件不存在';
                }
                // 处理权限错误
                else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
                    ctx.status = 403;
                    ctx.body = '没有访问该文件的权限';
                }
                // 其他错误
                else {
                    ctx.status = 500;
                    ctx.body = `服务器错误: ${(error as Error).message}`;
                }
            }
        } else {
            // 对于其他路径或方法返回404
            ctx.status = 404;
            ctx.body = '未找到该接口，请访问 /file?path=文件路径';
        }
    });

    // 启动服务器
    app.listen(port, () => {
        console.log(`服务器已启动，监听端口 ${port}`);
        console.log(`使用示例: http://localhost:${port}/file?path=./test.txt`);
    });

}

