// Small deterministic world for the real liquid engine; never reads game saves.
var B=32,DEPTH=64,W=1120,HH=640,cam={x:560,y:320,z:1};
var grid=new Map(),generated=new Set([-2,-1,0,1,2,3]),bs=new Set();
var fluidSeeded=new Set(),wetBodies=new WeakSet(),liquidCellsV18=new Map(),liquidSeededV18=new Set();
var liquidLastReactV18=0,SAVE_KEY='sky-stack-liquid-test',SKY_BUILD='test';
var finite=n=>Number.isFinite(n)?n:0,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),key=(x,y)=>x+','+y;
var liquidInit=()=>{},saveGame=()=>{},restoreDynamicState=()=>{},wake=()=>{},saveSoon=()=>{};
var hash01=(x,y,s)=>((Math.sin(x*12.98+y*78.23+s)*43758.54)%1+1)%1;
var createObsidian=()=>{},pocketDefs=()=>[],Body={};
var w2s=(x,y)=>({x:(x-cam.x)*cam.z+W/2,y:(y-cam.y)*cam.z+HH/2});
