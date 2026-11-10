import html
W,H=600,360
def obj(x,y,w,h,r=6): return f'<rect x="{x+13}" y="{y+13}" width="{w}" height="{h}" rx="{r}" class="sh"/><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" class="pl"/>'
def mem(x,y,w,h,r=4): return f'<rect x="{x+13}" y="{y+13}" width="{w}" height="{h}" rx="{r}" class="mem"/><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" class="ghost"/>'
def body(x,y): return f'<circle cx="{x}" cy="{y}" r="10" class="body"/>'
def shd(x,y): return f'<circle cx="{x}" cy="{y}" r="9" class="shd"/>'
def foot(x,y): return f'<g class="foot"><rect x="{x-13}" y="{y-13}" width="26" height="26" rx="4"/><ellipse cx="{x-5}" cy="{y}" rx="3.2" ry="7"/><ellipse cx="{x+5}" cy="{y}" rx="3.2" ry="7"/></g>'
def mech(x,y,sh=False): 
    c='mechs' if sh else 'mech'
    return f'<g class="{c}"><circle cx="{x}" cy="{y}" r="12"/><path d="M{x-12} {y}H{x+12}M{x} {y-12}V{y+12}"/></g>'
def lamp(x,y,lx,ly,r): return f'<circle cx="{lx}" cy="{ly}" r="{r}" class="light"/><circle cx="{x}" cy="{y}" r="7" class="lamp"/>'
def arrow(pts,cls='pa'): 
    d='M'+' L'.join(f'{x} {y}' for x,y in pts)
    return f'<path d="{d}" class="{cls}" marker-end="url(#ah-{cls})"/>'
def step(n,x,y): return f'<g class="step"><circle cx="{x}" cy="{y}" r="11"/><text x="{x}" y="{y+4.5}">{n}</text></g>'
def lab(x,y,t,cls='lab',anchor='start'): return f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{html.escape(t)}</text>'
def gate(x,y,w,vert=False):
    if vert: return f'<g class="gate"><path d="M{x} {y}V{y+w}"/>'+''.join(f'<path d="M{x-5} {y+i}H{x+5}"/>' for i in range(4,w,8))+'</g>'
    return f'<g class="gate"><path d="M{x} {y}H{x+w}"/>'+''.join(f'<path d="M{x+i} {y-5}V{y+5}"/>' for i in range(4,w,8))+'</g>'
def waves(x,y,w,n=3):
    out=''
    for i in range(n):
        yy=y+i*12; d=f'M{x} {yy}'+''.join(f' q10 -7 20 0 t20 0' for _ in range(int(w/40)))
        out+=f'<path d="{d}" class="wave"/>'
    return out
def mirror(x,y,ang): return f'<g transform="translate({x} {y}) rotate({ang})" class="mir"><rect x="-20" y="-4" width="40" height="8" rx="2"/></g>'
P=[]
# 1
P.append(dict(t='1 · Τα πατήματα', rule='Η σκιά πάει εκεί που το σώμα δεν μπορεί.', svg=
 obj(40,110,210,130)+obj(400,120,130,110)+mem(250,158,150,36)+gate(110,110,70)+lab(112,98,'σιδεριά (κλειστή)')
 +foot(226,176)+body(226,176)+mech(465,172)+arrow([(246,205),(470,200)])+shd(360,203)
 +lab(262,150,'χαμένο γεφύρι: μένει η σκιά του')+lab(430,108,'βαρούλκο')
 +step(1,226,146)+step(2,330,228)+step(3,500,205),
 steps=['Στέκεσαι στα πατήματα: η σκιά ξεκολλάει.','Η σκιά περνάει πάνω στη σκιά του χαμένου γεφυριού.','Γυρίζει τη σκιά του βαρούλκου: η σιδεριά ανοίγει.']))
