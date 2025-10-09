export interface Mutable<T> {
    raw():T
    on(listener: () => void): MutRef<T>
}

export interface MutRef<T> {
    status: 'on' | 'off'
    val(): T
    dispose(): void
}

export interface MutMonitor {
    monitored: MutRef<unknown>[]
    dispose(): void
}

export class MutValRef<T> implements MutRef<T> {

    status: "on" | "off" = 'on'
    constructor(
        public listener: () => void,
        public val: () => T,
        private ondispose: () => void
    ) { }

    children: Set<MutRef<T>> = new Set([this])

    dispose(): void {
        this.status = 'off'
        this.ondispose()
    }

}


export class MutVal<T> implements Mutable<T> {

    refs: MutValRef<T>[] = []

    constructor(protected value: T) { }

    on(listener: () => void) {

        const ref = new MutValRef(
            listener,
            () => this.value,
            () => { this.remove(ref) }
        )

        this.add(ref)
        return ref
    }

    protected add(ref: MutValRef<T>) {
        this.refs = this.refs.filter(v => v !== ref).concat([ref])
    }

    protected remove(ref: MutValRef<T>) {
        this.refs = this.refs.filter(v => v !== ref)
    }


    update(val: T) {
        this.value = val
        this.refs.forEach(v => v.listener())
        this.onChange?.()
    }

    onChange?:()=>void

    raw(){return this.value}

}


export class MutComputed<T> extends MutVal<T> implements MutMonitor {


    protected value: T

    monitored: MutRef<unknown>[] = []

    listeners: MutValRef<T>[] = []

    val() { return this.value }

    constructor(
        private readonly fn: (binder: <T>(mut: Mutable<T>) => T) => T
    ) {
        super(null as any)
        this.value = this.getUpdateVal()
    }

    protected getUpdateVal() {
        const list = new Set<MutRef<unknown>>()
        const binder: <T>(mut: Mutable<T>) => T = (mut) => {
            const ref = mut.on(this.updateFn)
            list.add(ref)
            return ref.val()
        }
        const val = this.fn(binder)
        this.updateMonitord(list)
        return val
    }

    private updateFn = () => {
        this.update(this.getUpdateVal())
    }

    private updateMonitord(list: Iterable<MutRef<unknown>>) {
        this.monitored.forEach(v => v.dispose())
        this.monitored = [...list];
    }

    dispose(): void {
        this.updateMonitord([])
    }

    map<S>(fn:(t:T ,binder:<T>(mut: Mutable<T>) => T)=>S){
        return new MutComputed((binder)=>{
            const val = binder(this)
            return fn(val,binder)
        })
    }

    flatMap<S>(fn:(t:T ,binder:<K>(mut: Mutable<K>) => K)=>Mutable<S>){
        return new MutComputed((binder)=>{
            const val = binder(this)
            const mut = fn(val,binder)
            const res = binder(mut)
            return res
        })
    }
    
    raw(){return this.value}
}


export class MutRecord extends MutComputed<Record<string,unknown>>{
    constructor(
        public readonly struct:Record<string, MutComputed<unknown>>
    ) {
        super((bind)=>{
            const res : Record<string, unknown> = {}
            Object.entries(struct).forEach(([key,ref])=>{
                const value = bind(ref)
                res[key] = value
            })
            return res
        })
    }
    dispose(): void {
        [...Object.values(this.struct)].forEach(v=>v.dispose());
        super.dispose();
    }
}
