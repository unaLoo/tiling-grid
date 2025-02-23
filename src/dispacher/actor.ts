import { bindAll, isWorker, uniqueId, serialize, deserialize } from './util';
import Scheduler from './scheduler';

import type { Transferable, Cancelable, Callback } from './types';

type ActorCallback = Callback<any> & { priority?: number | (() => number) }

class Actor {

    name: string = 'Actor' + uniqueId()
    target: any
    functionHolder: any
    scheduler: Scheduler
    callbacks: { [id: string]: ActorCallback } = {}
    cancelCallbacks: { [id: string]: Cancelable } = {}

    constructor(target: any, functionHolder: any, name?: string) {


        this.target = target
        this.functionHolder = functionHolder
        name && (this.name = name)

        console.log("new actor! " + this.name)

        bindAll(['receive'], this)


        if (isWorker()) {
            this.target.addEventListener('message', this.receive, false)
        } else {
            window.addEventListener('message', this.receive, false)
        }

        this.scheduler = new Scheduler()
    }

    send(
        type: string,
        data: unknown,
        callback?: ActorCallback,
        taskPriority?: number | (() => number),
        mustQueue = false, // add to task queue if ture
    ): Cancelable {

        const id = Math.round((Math.random() * 1e18)).toString(36).substring(0, 10)
        if (callback) {
            callback.priority = taskPriority
            this.callbacks[id] = callback
        }
        console.log(this.name + " send------- ", type, id)

        const buffers: Set<Transferable> = new Set()
        this.target.postMessage({
            id,
            type,
            hasCallback: !!callback,
            mustQueue,
            data: serialize(data, buffers)
        }, buffers)

        return {
            cancel: () => {
                callback && (delete this.callbacks[id])
                this.target.postMessage({ id, type: '<cancel>' })
            }
        }
    }

    receive(message: any) {

        console.log(this.name + " receive------- ", message.data.type)

        const data = message.data
        const id = data.id

        if (!id) return

        if (data.type === '<cancel>') {

            const cancel = this.cancelCallbacks[id]
            delete this.cancelCallbacks[id]
            if (cancel) cancel.cancel()

        } else {

            if (data.mustQueue || isWorker()) {

                const callback = this.callbacks[id]
                const priority = (callback && callback.priority) || 0
                const cancel = this.scheduler.add(() => this.processTask(id, data), priority)
                if (cancel) this.cancelCallbacks[id] = cancel

            } else {
                this.processTask(id, data)
            }
        }
    }

    processTask(id: string, task: any) {

        delete this.cancelCallbacks[id]
        if (task.type === '<response>') {

            const callback = this.callbacks[id]
            delete this.callbacks[id]
            if (task.error) callback(deserialize(task.error) as Error)
            else callback(null, deserialize(task.data))

        } else {
            const buffers: Set<Transferable> = new Set()
            const done = task.hasCallback ? (err: Error | null, data?: unknown) => {
                console.log(this.name, ' send response message')
                this.target.postMessage({
                    id,
                    type: '<response>',
                    error: err ? serialize(err) : null,
                    data: serialize(data, buffers)
                }, buffers)
            } : (_: Error | null, __?: unknown) => { }


            const params = deserialize(task.data)
            if (this.functionHolder[task.type]) {
                this.functionHolder[task.type](params, done)
            } else {
                done(new Error(`Could not find function ${task.type}`))
            }
        }
    }

    remove() {
        this.scheduler.remove()
        this.target.removeEventListener('message', this.receive, false)

    }
}

export default Actor
