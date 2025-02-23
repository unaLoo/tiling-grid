import Actor from '../actor'
import * as funcs from './func.worker'

type FuncModule = { [ key: string ]: Function }
declare const self: WorkerGlobalScope & Record<string, any>

self.actor = new Actor(self, globalThis)

for (const key in funcs) {

    const element = (funcs as FuncModule)[key]
    if (element) self[key] = element.bind(self)
}

