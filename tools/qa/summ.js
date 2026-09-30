let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const blocks = s.split(/^===== /m).slice(1);
  blocks.forEach((b) => {
    const head = b.split("\n")[0];
    const json = b.slice(b.indexOf("{"));
    let o; try { o = JSON.parse(json.slice(0, json.lastIndexOf("}") + 1)); } catch (e) { console.log(head + "  PARSE FAIL"); return; }
    console.log("== " + head);
    if (o.issues.length) console.log("   ISSUES: " + o.issues.join("; "));
    const ov = (o.overflowX || []).filter((x) => x.sel !== "#fx");
    if (ov.length) console.log("   overflowX: " + ov.map((x) => x.sel + " [" + x.left + ".." + x.right + "]").join(", "));
    const st = (o.smallTargets || []).filter((x) => !/button\.card/.test(x.sel));
    if (st.length) console.log("   small targets: " + st.map((x) => x.sel + ' "' + x.text + '" ' + x.w + "x" + x.h).join(" | "));
    const cs = (o.smallTargets || []).filter((x) => /button\.card/.test(x.sel));
    if (cs.length) console.log("   hand cards under 44: " + cs.length + " e.g. " + cs[0].w + "x" + cs[0].h);
    const cl = (o.clipped || []).filter((x) => !/\.card/.test(x.sel));
    if (cl.length) console.log("   clipped: " + cl.map((x) => x.sel + " " + x.sh + ">" + x.ch).join(", "));
    console.log("   doc scroll w " + o.scrollW + "/" + o.clientW + "  h " + o.scrollH + "/" + o.clientH);
  });
});
