const path = require('path');
const { Worker } = require('worker_threads');

function optimizeInWorker(requests, people, options = {}) {
  const timeoutMs = options.timeoutMs ?? Number(process.env.ALLOCATION_TIMEOUT_MS || 30000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) return Promise.reject(new Error('ALLOCATION_TIMEOUT_MS must be an integer from 1 to 300000.'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'allocationWorker.js'), { workerData: { requests, requestors: [...people], options: { ...options, timeoutMs } } });
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('Allocation optimization timed out; existing grants were preserved.')), timeoutMs);
    worker.once('message', (message) => finish(message.error ? new Error(message.error) : null, message.result));
    worker.once('error', (error) => finish(error));
    worker.once('exit', (code) => { if (!finished) finish(new Error(`Allocation worker exited without a result (${code}).`)); });
  });
}
module.exports = { optimizeInWorker };
