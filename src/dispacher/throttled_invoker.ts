/**
 * Invokes the wrapped function in a non-blocking way when trigger() is called. Invocation requests
 * are ignored until the function was actually invoked.
 *
 * @private
 */
class ThrottledInvoker {
    _channel: MessageChannel | undefined;
    _triggered: boolean;
    _callback: any;

    constructor(callback: any) {
        this._callback = callback;
        this._triggered = false;
        this._channel = new MessageChannel();
        this._channel.port2.onmessage = () => {
            this._triggered = false; // invoke callback when the message is received
            this._callback();
        };

    }

    trigger() {
        if (!this._triggered) {
            this._triggered = true;
            this._channel && this._channel.port1.postMessage(true);
        }
    }

    remove() {
        this._channel = undefined;
        this._callback = () => { };
    }
}

export default ThrottledInvoker;
