#!/usr/bin/env python3
"""Build pitch/demo.mp4 from the real screenshots in pitch/shots-reconnect, with captions.
   python3 scripts/build-demo-video.py        (needs Pillow and ffmpeg)
Each scene: a phone screenshot on the left, a title and two caption lines on the right. Hook in the first
5 seconds, product on screen by 15, ends on the result. About 80 seconds."""
import os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "pitch", "shots-reconnect")
OUT = os.path.join(ROOT, "pitch", "demo.mp4")
W, H = 1920, 1080
BG = (28, 30, 33); INK = (253, 253, 252); MUTED = (201, 206, 214); BLUE = (127, 179, 255); WARM = (232, 163, 61); GREEN = (49, 162, 76)
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_R = "/System/Library/Fonts/Supplemental/Arial.ttf"
f = lambda s, bold=True: ImageFont.truetype(FONT if bold else FONT_R, s)

SCENES = [
  # (shot or None, eyebrow, title, lines, seconds)
  (None, "RECONNECT", "Friendships don't end.\nThey go quiet.", ["Maya and Nadia were roommates for three years.", "Seven weeks since a real conversation. Nothing happened.", "Which is the problem: nothing happening has no notification."], 6),
  ("01-feed.jpg", "1 · FEED", "Nadia posted this morning.", ["Facebook noticed two things at once: the post, and that", "Maya and Nadia are past their rhythm. That part is code.", "The line under the post is Muse, and it cites what it leans on."], 7),
  ("04-evidence.jpg", "2 · WHAT WAS USED", "Every citation, checked.", ["Only things both of them are in. Only things Maya can see.", "Likes, mood, health, anyone else's chats: never read.", "A citation that isn't on this list drops the whole nudge."], 7),
  ("03-mutual.jpg", "2b · PRIVATE", "The heart is private.", ["Nobody sees it. Nadia tapped hers last week.", "So now both know the other wants this,", "and neither had to go first."], 6),
  ("05-cards.jpg", "3 · PLAN", "Three real shapes.", ["A Muse agent reads who Nadia is, the next six weekends,", "events in both cities, who's driving. It found Arjun's 25th", "in Chicago, Dec 5. Nadia already RSVP'd."], 7),
  ("06-plan.jpg", "3 · PLAN", "Who, when, how much.", ["Her own words about the dates. Cost line by line from a", "price table, added in code. Nothing is sent yet."], 6),
  ("07-sources.jpg", "3 · PLAN", "How this was planned.", ["Every claim with its source. Every id re-checked.", "The model wrote the title and the pitch, nothing else."], 5),
  ("08-draft.jpg", "4 · MESSENGER", "Her words. Her send.", ["Muse drafts from how Maya actually texts Nadia.", "It's a draft in the normal composer. She edits it. She sends it.", "The agent never messages anyone."], 7),
  ("09-nadia-notif.jpg", "5 · NADIA'S PHONE", "The dormant account.", ["What brings Nadia back is not a product notification.", "It's a message from a friend."], 5),
  ("10-nadia-thread.jpg", "5 · NADIA'S PHONE", "A friend's words and an Event.", ["One tap: I'm in. There is no AI on this screen.", "Sending created an invite-only Facebook Event."], 6),
  ("12-confirmed.jpg", "6 · THE PLAN", "Maya confirms last.", ["Nothing is a plan until the people in it say so.", "The plan's home is a normal Event. From here it's two people."], 6),
  ("14-kinds.jpg", "7 · RECONNECT", "Four doors in. One engine.", ["A person. A chapter whose 'who's in' died.", "Your culture. A place with quiet friends and a ride.", "The travel case is the fourth."], 6),
  (None, "MEASURED", "Live, on the seed.", ["9 drifted pairs → 9 nudges, 9/9 citations real and shared, 0 mood or health words.", "12 plans → 12/12 ids real, 12/12 costs add up, 0 model-written prices.", "154 of 250 friendships asleep. 38 with history a nudge can cite today."], 8),
  (None, "RECONNECT", "Facebook knows who you've lost.\nNow it can do something about it.", ["Muse · code-checked · nothing sent without you"], 6),
]

def wrap(draw, text, font, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= width: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def frame(shot, eyebrow, title, lines):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    x_text = 128
    if shot:
        ph = Image.open(os.path.join(SHOTS, shot)).convert("RGB")
        ph_h = 940; ph_w = round(ph.width * ph_h / ph.height)
        ph = ph.resize((ph_w, ph_h), Image.LANCZOS)
        # phone bezel
        bx, by = 128, (H - ph_h) // 2
        mask = Image.new("L", (ph_w + 28, ph_h + 28), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, ph_w + 27, ph_h + 27], radius=56, fill=255)
        bezel = Image.new("RGB", (ph_w + 28, ph_h + 28), (18, 20, 23))
        im.paste(bezel, (bx - 14, by - 14), mask)
        m2 = Image.new("L", (ph_w, ph_h), 0)
        ImageDraw.Draw(m2).rounded_rectangle([0, 0, ph_w - 1, ph_h - 1], radius=44, fill=255)
        im.paste(ph, (bx, by), m2)
        x_text = bx + ph_w + 96
    width = W - x_text - 128
    y = 300 if shot else 330
    d.text((x_text, y), eyebrow, font=f(28), fill=BLUE); y += 60
    for t in title.split("\n"):
        for l in wrap(d, t, f(72), width): d.text((x_text, y), l, font=f(72), fill=INK); y += 86
    y += 24
    for l in lines:
        for ll in wrap(d, l, f(34, False), width): d.text((x_text, y), ll, font=f(34, False), fill=MUTED); y += 48
        y += 6
    d.text((128, H - 90), "Reconnect · built on a Facebook clone · Muse Spark + Ember · every id and dollar re-checked in code", font=f(22, False), fill=(120, 124, 130))
    return im

def main():
    tmp = tempfile.mkdtemp()
    listing = []
    for i, (shot, eb, title, lines, secs) in enumerate(SCENES):
        p = os.path.join(tmp, f"s{i:02d}.png")
        frame(shot, eb, title, lines).save(p)
        listing.append(f"file '{p}'\nduration {secs}")
    listing.append(f"file '{os.path.join(tmp, f's{len(SCENES)-1:02d}.png')}'")
    lst = os.path.join(tmp, "list.txt")
    open(lst, "w").write("\n".join(listing) + "\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", OUT], check=True)
    total = sum(s[4] for s in SCENES)
    print(f"wrote {OUT} ({total}s, {len(SCENES)} scenes)")

if __name__ == "__main__":
    main()
