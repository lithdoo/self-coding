

interface DataStore {
    action(mutaions: [string, any][]): { to: number, from: number, mutaions: [string, any][] }
}



class MViewBaseStore implements DataStore {
    ts: number = new Date().getTime()
    state: Map<string, any> = new Map()

    action(mutaions: [string, any][]) {
        const from = this.ts
        const to = new Date().getTime()

        mutaions.forEach(([key, val]) => {
            this.set(key, val)
        })

        this.ts = to

        return { from, to, mutaions }
    }

    private set(key: string, value: any) {
        if (value === null || value === undefined) {
            this.state.delete(key)
        } else {
            this.state.set(key, value)
        }
    }

}

abstract class MViewScene {

    templates: {  [key: string]: string } = {}

    abstract store: DataStore
}