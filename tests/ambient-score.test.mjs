import test from 'node:test';
import assert from 'node:assert/strict';
import {createAmbientScore} from '../src/lib/ambientScore.mjs';

function parameter(){
  return {value:0,setTargetAtTime(){},cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
}

function fakeContext(){
  const nodes=[];
  const makeNode=(kind)=>{
    const node={kind,gain:parameter(),frequency:parameter(),detune:parameter(),type:'',Q:parameter(),onended:null,connect(){},disconnect(){},start(){},stop(){}};
    nodes.push(node);return node;
  };
  return {
    nodes,state:'suspended',currentTime:0,destination:{},
    createGain(){return makeNode('gain');},
    createBiquadFilter(){return makeNode('filter');},
    createOscillator(){return makeNode('oscillator');},
    async resume(){this.state='running';},
    async suspend(){this.state='suspended';},
    async close(){this.state='closed';},
  };
}

test('ambient score bounds catch-up work after a 601-second suspended/background gap',async()=>{
  const originalSetInterval=globalThis.setInterval,originalClearInterval=globalThis.clearInterval;
  let timerCallback=null,cleared=false;
  globalThis.setInterval=(callback)=>{timerCallback=callback;return 17;};
  globalThis.clearInterval=(id)=>{if(id===17)cleared=true;};
  try{
    const context=fakeContext(),score=createAmbientScore(context,20);
    await score.play();
    assert.equal(context.state,'running');
    const before=context.nodes.filter(n=>n.kind==='oscillator').length;
    assert.equal(before,5,'play should start four pad oscillators and one current motif note');
    context.currentTime=601;
    assert.equal(typeof timerCallback,'function','play should install the scheduler');
    timerCallback();
    const after=context.nodes.filter(n=>n.kind==='oscillator').length;
    assert.ok(after-before<=2,`a delayed scheduler tick allocated ${after-before} motif nodes`);
    assert.ok(after-before>=0);
    score.dispose();
    const disposedCount=context.nodes.length;
    assert.equal(cleared,true,'dispose should clear the interval');
    timerCallback();
    assert.equal(context.nodes.length,disposedCount,'a stale timer callback allocated Web Audio nodes after dispose');
    assert.equal(context.state,'closed');
  }finally{
    globalThis.setInterval=originalSetInterval;
    globalThis.clearInterval=originalClearInterval;
  }
});

test('ambient score pause suspends audio and resume reuses the same score graph',async()=>{
  const originalSetInterval=globalThis.setInterval,originalClearInterval=globalThis.clearInterval;
  let timerCallback=null,nextTimer=0;
  globalThis.setInterval=(callback)=>{timerCallback=callback;return ++nextTimer;};
  globalThis.clearInterval=()=>{};
  try{
    const context=fakeContext(),score=createAmbientScore(context,35);
    await score.play();
    const oscillatorCount=context.nodes.filter(n=>n.kind==='oscillator').length;
    assert.equal(context.state,'running');
    await score.pause();
    assert.equal(context.state,'suspended');
    const countAfterPause=context.nodes.length;
    timerCallback?.();
    assert.equal(context.nodes.length,countAfterPause,'suspended scheduler callback should not create nodes');
    await score.play();
    assert.equal(context.state,'running');
    assert.equal(context.nodes.filter(n=>n.kind==='oscillator').length,oscillatorCount+1,'resume should reuse the four pad oscillators and schedule only the current motif note');
    score.dispose();
  }finally{
    globalThis.setInterval=originalSetInterval;
    globalThis.clearInterval=originalClearInterval;
  }
});
