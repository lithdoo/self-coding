import os from 'node:os'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { cpSync, mkdirSync } from 'node:fs'
import { readDir, writeInfo } from './base'
import { FileViewerRPCServer } from './ws'

const tempFilePath = path.resolve(os.tmpdir(), nanoid())

mkdirSync(tempFilePath)

const targetPNGPath = path.resolve(tempFilePath, 'example.png')

cpSync(path.resolve(__dirname, './eg.png'), targetPNGPath)


writeInfo(targetPNGPath,{
    title: '测试图片',
    desc: '这是一个测试图片',
    tags: ['png'],
    extra: [
        {
            name: '测试连接',
            content: '测试连接',
            payload: 'https://www.baidu.com',
            type: 'link'
        }
    ]
})

const infos = readDir(tempFilePath)

const server = new FileViewerRPCServer()



server.fileList.updateList(infos)


server.start()

