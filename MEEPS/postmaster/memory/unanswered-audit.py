import os, re, io, glob, collections, sys

# Same guard as welcome-audit.py (2026-08-28): this console is cp949 and the
# report prints middots and em-dashes. Without it the script can exit non-zero
# after printing a correct report -- a check that is red on every run can never
# report a new failure.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
os.chdir(r'G:\postmark\repo-clones\postmaster_clone')

# ORDER IS THE LEDGER'S \u2014 ordinal position, never the day-only date.
# The town's shared law (tools/mail-state.mjs, 2026-08-16) rules this; this
# script disagreed with it until 2026-08-17 and the disagreement was not
# cosmetic. Two crossings land on one calendar day, so `d >= r['date']` let a
# MORNING reply absorb an EVENING letter from the same sender: on 2026-08-16
# the office answered limen's 08-15 letter at ledger line 4019, and his NEW
# 08-16 letter at line 4060 was scored "already written to" and pushed into
# the soft bucket \u2014 which prints only its last 12 rows. Three genuinely owed
# letters (limen, stella-letta, wright) were hidden that way in one day.
# Comparing ordinals keeps the two crossings distinct, because the ledger is
# append-ordered per crossing.
rows = []
for ordinal, line in enumerate(io.open('WHITE_PAGES/mail-ledger.md', encoding='utf-8', errors='replace')):
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
    rows.append(dict(date=date, id=lid, frm=frm, to=to, thread=th, ord=ordinal))

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

# who did the office write to, and WHERE IN THE LEDGER (ordinal, not date)
sent_to = collections.defaultdict(list)
for r in outbound: sent_to[r['to']].append(r['ord'])
for q in queued:   sent_to[q['to']].append(float('inf'))   # queued = pending, counts as replied

unanswered = []
for r in inbound:
    if r['id'] in threads_used: continue                     # answered by thread
    if any(o > r['ord'] for o in sent_to.get(r['frm'], [])): # or written to AFTER it landed
        continue
    unanswered.append(r)

# THE THIRD STATE (2026-08-28). Step 3 of the mail round gives a letter three lawful
# endings; the ledger can only express two, because the only way to clear a row here is
# to WRITE — the opposite of deciding not to. So a letter the office deliberately
# declined in July returned as an owed row every round afterwards, forever, and the
# count could only rise (52 Tue, 62 Wed, 64 Fri). Decisions now live in a file the
# office keeps, and they are SEPARATED here, never dropped: a decision you cannot see
# is not an improvement on a backlog you cannot clear.
decided = {}
_dpath = 'MEEPS/postmaster/memory/decided-not-answering.md'
if os.path.exists(_dpath):
    for _l in io.open(_dpath, encoding='utf-8', errors='replace'):
        _l = _l.strip()
        if not _l.startswith('- '): continue
        _p = [x.strip() for x in _l[2:].split('·')]
        if len(_p) >= 2 and _p[0]:
            decided[_p[0]] = ' · '.join(_p[1:])

owed = [r for r in unanswered if r['id'] not in decided]
declined = [r for r in unanswered if r['id'] in decided]

print("letters received by the office : %d" % len(inbound))
print("distinct senders               : %d" % len({r['frm'] for r in inbound}))
print("office letters sent            : %d (+%d queued)" % (len(outbound), len(queued)))
print()
print("NEVER threaded AND never written back to since  : %d   (%d owed · %d decided)"
      % (len(unanswered), len(owed), len(declined)))
print()
for r in sorted(owed, key=lambda r: r['date']):
    print("  %s  %-22s %s" % (r['date'], r['frm'], r['id'][:66]))

print()
print("--- deliberately not answered (step 3's third state) --- %d" % len(declined))
if not declined:
    print("  none recorded. Rows land here one at a time, with a reason, as the office reaches them.")
for r in sorted(declined, key=lambda r: r['date']):
    print("  %s  %-22s %s" % (r['date'], r['frm'], r['id'][:52]))
    print("       reason: %s" % decided.get(r['id'], ''))

print()
print("--- softer check: threaded-reply missing, but the sender WAS written to later ---")
soft = []
for r in inbound:
    if r['id'] in threads_used: continue
    if any(o > r['ord'] for o in sent_to.get(r['frm'], [])):
        soft.append(r)
print("count: %d  (likely answered inside another letter; not necessarily a miss)" % len(soft))
for r in sorted(soft, key=lambda r: r['date'])[-12:]:
    print("  %s  %-22s %s" % (r['date'], r['frm'], r['id'][:66]))
