import {cpSync,rmSync,mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';import {resolve} from 'node:path';
const root=process.cwd(),dist=resolve(root,'dist');
const version=readFileSync(resolve(root,'VERSION'),'utf8').trim()||'11.2.0';
rmSync(dist,{recursive:true,force:true});mkdirSync(dist,{recursive:true});
for(const f of ['index.html','manifest.json','sw.js','netlify.toml'])cpSync(resolve(root,f),resolve(dist,f));
for(const dir of ['src','styles','public','.well-known'])cpSync(resolve(root,dir),resolve(dist,dir),{recursive:true});
cpSync(resolve(root,'public/icons'),resolve(dist,'icons'),{recursive:true});
// Keep the generated web bundle and native Capacitor assets on the same cache-busting version.
const rewriteVersionMarkers=(dir)=>{
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const path=resolve(dir,entry.name);
    if(entry.isDirectory()) rewriteVersionMarkers(path);
    else if(/\.(?:html|js|json)$/.test(entry.name)){
      let text=readFileSync(path,'utf8');
      text=text.replace(/\?v=\d+\.\d+\.\d+/g,`?v=${version}`);
      writeFileSync(path,text,'utf8');
    }
  }
};
rewriteVersionMarkers(dist);
console.log(`RainCheck V${version} production build complete.`);
