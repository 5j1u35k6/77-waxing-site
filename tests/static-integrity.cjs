const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','artifacts','node_modules','tests'].includes(item.name))continue;const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else files.push(file);}}walk(root);
const routes=new Set([...fs.readFileSync(path.join(root,'assets/pages.js'),'utf8').matchAll(/path\s*===\s*['"]([^'"]+)['"]/g)].map(match=>match[1]));
const missing=[],syntax=[];let css=0,html=0,js=0;
const resolve=(file,ref)=>{const clean=ref.split(/[?#]/)[0];if(!clean||/^(?:[a-z]+:|\/\/)/i.test(clean)||clean.startsWith('${'))return null;if(clean.startsWith('/77-waxing-site/'))return path.join(root,clean.slice('/77-waxing-site/'.length));if(clean.startsWith('/'))return path.join(root,clean.slice(1));return path.resolve(path.dirname(file),clean);};
for(const file of files){const ext=path.extname(file),source=fs.readFileSync(file,'utf8');
 if(['.js','.gs'].includes(ext)){js++;const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:source,encoding:'utf8'});if(result.status)syntax.push(path.relative(root,file)+': '+result.stderr);}
 if(ext==='.js')for(const match of source.matchAll(/(?:from\s*|import\s*\()(["'])([^"']+)\1/g)){const target=/\.m?js(?:\?|$)/.test(match[2])?resolve(file,match[2]):null;if(target&&!fs.existsSync(target))missing.push(path.relative(root,file)+': '+match[2]);}
 if(ext==='.html'){html++;for(const match of source.matchAll(/(?:src|href)\s*=\s*(["'])([^"']+)\1/g)){const target=resolve(file,match[2]);if(!target)continue;const relative=path.relative(root,target);if(/^services\//.test(relative)||routes.has('/'+relative.replace(/\/$/,'')+'/'))continue;if(!fs.existsSync(target))missing.push(path.relative(root,file)+': '+match[2]);}
  for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!match[2].trim())continue;if(/application\/ld\+json/i.test(match[1])){try{JSON.parse(match[2]);}catch(error){syntax.push(file+': invalid JSON-LD');}continue;}const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:match[2],encoding:'utf8'});if(result.status)syntax.push(file+': inline script: '+result.stderr);}
 }
 if(ext==='.css'){css++;const stack=[];let quote='',comment=false;
  for(let i=0;i<source.length;i++){const c=source[i],n=source[i+1];if(comment){if(c==='*'&&n==='/'){comment=false;i++;}continue;}if(c==='\\'){i++;continue;}if(quote){if(c===quote)quote='';continue;}if(c==='/'&&n==='*'){comment=true;i++;continue;}if(c==='"'||c==="'"){quote=c;continue;}if('{[('.includes(c))stack.push(c);if('}])'.includes(c))assert.equal(stack.pop(),{'}':'{',']':'[',')':'('}[c],path.relative(root,file)+': CSS delimiter');}
  assert.equal(quote,'',file+': CSS string');assert.equal(comment,false,file+': CSS comment');assert.equal(stack.length,0,file+': CSS block');
 }
}
assert.deepEqual(missing,[],'local assets and module imports must exist');assert.deepEqual(syntax,[],'all scripts and inline scripts must parse');
console.log(`PASS: ${js} website/backend scripts, ${html} HTML entries and inline scripts, ${css} CSS delimiter/string checks, and local module/asset references`);
