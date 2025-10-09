import * as url from 'url'
import BetterSqlite3 from 'better-sqlite3'
import { ManualPromise } from '../utils'

export type SqliteDatabase = BetterSqlite3.Database


export class SqliteConnection {
    static raw(filePath:string){
        return new BetterSqlite3(filePath) 
    }
    db: BetterSqlite3.Database
    open: ManualPromise<void> = new ManualPromise()
    constructor(
        public fileUrl: string
    ) {
        const filePath = url.fileURLToPath(fileUrl)
        this.db = new BetterSqlite3(filePath)
    }

    query: Map<string, BetterSqlite3.Statement> = new Map()
    prepare(name: string, sql: string) {
        const prepare = this.query.get(name)
        if (prepare) return prepare
        try {
            const newPrepare = this.db.prepare(sql)
            this.query.set(name, newPrepare)
            return newPrepare
        } catch (e) {
            console.log('prepare error: \r\n' + sql)
            throw e
        }
    }

}