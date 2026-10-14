(function(){
  var narrow = window.matchMedia('(max-width:1060px)');
  var coarse = window.matchMedia('(pointer:coarse)');
  var article = document.querySelector('article.article');
  var paras = article ? [].slice.call(article.querySelectorAll('p.para')) : [];
  var MARKERS = 'mark.hl,.un-hl,.un-sup';

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }
  function $all(sel, root){ return [].slice.call((root||document).querySelectorAll(sel)); }

  /* ------------------------------------------------ note keys: "n:3" built-in, "u:<id>" reader's own */
  function keyOf(node){
    if(!node || !node.closest) return null;
    // where a reader highlight overlaps a built-in one, the built-in mark wins; ✎ always opens the reader's note
    var x = node.closest('.un-sup') || node.closest('mark.hl') || node.closest('.un-hl,.note');
    if(!x) return null;
    if(x.dataset.un) return 'u:' + x.dataset.un;
    if(x.dataset.n) return 'n:' + x.dataset.n;
    return null;
  }
  function partsOf(key){
    var id = key.slice(2);
    if(key[0] === 'n') return {note: document.getElementById('note-' + id), marks: $all('mark.hl[data-n="' + id + '"]')};
    return {note: document.getElementById('unote-' + id), marks: $all('.un-hl[data-un="' + id + '"],.un-sup[data-un="' + id + '"]')};
  }
  function setActive(key, on){
    var p = partsOf(key);
    p.marks.concat(p.note ? [p.note] : []).forEach(function(e){ e.classList.toggle('active', on); });
  }
  function closeAll(){
    $all('.note.open').forEach(function(n){ n.classList.remove('open'); });
    $all('.active').forEach(function(e){ e.classList.remove('active'); });
    if(allOpen){ allOpen = false; label(); }
  }
  // narrow screens: only one note open at a time; tapping the open one's marker closes it
  function openOnly(key, force){
    var p = partsOf(key);
    if(!p.note) return;
    var wasOpen = p.note.classList.contains('open') && !allOpen;
    closeAll();
    if(wasOpen && !force) return;
    p.note.classList.add('open');
    setActive(key, true);
    p.note.scrollIntoView({block:'nearest', behavior:'smooth'});
  }
  function flash(key){
    var p = partsOf(key);
    if(!p.note) return;
    p.note.scrollIntoView({block:'nearest', behavior:'smooth'});
    setActive(key, true);
    setTimeout(function(){ setActive(key, false); }, 1400);
  }
  function tap(key){ if(narrow.matches) openOnly(key); else flash(key); }

  var hoverKey = null;
  document.addEventListener('mouseover', function(e){
    if(narrow.matches) return;
    var k = keyOf(e.target);
    if(k === hoverKey) return;
    if(hoverKey) setActive(hoverKey, false);
    hoverKey = k;
    if(k) setActive(k, true);
  });

  function selectingText(){
    var s = window.getSelection();
    return s && !s.isCollapsed && article && s.rangeCount && s.getRangeAt(0).intersectsNode(article);
  }
  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t.closest || t.closest('.un-fab,.un-editor,.un-toast,#toggle-all,.mynotes')) return;
    var act = t.closest('.un-act');
    if(act){ noteAction(act.dataset.act, act.closest('[data-un]').dataset.un); return; }
    if(selectingText()) return;
    var m = t.closest(MARKERS);
    if(m && article.contains(m)){ var k = keyOf(m); if(k) tap(k); return; }
    if(t.closest('.note')) return;
    if(narrow.matches) closeAll();
  });
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter' && e.key !== ' ') return;
    var m = e.target.closest && e.target.closest('mark.hl,.un-sup');
    if(!m) return;
    e.preventDefault();
    tap(keyOf(m));
  });

  var t = document.getElementById('toggle-all'), allOpen = false;
  function label(){ if(t) t.textContent = narrow.matches ? (allOpen?'收起全部笔记':'展开全部笔记') : (allOpen?'收起高亮':'高亮全部批注'); }
  if(t){ label(); narrow.addEventListener && narrow.addEventListener('change', label);
    t.addEventListener('click', function(){ allOpen = !allOpen;
      $all('.note').forEach(function(nt){ nt.classList.toggle('open', allOpen); });
      $all(MARKERS).forEach(function(m){ m.classList.toggle('active', allOpen); });
      label(); });
  }

  // word / sentence pronunciation via the browser's speech synthesis
  var synth = window.speechSynthesis;
  $all('.say').forEach(function(b){
    if(!synth){ b.style.display = 'none'; return; }
    b.addEventListener('click', function(){
      synth.cancel(); var u = new SpeechSynthesisUtterance(b.dataset.say); u.lang = 'en-US'; u.rate = .9;
      var v = synth.getVoices().filter(function(x){ return /en-US/i.test(x.lang); })[0]; if(v) u.voice = v;
      synth.speak(u);
    });
  });

  if(!article || !paras.length) return;

  /* ================================================ reader's own notes */
  var issueId = document.body.dataset.issue || location.pathname;
  var KEY = 'chendu:notes:' + issueId;
  var CTX = 32;
  var notes = load(), pending = null, editing = null, pendingSel = null;

  function load(){
    try{
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      return v && Array.isArray(v.notes) ? v.notes : [];
    }catch(e){ return []; }
  }
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify({v:1, notes:notes})); return true; }
    catch(e){ toast('浏览器禁止了本地存储，笔记无法保存'); return false; }
  }
  window.addEventListener('storage', function(e){ if(e.key === KEY){ notes = load(); render(); } });

  // article text = paragraphs joined by "\n"; superscript numbers/markers are excluded
  function textModel(){
    var list = [], text = '', pstart = [];
    paras.forEach(function(p, pi){
      if(pi) text += '\n';
      pstart.push(text.length);
      var w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, {acceptNode: function(n){
        return n.parentNode.closest('sup') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }});
      var n;
      while((n = w.nextNode())){ list.push({node:n, start:text.length}); text += n.data; }
    });
    return {list:list, text:text, pstart:pstart};
  }
  function paraIndexAt(m, pos){
    var i = m.pstart.length - 1;
    while(i > 0 && m.pstart[i] > pos) i--;
    return i;
  }

  function rangeToAnchor(r){
    var m = textModel(), s = Infinity, e = -1;
    m.list.forEach(function(x){
      if(!r.intersectsNode(x.node)) return;
      var a = x.node === r.startContainer ? r.startOffset : 0;
      var b = x.node === r.endContainer ? r.endOffset : x.node.length;
      if(b <= a) return;
      s = Math.min(s, x.start + a); e = Math.max(e, x.start + b);
    });
    if(e < 0) return null;
    while(s < e && /\s/.test(m.text[s])) s++;
    while(e > s && /\s/.test(m.text[e-1])) e--;
    if(e <= s) return null;
    return {start:s, end:e, quote:m.text.slice(s, e),
            prefix:m.text.slice(Math.max(0, s - CTX), s), suffix:m.text.slice(e, e + CTX)};
  }

  // re-find a saved quote: prefer matching surrounding context, then the closest to the saved offset
  function locate(n, m){
    var q = n.quote, best = null, i = q ? m.text.indexOf(q) : -1;
    while(i >= 0){
      var ctx = (n.prefix && m.text.slice(Math.max(0, i - n.prefix.length), i) === n.prefix ? 1 : 0) +
                (n.suffix && m.text.slice(i + q.length, i + q.length + n.suffix.length) === n.suffix ? 1 : 0);
      var score = Math.abs(i - (n.start || 0)) - ctx * 1e7;
      if(!best || score < best.score) best = {score:score, start:i};
      i = m.text.indexOf(q, i + 1);
    }
    return best ? {start:best.start, end:best.start + q.length} : null;
  }

  function wrap(start, end, id, extra){
    var m = textModel(), segs = [];
    m.list.forEach(function(x){
      var a = Math.max(start, x.start), b = Math.min(end, x.start + x.node.length);
      if(b > a) segs.push({node:x.node, a:a - x.start, b:b - x.start});
    });
    var last = null;
    segs.forEach(function(sg){
      var n = sg.node;
      if(sg.b < n.length) n.splitText(sg.b);
      if(sg.a > 0) n = n.splitText(sg.a);
      var span = el('span', 'un-hl' + (extra ? ' ' + extra : ''));
      span.dataset.un = id;
      n.parentNode.insertBefore(span, n);
      span.appendChild(n);
      last = span;
    });
    return last;
  }

  function clearRendered(){
    $all('.un-sup', article).forEach(function(s){ s.remove(); });
    $all('.un-hl', article).forEach(function(s){
      var p = s.parentNode;
      while(s.firstChild) p.insertBefore(s.firstChild, s);
      p.removeChild(s);
    });
    paras.forEach(function(p){ p.normalize(); });
    $all('.note.t-user').forEach(function(n){ n.remove(); });
  }

  function shortQuote(q, max){
    q = q.replace(/\s*\n\s*/g, ' / ');
    max = max || 48;
    return q.length > max ? q.slice(0, max - 2).replace(/\s+\S*$/, '') + ' …' : q;
  }

  function buildNote(n, i){
    var d = el('div', 'note t-user');
    d.id = 'unote-' + n.id; d.dataset.un = n.id;
    d.style.setProperty('--tilt', [-0.7, 0.6, -0.4, 0.9][i % 4] + 'deg');
    d.appendChild(el('span', 'num', '✎'));
    d.appendChild(el('span', 'tag', '我的笔记'));
    d.appendChild(el('div', 'nh nq', '“' + shortQuote(n.quote) + '”'));
    d.appendChild(el('div', 'nz', n.text));
    d.appendChild(actions());
    return d;
  }
  function actions(){
    var a = el('div', 'un-acts');
    var e = el('button', 'un-act', '编辑'); e.type = 'button'; e.dataset.act = 'edit';
    var x = el('button', 'un-act', '删除'); x.type = 'button'; x.dataset.act = 'del';
    a.appendChild(e); a.appendChild(x);
    return a;
  }

  function render(){
    var openIds = $all('.note.t-user.open').map(function(n){ return n.dataset.un; });
    clearRendered();
    var m = textModel(), changed = false;
    notes.forEach(function(n){
      var loc = locate(n, m);
      n._lost = !loc;
      if(loc && (loc.start !== n.start || loc.end !== n.end)){ n.start = loc.start; n.end = loc.end; changed = true; }
    });
    var placed = notes.filter(function(n){ return !n._lost; }).sort(function(a, b){ return a.start - b.start; });
    placed.forEach(function(n, i){
      var last = wrap(n.start, n.end, n.id);
      if(last){
        var sup = el('sup', 'un-sup', '✎');
        sup.dataset.un = n.id; sup.tabIndex = 0;
        sup.setAttribute('role', 'button'); sup.setAttribute('aria-label', '我的笔记');
        last.parentNode.insertBefore(sup, last.nextSibling);
      }
      var row = paras[paraIndexAt(m, n.start)].parentNode;
      var L = row.querySelector('.side.left'), R = row.querySelector('.side.right');
      var side = L.children.length < R.children.length ? L : R;
      side.appendChild(buildNote(n, i));
    });
    if(pending) wrap(pending.start, pending.end, '__pending', 'pending');
    openIds.forEach(function(id){
      var p = partsOf('u:' + id);
      if(p.note){ p.note.classList.add('open'); setActive('u:' + id, true); }
    });
    if(changed) save();
    renderList();
  }

  /* ------------------------------------------------ "add note" button
     fine pointer: floats under the selection. touch / narrow: fixed bar at the bottom of the viewport,
     clear of the native selection callout (iOS/Android draw it right next to the selection). */
  var fab = el('button', 'un-fab', '✏️ 加笔记');
  fab.type = 'button'; fab.hidden = true;
  fab.setAttribute('aria-label', '给选中的文字加笔记');
  document.body.appendChild(fab);
  var pressing = false, dragging = false, selTimer = null, lastTouch = 0;

  function barMode(){ return coarse.matches || narrow.matches; }
  function hideFab(){ fab.hidden = true; pendingSel = null; }
  function evaluateSelection(){
    if(editorOpen() || pressing) return;
    var s = window.getSelection();
    if(!s || !s.rangeCount || s.isCollapsed){ hideFab(); return; }
    var r = s.getRangeAt(0);
    if(!r.intersectsNode(article)){ hideFab(); return; }
    var a = rangeToAnchor(r);
    if(!a){ hideFab(); return; }
    pendingSel = a;
    fab.hidden = false;
    var bar = barMode();
    fab.classList.toggle('bar', bar);
    if(bar){ fab.style.left = fab.style.top = ''; return; }
    var rects = [].filter.call(r.getClientRects(), function(x){ return x.width > 0 && x.height > 0; });
    var box = rects.length ? rects[rects.length - 1] : r.getBoundingClientRect();
    var w = fab.offsetWidth, vw = document.documentElement.clientWidth;
    var left = Math.min(Math.max(8, box.right - w / 2), vw - w - 8);
    fab.style.left = (left + window.scrollX) + 'px';
    fab.style.top = (box.bottom + window.scrollY + 8) + 'px';
  }
  function schedule(ms){ clearTimeout(selTimer); selTimer = setTimeout(evaluateSelection, ms); }
  document.addEventListener('selectionchange', function(){ if(!dragging) schedule(barMode() ? 200 : 120); });
  // only a real mouse drag defers evaluation; touch selection (handles, long-press) relies on selectionchange
  document.addEventListener('pointerdown', function(e){ if(e.pointerType === 'mouse' && !fab.contains(e.target)) dragging = true; });
  document.addEventListener('pointerup', function(){ if(dragging){ dragging = false; schedule(10); } });
  document.addEventListener('pointercancel', function(){ dragging = false; });
  document.addEventListener('touchend', function(e){ if(!fab.contains(e.target)) schedule(350); }, {passive:true});
  window.addEventListener('resize', function(){ if(!fab.hidden) evaluateSelection(); });

  // the selection was cached in pendingSel; preventDefault keeps the tap from clearing it first
  function press(e){
    pressing = true;
    if(e.cancelable) e.preventDefault();
    setTimeout(function(){ pressing = false; }, 1500);
  }
  function fire(e){
    if(e && e.cancelable) e.preventDefault();
    pressing = false;
    if(e && e.type === 'touchend') lastTouch = Date.now();
    else if(Date.now() - lastTouch < 700) return;
    var a = pendingSel;
    if(!a) return;
    fab.hidden = true;
    var s = window.getSelection(); if(s) s.removeAllRanges();
    pending = a;
    render();
    openEditor(null, $all('.un-hl.pending', article).pop());
  }
  fab.addEventListener('touchstart', press, {passive:false});
  fab.addEventListener('touchend', fire, {passive:false});
  fab.addEventListener('mousedown', press);
  fab.addEventListener('click', fire);

  /* ------------------------------------------------ editor */
  var ed = el('div', 'un-editor');
  ed.hidden = true;
  ed.setAttribute('role', 'dialog'); ed.setAttribute('aria-label', '我的笔记');
  var edQ = el('div', 'ue-q'), edT = el('textarea'), edBar = el('div', 'ue-bar');
  edT.rows = 3; edT.placeholder = '写下你的理解、联想或疑问…'; edT.maxLength = 2000;
  var edDel = el('button', 'ue-del', '删除'), edCancel = el('button', 'ue-cancel', '取消'), edSave = el('button', 'ue-save', '保存');
  [edDel, edCancel, edSave].forEach(function(b){ b.type = 'button'; });
  edBar.appendChild(edDel); edBar.appendChild(el('span', 'ue-sp')); edBar.appendChild(edCancel); edBar.appendChild(edSave);
  ed.appendChild(el('div', 'ue-h', '我的笔记')); ed.appendChild(edQ); ed.appendChild(edT); ed.appendChild(edBar);
  document.body.appendChild(ed);

  function editorOpen(){ return !ed.hidden; }
  function syncSave(){ edSave.disabled = !edT.value.trim(); }
  edT.addEventListener('input', syncSave);

  function openEditor(note, anchorEl){
    editing = note;
    edQ.textContent = '“' + shortQuote(note ? note.quote : pending.quote, 140) + '”';
    edT.value = note ? note.text : '';
    edDel.hidden = !note;
    syncSave();
    ed.hidden = false;
    var vw = document.documentElement.clientWidth, w = Math.min(340, vw - 16);
    ed.style.width = w + 'px';
    var box = anchorEl ? anchorEl.getBoundingClientRect() : {left:(vw - w) / 2, bottom:window.innerHeight / 3};
    ed.style.left = (Math.min(Math.max(8, box.left), vw - w - 8) + window.scrollX) + 'px';
    ed.style.top = (box.bottom + window.scrollY + 8) + 'px';
    edT.focus({preventScroll:true});
    var len = edT.value.length; edT.setSelectionRange(len, len);
    ed.scrollIntoView({block:'nearest', behavior:'smooth'});
  }
  function closeEditor(){
    ed.hidden = true;
    editing = null;
    if(pending){ pending = null; render(); }
  }
  function commit(){
    var text = edT.value.trim();
    if(!text) return;
    var id, now = Date.now();
    if(editing){
      editing.text = text; editing.updated = now; id = editing.id;
    }else if(pending){
      id = now.toString(36) + Math.random().toString(36).slice(2, 6);
      notes.push({id:id, quote:pending.quote, prefix:pending.prefix, suffix:pending.suffix,
                  start:pending.start, end:pending.end, text:text, created:now, updated:now});
    }else return;
    var wasEdit = !!editing;
    pending = null; editing = null; ed.hidden = true;
    var ok = save();
    render();
    if(narrow.matches) openOnly('u:' + id, true); else flash('u:' + id);
    if(ok) toast(wasEdit ? '笔记已更新' : '笔记已保存');
  }
  edSave.addEventListener('click', commit);
  edCancel.addEventListener('click', closeEditor);
  edDel.addEventListener('click', function(){ var n = editing; closeEditor(); if(n) remove(n.id); });
  ed.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){ e.preventDefault(); closeEditor(); }
    else if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)){ e.preventDefault(); commit(); }
  });
  document.addEventListener('pointerdown', function(e){
    if(!editorOpen() || ed.contains(e.target)) return;
    var original = editing ? editing.text : '';
    if(edT.value.trim() === original.trim()) closeEditor();
  });

  function findNote(id){ return notes.filter(function(n){ return n.id === id; })[0]; }
  function noteAction(act, id){
    var n = findNote(id);
    if(!n) return;
    if(act === 'edit'){
      var anchor = document.getElementById('unote-' + id);
      if(!anchor || !anchor.offsetParent) anchor = document.querySelector('.mn-item[data-un="' + id + '"]') || $all('.un-hl[data-un="' + id + '"]').pop();
      openEditor(n, anchor);
    }else if(act === 'del') remove(id);
    else if(act === 'go') goTo(id);
  }
  function remove(id){
    var i = -1;
    notes.forEach(function(n, k){ if(n.id === id) i = k; });
    if(i < 0) return;
    var gone = notes.splice(i, 1)[0];
    save(); render();
    toast('已删除这条笔记', '撤销', function(){ notes.splice(i, 0, gone); save(); render(); });
  }
  function goTo(id){
    var h = article.querySelector('.un-hl[data-un="' + id + '"]');
    if(!h) return;
    h.scrollIntoView({block:'center', behavior:'smooth'});
    if(narrow.matches) openOnly('u:' + id, true);
    else { setActive('u:' + id, true); setTimeout(function(){ setActive('u:' + id, false); }, 1600); }
  }

  /* ------------------------------------------------ toast */
  var toastEl = el('div', 'un-toast'), toastTimer = null;
  toastEl.hidden = true; toastEl.setAttribute('role', 'status');
  document.body.appendChild(toastEl);
  function toast(msg, actionLabel, fn){
    toastEl.textContent = '';
    toastEl.appendChild(el('span', null, msg));
    if(actionLabel){
      var b = el('button', null, actionLabel); b.type = 'button';
      b.addEventListener('click', function(){ toastEl.hidden = true; fn(); });
      toastEl.appendChild(b);
    }
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.hidden = true; }, actionLabel ? 5000 : 2200);
  }

  /* ------------------------------------------------ list + copy / export */
  var section = document.getElementById('mynotes');
  var listBody = section && section.querySelector('.mn-body');
  if(section){
    section.hidden = false;
    section.addEventListener('click', function(e){
      var b = e.target.closest('[data-act]');
      if(!b) return;
      if(b.dataset.act === 'copy') copyAll();
      else if(b.dataset.act === 'export') download();
      else noteAction(b.dataset.act, b.closest('[data-un]').dataset.un);
    });
  }
  function ordered(){
    return notes.slice().sort(function(a, b){ return (a._lost - b._lost) || (a.start - b.start); });
  }
  function renderList(){
    if(!listBody) return;
    listBody.textContent = '';
    if(!notes.length){
      listBody.appendChild(el('p', 'mn-empty', '还没有笔记。选中原文里的词或句子（可以跨好几行），点「✏️ 加笔记」写下你自己的理解。'));
      return;
    }
    var ol = el('ol', 'mn-list');
    ordered().forEach(function(n){
      var li = el('li', 'mn-item'); li.dataset.un = n.id;
      var q = el('button', 'mn-q', '“' + shortQuote(n.quote, 160) + '”'); q.type = 'button'; q.dataset.act = 'go';
      if(n._lost){ q.disabled = true; }
      li.appendChild(q);
      if(n._lost) li.appendChild(el('span', 'mn-lost', '原文位置未找到'));
      li.appendChild(el('div', 'mn-t', n.text));
      li.appendChild(actions());
      ol.appendChild(li);
    });
    listBody.appendChild(ol);
    var bar = el('div', 'mn-bar');
    var c = el('button', 'toggle', '📋 复制全部笔记'); c.type = 'button'; c.dataset.act = 'copy';
    var x = el('button', 'toggle', '⬇️ 导出 .md 文件'); x.type = 'button'; x.dataset.act = 'export';
    bar.appendChild(c); bar.appendChild(x);
    listBody.appendChild(bar);
  }
  function exportText(){
    var title = (document.querySelector('h1.title') || {}).textContent || '';
    var out = ['# 晨读 ' + issueId + ' · ' + title, '', location.href.split('#')[0], '',
               '## 我的笔记（' + notes.length + ' 条）', ''];
    ordered().forEach(function(n, i){
      out.push((i + 1) + '. > ' + n.quote.replace(/\n/g, ' / '));
      n.text.split('\n').forEach(function(line){ out.push('   ' + line); });
      out.push('');
    });
    return out.join('\n');
  }
  function copyAll(){
    var txt = exportText(), done = function(){ toast('已复制 ' + notes.length + ' 条笔记'); };
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(txt).then(done, function(){ fallbackCopy(txt) ? done() : toast('复制失败，请用导出'); });
    }else if(fallbackCopy(txt)) done();
    else toast('复制失败，请用导出');
  }
  function fallbackCopy(txt){
    var ta = el('textarea'); ta.value = txt; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try{ ok = document.execCommand('copy'); }catch(e){}
    ta.remove();
    return ok;
  }
  function download(){
    var a = el('a');
    a.href = URL.createObjectURL(new Blob([exportText()], {type:'text/markdown;charset=utf-8'}));
    a.download = '晨读-' + issueId + '-我的笔记.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  }

  render();
})();
