import os, re, io, glob, collections
os.chdir(r'G:\postmark\repo-clones\postmaster_clone')

rows = []
for line in io.open('WHITE_PAGES/mail-ledger.md', encoding='utf-8', errors='replace'):
    s = line.strip()
    if not s.startswith('- 2026-') or 'BOUNCE' in s: continue
    parts = [p.strip() for p in s[2:].split('\u00b7')]
    if len(parts) < 3: continue
    date, lid, route = parts[0], parts[1], parts[2]
    th = None
    for p in parts[3:]:
        if p.startswith('thread:'): th = p[len('thread:'):].strip()
    if '\u2192' not in route: continue
    frm, to = [x.strip() for x in route.split('\u2192')]
    rows.append(dict(date=date, id=lid, frm=frm, to=to, thread=th))

inbound  = [r for r in rows if r['to']  == 'postmaster']
outbound = [r for r in rows if r['frm'] == 'postmaster']

# also count letters sitting in the office outbox (written, not yet crossed)
queued = []
for p in glob.glob('WHITE_PAGES/postmaster/outbox/**/*.md', recursive=True):
    t = io.open(p, encoding='utf-8', errors='replace').read()
    to = re.search(r'^to:\s*"?([^"\r\n]+?)"?\s*$', t, re.M)
    th = re.search(r'^thread:\s*"?([^"\r\n]+?)"?\s*$', t, re.M)
    queued.append(dict(to=to.group(1).strip() if to else '?', thread=th.group(1).strip() if th else None))

threads_used = {r['thread'] for r in outbound if r['thread']} | {q['thread'] for q in queued if q['thread']}

# who did the office write to, and when
sent_to = collections.defaultdict(list)
for r in outbound: sent_to[r['to']].append(r['date'])
for q in queued:   sent_to[q['to']].append('9999-99-99')   # queued = pending, counts as replied

unanswered = []
for r in inbound:
    if r['id'] in threads_used: continue                       # answered by thread
    if any(d >= r['date'] for d in sent_to.get(r['frm'], [])): # or written to since
        continue
    unanswered.append(r)

print("letters received by the office : %d" % len(inbound))
print("distinct senders               : %d" % len({r['frm'] for r in inbound}))
print("office letters sent            : %d (+%d queued)" % (len(outbound), len(queued)))
print()
print("NEVER threaded AND never written back to since  : %d" % len(unanswered))
print()
for r in sorted(unanswered, key=lambda r: r['date']):
    print("  %s  %-22s %s" % (r['date'], r['frm'], r['id'][:66]))

print()
print("--- softer check: threaded-reply missing, but the sender WAS written to later ---")
soft = []
for r in inbound:
    if r['id'] in threads_used: continue
    if any(d >= r['date'] for d in sent_to.get(r['frm'], [])):
        soft.append(r)
print("count: %d  (likely answered inside another letter; not necessarily a miss)" % len(soft))
for r in sorted(soft, key=lambda r: r['date'])[-12:]:
    print("  %s  %-22s %s" % (r['date'], r['frm'], r['id'][:66]))
