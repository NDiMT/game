import sys, os, math
sys.path.insert(0,'/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/l6b')
import topple
from topple import Board, moves, cover
from PIL import Image, ImageDraw, ImageFont
OUT=sys.argv[1]
rows=["~~~~~~oG","~~~~~~oo","~~~~~~~~","W~~~~~~~","oC~~C~C~","SC~~C~~~"]
hs={(1,4):2,(4,4):1,(6,4):3,(1,5):2,(4,5):2}
b=Board(rows,hs)
C=96; X0=66; Y0=170; IW=900; IH=1060
fb=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',32)
fn=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',28)
fs=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
SKY=(232,226,236); WAT=(176,184,212); SLAB=(246,242,244); EDGE=(188,178,196); COL=(236,230,236); COLE=(120,108,128)
def cxy(p): return X0+p[0]*C+C//2, Y0+p[1]*C+C//2
def draw_board(d, st, falling=None, ft=1.0, lit=0.0):
    p, fallen = st
    d.rectangle([0,0,IW,IH],fill=SKY)
    d.rectangle([X0-30,Y0-30,X0+b.W*C+30,Y0+b.H*C+30],fill=WAT)
    for y in range(b.H):
        for x in range(b.W):
            if (x,y) in b.slab:
                cx,cy=cxy((x,y)); d.rounded_rectangle([cx-C//2+5,cy-C//2+5,cx+C//2-5,cy+C//2-5],12,fill=SLAB,outline=EDGE,width=3)
    # the winch
    wx,wy=cxy(b.Wr); d.ellipse([wx-26,wy-26,wx+26,wy+26],outline=(176,140,60),width=7)
    for a in range(4): d.line([(wx,wy),(wx+26*math.cos(a*math.pi/2+0.4),wy+26*math.sin(a*math.pi/2+0.4))],fill=(176,140,60),width=6)
    d.text((wx,wy+40),'βαρούλκο',font=fs,fill=(120,96,50),anchor='mm')
    # the ring and the gate
    gx,gy=cxy(b.G); a=int(150+105*lit)
    d.ellipse([gx-34,gy-34,gx+34,gy+34],outline=(a,a-8,a-26),width=8); d.ellipse([gx-22,gy-22,gx+22,gy+22],fill=(150,128,118))
    d.rectangle([gx+40,gy-44,gx+50,gy+34],fill=(214,206,222)); d.text((gx-6,gy-62),'πύλη',font=fs,fill=COLE,anchor='mm')
    fd=dict(fallen)
    for c,h in b.cols.items():
        if c in fd or (falling and c in dict(falling)): continue
        cx,cy=cxy(c); d.ellipse([cx-30,cy-30,cx+30,cy+30],fill=COL,outline=COLE,width=5); d.text((cx,cy),str(h),font=fs,fill=COLE,anchor='mm')
    def bar(c,dd,t):
        h=b.cols[c]; cx,cy=cxy(c); L=(h*C)*t
        ex,ey=cx+dd[0]*(C*0.42+L), cy+dd[1]*(C*0.42+L)
        w=26
        if dd[0]: d.rounded_rectangle([min(cx,ex),cy-w,max(cx,ex),cy+w],w,fill=COL,outline=COLE,width=4)
        else: d.rounded_rectangle([cx-w,min(cy,ey),cx+w,max(cy,ey)],w,fill=COL,outline=COLE,width=4)
        d.ellipse([cx-14,cy-14,cx+14,cy+14],fill=(214,206,214))
    for c,dd in fallen:
        if falling and (c,dd) in falling: continue
        bar(c,dd,1.0)
    if falling:
        for i,(c,dd) in enumerate(falling):
            t=max(0.0,min(1.0,ft*len(falling)-i)); t=t*t
            if t<=0: cx,cy=cxy(c); d.ellipse([cx-30,cy-30,cx+30,cy+30],fill=COL,outline=COLE,width=5); continue
            bar(c,dd,t)
def her(d,xy):
    x,y=xy; d.ellipse([x-24,y-24,x+24,y+24],fill=(250,248,246),outline=(70,58,74),width=5)
    for k in (-9,2,13): d.line([(x-16,y+k-6),(x+16,y+k+2)],fill=(186,96,64),width=5)
def fit(d,t,size,bold):
    for sz in range(size,14,-1):
        f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf'%('-Bold' if bold else ''),sz)
        if d.textlength(t,font=f)<=IW-48: return f
    return f
def caption(d,t1,t2=''):
    d.rectangle([0,IH-150,IW,IH],fill=(40,34,44))
    d.text((IW//2,IH-104),t1,font=fit(d,t1,32,True),fill=(245,240,244),anchor='mm')
    if t2: d.text((IW//2,IH-54),t2,font=fit(d,t2,28,False),fill=(222,212,224),anchor='mm')
def title(d,t):
    d.text((40,34),'Πίστα 6: οι κίονες του ερειπίου',font=fb,fill=(70,58,74))
    d.text((40,80),t,font=fs,fill=(120,110,126))
frames=[]
def put(img,n=1):
    for _ in range(n): frames.append(img.copy())
def go(st,d):
    for dd,n,k in moves(b,st):
        if dd==d: return n,k
    raise SystemExit('no move %s from %s'%(d,st))
U,Dn,L,R=(0,-1),(0,1),(-1,0),(1,0)
def play(st, seq, label, caps):
    for i,d in enumerate(seq):
        n,k=go(st,d); c1,c2=caps.get(i,('',''))
        if k=='push':
            new=sorted(n[1]-st[1], key=lambda cd: abs(cd[0][0]-st[0][0])+abs(cd[0][1]-st[0][1]))
            for f in range(22):
                img=Image.new('RGB',(IW,IH)); dr=ImageDraw.Draw(img); draw_board(dr,(st[0],n[1]),falling=new,ft=f/21); her(dr,cxy(st[0])); title(dr,label); caption(dr,c1,c2); put(img)
            put(img,26 if c1 else 6)
        elif k=='reset':
            a0,a1=cxy(st[0]),cxy(n[0])
            for f in range(12):
                t=f/11; img=Image.new('RGB',(IW,IH)); dr=ImageDraw.Draw(img); draw_board(dr,st); her(dr,(a0[0]+(a1[0]-a0[0])*t,a0[1]+(a1[1]-a0[1])*t)); title(dr,label); caption(dr,c1,c2); put(img)
            for f in range(16):
                img=Image.new('RGB',(IW,IH)); dr=ImageDraw.Draw(img); draw_board(dr,(n[0],st[1]) if f<8 else n); her(dr,a1); title(dr,label); caption(dr,c1,c2); put(img)
            put(img,30)
        else:
            a0,a1=cxy(st[0]),cxy(n[0])
            for f in range(8):
                t=f/7; t=t*t*(3-2*t); img=Image.new('RGB',(IW,IH)); dr=ImageDraw.Draw(img); draw_board(dr,n); her(dr,(a0[0]+(a1[0]-a0[0])*t,a0[1]+(a1[1]-a0[1])*t)); title(dr,label); caption(dr,c1,c2); put(img)
            put(img,24 if c1 else 1)
        st=n
    return st
st=(b.S,frozenset())
img=Image.new('RGB',(IW,IH)); dr=ImageDraw.Draw(img); draw_board(dr,st); her(dr,cxy(b.S)); title(dr,'τα νούμερα: πόσο μακριά φτάνει ο κίονας όταν πέσει')
caption(dr,'Σπρώχνεις έναν κίονα: πέφτει και γίνεται γέφυρα.','Πάνω σε γέφυρα περπατάς μόνο κατά μήκος της.'); put(img,100)
# the trap first
st=play(st,[U,R,U],'μια λάθος πρώτη κίνηση',{1:('Παγίδα: ο κίονας ρίχνει και τους επόμενους,','και ο μεγάλος χάνεται στη θάλασσα.'),2:('Το βαρούλκο τους ξανασηκώνει όλους.','')})
st=play(st,[Dn,Dn],'πίσω στην αρχή',{})
sol=[R,R,R,R,R,R,R,U,L,L,L,L,L,L,U,R,R,R,R,R,R,R,U,U,U,U,R]
caps={0:('Ντόμινο: ο πρώτος ρίχνει τον δεύτερο.','Δύο κίονες, μία γέφυρα.'),7:('Ο μεγάλος πρέπει να πέσει προς τα πάνω,','γέφυρα ως το νησάκι της πύλης.'),8:('Από γέφυρα δεν βγαίνεις στο πλάι:','πίσω, να βρεις άλλον δρόμο.'),15:('Τώρα ο δεύτερος σταματά στη βάση του μεγάλου:','η σειρά ήταν όλο το μυστικό.')}
st=play(st,sol,'η λύση',caps)
for f in range(30):
    img=Image.new('RGB',(IW,IH)); dr=ImageDraw.Draw(img); draw_board(dr,st,lit=f/29); her(dr,cxy(st[0])); title(dr,'η λύση'); caption(dr,'Στον κύκλο: η πύλη ανοίγει.',''); put(img)
put(img,70)
os.makedirs(OUT,exist_ok=True)
for i,fr in enumerate(frames): fr.save('%s/f%04d.png'%(OUT,i))
print('frames',len(frames))
