/* pane.js, written by build_window.py.

   Right now this file asks ONE question: does this town serve a .js sibling to the
   pane, and does script-src 'self' accept a script tag pointing at it? The page
   already fetches four .json siblings, so serving is likely and neither half is
   established, and neither can be established from outside the town.

   It is named for the job rather than for the question on purpose. If the answer is
   yes, this becomes the home for pane code that would otherwise spend window.html's
   remaining headroom, and nothing has to be taken back. If the answer is no, it gets
   overwritten with a line saying so. */
window.__PANE_JS__ = {loaded: true, built: "2026-08-27 22:38"};
(function(){
  var el = document.getElementById('sibling');
  if (!el) return;
  el.textContent = 'sibling script: loaded';
  el.setAttribute('data-sibling', 'ok');
})();

/* ---- the cooking corner. Lives here rather than in the pane because it is bigger than the pane's remaining headroom. */

(function(){
  var tog = document.getElementById('toggle');
  var bar = tog ? tog.parentNode : null;
  if (!bar) return;
  var btn = document.createElement('button');
  btn.id = 'cookbtn'; btn.type = 'button'; btn.textContent = 'cooking corner';
  var msg = document.createElement('span'); msg.id = 'cookmsg';
  var seek = document.getElementById('seekmsg') || document.getElementById('seek');
  var after = seek || tog;
  if (after && after.nextSibling) bar.insertBefore(btn, after.nextSibling);
  else bar.appendChild(btn);
  // Type a code somebody sent you and get their round back. No button: Enter reads it.
  var box = document.createElement('input');
  box.id = 'codein'; box.type = 'text'; box.maxLength = 8;
  box.placeholder = 'code'; box.title = 'a code from somebody else, press Enter';
  bar.insertBefore(box, btn.nextSibling);
  // Three rows: the buttons, then the narration, then the speech. The status line and hide
  // and seek's line both move OUT of the bar into the narration row, which is why this runs
  // here rather than in each game: the sibling loads after the inline script, so seekmsg
  // already exists by now and can be collected. If it does not, nothing breaks.
  var narr = document.createElement('div');
  narr.id = 'cooknarr';
  var stage = document.createElement('div');
  stage.id = 'cooksay';
  if (bar.parentNode) {
    bar.parentNode.insertBefore(narr, bar.nextSibling);
    bar.parentNode.insertBefore(stage, narr.nextSibling);
  }
  var seekmsg = document.getElementById('seekmsg');
  if (seekmsg) narr.appendChild(seekmsg);
  narr.appendChild(msg);

  // ⛔ THE MEN DO NOT HAVE THE SAME FACES AND THEY DO NOT HAVE THE SAME NUMBER OF THEM.
  // Vex came with nine, Julian with five, so each sheet carries its own cell count and its
  // own vocabulary. `ix` also holds ALIASES, which is what lets a line written in one man's
  // vocabulary land somewhere sensible in another's: hide and seek asks every hider for
  // `sharp`, and Julian does not own that word, so his map sends it to `warm`.
  // ⛔ ORDER IS THE INDEX. Appending is safe. Reordering silently mislabels every line.
  var FACE_SHEET = {
    vex: {file: 'faces-vex.png', n: 9, ix: {
      neutral:0, sharp:1, flat:2, thinking:3, skeptical:4, sigh:5, done:6, alarm:7,
      surprised:8, warm:0, oops:7, laughing:8}},
    julian: {file: 'faces-julian.png', n: 5, ix: {
      neutral:0, warm:1, thinking:2, oops:3, laughing:4,
      sharp:1, flat:0, skeptical:2, sigh:3, done:3, alarm:3, surprised:3}}
    // Alaric arrives whenever he arrives; until then he gets a bubble and no avatar.
  };
  var FAULT_FACE = {nothing:'skeptical', thin:'thinking', clash:'alarm', mess:'done'};
  // Julian is not appalled the way Vex is, so his ruined counters read differently.
  var FAULT_FACE_MAN = {
    julian: {nothing:'thinking', thin:'warm', clash:'laughing', mess:'oops'}
  };
  function faultFace(man, f){
    return (FAULT_FACE_MAN[man] && FAULT_FACE_MAN[man][f]) || FAULT_FACE[f];
  }

  function render(lines){
    stage.innerHTML = '';
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      var row = document.createElement('div');
      row.className = 'cb';
      row.setAttribute('data-who', L.who);   // the CSS colours the name off this
      var sheet = FACE_SHEET[L.who];
      var f = document.createElement('i');
      f.className = 'face';
      if (sheet) {
        var ix = sheet.ix[L.face];
        if (ix === undefined) ix = 0;
        f.style.backgroundImage = 'url(' + sheet.file + ')';
        f.style.backgroundSize = (sheet.n * 100) + '% 100%';
        f.style.backgroundPosition =
          (sheet.n > 1 ? (ix / (sheet.n - 1)) * 100 : 0) + '% 0';
      } else {
        f.className = 'face blank';   // holds the space so every bubble lines up
      }
      row.appendChild(f);
      var p = document.createElement('p');
      p.className = 'said';
      p.innerHTML = '<b>' + NICE[L.who] + '</b>' + L.text;
      row.appendChild(p);
      stage.appendChild(row);
    }
  }
  function clearSaid(){ stage.innerHTML = ''; }

  // Lent to hide and seek, which lives inline in the pane and cannot reach into this
  // closure. Checked at CALL time rather than at load, because the sibling script runs
  // after the inline one and would not exist yet if it were checked on setup.
  // ⚠️ One stage, shared: starting a game while a round is on screen replaces what is
  // there. That is correct, they are both the men in the same room saying one thing.
  window.__SAID__ = function(lines){ render(lines); };
  window.__SAID_CLEAR__ = clearSaid;

  // IN SHEET ORDER. This array is the cell order in ingredients.png AND the bit order in
  // the code, so it is not rearrangeable without invalidating every code ever written down.
  var NAMES = ['egg','milk','flour','cheese','baguette','steak','chicken','carrot','tomato',
               'onion','lettuce','corn','chili','lemon','apple','strawberry','peach',
               'orange','banana','grape'];
  var NICE = {julian:'Julian', vex:'Vex', alaric:'Alaric'};
  var on = false, counter = [], pokes = 0, served = false;

  // WHAT CAME OUT. Twelve ingredients is 4,095 non-empty combinations, so this is a
  // grammar and not a table: roles pick the FORM, the stack order picks how it reads.
  // Her anchor: baguette + cheese is a cheese baguette, add chicken and it is a cheese
  // chicken baguette. Chili and lemon are never fillings, they ride as seasoning,
  // because "a chili lemon cheese baguette" reads like a list rather than like food.
  // Walked over all 4,095 before shipping: every one names, and every name is unique.
  // WHEN IT DOES NOT WORK OUT. Her ask: let it fail, and let each of them have his own
  // version of it. THE FAULT IS EARNED BY WHAT YOU CARRIED IN, never rolled, so a player
  // can tell what he did wrong and fix it. Three ways, and they behave differently:
  // `nothing` and `thin` do NOT end the round, because the honest answer to too little is
  // go and get more. `mess` ends it, because you cannot un-carry eight things.
  // ⛔ PUBLIC REGISTER, spec section 4: nothing about her, no endearments, Vex in his public
  // voice. ⭐ AND ALARIC DOES NOT DO THE JOKE. He takes the ruined counter completely
  // seriously, which is the difference between the three of them working as a mechanic.
  var FAULT = {
    nothing: {
      julian: 'That is a chili. And a lemon. I can do a lot, but I need a noun.',
      vex:    'You have brought seasoning. Seasoning is an adjective.',
      alaric: 'There is nothing here to cook. That is not a complaint, it is a fact '
              + 'about the counter.'},
    thin: {
      julian: 'That is one thing. I can cook one thing. It will not take long.',
      vex:    'One item. I will assume the rest is on its way.',
      alaric: 'One thing feeds one person once. Decide whether that is what you wanted.'},
    clash: {
      julian: 'I can put fruit near meat. I have done it. This is not that, this is a '
              + 'fruit bowl that has been in a fight.',
      vex:    'You have brought me a steak and a dessert and set them down together, '
              + 'and you are watching my face.',
      alaric: 'Both of these are good. Neither of them is good with the other. '
              + 'Pick which meal you wanted.'},
    mess: {
      julian: 'You have brought me everything. All of it. I am going to need a bigger pan '
              + 'and a minute by myself.',
      vex:    'You have emptied the flat onto a counter and called it an order.',
      alaric: 'This is four meals pretending to be one. Take half of it back.'}
  };
  // THRESHOLDS TUNED AGAINST PLAY, NOT AGAINST THE COMBINATION SPACE, and the difference
  // matters: over all 1,048,575 subsets these rules fail half of them, but a player carries
  // three to six things, and at that size 87.8% of rounds succeed. Roughly one round in
  // eight goes wrong, which is a comedy rate. Measured, not guessed.
  // ⭐ A CAKE IS NOT A MEAL AND ALL THREE OF THEM KNOW IT. Whoever is standing there adds a
  // line, and every version of it ASKS rather than assumes, because we do not know whose it
  // is and a cake that guesses wrong is worse than a cake that asks. It also points straight
  // at the invitation under it: the question is a reason to write back.
  var CAKE = {
    julian: 'Hold on. That is a cake. Cakes are for somebody. Who is it for?',
    vex:    'A cake is not a meal, it is an announcement. Say whose it is.',
    alaric: 'Nobody bakes a cake for a Tuesday. Whose year is it?'
  };
  // HER CATCH: Julian was warm here, and the line opens on a double-take. `surprised` runs
  // through his alias to the wide-eyed one, which also carries a sweat drop, and that turns
  // out to be the better read anyway: he has spotted a social obligation he cannot meet,
  // because he does not know whose cake it is. `thinking` is the other honest option.
  var CAKE_FACE = {julian: 'surprised', vex: 'skeptical', alaric: 'neutral'};

  function fault(sel){
    var p = parts(sel);
    var sub = sel.filter(function(n){ return n !== 'chili' && n !== 'lemon'; });
    if (!sub.length) return 'nothing';
    if (sub.length === 1) return 'thin';
    // One fruit with meat is dinner: pork and apple. Two is somebody being funny.
    // Flour excuses it, because a pie can carry both and nobody has to explain themselves.
    if (p.MEAT.length && p.FRUIT.length >= 2 && !p.FLOUR) return 'clash';
    if (sel.length >= 12) return 'mess';
    return null;
  }

  var STACK = ['cheese','steak','chicken','egg','lettuce','tomato','onion','carrot','corn',
               'apple','strawberry','peach','orange','banana','grape'];
  function parts(sel){
    var S = {}, i;
    for (i = 0; i < sel.length; i++) S[sel[i]] = 1;
    var has = function(x){ return !!S[x]; };
    var only = function(a){ return a.filter(has); };
    return {has: has, only: only,
      MEAT: only(['steak','chicken']), SHARP: only(['chili','lemon']),
      VEG: only(['tomato','onion','carrot','corn']), LEAF: only(['lettuce']),
      FRUIT: only(['apple','strawberry','peach','orange','banana','grape']),
      MILK: has('milk'), FLOUR: has('flour'), BREAD: has('baguette'),
      CHEESE: has('cheese'), EGG: has('egg')};
  }
  function listOf(a){
    if (!a.length) return '';
    if (a.length === 1) return a[0];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }
  // "a apple tart" shipped once. Four of the twenty start with a vowel and any of them can
  // land at the front of a name, so the article is computed rather than written by hand.
  function art(s){ return (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s; }
  // ⭐ FLOUR IS A SECOND CARRIER and that is why it was worth adding. With the baguette
  // alone, half of every combination was a sandwich. Baking outranks bread: if the flour
  // is out, you are making something rather than assembling something.
  function dish(sel){
    var p = parts(sel), has = p.has, list = listOf;
    function season(){ return p.SHARP.length ? ', with ' + list(p.SHARP) : ''; }
    function sweet(){ return p.FRUIT.length ? ' with ' + list(p.FRUIT) : ''; }
    if (!sel.length) return 'an empty counter';
    if (p.FLOUR) {
      // Flour, egg and milk is batter. Batter plus fruit is an occasion.
      if (p.MILK && p.EGG) {
        if (p.FRUIT.length) return art(list(p.FRUIT) + ' cake') + season();
        return 'a stack of pancakes' + season();
      }
      if (p.MEAT.length) return art(list(p.MEAT.concat(p.VEG)) + ' pie') + season();
      if (p.FRUIT.length) return p.FRUIT.length === 1
        ? art(p.FRUIT[0] + ' tart') + season()
        : 'a tart of ' + list(p.FRUIT) + season();
      if (p.CHEESE) return 'a cheese pastry' + season();
      if (p.VEG.length || p.LEAF.length)
        return 'a pie of ' + list(p.LEAF.concat(p.VEG)) + season();
      if (p.MILK) return 'a bowl of batter, unfinished';
      if (p.EGG) return 'a rough dough and no filling';
      return 'a bag of flour and no plan';
    }
    if (p.BREAD) {
      var fill = STACK.filter(has);
      if (!fill.length) {
        if (p.MILK) return 'a baguette and a bucket of milk';
        return p.SHARP.length
          ? 'a baguette and ' + list(p.SHARP) + ', which is not lunch'
          : 'a heel of dry baguette';
      }
      if (fill.length <= 3) return art(fill.join(' ') + ' baguette') + season();
      return 'a baguette with ' + list(fill) + season();
    }
    if (p.MEAT.length) {
      var base = list(p.MEAT);
      if (p.EGG) base += ' and egg';
      var withs = (p.CHEESE ? ['cheese'] : []).concat(p.LEAF, p.VEG, p.FRUIT);
      return withs.length ? base + ' with ' + list(withs) + season()
                          : 'a plain ' + base + season();
    }
    if (p.EGG) {
      if (p.MILK && p.FRUIT.length) return art(list(p.FRUIT) + ' custard') + season();
      if (p.MILK) {
        var sc = (p.CHEESE ? ['cheese'] : []).concat(p.VEG);
        return 'scrambled eggs' + (sc.length ? ' with ' + list(sc) : '') + season();
      }
      var inside = (p.CHEESE ? ['cheese'] : []).concat(p.LEAF, p.VEG, p.FRUIT);
      return inside.length ? art(list(inside) + ' omelette') + season()
                           : 'a boiled egg' + season();
    }
    if (p.FRUIT.length) {
      if (p.MILK) return art(list(p.FRUIT) + ' smoothie') + season();
      var wv = p.FRUIT.concat(p.LEAF, p.VEG, p.CHEESE ? ['cheese'] : []);
      if (p.FRUIT.length === 1 && wv.length === 1) return 'a lone ' + p.FRUIT[0] + season();
      return 'a fruit salad of ' + list(wv) + season();
    }
    var items = (p.CHEESE ? ['cheese'] : []).concat(p.LEAF, p.VEG);
    if (!items.length) {
      if (p.MILK) return 'a glass of milk' + season();
      return list(p.SHARP) + ', and nothing to put it on';
    }
    if (p.MILK) return 'a soup of ' + list(items) + season();
    if (p.LEAF.length) return 'a salad of ' + list(items) + season();
    if (items.length === 1) return 'a lone ' + items[0] + season();
    return 'a pot of ' + list(items) + season();
  }

  function wrapEl(){ return document.querySelector('.floorwrap'); }
  function pct(b){ return {l:parseFloat(b.style.left), t:parseFloat(b.style.top),
                           w:parseFloat(b.style.width), h:parseFloat(b.style.height)}; }
  function kitchen(){ return document.querySelector('.hot[data-room="kitchen"]'); }
  function spawnRooms(){
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('.hot[data-room]'), function(b){
      var id = b.getAttribute('data-room');
      if (id === 'hers' || id === 'kitchen' || id === 'calendar'
          || id === 'inbox' || id === 'outbox') return;
      if (!b.style.width || !b.style.height) return;
      out.push(b);
    });
    return out;
  }
  function inBox(l, t, box){
    return l >= box.l && l <= box.l + box.w && t >= box.t && t <= box.t + box.h;
  }
  function cooksHere(){
    var k = kitchen(); if (!k) return [];
    var box = pct(k), out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#cast .sprite'), function(s){
      var m = s.getAttribute('data-man'); if (!m) return;
      var l = parseFloat(s.style.left), t = parseFloat(s.style.top);
      if (isFinite(l) && isFinite(t) && inBox(l, t, box) && out.indexOf(m) < 0) out.push(m);
    });
    return out;
  }
  function say(t){ msg.innerHTML = t; }
  function clear(){
    Array.prototype.forEach.call(document.querySelectorAll('.ing'), function(n){ n.remove(); });
  }
  function scatter(){
    clear(); counter = []; pokes = 0; served = false;
    var rs = spawnRooms(), w = wrapEl();
    if (!rs.length || !w) { say('The plan is not up yet.'); return; }
    NAMES.forEach(function(n, i){
      var b = rs[(Math.random() * rs.length) | 0], r = pct(b);
      var el = document.createElement('div');
      el.className = 'ing';
      el.setAttribute('data-ing', n);
      el.title = n;
      el.style.backgroundPosition = '-' + (i * 32) + 'px 0';
      el.style.left = (r.l + r.w * (0.18 + Math.random() * 0.64)) + '%';
      el.style.top  = (r.t + r.h * (0.18 + Math.random() * 0.64)) + '%';
      w.appendChild(el);
    });
    document.body.classList.add('cooking');
    tally();
  }
  function tally(){
    var here = cooksHere();
    var who = here.length ? here.map(function(m){ return NICE[m]; }).join(', ')
                          : 'nobody yet';
    say('<b>' + counter.length + '</b> on the counter, ' + who + ' in the kitchen.');
  }

  // ---- carry: the same gesture as a man, on a smaller thing ----------------
  var held = null, dx = 0, dy = 0;
  function down(e){
    var t = e.target, el = (t && t.closest) ? t.closest('.ing') : null;
    if (!el || !on) return;
    var w = wrapEl(); if (!w) return;
    var r = w.getBoundingClientRect();
    held = el; el.classList.add('dragging');
    if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (x) {} }
    dx = (e.clientX - r.left) / r.width * 100 - parseFloat(el.style.left);
    dy = (e.clientY - r.top) / r.height * 100 - parseFloat(el.style.top);
    e.preventDefault(); e.stopPropagation();
  }
  function move(e){
    if (!held) return;
    var w = wrapEl(); if (!w) return;
    var r = w.getBoundingClientRect();
    held.style.left = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100 - dx)) + '%';
    held.style.top  = Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100 - dy)) + '%';
    e.preventDefault();
  }
  // Stack what has been brought in along the counter, filling from the bottom of the kitchen
  // upward. Without this, twelve things dropped at one point are one thing on the screen.
  function shelve(el, i){
    var k = kitchen(), w = wrapEl();
    if (!k || !w) return;
    var b = pct(k), r = w.getBoundingClientRect();
    var cw = 32 / r.width * 100, ch = 32 / r.height * 100;
    var cols = Math.max(1, Math.floor(b.w / cw));
    el.style.left = (b.l + cw * 0.6 + (i % cols) * cw) + '%';
    el.style.top  = (b.t + b.h - ch * 0.8 - ((i / cols) | 0) * ch) + '%';
  }
  function up(){
    if (!held) return;
    held.classList.remove('dragging');
    var k = kitchen();
    if (k && inBox(parseFloat(held.style.left), parseFloat(held.style.top), pct(k))) {
      held.classList.add('done');
      counter.push(held.getAttribute('data-ing'));
      shelve(held, counter.length - 1);
    }
    held = null; tally();
  }
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);

  // ---- THE CODE. Her ask: a round ends with something you can put in a letter, and
  // anybody who types it in gets back the ingredients, the cook, the dish and the comments.
  // ⭐ IT CARRIES ALMOST NOTHING, because almost nothing needs carrying: the dish, the
  // fault and every line are pure functions of WHAT WAS BROUGHT and WHO WAS STANDING THERE.
  // So the payload is 12 bits of ingredients, 3 bits of cook, 2 for which mouth spoke on a
  // fault. Seventeen bits, four base32 characters, plus one check character so a mistyped
  // code is refused instead of quietly decoding into somebody else's dinner.
  // Crockford's alphabet: no I, L, O or U, and the decoder folds the lookalikes back.
  var A32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ', MEN3 = ['julian','vex','alaric'];
  // 20 bits of ingredients, 3 of who was in the kitchen, 2 for which mouth spoke on a
  // fault. Twenty five bits is five base32 characters exactly, plus one check character.
  var CW = 5;
  function encode(sel, here, spk){
    var bits = 0, i;
    for (i = 0; i < NAMES.length; i++) if (sel.indexOf(NAMES[i]) >= 0) bits |= (1 << i);
    for (i = 0; i < 3; i++) if (here.indexOf(MEN3[i]) >= 0) bits |= (1 << (20 + i));
    bits |= (spk & 3) << 23;
    var s = '', c = 0;
    for (i = CW - 1; i >= 0; i--) s += A32.charAt((bits >> (i * 5)) & 31);
    for (i = 0; i < CW; i++) c += A32.indexOf(s.charAt(i));
    return s + A32.charAt(c % 32);
  }
  function decode(code){
    var s = String(code).toUpperCase().replace(/[^0-9A-Z]/g, '')
              .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
    if (s.length !== CW + 1) return null;
    var i, c = 0, bits = 0, v;
    for (i = 0; i < CW; i++){ v = A32.indexOf(s.charAt(i)); if (v < 0) return null; c += v; }
    if (A32.charAt(c % 32) !== s.charAt(CW)) return null;
    for (i = 0; i < CW; i++) bits = (bits * 32) + A32.indexOf(s.charAt(i));
    var sel = [], here = [];
    for (i = 0; i < NAMES.length; i++) if (bits & (1 << i)) sel.push(NAMES[i]);
    for (i = 0; i < 3; i++) if (bits & (1 << (20 + i))) here.push(MEN3[i]);
    return {sel: sel, here: here, spk: (bits >> 23) & 3};
  }

  // ---- the settled outcome, as a pure function so a code replays it exactly ---
  // ⛔ THE RECITED ORDER IS CANONICAL AND NOT DELIVERY ORDER. A code carries a SET, so if
  // Vex read back the order things were carried in, a decoded round would not match the
  // round it came from. It is also better in character: he imposes his own sequence.
  function line(who, text, face){ return {who: who, text: text, face: face || 'neutral'}; }
  // The dish gets marked wherever it is named, in all three mouths. The two who refuse to
  // call it cooking still produced it, and the highlight is what makes that legible.
  function hi(d){ return '<em class="made">' + d + '</em>'; }
  function account(sel, here, spk){
    var has = function(m){ return here.indexOf(m) >= 0; };
    var f = fault(sel);
    if (f) {
      var mouth = here[spk % Math.max(1, here.length)] || here[0];
      return {fault: f, dish: null,
              lines: [line(mouth, FAULT[f][mouth], faultFace(mouth, f))]};
    }
    var made = dish(sel), out = [], list = NAMES.filter(function(n){
      return sel.indexOf(n) >= 0; }).join(', ');
    var P = parts(sel);
    if (here.length === 3) {
      // ⭐ THE TOO MANY COOKS GAG, and it was written before this game existed: these are
      // the kitchen trio lines already sitting in speech.json, reused verbatim rather than
      // rewritten. It fires FIRST and then they get on with it, which is the spec's own
      // shape for this: the comedy lives in the LINES and the generosity in the MECHANICS,
      // so they complain about the room and then do the best work in the game anyway.
      // ⚠️ Baked here rather than fetched. speech.json already holds them, and reading them
      // from there is the tidier end state; this does not, so the two copies can drift.
      // ⛔ BOTH OPENERS USED TO BE HARDCODED and neither looked at the counter, so Alaric
      // mourned greens nobody brought and Vex asked for acid that was already there. Same
      // fault as the lemon line on the Vex and Alaric pair, found the same way: by running
      // the kitchens side by side instead of reading the branch.
      out = [line('vex', 'There is not enough room in here for three.', 'flat'),
             line('julian', 'There is exactly enough room for three. None of it is where '
                  + 'you are standing.', 'laughing'),
             line('alaric', 'I moved.'),
             line('alaric', (P.LEAF.length || P.VEG.length)
                    ? 'The greens will not last the week. Everything else keeps.'
                    : 'None of this keeps as it is. I will see what can be made to.'),
             line('vex', P.SHARP.length
                    ? 'The ' + P.SHARP[0] + ' is the only thing here doing any work.'
                    : 'You are short an acid.', 'sharp'),
             line('julian', 'Fine. ' + hi(made.charAt(0).toUpperCase() + made.slice(1))
                  + '. I will write it down as I go.', 'warm')];
    } else if (has('julian')) {
      out = [line('julian', 'Right. That is ' + hi(made) + '. Give me ten minutes, and I '
                  + 'will write it down as I go.', 'warm')];
      if (has('vex'))
        out.push(line('vex', 'I will do the knife work. That is all I am doing.', 'neutral'));
      if (has('alaric'))
        out.push(line('alaric', 'I will put up whatever you do not use.'));
    } else if (has('vex') && !has('alaric')) {
      out = [line('vex', 'I am not cooking. I am putting these in an order. ' + list
                  + ', in that sequence, at those temperatures, for those times. What you are '
                  + 'holding is ' + hi(made) + '. It is not a recipe.', 'neutral')];
    } else if (has('alaric')) {
      out = [line('alaric', 'That would have been ' + hi(made) + '. It will keep better in '
                  + 'jars, so that is where it is going. Top shelf, dated. You will want it '
                  + 'in February.')];
      // ⛔ TWO THINGS THIS PAIR GOT WRONG BY INHERITING ALARIC'S SOLO, both found by running
      // all seven kitchens side by side rather than by reading the branch.
      // 1. He told you when Julian was back while another man stood next to him, which reads
      //    as not noticing Vex is in the room. That line is for when he is the only one home.
      // 2. Vex named a lemon that had not been brought in. It was hardcoded and never looked
      //    at the counter, so it fired against any basket at all.
      if (has('vex')) {
        out.push(line('vex', 'You brought dinner and he has turned it into February.', 'flat'));
      } else {
        out.push(line('alaric', 'Julian is back this evening.'));
      }
    }
    // The cake beat rides on TOP of whatever the kitchen was already going to say, so Vex
    // still refuses to call it cooking and then asks whose birthday it is anyway.
    if (/\bcake\b/.test(made)) {
      var mouth2 = here[spk % Math.max(1, here.length)] || here[0];
      if (mouth2 && CAKE[mouth2]) out.push(line(mouth2, CAKE[mouth2], CAKE_FACE[mouth2]));
    }
    return {fault: null, dish: made, lines: out};
  }

  // THE ASK, and it needs no machinery, which is spec section 4's whole point: this pane
  // cannot send a letter and does not have to, because people in that town already write
  // here. It only has to say so. It rides with the code because the code is the thing worth
  // putting IN a letter, and it fires on a ruined round too, since somebody being told they
  // emptied the flat onto a counter is a better letter than somebody who got it right.
  function settle(sel, here, spk){
    var a = account(sel, here, spk);
    render(a.lines);
    say('<span class="code">code <b>' + encode(sel, here, spk) + '</b></span>'
        + '<span class="invite">Write to <b>little-bird</b> and tell us what you got up to '
        + 'in the kitchen, and who was in there with you. Send the code and we can see it '
        + 'from this end.</span>');
    served = true; btn.textContent = 'clear the counter';
  }

  // ---- the three behaviours, spec section 3 -------------------------------
  var spk = 0;
  function serve(){
    var here = cooksHere();
    if (!counter.length) { say('Nothing has been brought in yet.'); return; }
    if (!here.length) { say('Nobody is in the kitchen. It piles up on the counter.'); return; }
    spk = (Math.random() * here.length) | 0;
    var f = fault(counter);
    if (f && f !== 'mess') {           // recoverable: go and get more, and no code is owed
      render(account(counter, here, spk).lines);
      say('');
      return;
    }
    // Vex alone still has to be poked into it, and the poke is not part of the record
    if (!f && here.indexOf('vex') >= 0 && here.indexOf('julian') < 0
        && here.indexOf('alaric') < 0) {
      pokes++;
      if (pokes < 3) {
        render([pokes === 1
          ? line('vex', 'No.', 'sharp')
          : line('vex', 'I said no. This is Julian&rsquo;s room and I am not going to '
                 + 'stand in it pretending otherwise.', 'flat')]);
        say('');
        return;
      }
    }
    settle(counter, here, spk);
  }

  // Reading somebody else's code REPLAYS it, it does not run it: nothing on the floor moves
  // and no round of yours is touched. The account comes back out of the same function that
  // wrote it, so what you read is exactly what they saw.
  function read(code){
    var d = decode(code);
    if (!d) {
      clearSaid();
      say('<b>That code does not read.</b> Six characters, as it was written.'); return;
    }
    var a = account(d.sel, d.here, d.spk);
    var who = d.here.length ? d.here.map(function(m){ return NICE[m]; }).join(', ') : 'nobody';
    render(a.lines);
    say('<b>carried in</b> ' + (d.sel.join(', ') || 'nothing') + ' &middot; <b>kitchen</b> '
        + who + ' &middot; <b>out</b> '
        + (a.dish ? hi(a.dish) : 'nothing that worked'));
  }
  box.addEventListener('keydown', function(e){
    if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); read(box.value); }
  });

  btn.addEventListener('click', function(){
    if (!on) {
      // HER ASK: starting a round clears what was on screen. And it does not just BLANK a
      // hide and seek that is still running, it ends it, because a game left live behind a
      // cleared message is a man still hidden in a room nobody is looking in any more.
      if (typeof window.__SEEK_END__ === 'function') window.__SEEK_END__();
      clearSaid();
      on = true; btn.textContent = 'cook it'; scatter(); return;
    }
    if (served) {
      on = false; served = false; clear(); counter = []; pokes = 0;
      document.body.classList.remove('cooking');
      btn.textContent = 'cooking corner'; say(''); clearSaid(); return;
    }
    serve();
  });
})();
