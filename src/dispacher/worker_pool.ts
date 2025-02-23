
class WorkerPool {

    static _instance: WorkerPool

    static workerCount: number = 2

    baseWorker: Worker | null = null

    active: Partial<Record<number | string, boolean>>
    workers: Array<Worker>

    constructor() {

        this.active = {}
        this.workers = []
    }

    static get instance(): WorkerPool {

        if (!WorkerPool._instance) {
            WorkerPool._instance = new WorkerPool()
        }

        return WorkerPool._instance
    }

    acquire(id: number | string): Array<Worker> {

        if (this.workers.length === 0) {
            while (this.workers.length < WorkerPool.workerCount) {
                this.workers.push(createWorker('./worker/base.worker.ts'))
            }
        }

        this.active[id] = true
        return this.workers.slice()
    }

    release(id: number | string) {

        delete this.active[id]
        if (this.workers && this.numActive() === 0) {
            this.workers.forEach(w => {
                w.terminate()
            })
            this.workers = []
        }
    }

    numActive(): number {

        return Object.keys(this.active).length
    }
}


export function createWorker(workerURL: string, options?: Partial<WorkerOptions>): Worker {
    const defaultOptions = { type: 'module' }
    const opt = { ...defaultOptions, ...options } as WorkerOptions
    return new Worker(new URL(workerURL, import.meta.url), opt)!
}

export default WorkerPool
