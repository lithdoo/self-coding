export enum BaseType {
    string = 'string',
    number = 'number',
    integer = 'integer',
    boolean = 'boolean',
}

export type ExtType = { key: string, meta: unknown }

export interface DataBaseField {
    name: string, type: string, not_null: boolean
}

export interface StructData {
    keyName: string
    keyField: string
    fields: DataBaseField[]
}

export interface Relation {
    field: string, struct: string, only: boolean
}

export interface RelationData {
    keyName: string
    relations: Relation[]
    fields: DataBaseField[]
}


export interface UDBMetaData {
    typeMeta: { [key: string]: unknown }
    structs: StructData[]
    relations: RelationData[]
}

export const isNull = Symbol()
export const notNull = Symbol()



export interface UDBController extends UDBMetaData {
    find<T = any>(keyName: string, part: { [P in keyof T]?: T[P] | Symbol; }): Promise<T | null>
    query<T = any>(keyName: string, part: { [P in keyof T]?: T[P] | Symbol; }): Promise<T[]>
    remove<T = any>(keyName: string, part: { [P in keyof T]?: T[P] | Symbol; }): Promise<void>
    insert<T = any>(keyName: string, data: T): Promise<void>
    updateByKey<T = any>(keyName: string, data: Partial<T>, autoInsert: boolean)
    findWith<S, T>(
        source: { name: string, field: string, params?: { [P in keyof T]?: T[P] | Symbol; } },
        target: { name: string, field: string, params?: { [P in keyof S]?: S[P] | Symbol; } },
    ): Promise<T | null>
    typeDeals: TypeDeal<this>[]
}



export interface TypeDeal<T extends UDBController> {

    use(keyName: string, meta: unknown): boolean

    toSave(source: unknown, option: {
        controller: T, type: ExtType
    }): any

    fromeSave(source: unknown, option: {
        controller: T, type: ExtType
    }): any

}

