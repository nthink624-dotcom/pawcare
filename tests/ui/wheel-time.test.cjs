const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const source = readFileSync('apps/shared/lib/wheel-time.ts', 'utf8');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: moduleValue.exports, module: moduleValue });
const { parseClock, clockToWheel, wheelToClock, formatWheelTime, availableClockTimes, constrainWheelTime } = moduleValue.exports;

test('all 1,440 clock minutes round trip with Korean AM/PM and no off-by-one hour', () => {
  for (let minute = 0; minute < 1440; minute++) {
    const clock = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    assert.equal(wheelToClock(clockToWheel(clock)), clock);
  }
  assert.equal(formatWheelTime('00:00'), '오전 12:00');
  assert.equal(formatWheelTime('12:00'), '오후 12:00');
  assert.equal(formatWheelTime('23:59'), '오후 11:59');
});
test('empty and invalid clocks stay unknown for display and never become a saved default', () => {
  for (const value of ['', '24:00', '12:60', '-1:00', '9:00', 'n/a']) {
    assert.equal(parseClock(value), null);
    assert.equal(formatWheelTime(value), '시간 선택');
  }
  assert.equal(wheelToClock({ hour: '0', minute: '0', period: 'am' }), '');
});
test('steps, min/max, step origin and midnight-spanning ranges preserve clock constraints', () => {
  assert.equal(availableClockTimes({ step: 300 }).length, 288);
  assert.equal(availableClockTimes({ min: '09:02', max: '09:14', step: 300 }).join(','), '09:02,09:07,09:12');
  const overnight = availableClockTimes({ min: '23:00', max: '01:00', step: 1800 });
  assert.equal(overnight.join(','), '00:00,00:30,01:00,23:00,23:30');
});
test('sparse appointment availability never manufactures unavailable combinations', () => {
  const times = availableClockTimes({ allowedTimes: ['09:15', '10:40', '13:05', '13:05', 'bad'] });
  assert.equal(times.join(','), '09:15,10:40,13:05');
  for (const period of ['am', 'pm']) for (let hour = 1; hour <= 12; hour++) for (let minute = 0; minute < 60; minute++) {
    const next = constrainWheelTime({ period, hour: String(hour), minute: String(minute) }, times);
    assert.ok(times.includes(wheelToClock(next)));
  }
  assert.equal(availableClockTimes({ allowedTimes: [] }).length, 0);
});
test('switching hour/period preserves the requested column when an available value exists', () => {
  const times = ['09:15', '10:40', '13:05'];
  assert.equal(wheelToClock(constrainWheelTime({ period: 'am', hour: '10', minute: '15' }, times)), '10:40');
  assert.equal(wheelToClock(constrainWheelTime({ period: 'pm', hour: '9', minute: '15' }, times)), '13:05');
});
