import Actor from './actor'
import WorkerPool from './worker_pool'
import { uniqueId, asyncAll } from './util'
import type { Class, Callback } from './types'

class Dispatcher {

    ready = false
    id = uniqueId()
    currentActor = 0
    activeActorCount = 0
    actors: Array<Actor> = []
    workerPool = WorkerPool.instance

    static Actor: Class<Actor>

    constructor(parent: any, actorMaxNum?: number) {
        if (actorMaxNum) {
            WorkerPool.workerCount = actorMaxNum
        } else {
            const hardwareConcurrency = typeof window !== 'undefined' ? (window.navigator.hardwareConcurrency || 2) : 2
            WorkerPool.workerCount = Math.min(hardwareConcurrency, 2)
        }

        WorkerPool.workerCount = 1

        this.workerPool.acquire(this.id).forEach((worker, index) => {

            const actor = new Actor(worker, parent, `Main_Thread_Actor_${index}`)
            this.actors.push(actor)

        })
        this.broadcast('checkIfReady', null, (err, res) => {
            if (err) console.error(err)
            else this.ready = true
        })
    }

    broadcast(type: string, data: unknown, cb?: Callback<unknown>) {

        cb = cb || function () { }
        asyncAll(this.actors, (actor, done) => {
            actor.send(type, data, done as Callback<unknown>)
        }, cb)
    }

    get actor(): Actor {

        this.currentActor = (this.currentActor + 1) % (this.actors.length - 1)
        return this.actors[this.currentActor]
    }

    remove() {
        this.actors.forEach(actor => actor.remove())
        this.actors = []
        this.workerPool.release(this.id)
    }
}

export default Dispatcher
