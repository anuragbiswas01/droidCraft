const adb = require('../services/adb');
const memoryService = require('../services/memoryService');
const processService = require('../services/processService');
const cp = require('child_process');

async function runTests() {
  console.log('=== SYSTEM MONITOR & PROCESS MANAGER TEST SUITE ===');

  const { devices } = await adb.getDevices();
  const serial = devices.find(d => d.authorized)?.serial;

  if (!serial) {
    console.error('No authorized device found for verification.');
    process.exit(1);
  }

  console.log(`Testing with device: ${serial}`);
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  // TEST 1: Memory stats retrieval
  try {
    console.log('\n[1] Testing Memory & RAM Stats:');
    const stats = await memoryService.getMemoryStats(serial);
    assert(stats && stats.ram, 'Returns stats object with ram property');
    assert(stats.ram.totalBytes > 0, `Total RAM > 0 (${stats.ram.totalFormatted})`);
    assert(stats.ram.usedBytes >= 0, `Used RAM >= 0 (${stats.ram.usedFormatted})`);
    assert(stats.ram.availableBytes > 0, `Available RAM > 0 (${stats.ram.availableFormatted})`);
    assert(stats.ram.usedPercentage >= 0 && stats.ram.usedPercentage <= 100, `Used % is valid (${stats.ram.usedPercentage}%)`);
    assert(stats.swap && typeof stats.swap.usedPercentage === 'number', `Swap stats valid (${stats.swap.totalFormatted})`);
  } catch (err) {
    assert(false, `Memory stats threw error: ${err.message}`);
  }

  // TEST 2: Top memory consumers
  try {
    console.log('\n[2] Testing Top Memory Consumers (dumpsys meminfo):');
    const top = await memoryService.getTopMemoryProcesses(serial, 5);
    assert(Array.isArray(top), 'Returns an array of top processes');
    assert(top.length > 0, `Found ${top.length} top memory processes`);
    if (top.length > 0) {
      assert(top[0].pssBytes > 0, `Top process "${top[0].name}" uses ${top[0].pssFormatted}`);
    }
  } catch (err) {
    assert(false, `Top memory consumers threw error: ${err.message}`);
  }

  // TEST 3: Process listing via ps
  let processes = [];
  try {
    console.log('\n[3] Testing Process Scanner (ps / ps -A):');
    processes = await processService.getProcesses(serial);
    assert(Array.isArray(processes) && processes.length > 10, `Found ${processes.length} running processes`);
    
    const initProc = processes.find(p => p.pid === 1);
    assert(initProc && initProc.isCritical, 'Found PID 1 (init) and flagged as critical');

    const appProcs = processes.filter(p => p.category === 'user-app' || p.category === 'system-app');
    assert(appProcs.length > 0, `Successfully categorized ${appProcs.length} Android app processes`);

    const kernelProcs = processes.filter(p => p.category === 'kernel');
    assert(kernelProcs.length > 0, `Found ${kernelProcs.length} kernel threads`);
  } catch (err) {
    assert(false, `Process scanner threw error: ${err.message}`);
  }

  // TEST 4: Kill Safety Guards (Refuse PID 1 & 2)
  try {
    console.log('\n[4] Testing Process Kill Safety Guards:');
    let threwForInit = false;
    try {
      await processService.killProcess(serial, 1);
    } catch (err) {
      threwForInit = true;
      assert(err.message.includes('Critical kernel thread') || err.message.includes('Refusing to kill'), `Refused killing PID 1: ${err.message}`);
    }
    assert(threwForInit, 'Strictly blocked killing PID 1 (/init)');

    let threwForKthread = false;
    try {
      await processService.killProcess(serial, 2);
    } catch (err) {
      threwForKthread = true;
    }
    assert(threwForKthread, 'Strictly blocked killing PID 2 (kthreadd)');
  } catch (err) {
    assert(false, `Kill safety guards threw unexpected error: ${err.message}`);
  }

  // TEST 5: Real Process Spawning and Termination
  try {
    console.log('\n[5] Testing Real Process Spawning & Killing:');
    const sub = cp.spawn('adb', ['-s', serial, 'shell', 'toolbox sleep 120'], { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 600));

    const refreshedProcs = await processService.getProcesses(serial);
    const testProc = refreshedProcs.find(p => p.name === 'toolbox' || p.name.includes('sleep'));

    if (testProc) {
      assert(true, `Successfully spawned and located test process "${testProc.name}" (PID ${testProc.pid})`);

      // Now kill the process using processService
      const killRes = await processService.killProcess(serial, testProc.pid, { signal: '9' });
      assert(killRes.success, `Successfully killed PID ${testProc.pid} via ${killRes.method}`);

      // Verify it is gone
      await new Promise(r => setTimeout(r, 500));
      const verifyProcs = await processService.getProcesses(serial);
      const stillAlive = verifyProcs.some(p => p.pid === testProc.pid);
      assert(!stillAlive, `Verified PID ${testProc.pid} no longer running`);
    } else {
      assert(false, 'Failed to locate spawned test process in ps');
    }

    try { sub.kill(); } catch (_) {}
  } catch (err) {
    assert(false, `Process spawning and kill test threw error: ${err.message}`);
  }

  console.log(`\nResults: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  if (passed === total) {
    console.log('✓ ALL SYSTEM MANAGER TESTS PASSED!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
