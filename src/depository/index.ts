
type Subscriber = (newValue: unknown, oldValue: unknown) => void

export default class Depository {

    private data: Record<string, unknown>;
    private subscribeMap: Record<string, Array<Subscriber>>;
    public static instance: Depository | null

    constructor() {
        this.data = {}
        this.subscribeMap = {}
    }

    static getInstance(): Depository {
        if (!Depository.instance) {
            Depository.instance = new Depository();
        }
        return Depository.instance;
    }

    public setData(key: string, value: unknown): this {
        const oldValue = this.data[key];
        if (oldValue !== value) {
            this.data[key] = value;
            this.notify(key, value, oldValue);
        }
        return this;
    }

    public getData(key: string) {
        return this.data[key]
    }

    public subscribe(key: string, callback: Subscriber) {

        if (!this.subscribeMap[key]) this.subscribeMap[key] = []
        this.subscribeMap[key].push(callback)
        return () => {
            this.subscribeMap[key] = this.subscribeMap[key].filter(sub => sub != callback)
        }
    }

    private notify(key: string, newValue: unknown, oldValue: unknown): void {
        this.subscribeMap[key]?.forEach(fn => fn(newValue, oldValue));
    }

}