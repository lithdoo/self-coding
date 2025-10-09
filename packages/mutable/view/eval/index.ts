export type EvalRef = {
    ['_VALUE_GENERATOR_REFERENCE_']: string
}

export type EvalVal =
    | { type: 'json', content: string }
    | { type: 'eval:js', content: string }


export const isEvalRef = (data: any): data is EvalRef => {
    if (!data) return false
    if (typeof data !== "object") return false
    return typeof data['_VALUE_GENERATOR_REFERENCE_'] === 'string'
}

export const isEvalVal = (data: any): data is EvalVal => {
    if (!data) return false
    if (typeof data !== "object") return false
    if (data.type !== 'json' && data.type !== 'eval:js') return false
    if (typeof data.content !== 'string') return false
    return true
}



export const StaticEvalVal: {
    ['null']: EvalVal
    ['blank_string']: EvalVal
    ['empty_array']: EvalVal
    ['empty_object']: EvalVal
    ['true']: EvalVal
    ['false']: EvalVal
} = {
    ['null']: { type: 'json', content: 'null' },
    ['blank_string']: { type: 'json', content: '""' },
    ['empty_array']: { type: 'json', content: '[]' },
    ['empty_object']: { type: 'json', content: '{}' },
    ['true']: { type: 'json', content: 'true' },
    ['false']: { type: 'json', content: 'false' },
}


// export class EvalValStore {

//     constructor(
//         protected all: { [key: string]: EvalVal } = {}
//     ) { }


//     val(ref: EvalRef) {
//         const key = ref['_VALUE_GENERATOR_REFERENCE_']
//         const staticVal = (StaticEvalVal as any)[key] as (EvalVal | undefined)
//         if (staticVal) return staticVal
//         const tableVal = this.all[key]
//         if (tableVal) return tableVal
//         throw new Error(`ref:${key} is not exist!!!`)
//     }


//     set(ref: EvalRef, val: EvalVal) {
//         const refKey = ref['_VALUE_GENERATOR_REFERENCE_']
//         this.all[refKey] = val
//     }

//     clear(refs: EvalRef[] = []) {
//         const set = new Set(refs.map(v => v._VALUE_GENERATOR_REFERENCE_));
//         [...Object.keys(this.all)].map(name => {
//             if (!set.has(name)) {
//                 delete (this.all.data as any)[name]
//             }
//         })
//     }

//     table() {
//         return { ...this.all }
//     }

// }


// export class EvalValDataStore extends EvalValStore {

//     constructor(
//         public all: { [key: string]: EvalVal } = {}
//     ) {
//         super(all)
//     }


//     data(ref: EvalRef, scope: { [key: string]: unknown }) {
//         const val = this.val(ref)
//         if (val.type === 'json') {
//             return JSON.parse(val.content)
//         }

//         if (val.type === 'eval:js') {
//             const argus = [...Object.keys(scope)]
//             const input = [...Object.values(scope)]
//             const func = new Function(...argus, val.content)
//             return func.apply(null, input)
//         }

//         throw new Error(`unknown eval_ref type!`)
//     }
// }