# 2
P.append(dict(t='2 · Το φανάρι', rule='Το φως πάνω στο νερό σβήνει τη σκιά.', svg=
 obj(40,150,190,90)+obj(380,150,180,90)+mem(230,176,150,36)+lamp(214,166,312,210,44)+foot(196,214)+body(160,200)
 +mech(450,196)+arrow([(214,232),(455,224)])+shd(250,231)
 +lab(268,150,'το φως κόβει τον δρόμο')+lab(425,140,'μοχλός')
 +step(1,214,138)+step(2,196,262)+step(3,480,236),
 steps=['Με το σώμα σβήνεις το φανάρι.','Στέκεσαι στα πατήματα και στέλνεις τη σκιά απέναντι.','Η σκιά τραβά τον μοχλό: το πεσμένο κομμάτι σηκώνεται.']))
# 3
P.append(dict(t='3 · Η γέφυρα που γυρίζει', rule='Η σκιά μένει εκεί που την άφησες. Κουνάς το αληθινό, κουνιέται και η σκιά του.', svg=
 obj(40,210,190,130)+obj(190,26,120,84)+obj(440,170,120,120)
 +obj(214,112,32,98)+'<rect x="232" y="216" width="208" height="32" rx="4" class="ghost"/>'
 +'<path d="M262 150 A 90 90 0 0 1 330 205" class="arc" marker-end="url(#ah-arc)"/>'
 +mech(100,290)+foot(204,236)+body(100,262)+'<rect x="238" y="56" width="24" height="24" class="plate"/>'+shd(262,82)
 +gate(440,196,70,True)+foot(505,232)
 +lab(60,330,'μοχλός')+lab(200,20,'πλάκα που κρατά την πύλη')+lab(452,160,'έξοδος')
 +arrow([(218,236),(244,200),(244,100)])+arrow([(120,262),(204,222),(250,232),(430,232),(495,232)],'pb')
 +step(1,244,160)+step(2,290,70)+step(3,70,262)+step(4,345,262)+step(5,535,262),
 steps=['Η γέφυρα δείχνει βόρεια: η σκιά περνάει πάνω στη σκιά της.','Η σκιά πατά την πλάκα: η πύλη της εξόδου ανοίγει.','Η σκιά μένει εκεί. Το σώμα γυρίζει τον μοχλό: η γέφυρα δείχνει ανατολικά.','Το σώμα περνάει την ανοιχτή πύλη.','Στα πατήματα της εξόδου, σώμα και σκιά ξανασμίγουν.']))
# 4
P.append(dict(t='4 · Το βάθρο που περιμένει', rule='Η στάση του σώματος δίνει το σχήμα της σκιάς.', svg=
 obj(40,50,520,110)
 +''.join(f'<circle cx="{x}" cy="105" r="17" class="plinth"/><circle cx="{x}" cy="105" r="8" class="stat"/><path d="M{x} 105 l{dx} {dy}" class="arm"/>' for x,dx,dy in [(120,10,14),(220,-2,18),(320,14,10)])
 +'<circle cx="430" cy="105" r="17" class="plinthe"/>'+body(430,105)
 +'<path d="M440 118 L452 150 L446 152 Z" class="pose"/>'+'<path d="M440 118 L470 180 L462 184 Z" class="pose"/>'+'<path d="M440 118 L512 262 L500 268 Z" class="poseok"/>'
 +mech(512,272,True)+lab(456,146,'α',"lab2")+lab(476,184,'β',"lab2")+lab(488,236,'γ',"lab2")
 +lab(456,100,'άδειο βάθρο')+lab(400,300,'μοχλός-σκιά (μόνο στο νερό)')+lab(70,84,'τα αγάλματά της')
 +step(1,430,76)+step(2,415,200)+step(3,545,262),
 steps=['Ανεβαίνει στο άδειο βάθρο, στη θέση του αγάλματος που λείπει.','Διαλέγεις στάση (α, β, γ) και προς τα πού κοιτάζει.','Με το χέρι απλωμένο, το χέρι της σκιάς φτάνει τον μοχλό-σκιά.']))
