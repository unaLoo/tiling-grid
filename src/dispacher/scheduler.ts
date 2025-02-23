import ThrottledInvoker from './throttled_invoker';
import { bindAll } from './util';

export type Cancelable = {
    cancel: () => void;
};

type TaskFunction = () => void;
type TaskPriority = number | (() => number); // the **smaller** the number, the **higher** the priority
type Task = {
    fn: TaskFunction
    priority: number;
    id: number;
};

class Scheduler {
    tasks: {
        [key: number]: Task;
    };
    taskQueue: Array<number>;
    invoker: ThrottledInvoker;
    nextId: number;

    constructor() {
        this.tasks = {};
        this.taskQueue = [];
        bindAll(['process'], this);
        this.invoker = new ThrottledInvoker(this.process);

        this.nextId = 0;
    }

    add(fn: TaskFunction, thePriority: TaskPriority): Cancelable | null {

        const id = this.nextId++;
        const priority = typeof thePriority === 'function' ? thePriority() : thePriority;

        if (priority === 0) {
            // Process immediately. Do not yield to the event loop.
            fn();
            return null;// can't actually be cancelled
        }

        this.tasks[id] = { fn, priority, id };
        this.taskQueue.push(id);
        this.invoker.trigger();

        return {
            cancel: () => {
                delete this.tasks[id];
            }
        };
    }

    process() {

        this.taskQueue = this.taskQueue.filter(id => !!this.tasks[id]);

        if (!this.taskQueue.length) return;

        const id = this.pick();
        if (id === null) return;

        const task = this.tasks[id];
        delete this.tasks[id];

        if (this.taskQueue.length) {
            // Schedule another process call if we know there's more task to process, 
            // whatever happens to the result of the task, still trigger another process call
            this.invoker.trigger();
        }

        if (!task) return; // if the task was canceled.

        task.fn(); // invoke the task function directly

    }

    pick(): null | number {
        let minIndex = null;
        let minPriority = Infinity;
        for (let i = 0; i < this.taskQueue.length; i++) {
            const id = this.taskQueue[i];
            const task = this.tasks[id];
            if (task.priority < minPriority) {
                minPriority = task.priority;
                minIndex = i;
            }
        }
        if (minIndex === null) return null;
        const id = this.taskQueue[minIndex];
        this.taskQueue.splice(minIndex, 1);
        return id;
    }

    remove() {
        this.invoker.remove();
    }
}
export default Scheduler;
