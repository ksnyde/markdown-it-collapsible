"use strict";const M=(r,e,p,s,u)=>'<summary><span class="details-marker">&nbsp;</span>'+u.renderInline(r[e].children,p,s)+"</summary>";function b(r,e,p){for(e;e<p;e++)if(!r.md.utils.isWhiteSpace(r.src.charCodeAt(e)))return!1;return!0}const x=(r,e,p,s)=>{const u=43;let a=!1,l=r.bMarks[e]+r.tShift[e],c=r.eMarks[e];if(r.src.charCodeAt(l)!==u)return!1;let i=r.skipChars(l,u),m=i-l;if(m<3)return!1;let h=r.src.slice(l,i),f=r.src.slice(i,c).trim();if(b(r,i,c)||f.endsWith(String.fromCharCode(u).repeat(m)))return!1;if(s)return!0;let n=e,k=!0;for(;n++,!(n>=p||(l=r.bMarks[n]+r.tShift[n],c=r.eMarks[n],l<c&&r.sCount[n]<r.blkIndent));){if(r.src.charCodeAt(l)!==u){k&&(k=b(r,l,c));continue}if(!(r.sCount[n]-r.blkIndent>=4)&&(i=r.skipChars(l,u),!(i-l<m)&&(i=r.skipSpaces(i),!(i<c)))){a=!0;break}}if(k)return!1;let C=r.parentType,y=r.lineMax;r.parentType="container",r.lineMax=n;let o=r.push("collapsible_open","details",1);o.block=!0,o.info=f,o.markup=h,o.map=[e,n];let d=[];return r.md.inline.parse(f,r.md,r.env,d),o=r.push("collapsible_summary","summary",0),o.content=f,o.children=d,r.md.block.tokenize(r,e+1,n),o=r.push("collapsible_close","details",-1),o.markup=r.src.slice(l,i),o.block=!0,r.parentType=C,r.lineMax=y,r.line=n+(a?1:0),!0},S=r=>{r.block.ruler.before("fence","collapsible",x,{alt:["paragraph","reference","blockquote","list"]}),r.renderer.rules.collapsible_summary=M};module.exports=S;