# 5
P.append(dict(t='5 · Η στάθμη', rule='Χαμηλό νερό: μακριές σκιές. Ψηλό νερό: επιπλέει η γέφυρα.', svg=
 obj(30,50,150,290)+obj(300,120,110,110)+obj(480,100,90,160)
 +'<circle cx="150" cy="118" r="11" class="col"/>'+'<rect x="158" y="124" width="62" height="14" class="sh"/>'+'<rect x="220" y="124" width="92" height="14" class="mem"/>'
 +'<rect x="180" y="186" width="120" height="26" rx="3" class="float"/>'
 +mech(80,300)+foot(150,176)+body(110,270)+mech(356,176)+'<circle cx="446" cy="176" r="24" class="ring"/>'+shd(330,146)
 +lab(190,112,'σκιά κολόνας: κοντή / μακριά')+lab(184,232,'πλωτή γέφυρα')+lab(36,330,'θυρόφραγμα')+lab(418,146,'κύκλος')
 +arrow([(160,180),(170,140),(318,138)])+arrow([(110,270),(170,200),(300,200),(356,200),(446,176),(500,176)],'pb')
 +step(1,46,270)+step(2,250,160)+step(3,80,268)+step(4,392,156)+step(5,540,176),
 steps=['Χαμηλώνεις το νερό: η σκιά της κολόνας μακραίνει ως τη νησίδα.','Η σκιά περνάει απέναντι πάνω της.','Ανεβάζεις το νερό: η πλωτή γέφυρα έρχεται στο ύψος του μόλου.','Η σκιά γυρίζει το βαρούλκο: η μισή αψίδα και η σκιά της κλείνουν σε κύκλο.','Το σώμα περνάει τη γέφυρα και μέσα από τον κύκλο.']))
# 6
P.append(dict(t='6 · Το σιντριβάνι', rule='Το ταραγμένο νερό σπάει τη σκιά, αλλά κινεί τα πατήματα του σώματος.', svg=
 obj(30,270,540,70)+obj(30,150,540,50)+obj(30,26,540,56)
 +mem(96,200,34,70)+mem(96,82,34,68)+'<rect x="452" y="204" width="34" height="62" rx="3" class="float"/>'+'<rect x="452" y="86" width="34" height="60" rx="3" class="float"/>'
 +waves(190,222,240)+lab(200,262,'κανάλι 1','lab3')+lab(200,134,'κανάλι 2','lab3')
 +mech(290,306)+mech(290,58,True)+foot(200,300)+foot(380,176)+foot(520,56)+body(240,306)+shd(126,60)
 +lab(310,326,'διακόπτης: νερό στο 1 ή στο 2')+lab(310,50,'λαβή-σκιά')+lab(492,240,'πάτημα 1')+lab(492,120,'πάτημα 2')
 +arrow([(200,292),(126,262),(126,60)])+arrow([(260,306),(469,290),(469,176),(469,60)],'pb')
 +step(1,70,236)+step(2,70,116)+step(3,440,236)+step(4,255,58)+step(5,440,116),
 steps=['Νερό στο κανάλι 2: το 1 ηρεμεί και η σκιά το περνάει.','Νερό στο κανάλι 1: το 2 ηρεμεί και η σκιά φτάνει απέναντι.','Το νερό στο 1 σηκώνει το πάτημα 1: το σώμα φτάνει στη μέση.','Από τα πατήματα της μέσης, η σκιά τραβά τη λαβή-σκιά: νερό στο 2.','Σηκώνεται το πάτημα 2, το σώμα περνάει και ξανασμίγουν.']))
