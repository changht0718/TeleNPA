// Full-canvas position assets, no scaling/clamping of individual objects.
export async function renderReconstruction(canvas, scene, placements){
 const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Missing asset: '+src));im.src=src});
 if(placements.length!==6 || placements.some(p=>p!==null&&(!Number.isInteger(p)||p<0||p>5)) || new Set(placements.filter(p=>p!==null)).size!==placements.filter(p=>p!==null).length) throw Error('Invalid slots');
 const images=await Promise.all([load(scene.empty),...placements.flatMap((slot,i)=>slot===null?[]:[load(scene.objects[i].poses[slot])])]);
 if(images.some(im=>im.naturalWidth!==1448||im.naturalHeight!==1086))throw Error('Invalid asset dimensions');
 canvas.width=1448;canvas.height=1086;const ctx=canvas.getContext('2d');for(const im of images)ctx.drawImage(im,0,0);
}
