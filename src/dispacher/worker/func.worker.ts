import { Callback, WorkerSelf, Serialized } from '../types'

export function checkIfReady(this: WorkerSelf, data: Serialized, callback: Callback<any>) {

    callback(null, true)
}