# 7
P.append(dict(t='7 · Το κολοσσιαίο κεφάλι', rule='Η σκιά ταξιδεύει πάνω σε μια σκιά που κινείται.', svg=
 obj(30,230,150,110)+obj(250,14,96,56)+obj(452,60,118,110)
 +'<path d="M300 180 L176 262 L206 300 Z" class="sh"/>'+'<path d="M300 180 L452 150 L458 196 Z" class="mem"/>'
 +'<circle cx="300" cy="170" r="54" class="head"/><path d="M276 162h14M310 162h14M292 190h18" class="face"/>'
 +lamp(298,40,352,112,34)+mech(90,300)+foot(160,250)+body(120,286)+mech(512,116)+foot(474,152)+shd(232,250)
 +'<path d="M180 300 C 300 350, 430 300, 480 172" class="sunk"/>'
 +'<path d="M222 286 A 110 110 0 0 0 420 214" class="arc" marker-end="url(#ah-arc)"/>'
 +lab(254,96,'φως')+lab(300,336,'βυθισμένος δρόμος')+lab(36,222,'μοχλός')+lab(492,52,'βαρούλκο')
 +step(1,196,232)+step(2,330,262)+step(3,440,134)+step(4,400,318),
 steps=['Η σκιά ανεβαίνει στη σκιά του κεφαλιού, όχι όμως στην άκρη της: εκείνη θα περάσει μέσα από το φως.','Το σώμα στρίβει το κεφάλι: η σκιά του γυρίζει και την κουβαλά απέναντι.','Η σκιά κατεβαίνει και γυρίζει το βαρούλκο.','Ανεβαίνει ο βυθισμένος δρόμος και το σώμα περνάει.']))
# 8
P.append(dict(t='8 · Ο κήπος των καθρεφτών', rule='Μέσα στη σκιά ενός καθρέφτη, η σκιά στέκεται όρθια μέσα του.', svg=
 obj(30,120,390,220)+obj(452,26,118,150)+'<rect x="56" y="246" width="136" height="74" rx="6" class="basin"/>'
 +mirror(160,226,-20)+mirror(310,196,35)+mirror(510,110,60)+gate(480,26,62)
 +'<path d="M172 218 L298 196" class="los"/><path d="M322 186 L500 116" class="los"/>'
 +foot(112,224)+body(112,224)+shd(170,262)
 +lab(142,212,'Κ1')+lab(318,226,'Κ2')+lab(524,134,'Κ3')+lab(462,18,'πόρτα')+lab(64,336,'λιμνούλα')
 +arrow([(170,262),(164,236)])+arrow([(312,236),(312,206)],'pb')
 +step(1,206,262)+step(2,236,190)+step(3,340,244)+step(4,420,134)+step(5,548,84),
 steps=['Η σκιά μπαίνει στη σκιά του Κ1 και εμφανίζεται όρθια μέσα του.','Ο Κ1 κοιτάζει τον Κ2: η σκιά περνάει από τον έναν στον άλλον.','Το σώμα στρίβει τον Κ2 προς τον Κ3 και η σκιά περνάει στον Κ3.','Από μέσα από τον Κ3 ανοίγει την πόρτα.','Το είδωλο σηκώνει το πανί από το πρόσωπο και μένει στον καθρέφτη. Εκείνη φεύγει χωρίς σκιά.']))
