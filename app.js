/* الكتاب الإلكتروني التفاعلي — الأداءات والتقييمات */
var B = window.BOOK;
var QBY = {}; B.questions.forEach(function(q,i){ q._i=i; QBY[q.id]=q; });
var LS = {
  get: function(k,d){ try{ var v=localStorage.getItem('ss1_'+k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set: function(k,v){ try{ localStorage.setItem('ss1_'+k, JSON.stringify(v)); }catch(e){} }
};
var student = LS.get('student', {name:'', cls:''});
var answers = LS.get('answers', {});      // qid -> {items:{}, vals:[], tf:[], match:{}, cls:{}, order:[], grid:{}, done:bool}
var grades  = LS.get('grades', {});       // blockKey -> {auto, manual:{qid:{score,max,note}}, ts}
var blocksState = LS.get('blocks', {});   // blockKey -> {opened:ts, finished:ts, manual:bool}
var settings = LS.get('settings', {showAnswers:false});

/* ---------- helpers ---------- */
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function hl(text, kw){
  if(!kw) return esc(text);
  var i = text.indexOf(kw);
  if(i<0) return esc(text);
  return esc(text.slice(0,i)) + '<span class="mark">'+esc(text.substr(i,kw.length))+'</span>' + esc(text.slice(i+kw.length));
}
function typeLabel(t){
  return {mcq:'اختيار من متعدد', tf:'صواب/خطأ', complete:'أكمل', essay:'مقالي', match:'صل بين العمودين',
    order:'ترتيب', table:'جدول', classify:'تصنيف', map:'خريطة/صورة', task:'نشاط تطبيقي'}[t]||t;
}
function typBadge(t){ return '<span class="badge p">'+typeLabel(t)+'</span>'; }
function sectionBadge(s){
  var m = {'الأداء الصفي':'badge g','الأداء المنزلي (الواجب)':'badge w','التقييم الأسبوعي':'badge p','التدريب الشهري':'badge p'};
  return '<span class="badge '+(m[s]||'')+'">'+esc(s)+'</span>';
}
function autoGradeable(q){
  if(q.typ==='mcq'){
    if(q.answer_idx!=null) return 'full';
    return (q.items||[]).some(function(it){return it.answer_idx!=null;}) ? 'partial':'none';
  }
  if(q.typ==='tf') return (q.items||[]).some(function(it){return it.tf||it.fix;}) ? 'partial':'none';
  return 'none';
}
function mediaURL(p){ return 'media/page-'+String(p).padStart(2,'0')+'.jpg'; }

/* ---------- answer structure ---------- */
function getA(qid){ if(!answers[qid]) answers[qid]={}; return answers[qid]; }

/* ---------- router ---------- */
var VIEW='home';
document.getElementById('tabs').addEventListener('click', function(e){
  var b = e.target.closest('button'); if(!b) return;
  document.querySelectorAll('.tabs button').forEach(function(x){x.classList.toggle('on', x===b);});
  render(b.dataset.view);
});
function render(v, arg){
  VIEW=v;
  var m=document.getElementById('view'); m.scrollTop=0; window.scrollTo(0,0);
  if(v==='home') return renderHome(m);
  if(v==='search') return renderSearch(m);
  if(v==='progress') return renderProgress(m);
  if(v==='teacher') return renderTeacher(m);
  if(v==='lesson') return renderLesson(m, arg);
  if(v==='block') return renderBlock(m, arg);
  if(v==='result') return renderResult(m, arg);
  if(v==='teacherQ') return renderTeacherQ(m, arg);
  if(v==='teacherReport') return renderTeacherReport(m);
  if(v==='settings') return renderSettings(m);
}

/* ---------- home / index ---------- */
function unitIndex(q){ return B.unit_tree.findIndex(function(u){return u.title===q.unit;})+1; }
function renderHome(m){
  var done=0; Object.values(blocksState).forEach(function(b){ if(b.finished) done++; });
  m.innerHTML =
  '<div class="card hero"><h1>📘 '+esc(B.title)+'</h1><p>'+esc(B.subtitle)+'</p>'+
    '<div class="badges">'+
      '<span>📄 73 صفحة</span><span>🧩 '+B.questions.length+' سؤالاً ونشاطاً</span>'+
      '<span>🏫 4 وحدات</span><span>✅ '+done+' تقييماً أتممته</span>'+
    '</div>'+
    '<div style="margin-top:12px"><button class="btn ghost" onclick="switchStudent()">✏️ '+(student.name?'تغيير اسم الطالب':'أدخل اسمك لبدء الاستخدام')+'</button></div>'+
  '</div>'+
  B.unit_tree.map(function(u,i){
    var nq = B.questions.filter(function(q){return q.unit===u.title;}).length;
    var lessons = u.lessons.map(function(L){
      var blocks = blockList(u.title, L);
      return '<div class="lesson-row" onclick="renderLesson(document.getElementById(\'view\'),\''+escAttr(u.title)+'|'+escAttr(L)+'\')">'+
        '<div><div class="t">'+esc(L)+'</div><div style="font-size:11px;color:var(--mut);margin-top:3px">'+blocks.length+' جزءاً تقييمياً</div></div>'+
        '<span class="pill">افتح ↗</span></div>';
    }).join('');
    return '<div class="card"><div class="unit-h" onclick="toggle(this,\'u'+i+'\')">'+
      '<div class="un">'+(i+1)+'</div><h2>'+esc(u.title)+'</h2></div>'+
      '<div id="u'+i+'">'+lessons+'</div></div>';
  }).join('')+
  '<div class="card"><b>⚙️ أدوات</b><div class="actions" style="margin-top:8px">'+
    '<button class="btn ghost sm" onclick="render(document.getElementById(\'view\'),\'settings\')">الإعدادات وحفظ البيانات</button>'+
    '<button class="btn ghost sm" onclick="window.print()">🖨 طباعة / حفظ PDF</button>'+
  '</div><div class="warnbox" style="margin-top:10px">⚠️ الحفظ محلي في هذا الجهاز (localStorage) فقط — لا يوجد سيرفر أو قاعدة بيانات. استخدم «تصدير النتائج JSON» لأخذ نسخة احتياطية أو إرسالها للمعلم.</div></div>';
}
function escAttr(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function toggle(el,id){ var d=document.getElementById(id); d.classList.toggle('hidden'); }

function blockList(unit, lesson){
  var out=[], seen={};
  B.questions.forEach(function(q){
    if(q.unit!==unit || (q.lesson||'تقييمات وتدريبات الوحدة')!==lesson) return;
    var g = (q.group||'').replace(/^تابع\s*/,'').replace(/\s*-\s*تابع$/,'');
    var key = q.section+'||'+g;
    if(seen[key]) return; seen[key]=1;
    var count = B.questions.filter(function(x){return x.unit===unit && (x.lesson||'تقييمات وتدريبات الوحدة')===lesson && x.section===q.section && ((x.group||'').replace(/^تابع\s*/,'').replace(/\s*-\s*تابع$/,''))===g;}).length;
    out.push({key:key, section:q.section, group:g, count:count});
  });
  return out;
}
function blockKeyOf(q){
  var g=(q.group||'').replace(/^تابع\s*/,'').replace(/\s*-\s*تابع$/,'');
  return q.section+'||'+g;
}
function questionsOfBlock(key){
  return B.questions.filter(function(q){ return blockKeyOf(q)===key; });
}

/* ---------- lesson page ---------- */
function renderLesson(m, arg){
  var i = arg.indexOf('|');
  var unit = arg.slice(0,i), lesson = arg.slice(i+1);
  var blocks = blockList(unit, lesson);
  m.innerHTML =
  '<div class="crumb"><a onclick="render(\'home\')">🏠 الفهرس</a> / '+esc(unit)+' / <b>'+esc(lesson)+'</b></div>'+
  '<div class="card"><h2 style="margin:4px 0;font-size:17px;color:var(--pri2)">'+esc(lesson)+'</h2>'+
  '<div style="font-size:12px;color:var(--mut)">'+esc(unit)+'</div></div>'+
  blocks.map(function(b){
    var st = blocksState[b.key]||{};
    var label = b.section + (b.group? ' — '+b.group : '');
    var done = st.finished? ' done':'';
    return '<button class="blockbtn'+done+'" onclick="render(\'block\',\''+escAttr(b.key)+'\')">'+
      (st.finished?'✔ ':'')+esc(label)+' <span class="badge">'+b.count+' سؤالاً</span></button>';
  }).join('')+
  '<div class="actions"><button class="btn ghost" onclick="render(\'home\')">↩ عودة إلى الفهرس</button></div>';
}

/* ---------- block (assessment) page ---------- */
function renderBlock(m, key){
  var qs = questionsOfBlock(key); if(!qs.length){ render('home'); return; }
  var first = qs[0];
  var st = blocksState[key] = blocksState[key]||{};
  if(!st.opened){ st.opened = Date.now(); LS.set('blocks', blocksState); }
  var label = first.section + (first.group? ' — '+first.group : '');
  var head = '<div class="crumb"><a onclick="render(\'home\')">🏠 الفهرس</a> / <a onclick="render(\'lesson\',\''+escAttr(first.unit)+'|'+escAttr(first.lesson||'تقييمات وتدريبات الوحدة')+'\')">'+esc(first.lesson||'تقييمات وتدريبات الوحدة')+'</a> / <b>'+esc(label)+'</b></div>'+
  '<div class="card"><h2 style="margin:2px 0;font-size:17px">'+esc(label)+'</h2>'+
  '<div class="tline" style="font-size:12px;color:var(--mut)">'+
    '<span>'+esc(first.unit)+'</span><span>·</span><span>الصفحة '+first.page+' إلى '+qs[qs.length-1].page+'</span>'+
    '<span>·</span><span>'+qs.length+' عنصراً</span></div>'+
  '<div class="actions" style="margin-top:8px">'+
    '<button class="btn sm" id="startBtn" onclick="startAssessment(\''+escAttr(key)+'\')">▶ بدء التقييم</button>'+
    (st.finished? '<button class="btn green sm" onclick="render(\'result\',\''+escAttr(key)+'\')">📊 عرض النتيجة</button>':'')+
    '<button class="btn ghost sm" onclick="render(\'lesson\',\''+escAttr(first.unit)+'|'+escAttr(first.lesson||'تقييمات وتدريبات الوحدة')+'\')">↩ عودة</button>'+
  '</div></div>'+
  '<div id="quizArea"></div>';
  m.innerHTML = head;
  var saved = qs.every(function(q){ var a=answers[q.id]; return a&&a.submitted; });
  if(saved){ renderBlockRunner(m, key); }
}
function startAssessment(key){
  var qs = questionsOfBlock(key);
  if(student.name===undefined){}
  renderBlockRunner(document.getElementById('view'), key);
}
function renderBlockRunner(m, key){
  var qs = questionsOfBlock(key);
  maybeTimer(key);
  var idx = LS.get('cur_'+key, 0); if(idx>=qs.length) idx=0;
  var html = '<div class="card" id="runner">'+
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'+
      '<button class="btn ghost sm" onclick="render(\'block\',\''+escAttr(key)+'\')">↩</button>'+
      '<b id="qpos"></b><div class="bar" style="flex:1"><i id="qbar" style="width:0%"></i></div>'+
    '</div><div id="qbox"></div>'+
    '<div class="actions" style="margin-top:12px">'+
      '<button class="btn ghost" id="prevBtn">← السابق</button>'+
      '<button class="btn" id="nextBtn">التالي →</button>'+
      '<button class="btn green" onclick="finishBlock(\''+escAttr(key)+'\')">✔ إنهاء وتسليم التقييم</button>'+
    '</div>'+
    '<div style="margin-top:10px;font-size:12px;color:var(--mut)">💾 تُحفظ إجاباتك تلقائياً عند كل انتقال. يمكنك مراجعة أسئلتك قبل التسليم بالتنقل بين الأسئلة.</div>'+
  '</div>';
  document.getElementById('quizArea').innerHTML = html;
  var cur = idx;
  function show(){
    LS.set('cur_'+key, cur);
    var q = qs[cur];
    document.getElementById('qpos').textContent = 'سؤال '+(cur+1)+' من '+qs.length;
    document.getElementById('qbar').style.width = Math.round((cur+1)/qs.length*100)+'%';
    document.getElementById('qbox').innerHTML = renderQ(q);
    document.getElementById('prevBtn').disabled = cur===0;
    document.getElementById('prevBtn').onclick = function(){ if(cur>0){cur--; show();} };
    document.getElementById('nextBtn').onclick = function(){ if(cur<qs.length-1){cur++; show();} else {finishBlock(key);} };
    document.getElementById('nextBtn').textContent = cur<qs.length-1? 'التالي →':'إنهاء ↗';
  }
  window._showBlock = show;
  show();
}
function finishBlock(key){
  var qs = questionsOfBlock(key);
  var unanswered = qs.filter(function(q){ var a=answers[q.id]; return !a || !a.touched; }).length;
  if(unanswered>0 && !confirm('لديك '+unanswered+' سؤالاً بدون إجابة. هل تريد التسليم على أي حال؟')) return;
  var st = blocksState[key]; st.finished = Date.now(); LS.set('blocks', blocksState);
  computeResult(key);
  render('result', key);
}

/* ---------- question renderer ---------- */
function renderQ(q){
  var a = getA(q.id);
  a.touched = true; LS.set('answers', answers);
  var h = '<div class="qcard" data-qid="'+q.id+'">'+
    '<div class="qhead"><span class="qnum">'+q.id+'</span>'+typBadge(q.typ)+sectionBadge(q.section)+
      '<span class="badge">📄 ص '+q.page+'</span>'+
      (q.tag?'<span class="badge">'+esc(q.tag)+'</span>':'')+
      (q.suggested||hasSuggested(q)?'<span class="badge w">مراجعة المعلم</span>':'')+
    '</div>';
  if(q.text) h += '<div class="qtext">'+hl(q.text,'')+'</div>';
  if(q.note) h += '<div class="qnote">ℹ️ '+esc(q.note)+'</div>';
  if(q.img) h += '<div class="imgwrap"><img loading="lazy" src="'+mediaURL(q.img)+'" alt="صورة الصفحة '+q.img+'" onclick="zoom(this.src)"><div class="hint">🔍 اضغط على الصورة للتكبير — الصورة من الصفحة '+q.img+' الأصلية</div></div>';
  var body = '';
  if(q.typ==='mcq'){
    if(q.opts){
      body += '<div class="opts">';
      body += q.opts.map(function(o,i){
        var c = a.vals&&a.vals[0]===i?'checked':'';
        return '<label><input type="radio" name="r_'+q.id+'" '+c+' onchange="setMCQ(\''+q.id+'\',0,'+i+')"><span>'+hl(o,'')+'</span></label>';
      }).join('');
      body += '</div>';
    } else {
      body += (q.items||[]).map(function(it,ii){
        return '<div class="subq"><div class="st">'+hl(it.t,'')+'</div>'+
          (it.opts? '<div class="opts">'+it.opts.map(function(o,i){
            var c = a.items&&a.items[ii]===i?'checked':'';
            return '<label><input type="radio" name="r_'+q.id+'_'+ii+'" '+c+' onchange="setMCQ(\''+q.id+'\','+ii+','+i+')"><span>'+hl(o,'')+'</span></label>';
          }).join('')+'</div>' : '<textarea data-k="essay_'+ii+'" oninput="setSub(\''+q.id+'\','+ii+',this.value)">'+esc((a.items&&a.items[ii]&&typeof a.items[ii]==='string')?a.items[ii]:'')+'</textarea>')+
        '</div>';
      }).join('');
    }
  }
  else if(q.typ==='tf'){
    body += (q.items||[]).map(function(it,ii){
      var v = a.items&&typeof a.items[ii]==='number'? a.items[ii] : '';
      var ok = v===0?'ok':'', no = v===1?'no':'';
      return '<div class="subq"><div class="st">'+hl(it.t,'')+'</div>'+
        '<div class="tfrow">'+
        '<label class="'+ok+'"><input type="radio" name="tf_'+q.id+'_'+ii+'" '+(v===0?'checked':'')+' onchange="setTF(\''+q.id+'\','+ii+',0)">✔ صواب</label>'+
        '<label class="'+no+'"><input type="radio" name="tf_'+q.id+'_'+ii+'" '+(v===1?'checked':'')+' onchange="setTF(\''+q.id+'\','+ii+',1)">✘ خطأ</label></div>'+
        (it.fix? '<textarea data-k="fix_'+ii+'" placeholder="التصويب في حالة الخطأ..." oninput="setSub(\''+q.id+'\','+ii+',this.value,\'fix\')">'+esc((a.fix&&a.fix[ii])||'')+'</textarea>':'')+
        (it.justify? '<textarea data-k="j_'+ii+'" placeholder="التبرير..." oninput="setSub(\''+q.id+'\','+ii+',this.value,\'j\')">'+esc((a.j&&a.j[ii])||'')+'</textarea>':'')+
      '</div>';
    }).join('');
  }
  else if(q.typ==='complete' || q.typ==='essay'){
    if(q.items && q.items.some(function(it){return it.tbl;})){
      body += q.items.map(function(it,ii){ return '<div class="subq"><div class="st">'+hl(it.t,'')+'</div>'+gridHTML(q, it.tbl, ii, a)+'</div>'; }).join('');
    } else if(q.items){
      body += q.items.map(function(it,ii){
        return '<div class="subq"><div class="st">'+hl(it.t,'')+'</div>'+
          '<textarea '+(String(it.t).length>80?'class="big"':'')+' oninput="setSub(\''+q.id+'\','+ii+',this.value)">'+esc((a.items&&a.items[ii])||'')+'</textarea></div>';
      }).join('');
    } else {
      body += '<textarea class="big" oninput="setSub(\''+q.id+'\',0,this.value)">'+esc(a.vals&&a.vals[0]||'')+'</textarea>';
    }
  }
  else if(q.typ==='task'){
    body += '<textarea class="big" placeholder="اكتب إجابتك أو صوّر نشاطك يدوياً وارفعه للمعلم..." oninput="setSub(\''+q.id+'\',0,this.value)">'+esc(a.vals&&a.vals[0]||'')+'</textarea>';
  }
  else if(q.typ==='table'){
    body += gridHTML(q, q.tbl, 0, a);
  }
  else if(q.typ==='match'){
    var L=q.tbl.left, R=q.tbl.right;
    body += '<table class="grid"><tr><th>العمود (أ)</th><th>الاختيار</th><th>العمود (ب)</th></tr>';
    body += L.map(function(l,i){
      var sel = a.match&&a.match[i]!=null? a.match[i] : '';
      return '<tr><td>'+hl(l,'')+'</td><td><select onchange="setMatch(\''+q.id+'\','+i+',this.value)">'+
        '<option value="">—</option>'+R.map(function(r,ri){ return '<option value="'+ri+'" '+(String(sel)===String(ri)?'selected':'')+'>'+esc(r)+'</option>'; }).join('')+
      '</select></td>'+(i===0?'<td rowspan="'+L.length+'">'+R.map(esc).join('<hr>')+'</td>':'')+'</tr>';
    }).join('');
    body += '</table>';
  }
  else if(q.typ==='order'){
    var items = (a.order&&a.order.length? a.order : (q.items||[]).slice());
    body += '<div style="font-size:12px;color:var(--mut);margin:4px 0">اضغط ▲▼ لإعادة الترتيب من الأقدم إلى الأحدث (أو كما يطلب السؤال):</div>';
    body += items.map(function(it,i){
      return '<div class="subq" style="display:flex;align-items:center;gap:8px">'+
        '<b style="color:var(--pri)">'+(i+1)+'.</b><div style="flex:1">'+esc(it)+'</div>'+
        '<button class="btn ghost sm" onclick="moveOrder(\''+q.id+'\','+i+',-1)">▲</button>'+
        '<button class="btn ghost sm" onclick="moveOrder(\''+q.id+'\','+i+',1)">▼</button></div>';
    }).join('');
  }
  else if(q.typ==='classify'){
    body += (q.cls.items||[]).map(function(it,i){
      var v = a.cls&&typeof a.cls[i]==='number'? a.cls[i]:'';
      return '<div class="subq" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="flex:1;min-width:140px">'+esc(it)+'</div>'+
      '<select onchange="setCls(\''+q.id+'\','+i+',this.value)"><option value="">— اختر التصنيف —</option>'+
      q.cls.cats.map(function(c,ci){ return '<option value="'+ci+'" '+(String(v)===String(ci)?'selected':'')+'>'+esc(c)+'</option>'; }).join('')+'</select></div>';
    }).join('');
  }
  h += body;
  h += '<div class="actions"><button class="btn ghost sm" onclick="clearQ(\''+q.id+'\')">🗑 مسح إجابتي</button></div>';
  h += '</div>';
  return h;
}
function gridHTML(q, tbl, sub, a){
  if(!tbl) return '';
  var vals = a.grid = a.grid||{};
  var k = sub+'_'+(q.id);
  var store = vals[k] = vals[k]||{};
  var h = '<table class="grid"><tr>'+tbl.head.map(function(x){return '<th>'+esc(x)+'</th>';}).join('')+'</tr>';
  h += tbl.rows.map(function(row,ri){
    return '<tr>'+row.map(function(cell,ci){
      if(cell!=='' ) return '<td>'+esc(cell)+'</td>';
      var kk = ri+'_'+ci;
      return '<td><textarea oninput="setGrid(\''+q.id+'\','+sub+','+ri+','+ci+',this.value)">'+esc(store[kk]||'')+'</textarea></td>';
    }).join('')+'</tr>';
  }).join('');
  return h+'</table>';
}
/* ---------- answer setters ---------- */
function setMCQ(qid, sub, i){
  var a=getA(qid);
  if(sub===0){ a.vals=[i]; } else { a.items=a.items||{}; a.items[sub]=i; }
  LS.set('answers',answers);
}
function setTF(qid, ii, v){
  var a=getA(qid); a.items=a.items||{}; a.items[ii]=v; LS.set('answers',answers);
  var labels=document.querySelectorAll('input[name="tf_'+qid+'_'+ii+'"]');
  labels.forEach(function(inp){ inp.closest('label').className = (inp.checked ? (inp.value==='0'||inp.dataset?'':'') : inp.closest('label').className); });
  window._showBlock && window._showBlock();
}
function setSub(qid, ii, v, kind){
  var a=getA(qid);
  if(kind==='fix'){ a.fix=a.fix||{}; a.fix[ii]=v; }
  else if(kind==='j'){ a.j=a.j||{}; a.j[ii]=v; }
  else { a.items=a.items||{}; a.items[ii]=v; }
  LS.set('answers',answers);
}
function setMatch(qid,i,v){ var a=getA(qid); a.match=a.match||{}; a.match[i]=v===''?null:+v; LS.set('answers',answers); }
function setCls(qid,i,v){ var a=getA(qid); a.cls=a.cls||{}; a.cls[i]=v===''?null:+v; LS.set('answers',answers); }
function setGrid(qid,sub,ri,ci,v){ var a=getA(qid); a.grid=a.grid||{}; var k=sub+'_'+q.id; a.grid[k]=a.grid[k]||{}; a.grid[k][ri+'_'+ci]=v; LS.set('answers',answers); }
function moveOrder(qid,i,d){
  var q=QBY[qid]; var a=getA(qid);
  var items = a.order&&a.order.length? a.order.slice() : q.items.slice();
  var j=i+d; if(j<0||j>=items.length) return;
  var t=items[i]; items[i]=items[j]; items[j]=t;
  a.order=items; LS.set('answers',answers);
  window._showBlock && window._showBlock();
}
function clearQ(qid){ delete answers[qid]; LS.set('answers',answers); window._showBlock && window._showBlock(); }
function zoom(src){ document.getElementById('zoomImg').src=src; document.getElementById('zoomModal').classList.remove('hidden'); }
function hasSuggested(q){
  if(q.answer_idx!=null||q.suggested) return true;
  return (q.items||[]).some(function(it){return it.answer_idx!=null||it.suggested;});
}

/* ---------- result & grading ---------- */
function computeResult(key){
  var qs=questionsOfBlock(key);
  var auto=0, autoMax=0, manualMax=0, wrong=[], right=0, manualList=[];
  qs.forEach(function(q){
    var a=answers[q.id]||{};
    if(q.typ==='mcq'){
      if(q.opts){ if(q.answer_idx!=null){ autoMax++; if(a.vals&&a.vals[0]===q.answer_idx){auto++;right++;} else wrong.push(q);} else manualList.push(q); }
      else (q.items||[]).forEach(function(it,ii){
        if(it.answer_idx!=null){ autoMax++; if(a.items&&a.items[ii]===it.answer_idx){auto++;right++;} else wrong.push(q);} else manualList.push(q);
      });
    } else if(q.typ==='tf'){
      (q.items||[]).forEach(function(it,ii){
        var expected = it.tf? (it.fix?1:0) : null; // tf without fix: treat "صواب" correct? source gives no key -> manual
        manualList.push(q);
      });
    } else manualList.push(q);
  });
  manualMax = manualList.length;
  grades[key] = {auto:auto, autoMax:autoMax, manualMax:manualMax, manual:{}, wrong:wrong.map(function(q){return q.id;}), ts:Date.now()};
  LS.set('grades', grades);
}
function renderResult(m, key){
  var g = grades[key]||computeResult(key)&&grades[key];
  var qs=questionsOfBlock(key);
  var label = qs[0].section+(qs[0].group?' — '+qs[0].group:'');
  var manual = g.manual||{};
  var manualScore=0; Object.values(manual).forEach(function(x){ manualScore += (+x.score||0); });
  var total = g.auto + manualScore;
  var max = g.autoMax + g.manualMax;
  var pct = max? Math.round(total/max*100):0;
  m.innerHTML =
  '<div class="crumb"><a onclick="render(\'home\')">🏠 الفهرس</a> / <b>نتيجة التقييم</b></div>'+
  '<div class="card hero"><h1>📊 النتيجة: '+esc(label)+'</h1><p>الطالب: '+esc(student.name||'زائر')+(student.cls?' — '+esc(student.cls):'')+'</p>'+
  '<div class="badges"><span>الدرجة: '+total+' / '+max+'</span><span>النسبة: '+pct+'%</span><span>إجابات صحيحة تلقائياً: '+g.auto+'</span><span>أسئلة تحتاج تصحيح المعلم: '+g.manualMax+'</span></div></div>'+
  '<div class="card"><b>تفصيل النتيجة</b>'+
  '<table class="tbl"><tr><th>البند</th><th>الدرجة</th></tr>'+
  '<tr><td>تصحيح تلقائي (اختيار من متعدد بمفتاح مطبوع)</td><td>'+g.auto+' / '+g.autoMax+'</td></tr>'+
  '<tr><td>تصحيح المعلم (مقالي / صواب وخطأ / خرائط / جداول)</td><td>'+manualScore+' / '+g.manualMax+'</td></tr>'+
  '<tr><td><b>الإجمالي</b></td><td><b>'+total+' / '+max+' ('+pct+'%)</b></td></tr></table>'+
  '<div class="okbox">ℹ️ الكتاب الأصلي لا يتضمن مفتاح إجابة مطبوعاً لمعظم الأسئلة؛ لذلك تُعد معظم الأسئلة «تحت مراجعة المعلم»، والنتيجة الأولية تعكس أسئلة الاختيار من متعدد ذات المفتاح الاستدلالي فقط.</div></div>'+
  '<div class="card"><b>📝 مراجعة الأسئلة</b>'+
  qs.map(function(q){
    var a=answers[q.id]||{};
    var your='';
    if(q.typ==='mcq'){
      if(q.opts && a.vals&&a.vals[0]!=null) your='اخترت: '+q.opts[a.vals[0]];
      else if(q.items) your=(q.items||[]).map(function(it,ii){
        var t=it.t.split('\n')[0];
        if(it.opts && a.items&&typeof a.items[ii]==='number') return it.t.length>60? '• '+t.slice(0,60)+'… → '+it.opts[a.items[ii]] : '• '+t+' → '+it.opts[a.items[ii]];
        if(it.opts) return '• '+t+' → (لم تُجب)';
        return '• '+t.slice(0,70)+'… → '+((a.items&&typeof a.items[ii]==='string')?a.items[ii]:'(لم تُجب)');
      }).join('\n');
    } else if(q.typ==='tf'){
      your=(q.items||[]).map(function(it,ii){
        var v=a.items&&typeof a.items[ii]==='number'? (a.items[ii]?'خطأ':'صواب'):'(لم تُجب)';
        var f=a.fix&&a.fix[ii]?' | التصويب: '+a.fix[ii]:'';
        return '• '+it.t.split('\n')[0].slice(0,80)+' → '+v+f;
      }).join('\n');
    } else {
      var vals=[];
      if(a.vals&&a.vals[0]) vals.push(a.vals[0]);
      if(a.items) Object.keys(a.items).forEach(function(k){ var v=a.items[k]; if(typeof v==='string'&&v.trim()) vals.push(v.trim()); });
      if(a.grid) Object.values(a.grid).forEach(function(gg){ Object.values(gg).forEach(function(c){ if(c&&c.trim()) vals.push(c.trim()); }); });
      if(a.match) Object.entries(a.match).forEach(function(e){ if(e[1]!=null){ var q2=QBY[q.id]; if(q2&&q2.tbl) vals.push(q2.tbl.left[e[0]]+' ← '+q2.tbl.right[e[1]]);} });
      if(a.order&&a.order.length) vals.push('الترتيب: '+a.order.join(' ← '));
      if(a.cls) Object.entries(a.cls).forEach(function(e){ if(e[1]!=null){ var q2=QBY[q.id]; if(q2&&q2.cls) vals.push(q2.cls.items[e[0]]+' = '+q2.cls.cats[e[1]]);} });
      your = vals.length? vals.join('\n') : '(لم تُجب)';
    }
    var mg = manual[q.id];
    return '<div class="subq"><div class="qhead"><span class="qnum">'+q.id+'</span><span class="badge">ص '+q.page+'</span></div>'+
      '<div class="st" style="white-space:pre-wrap">'+esc(your)+'</div>'+
      (mg? '<div class="mgrade"><span>درجة المعلم:</span><input type="number" min="0" max="10" value="'+esc(mg.score)+'" onchange="setManual(\''+key+'\',\''+q.id+'\',this.value)">'+
        '<span style="font-size:12px;color:var(--mut)">'+esc(mg.note||'')+'</span></div>':'')+
    '</div>';
  }).join('')+'</div>'+
  '<div class="actions"><button class="btn ghost" onclick="render(\'block\',\''+escAttr(key)+'\')">↩ مراجعة الأسئلة</button>'+
  '<button class="btn" onclick="render(\'home\')">🏠 الفهرس</button>'+
  '<button class="btn green" onclick="exportJSON()">⬇ تصدير نتائجي JSON</button></div>';
}
function setManual(key,qid,v){
  var g=grades[key]; g.manual=g.manual||{}; g.manual[qid]=g.manual[qid]||{};
  g.manual[qid].score=+v||0; LS.set('grades',grades); render('result',key);
}
function exportJSON(){
  var payload={student:student, answers:answers, grades:grades, blocks:blocksState, exported:new Date().toISOString(), book:B.title};
  download('results_'+Date.now()+'.json', JSON.stringify(payload,null,1));
}
function download(name, text){
  var blob=new Blob([text],{type:'application/json;charset=utf-8'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
}

/* ---------- search ---------- */
function renderSearch(m){
  m.innerHTML='<div class="card"><b>🔍 البحث في الكتاب</b><div class="searchrow" style="margin-top:8px">'+
  '<input id="skw" placeholder="اكتب كلمة من نص السؤال..." onkeydown="if(event.key===\'Enter\')doSearch()">'+
  '<button class="btn" onclick="doSearch()">بحث</button></div>'+
  '<div style="font-size:12px;color:var(--mut);margin-top:6px">يبحث في نص جميع الأسئلة ('+B.questions.length+' عنصراً) مع الوحدة والصفحة.</div>'+
  '<div id="sres"></div></div>';
}
function doSearch(){
  var kw=document.getElementById('skw').value.trim(); var box=document.getElementById('sres');
  if(!kw){ box.innerHTML='<div class="warnbox">اكتب كلمة للبحث.</div>'; return; }
  var hits=B.questions.filter(function(q){
    var hay=[q.text||'', q.unit, q.lesson, q.period, q.section, q.group];
    (q.items||[]).forEach(function(it){ hay.push(it.t); });
    return hay.join(' ').indexOf(kw)>=0;
  });
  box.innerHTML='<div style="margin-top:10px;font-size:13px;color:var(--mut)">عدد النتائج: '+hits.length+'</div>'+
  (hits.slice(0,60).map(function(q){
    var snippet = (q.text||'');
    (q.items||[]).forEach(function(it){ snippet += '\n'+it.t; });
    snippet = snippet.replace(/\n+/g,' | ');
    if(snippet.length>200) snippet=snippet.slice(0,200)+'…';
    return '<div class="result-item" onclick="jumpTo(\''+q.id+'\')"><div class="m">'+esc(q.unit)+' · '+esc(q.lesson||'')+' · '+esc(q.section)+' · ص '+q.page+' · '+typeLabel(q.typ)+'</div><div class="t">'+hl(snippet,kw)+'</div></div>';
  }).join('') || '<div class="warnbox">لا نتائج.</div>');
}
function jumpTo(qid){
  var q=QBY[qid]; var key=blockKeyOf(q);
  render('block', key);
  setTimeout(function(){
    if(!window._showBlock) startAssessment(key);
    var idx = questionsOfBlock(key).findIndex(function(x){return x.id===qid;});
    if(window._showBlock){ LS.set('cur_'+key, idx); window._showBlock(); }
  }, 60);
}

/* ---------- student progress ---------- */
function renderProgress(m){
  var finished=0, attempted=0, total=B.questions.length, touched=0;
  var unitStats = B.unit_tree.map(function(u,i){
    var qs=B.questions.filter(function(q){return q.unit===u.title;});
    var t=0, f=0;
    qs.forEach(function(q){ if(answers[q.id]&&answers[q.id].touched)t++; });
    var seen={}; qs.forEach(function(q){ var k=blockKeyOf(q); if(!seen[k]){seen[k]=1; if(blocksState[k]&&blocksState[k].finished)f++;} });
    var keys=Object.keys(seen);
    return {name:u.title, total:keys.length, finished:f, qt:qs.length, touched:qs.filter(function(q){return answers[q.id]&&answers[q.id].touched;}).length};
  });
  Object.values(blocksState).forEach(function(b){ if(b.finished) finished++; });
  B.questions.forEach(function(q){ if(answers[q.id]&&answers[q.id].touched) touched++; });
  var gsum=0,gmax=0;
  Object.keys(grades).forEach(function(k){ var g=grades[k]; var ms=0; Object.values(g.manual||{}).forEach(function(x){ms+=(+x.score||0);}); gsum+=g.auto+ms; gmax+=g.autoMax+g.manualMax; });
  m.innerHTML =
  '<div class="card"><b>📈 متابعة تقدمي</b>'+
  '<div class="statgrid">'+
    '<div class="stat"><div class="v">'+touched+'/'+total+'</div><div class="l">أسئلة تمت الإجابة عنها</div></div>'+
    '<div class="stat"><div class="v">'+finished+'</div><div class="l">تقييمات أُتمّت</div></div>'+
    '<div class="stat"><div class="v">'+(gmax? (gsum+'/'+gmax):'—')+'</div><div class="l">مجموع الدرجات المسجلة</div></div>'+
    '<div class="stat"><div class="v">'+(gmax? Math.round(gsum/gmax*100)+'%':'—')+'</div><div class="l">نسبة الإنجاز العام</div></div>'+
  '</div></div>'+
  unitStats.map(function(s,i){
    var pct = s.qt? Math.round(s.touched/s.qt*100):0;
    return '<div class="card"><div class="unit-h"><div class="un">'+(i+1)+'</div><h2 style="font-size:14px">'+esc(s.name)+'</h2></div>'+
      '<div class="bar" style="margin-top:8px"><i style="width:'+pct+'%"></i></div>'+
      '<div style="font-size:12px;color:var(--mut);margin-top:4px">أجبت عن '+s.touched+' من '+s.qt+' عنصراً · أتممت '+s.finished+' من '+s.total+' جزءاً تقييمياً</div></div>';
  }).join('')+
  '<div class="card"><b>🗂 سجل التقييمات</b>'+
  (Object.keys(blocksState).length? '<table class="tbl"><tr><th>التقييم</th><th>الحالة</th><th>الدرجة</th><th></th></tr>'+
    Object.keys(blocksState).map(function(k){
      var qs=questionsOfBlock(k); if(!qs.length) return '';
      var label=qs[0].section+(qs[0].group?' — '+qs[0].group:'');
      var st=blocksState[k];
      var g=grades[k]; var sc='—';
      if(g){ var ms=0; Object.values(g.manual||{}).forEach(function(x){ms+=(+x.score||0);}); var mx=g.autoMax+g.manualMax; sc=(g.auto+ms)+'/'+mx; }
      return '<tr><td style="text-align:right">'+esc(label)+'<div style="font-size:11px;color:var(--mut)">'+esc(qs[0].unit.slice(0,30))+'…</div></td>'+
        '<td>'+(st.finished?'<span class="pill">مكتمل</span>':'<span class="pill gray">لم يكتمل</span>')+'</td>'+
        '<td>'+sc+'</td>'+
        '<td><button class="btn ghost sm" onclick="render(\'block\',\''+escAttr(k)+'\')">فتح</button></td></tr>';
    }).join('')+'</table>' : '<div class="warnbox">لم تفتح أي تقييم بعد.</div>')+'</div>';
}

/* ---------- teacher dashboard ---------- */
var teacherOK=false;
function renderTeacher(m){
  if(!teacherOK){
    m.innerHTML='<div class="card"><b>🧑‍🏫 لوحة المعلم</b><p style="font-size:13px">أدخل كلمة مرور المعلم للدخول (افتراضياً: <b>teacher</b> — يمكن تغييرها من الإعدادات).</p>'+
    '<div class="searchrow"><input id="tpw" type="password" placeholder="كلمة المرور"><button class="btn" onclick="tryTeacher()">دخول</button></div></div>';
    return;
  }
  var students = LS.get('students',{});
  var names = Object.keys(students);
  var cur = student.name||'';
  m.innerHTML =
  '<div class="crumb"><b>لوحة المعلم</b></div>'+
  '<div class="card"><b>👤 ملفات الطلاب (محلية على هذا الجهاز)</b>'+
  (names.length? '<table class="tbl"><tr><th>الطالب</th><th>الفصل</th><th>تقييمات مكتملة</th><th>المجموع</th><th></th></tr>'+
    names.map(function(n){
      var s=students[n]; var done=0,sc=0,mx=0;
      Object.keys(s.grades||{}).forEach(function(k){ var g=s.grades[k]; done++; var ms=0; Object.values(g.manual||{}).forEach(function(x){ms+=(+x.score||0);}); sc+=g.auto+ms; mx+=g.autoMax+g.manualMax; });
      return '<tr><td>'+esc(n)+'</td><td>'+esc(s.cls||'—')+'</td><td>'+done+'</td><td>'+(mx? sc+'/'+mx:'—')+'</td>'+
      '<td><button class="btn ghost sm" onclick="viewStudent(\''+escAttr(n)+'\')">عرض</button></td></tr>';
    }).join('')+'</table>' : '<div class="warnbox">لا توجد ملفات طلاب محفوظة بعد على هذا الجهاز. يستورد المعلم ملفات JSON يرسلها الطلاب من زر «استيراد ملف طالب» أدناه.</div>')+
  '<div class="actions" style="margin-top:10px">'+
    '<label class="btn ghost sm">📥 استيراد ملف طالب<input type="file" accept=".json" style="display:none" onchange="importStudent(this)"></label>'+
    '<button class="btn ghost sm" onclick="exportClass()">⬇ تصدير سجل الفصل</button>'+
  '</div></div>'+
  '<div class="card"><b>⚙️ إدارة التقييمات (إعدادات الإتقان)</b>'+
  '<p style="font-size:12px;color:var(--mut)">تحديد الإتاحة والزمن والدرجة النهائية لكل جزء تقييمي:</p>'+
  Object.keys(allBlockKeys()).map(function(k){
    var qs=questionsOfBlock(k); var label=qs[0].section+(qs[0].group?' — '+qs[0].group:'');
    var cfg=(LS.get('tconfig',{})||{})[k]||{};
    return '<div class="subq"><div class="tline"><b style="font-size:13px">'+esc(label)+'</b>'+
      '<span class="badge">ص '+qs[0].page+'–'+qs[qs.length-1].page+'</span>'+
      '<label style="font-size:12px"><input type="checkbox" '+(cfg.enabled!==false?'checked':'')+' onchange="setCfg(\''+escAttr(k)+'\',\'enabled\',this.checked)"> متاح للطلاب</label>'+
      '<input type="number" placeholder="الزمن (د)" value="'+esc(cfg.time||'')+'" onchange="setCfg(\''+escAttr(k)+'\',\'time\',this.value)">'+
      '<input type="number" placeholder="الدرجة النهائية" value="'+esc(cfg.max||'')+'" onchange="setCfg(\''+escAttr(k)+'\',\'max\',this.value)">'+
      '<input type="date" value="'+esc(cfg.from||'')+'" onchange="setCfg(\''+escAttr(k)+'\',\'from\',this.value)">'+
      '<input type="date" value="'+esc(cfg.to||'')+'" onchange="setCfg(\''+escAttr(k)+'\',\'to\',this.value)">'+
    '</div></div>';
  }).join('')+'</div>'+
  '<div class="card"><b>📊 تحليل الأسئلة الأكثر صعوبة</b>'+
  hardestHTML()+'</div>'+
  '<div class="card"><b>🔧 أدوات المعلم</b><div class="actions">'+
    '<button class="btn ghost sm" onclick="render(\'teacherReport\')">📄 تقرير مطابقة الكتاب</button>'+
    '<button class="btn ghost sm" onclick="render(\'settings\')">الإعدادات والنسخ الاحتياطي</button>'+
    '<button class="btn ghost sm" onclick="teacherOK=false;render(\'teacher\')">🔒 خروج</button>'+
  '</div></div>';
}
function allBlockKeys(){
  var seen={},out=[];
  B.questions.forEach(function(q){ var k=blockKeyOf(q); if(!seen[k]){seen[k]=1;out.push(k);} });
  return out;
}
function tryTeacher(){
  var pw=document.getElementById('tpw').value;
  var real=LS.get('tpass','teacher');
  if(pw===real){ teacherOK=true; render('teacher'); } else alert('كلمة المرور غير صحيحة');
}
function setCfg(k,f,v){ var c=LS.get('tconfig',{}); c[k]=c[k]||{}; c[k][f]= (f==='enabled')? !!v : v; LS.set('tconfig',c); }
function importStudent(inp){
  var f=inp.files[0]; if(!f) return;
  var r=new FileReader();
  r.onload=function(){
    try{
      var d=JSON.parse(r.result);
      if(!d.student||!d.answers) throw 0;
      var n=d.student.name||('طالب '+Date.now());
      var students=LS.get('students',{}); students[n]=d; LS.set('students',students);
      alert('تم استيراد ملف الطالب: '+n); render('teacher');
    }catch(e){ alert('ملف غير صالح'); }
  };
  r.readAsText(f);
}
function exportClass(){ download('class_record_'+Date.now()+'.json', JSON.stringify(LS.get('students',{}),null,1)); }
function viewStudent(n){
  var s=(LS.get('students',{})||{})[n]; if(!s) return;
  var m=document.getElementById('view');
  var rows=Object.keys(s.blocks||{}).map(function(k){
    var qs=questionsOfBlock(k); var g=(s.grades||{})[k]; var ms=0; if(g) Object.values(g.manual||{}).forEach(function(x){ms+=(+x.score||0);});
    var label=qs.length? qs[0].section+(qs[0].group?' — '+qs[0].group:''):k;
    return '<tr><td style="text-align:right">'+esc(label)+'</td><td>'+(s.blocks[k].finished?'مكتمل':'—')+'</td><td>'+(g?(g.auto+ms)+'/'+(g.autoMax+g.manualMax):'—')+'</td></tr>';
  }).join('');
  m.innerHTML='<div class="crumb"><a onclick="render(\'teacher\')">↩ لوحة المعلم</a> / <b>'+esc(n)+'</b></div>'+
  '<div class="card"><b>نتائج الطالب: '+esc(n)+'</b><table class="tbl"><tr><th>التقييم</th><th>الحالة</th><th>الدرجة</th></tr>'+(rows||'<tr><td colspan=3>لا سجلات</td></tr>')+'</table></div>'+
  '<div class="card"><b>📝 أسئلة مقالية بحاجة إلى تصحيح</b>'+
  Object.keys(s.answers||{}).map(function(qid){
    var q=QBY[qid]; if(!q) return '';
    var a=s.answers[qid]; var texts=[];
    if(a.vals&&typeof a.vals[0]==='string'&&a.vals[0].trim()) texts.push(a.vals[0]);
    if(a.items) Object.entries(a.items).forEach(function(e){ if(typeof e[1]==='string'&&e[1].trim()) texts.push(e[1]); });
    if(a.grid) Object.values(a.grid).forEach(function(gg){ Object.values(gg).forEach(function(c){ if(c&&c.trim()) texts.push(c); }); });
    if(!texts.length) return '';
    return '<div class="subq"><div class="qhead"><span class="qnum">'+q.id+'</span><span class="badge">ص '+q.page+'</span><span class="badge w">مراجعة المعلم</span></div>'+
      '<div class="st" style="white-space:pre-wrap">'+esc(texts.join('\n'))+'</div>'+
      '<div class="mgrade"><input type="number" min="0" max="10" placeholder="درجة" onchange="saveStuGrade(\''+escAttr(n)+'\',\''+qid+'\',this.value)"></div></div>';
  }).join('')||'<div class="warnbox">لا إجابات كتابية مسجلة.</div>'+'</div>';
}
function saveStuGrade(n,qid,v){
  var students=LS.get('students',{}); var s=students[n]; if(!s) return;
  s.grades=s.grades||{};
  // ضع الدرجة اليدوية في أول بلوك يحوي السؤال
  var q=QBY[qid]; var key=blockKeyOf(q);
  s.grades[key]=s.grades[key]||{auto:0,autoMax:0,manualMax:0,manual:{}};
  s.grades[key].manual[qid]={score:+v||0,note:'رصد يدوي'};
  LS.set('students',students); alert('تم رصد الدرجة.');
}
function hardestHTML(){
  var stats={};
  Object.keys(grades).forEach(function(k){
    var g=grades[k]; (g.wrong||[]).forEach(function(qid){ stats[qid]=(stats[qid]||0)+1; });
  });
  var arr=Object.entries(stats).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
  if(!arr.length) return '<div class="warnbox">لا بيانات كافية بعد (تظهر التحليلات بعد أداء الطلاب للتقييمات).</div>';
  return '<table class="tbl"><tr><th>السؤال</th><th>الصفحة</th><th>مرات الخطأ</th></tr>'+
  arr.map(function(e){ var q=QBY[e[0]]; return '<tr><td style="text-align:right">'+esc((q.text||'').slice(0,90))+'</td><td>'+q.page+'</td><td>'+e[1]+'</td></tr>'; }).join('')+'</table>';
}
function renderTeacherReport(m){
  var perPage = B.coverage && B.coverage.per_page;
  m.innerHTML='<div class="crumb"><a onclick="render(\'teacher\')">↩ لوحة المعلم</a> / <b>تقرير مطابقة الكتاب الأصلي</b></div>'+
  '<div class="card"><b>📄 تقرير المعالجة صفحةً صفحة</b>'+
  '<table class="tbl"><tr><th>الصفحة</th><th>الحالة</th><th>عدد العناصر</th></tr>'+
  perPage.map(function(r){ return '<tr><td>'+r[0]+'</td><td>'+(r[2]==='تمت المعالجة'?'✅ تمت المعالجة':esc(r[2]))+'</td><td>'+(r[3]||'—')+'</td></tr>'; }).join('')+
  '</table></div>'+
  '<div class="card"><b>الملخص</b>'+
  '<table class="tbl"><tr><th>البند</th><th>القيمة</th></tr>'+
  '<tr><td>إجمالي صفحات المصدر</td><td>73</td></tr>'+
  '<tr><td>صفحات معالجة (أسئلة)</td><td>68</td></tr>'+
  '<tr><td>إجمالي الأسئلة والأنشطة المستخرجة</td><td>'+B.questions.length+'</td></tr>'+
  '<tr><td>أسئلة مقالية/كتابية</td><td>'+(B.coverage?B.coverage.essay_like:'—')+'</td></tr>'+
  '<tr><td>أسئلة معتمدة على خرائط وصور</td><td>'+(B.coverage?B.coverage.map_image_dependent:'—')+'</td></tr>'+
  '<tr><td>أسئلة تحتاج مراجعة المعلم (لا مفتاح مطبوع)</td><td>'+(B.coverage?B.coverage.needs_teacher_review:'—')+'</td></tr>'+
  '<tr><td>محتوى تعذر استخراجه</td><td>لا يوجد — جميع الأسئلة نُقلت حرفياً؛ خرائط كتاب الدراسة الخارجية (ص 10، 14، 16، 20) موسومة بملاحظات.</td></tr>'+
  '</table></div>';
}

/* ---------- settings ---------- */
function renderSettings(m){
  m.innerHTML='<div class="crumb"><a onclick="render(\'home\')">🏠 الفهرس</a> / <b>الإعدادات وحفظ البيانات</b></div>'+
  '<div class="card"><b>👤 بيانات الطالب</b><div class="tline">'+
  '<input id="sname" placeholder="اسم الطالب" value="'+esc(student.name||'')+'">'+
  '<input id="scls" placeholder="الفصل" value="'+esc(student.cls||'')+'">'+
  '<button class="btn sm" onclick="saveStudent()">حفظ</button></div></div>'+
  '<div class="card"><b>💾 البيانات</b><p style="font-size:12px;color:var(--mut)">كل شيء يُحفظ محلياً في متصفح هذا الجهاز. لا يوجد سيرفر أو قاعدة بيانات — للنقل بين الأجهزة استخدم التصدير والاستيراد.</p>'+
  '<div class="actions">'+
  '<button class="btn ghost sm" onclick="exportJSON()">⬇ تصدير كل بياناتي (JSON)</button>'+
  '<label class="btn ghost sm">📥 استيراد بيانات<input type="file" accept=".json" style="display:none" onchange="importAll(this)"></label>'+
  '<button class="btn ghost sm" style="color:var(--bad);border-color:var(--bad)" onclick="wipeAll()">🗑 مسح كل بياناتي</button>'+
  '</div></div>'+
  '<div class="card"><b>🔐 كلمة مرور المعلم</b><div class="searchrow"><input id="npw" placeholder="كلمة مرور جديدة"><button class="btn sm" onclick="savePass()">حفظ</button></div></div>'+
  '<div class="card"><b>👁 خيار العرض</b><label style="font-size:13px"><input type="checkbox" '+(settings.showAnswers?'checked':'')+' onchange="settings.showAnswers=this.checked;LS.set(\'settings\',settings)"> إظهار تلميح «الإجابة المقترحة (مراجعة المعلم)» بعد التسليم</label></div>';
}
function saveStudent(){ student={name:document.getElementById('sname').value.trim(), cls:document.getElementById('scls').value.trim()};
  LS.set('student',student);
  var st=LS.get('students',{}); if(student.name){ st[student.name]=st[student.name]||{}; st[student.name].cls=student.cls; st[student.name].answers=answers; st[student.name].grades=grades; st[student.name].blocks=blocksState; LS.set('students',st); }
  document.getElementById('whoChip').textContent='👤 '+(student.name||'زائر'); render('home');
}
function switchStudent(){
  var n=prompt('اسم الطالب:', student.name||''); if(n===null) return;
  student={name:n.trim(), cls:student.cls||''}; LS.set('student',student);
  document.getElementById('whoChip').textContent='👤 '+(student.name||'زائر');
}
function importAll(inp){
  var f=inp.files[0]; if(!f) return; var r=new FileReader();
  r.onload=function(){ try{ var d=JSON.parse(r.result);
    if(d.answers){answers=d.answers;LS.set('answers',answers);}
    if(d.grades){grades=d.grades;LS.set('grades',grades);}
    if(d.blocks){blocksState=d.blocks;LS.set('blocks',blocksState);}
    alert('تم الاستيراد بنجاح'); render('home');
  }catch(e){ alert('ملف غير صالح'); } };
  r.readAsText(f);
}
function wipeAll(){ if(confirm('هل تريد مسح جميع الإجابات والنتائج من هذا الجهاز؟')){ localStorage.clear(); location.reload(); } }
function savePass(){ var v=document.getElementById('npw').value.trim(); if(v){LS.set('tpass',v); alert('تم حفظ كلمة المرور.');} }

/* ---------- timer (if teacher sets time) ---------- */
var timerH=null;
function maybeTimer(key){
  var cfg=(LS.get('tconfig',{})||{})[key]||{};
  if(cfg.time){
    var end=Date.now()+ (+cfg.time)*60000;
    document.getElementById('timerChip').classList.remove('hidden');
    clearInterval(timerH);
    timerH=setInterval(function(){
      var s=Math.max(0,Math.floor((end-Date.now())/1000));
      document.getElementById('timerVal').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
      if(s<=0){ clearInterval(timerH); alert('انتهى الزمن المحدد للتقييم.'); finishBlock(key); }
    },1000);
  }
}
/* init */
document.getElementById('whoChip').textContent='👤 '+(student.name||'زائر');
render('home');
