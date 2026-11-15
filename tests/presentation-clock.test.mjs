// Deterministic checks for the display-only clock bridge. These tests use
// synthetic commit/render times; they do not test scientific sample values.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPresentationAnchor,samplePresentation} from '../src/lib/presentationClock.mjs';

const close=(actual,expected,epsilon=1e-9)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} != ${expected} ±${epsilon}`);

test('delayed React commits carry rendered phase forward without moving the presented clock backward',()=>{
  let anchor=createPresentationAnchor(null,100,true,1,0);
  const first=samplePresentation(anchor,80,1000);
  close(first,100.08);

  // The next React clock commit is behind the 100 ms display extrapolation.
  anchor=createPresentationAnchor(anchor,100.06,true,1,100);
  const afterCommit=samplePresentation(anchor,100,1000);
  close(afterCommit,100.1);
  assert.ok(afterCommit>=first,'a late React anchor must not rewind the prior rendered frame');
  close(samplePresentation(anchor,120,1000),100.12);

  // A second delayed commit may also arrive behind the presentation phase.
  anchor=createPresentationAnchor(anchor,100.11,true,1,120);
  const secondCommit=samplePresentation(anchor,120,1000);
  close(secondCommit,100.12);
  assert.ok(secondCommit>=afterCommit);
});

test('display interpolation is capped at 100 ms of lead, independent of how late sampling runs',()=>{
  const anchor=createPresentationAnchor(null,12,true,24,1000);
  close(samplePresentation(anchor,1010,1000),12.24);
  close(samplePresentation(anchor,2000,1000),14.4);
  close(samplePresentation(anchor,5000,1000),14.4);
});

test('pause creates an exact stationary segment and resume starts from its current base index',()=>{
  const playing=createPresentationAnchor(null,5,true,1,0);
  close(samplePresentation(playing,80,100),5.08);

  const paused=createPresentationAnchor(playing,5.05,false,1,100);
  close(samplePresentation(paused,500,100),5.05);
  close(samplePresentation(paused,1500,100),5.05);

  const resumed=createPresentationAnchor(paused,5.05,true,1,2000);
  close(samplePresentation(resumed,2000,100),5.05);
  close(samplePresentation(resumed,2050,100),5.1);
});

test('speed changes start a fresh phase instead of applying the previous rate to a new base',()=>{
  const slow=createPresentationAnchor(null,20,true,1,0);
  close(samplePresentation(slow,40,100),20.04);

  const fast=createPresentationAnchor(slow,20.02,true,24,40);
  close(samplePresentation(fast,40,100),20.02);
  close(samplePresentation(fast,90,100),21.22);
});

test('terminal clamp and computed-period loop wrap are explicit segment changes',()=>{
  const ending=createPresentationAnchor(null,9.9,true,2,0);
  close(samplePresentation(ending,100,10),10);
  close(samplePresentation(ending,200,10),10);

  const wrapped=createPresentationAnchor(ending,0,true,2,200);
  close(samplePresentation(wrapped,200,10),0);
  close(samplePresentation(wrapped,250,10),0.1);

  const restarted=createPresentationAnchor(wrapped,0,false,2,300);
  close(samplePresentation(restarted,1000,10),0);
});

test('a real decrease in the authoritative base index is not hidden by the old presentation floor',()=>{
  const old=createPresentationAnchor(null,500,true,6,0);
  close(samplePresentation(old,100,1000),500.6);

  // Represents a user seek or another deliberate segment boundary. The helper
  // must start exactly at the new authoritative base rather than carrying 500.6.
  const sought=createPresentationAnchor(old,12,true,6,200);
  close(samplePresentation(sought,200,1000),12);
  close(samplePresentation(sought,250,1000),12.3);
});