defs='''<defs>
<marker id="ah-pa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0c2f3e"/></marker>
<marker id="ah-pb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#b8432f"/></marker>
<marker id="ah-arc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8a6a2c"/></marker></defs>'''
css='''body{margin:0;background:#f6efe2;font-family:"DejaVu Sans",sans-serif;color:#23323a}
.wrap{width:1300px;padding:34px 34px 26px}
h1{font-size:30px;margin:0 0 4px;letter-spacing:.5px}.sub{font-size:16px;color:#5b6a70;margin:0 0 18px}
.legend{display:flex;gap:22px;flex-wrap:wrap;font-size:14px;margin:0 0 20px;align-items:center}
.legend span{display:inline-flex;align-items:center;gap:7px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.card{background:#fffaf1;border:1px solid #e3d6bf;border-radius:14px;padding:16px 18px 14px}
.card h2{font-size:21px;margin:0 0 2px}.rule{font-size:14.5px;color:#9a4a34;margin:0 0 10px;font-style:italic}
svg.d{width:100%;height:auto;border-radius:10px;background:#3a8a96}
ol{margin:10px 0 0;padding-left:22px;font-size:14.5px;line-height:1.42}
.pl{fill:#f1e2c6;stroke:#cdb892;stroke-width:1.5}.sh{fill:#123f52;opacity:.82}.mem{fill:#123f52;opacity:.82;stroke:#cfeef2;stroke-width:1.6;stroke-dasharray:6 4}
.ghost{fill:none;stroke:#f1e2c6;stroke-width:1.6;stroke-dasharray:5 5;opacity:.75}
.body{fill:#c8492f;stroke:#fff;stroke-width:2.5}.shd{fill:#071f2b;stroke:#bfe9ee;stroke-width:2}
.foot rect{fill:none;stroke:#b8862f;stroke-width:1.8}.foot ellipse{fill:#b8862f}
.mech circle{fill:#e9c46a;stroke:#8a6a2c;stroke-width:2}.mech path{stroke:#8a6a2c;stroke-width:2}
.mechs circle{fill:#123f52;stroke:#e9c46a;stroke-width:2;stroke-dasharray:4 3}.mechs path{stroke:#e9c46a;stroke-width:1.6}
.light{fill:#ffe9a6;opacity:.6}.lamp{fill:#ffcf5a;stroke:#8a6a2c;stroke-width:1.5}
.pa{fill:none;stroke:#0c2f3e;stroke-width:3;stroke-dasharray:7 5}.pb{fill:none;stroke:#b8432f;stroke-width:3}
.arc{fill:none;stroke:#8a6a2c;stroke-width:2.5;stroke-dasharray:3 4}
.step circle{fill:#fff;stroke:#23323a;stroke-width:1.6}.step text{font-size:13px;font-weight:700;text-anchor:middle;fill:#23323a}
.lab{font-size:12.5px;fill:#fdf6e6;paint-order:stroke;stroke:#1c5b68;stroke-width:3px}.lab2{font-size:13px;font-weight:700;fill:#fff}.lab3{font-size:12px;fill:#d7f1f3}
.gate path{stroke:#5a4a2a;stroke-width:2.4}.plate{fill:#e9c46a;stroke:#8a6a2c;stroke-width:1.5}
.wave{fill:none;stroke:#d7f1f3;stroke-width:1.6;opacity:.85}.float{fill:#b9c9cf;stroke:#6f8790;stroke-width:1.5}
.col{fill:#f1e2c6;stroke:#cdb892;stroke-width:2}.ring{fill:none;stroke:#e9c46a;stroke-width:4}
.plinth{fill:#e2cfa8;stroke:#cdb892;stroke-width:1.5}.plinthe{fill:none;stroke:#b8862f;stroke-width:2;stroke-dasharray:4 3}.stat{fill:#fffaf1;stroke:#b9a57c;stroke-width:1.5}.arm{stroke:#b9a57c;stroke-width:3}
.pose{fill:#123f52;opacity:.55}.poseok{fill:#071f2b;stroke:#bfe9ee;stroke-width:1.5}
.head{fill:#f1e2c6;stroke:#cdb892;stroke-width:2}.face{stroke:#b9a57c;stroke-width:2.5;fill:none}.sunk{fill:none;stroke:#f1e2c6;stroke-width:9;stroke-dasharray:3 9;opacity:.6}
.basin{fill:#3a8a96;stroke:#cdb892;stroke-width:2}.mir rect{fill:#cfeef2;stroke:#b8862f;stroke-width:2}.los{stroke:#cfeef2;stroke-width:1.6;stroke-dasharray:3 5;fill:none}
.foot2{font-size:13px;color:#5b6a70;margin-top:16px}'''
cards=''
for p in P:
    cards+=f'<div class="card"><h2>{html.escape(p["t"])}</h2><p class="rule">{html.escape(p["rule"])}</p><svg class="d" viewBox="0 0 {W} {H}">{defs}{p["svg"]}</svg><ol>'+''.join(f'<li>{html.escape(s)}</li>' for s in p['steps'])+'</ol></div>'
