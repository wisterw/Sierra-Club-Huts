const { parentPort, workerData } = require('worker_threads');
const { solveAllocation } = require('./allocationSolver');
solveAllocation(workerData.requests, new Map(workerData.requestors), workerData.options)
  .then((result) => parentPort.postMessage({ result }))
  .catch((error) => parentPort.postMessage({ error: error.message }));
