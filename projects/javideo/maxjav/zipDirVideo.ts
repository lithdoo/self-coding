import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "fs"
import path from "path"
import { connection } from "./connection"
import archiver from 'archiver'
import { select } from '@inquirer/prompts';
import zipEncrypted from 'archiver-zip-encrypted'
// 注册加密支持
archiver.registerFormat('zip-encrypted', zipEncrypted);


const moveTo = (sourcePath: string, targetPath: string) => {
    console.log(`----from: ${sourcePath}`)
    console.log(`    to  : ${targetPath}`)
    const targetDir = path.dirname(targetPath)
    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true })
    }
    renameSync(sourcePath, targetPath)
}
// 定义返回的文件信息类型
interface FileInfo {
    filePath: string;    // 文件完整路径
    fileName: string;    // 文件名（包含扩展名）
    fileSize: number;    // 文件大小（字节）
}
/**
 * 递归读取指定路径下的所有文件信息
 * @param dirPath 要读取的目录路径
 * @returns 包含所有文件信息的数组
 */
function readAllFilesRecursively(dirPath: string): FileInfo[] {
    const fileInfos: FileInfo[] = [];

    try {
        // 读取目录内容
        const entries = readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory() && entry.name === 'node_modules') {

            } else if (entry.isDirectory()) {
                // 如果是目录，递归处理
                const subDirFiles = readAllFilesRecursively(fullPath);
                fileInfos.push(...subDirFiles);
            } else if (entry.isFile()) {
                // 如果是文件，获取文件信息
                const stats = statSync(fullPath);
                fileInfos.push({
                    filePath: fullPath,
                    fileName: entry.name,
                    fileSize: stats.size
                });
            }
        }

        return fileInfos;
    } catch (error) {
        console.error(`读取目录 ${dirPath} 时发生错误:`, error);
        throw error; // 重新抛出错误以便调用者处理
    }
}


function zipDir(sourceDirPath: string, targetFilePath: string) {
    console.log('start    : ' + sourceDirPath)
    return new Promise<void>(async (res, rej) => {

        const targetDir = path.dirname(targetFilePath)
        mkdirSync(targetDir, { recursive: true })

        // 2. 创建输出流
        const output = createWriteStream(targetFilePath);

        // 3. 创建 archiver 实例并配置加密选项
        const archive = archiver('zip-encrypted', {
            zlib: { level: 9 }, // 可选：压缩级别 (1-9)
            encryptionMethod: 'aes256', // 加密方法：'aes256' 或 'zip20'（传统加密）:cite[3]
            password: 'tempcode' // 请务必设置一个强密码
        });

        // 4. 监听事件
        output.on('close', () => {
            console.log(`complete : ${targetFilePath} 加密压缩完成！总共压缩了 ${archive.pointer()} 字节。`);
            res()
        });

        archive.on('error', (err) => {
            rej(err)
        });

        // 5. 建立管道并添加目录
        archive.pipe(output);
        archive.directory(sourceDirPath, false); // 第二个参数 false 表示不在压缩包内创建顶层文件夹
        // 如需将文件夹内容放入压缩包内的某个子目录，可以这样写：
        // archive.directory('要压缩的文件夹的路径/', '压缩包内子目录名'); 

        // 6. 最终化
        archive.finalize();
    })

}

export const readDirVideo = async (dir = 'E:\\VR') => {

    const files = readAllFilesRecursively(dir)
    let fileCode: {
        [key: string]: string[]
    } = {}
    let unsolve = []
    const json = JSON.parse(readFileSync(
        path.resolve(__dirname, './.temp/file2code.json')
    ).toString())

    fileCode = json.fileCode
    unsolve = json.unsolve

    const allKeyword = connection.select('keyword').query()
        .list.map(v => v.text)

    const filesWithCode = files.map(file => {
        const codes = fileCode[file.fileName]
        if (!codes || (codes.length > 1)) {
            return { ...file, codes }
        } else {
            const code = codes[0]
            const info = connection.select('__REF__video_info')
                .where({ video_code: code })
                .find()
            if (!info || !info.data.desc || !info.data.title) {
                return { ...file, codes }
            } else {
                const keywords = allKeyword.filter(keyword => {
                    if(!info.data.desc) throw new Error() 
                    if(!info.data.title) throw new Error() 

                    return (
                        info.data.desc.toLocaleLowerCase()
                            .indexOf(keyword.toLocaleLowerCase()) >= 0
                    ) || (
                            info.data.title.toLocaleLowerCase()
                                .indexOf(keyword.toLocaleLowerCase()) >= 0
                        )
                })

                return { ...file, codes, keywords }
            }
        }


    })



    writeFileSync(
        path.resolve(__dirname, './.temp/file_with_code.json'),
        JSON.stringify(filesWithCode, null, 2)
    )
}


export const moveDirVideo = (dir = 'E:\\_VR') => {
    const filesWithCode: (FileInfo & {
        keywords?: string[], codes?: []
    })[] = JSON.parse(readFileSync(
        path.resolve(__dirname, './.temp/file_with_code.json')
    ).toString())

    filesWithCode.filter(v => v.keywords?.length === 1)
        .forEach(cur => {
            const [keyword] = cur.keywords ?? []
            if (!keyword) return
            const fileName = cur.fileName
            const codeName = fileName.split('.')[0]
            const reg = /(^[3]?[A-Z|a-z]+(?:4k)?[0-9]*[\-]?[0-9]*)[A-Z]?/
            const match = codeName.match(reg)
            if (!match) return
            console.log(codeName)
            console.log(match[1])
            console.log("------------")
            const dirKey = match[1]
            moveTo(cur.filePath, path.resolve(dir, keyword, dirKey, fileName))
        })
}

export const zipDirVideo = async (dir = 'E:\\_VR') => {

    const keywordDirs = readdirSync(dir, { withFileTypes: true })
        .filter((keywordStat) => { return keywordStat.isDirectory() })
        .filter((keywordStat) => keywordStat.name[0] !== '_')

    let keyword = await select({
        message: 'Select a scipt to run',
        choices: keywordDirs.map(v => ({ value: v.name }))
    })

    const dirs = readdirSync(path.resolve(dir, keyword), { withFileTypes: true })
        .filter((keywordStat) => { return keywordStat.isDirectory() })
        .filter((keywordStat) => keywordStat.name[0] !== '_')

    console.log(dirs.map(v => v.name))

    await dirs.reduce(async (res, cur) => {
        await res
        const dirName = cur.name
        const fileList = readdirSync(path.resolve(dir, keyword, dirName))

        fileList.forEach(filename => {
            writeFileSync(path.resolve(
                __dirname, './.temp', 'download.jsonl'
            ), JSON.stringify({filename,keyword}) + '\n', { flag: 'a' })
        })
        await zipDir(
            path.resolve(dir, keyword, dirName),
            path.resolve(dir, '_zip', keyword, `${dirName}.zip`)
        )
    }, Promise.resolve())

}

const todo = '\\\\N2\\d_store\\_VR'
readDirVideo(todo)
    .then(()=>moveDirVideo(todo))
    .then(()=>zipDirVideo(todo))