/* Headless bot στις τρέχουσες σταθερές. node tools/sim.js [N] */
process.argv[3] = JSON.stringify([["current", require("../site/raise/game.js").TARGETS.slice(), {}]]);
require("./sweep.js");