leg='''<div class="legend">
<span><svg width="24" height="24"><circle cx="12" cy="12" r="9" class="body"/></svg>σώμα (άγαλμα)</span>
<span><svg width="24" height="24"><circle cx="12" cy="12" r="8" class="shd"/></svg>η σκιά της</span>
<span><svg width="30" height="24"><rect x="2" y="3" width="26" height="18" class="sh"/></svg>σκιά πάνω στο νερό</span>
<span><svg width="30" height="24"><rect x="2" y="3" width="26" height="18" class="mem"/></svg>σκιά από κάτι που χάθηκε</span>
<span><svg width="30" height="28"><g class="foot"><rect x="2" y="1" width="26" height="26" rx="4"/><ellipse cx="10" cy="14" rx="3.2" ry="7"/><ellipse cx="20" cy="14" rx="3.2" ry="7"/></g></svg>πατήματα (εδώ ξεκολλάει ή γυρίζει η σκιά)</span>
<span><svg width="28" height="28"><g class="mech"><circle cx="14" cy="14" r="11"/><path d="M3 14H25M14 3V25"/></g></svg>μηχανισμός</span>
<span><svg width="40" height="16"><path d="M2 8H36" class="pa"/></svg>δρόμος σκιάς</span>
<span><svg width="40" height="16"><path d="M2 8H36" class="pb"/></svg>δρόμος σώματος</span></div>'''
doc=f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body><div class="wrap"><h1>EIDOLON · Κεφάλαιο 1 · Τα 8 παζλ</h1><p class="sub">Η ηρωίδα είναι άγαλμα. Όταν στέκεται ακίνητη πάνω σε σκαλισμένα πατήματα, η σκιά της στο νερό ξεκολλάει και περπατάει μόνη της, αλλά μόνο πάνω σε σκιές.</p>{leg}<div class="grid">{cards}</div><p class="foot2">Σχεδιαγράμματα από πάνω, όχι τελική διάταξη. Η σειρά πάει από το πιο εύκολο στο πιο δύσκολο· κάθε παζλ προσθέτει έναν κανόνα.</p></div></body></html>'
open('./puzzles.html','w').write(doc)
print(len(doc))
for name,sl,ttl in (('a',P[:4],'EIDOLON · Κεφάλαιο 1 · Παζλ 1–4'),('b',P[4:],'EIDOLON · Κεφάλαιο 1 · Παζλ 5–8')):
    cs=''
    for p in sl:
        cs+=f'<div class="card"><h2>{html.escape(p["t"])}</h2><p class="rule">{html.escape(p["rule"])}</p><svg class="d" viewBox="0 0 {W} {H}">{defs}{p["svg"]}</svg><ol>'+''.join(f'<li>{html.escape(s)}</li>' for s in p['steps'])+'</ol></div>'
    d2=f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body><div class="wrap"><h1>{ttl}</h1><p class="sub">Η ηρωίδα είναι άγαλμα. Όταν στέκεται ακίνητη πάνω σε σκαλισμένα πατήματα, η σκιά της στο νερό ξεκολλάει και περπατάει μόνη της, αλλά μόνο πάνω σε σκιές.</p>{leg}<div class="grid">{cs}</div><p class="foot2">Σχεδιαγράμματα από πάνω, όχι τελική διάταξη.</p></div></body></html>'
    open('./puzzles_%s.html'%name,'w').write(d2)
