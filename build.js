import {cpSync,rmSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
const root=process.cwd(),dist=resolve(root,'dist');rmSync(dist,{recursive:true,force:true});mkdirSync(dist,{recursive:true});
for(const f of ['index.html','manifest.json','sw.js','netlify.toml'])cpSync(resolve(root,f),resolve(dist,f));
for(const dir of ['src','styles','public','.well-known'])cpSync(resolve(root,dir),resolve(dist,dir),{recursive:true});
cpSync(resolve(root,'public/icons'),resolve(dist,'icons'),{recursive:true});
console.log('RainCheck V10.0.0 production build complete.');
