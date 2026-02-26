/**
 * Compact Excalidraw element reference for LLM diagram generation.
 * Appended to the secretary system prompt so it can output valid Excalidraw JSON.
 */
export function getExcalidrawCheatsheet(): string {
  return `
## Excalidraw Element Reference

Output a JSON array of Excalidraw elements. Each element needs these fields:

### Common Fields (all elements)
- \`type\`: "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line"
- \`id\`: unique string (e.g. "rect1", "text1", "arrow1")
- \`x\`, \`y\`: number (top-left origin, x increases right, y increases down)
- \`width\`, \`height\`: number
- \`strokeColor\`: hex string (e.g. "#1e1e1e")
- \`backgroundColor\`: hex string or "transparent"
- \`fillStyle\`: "solid" | "hachure" | "cross-hatch"
- \`strokeWidth\`: 1 | 2 | 4
- \`roughness\`: 0 (sharp) | 1 (sketchy)
- \`opacity\`: 100
- \`angle\`: 0
- \`seed\`: any integer (e.g. 1)
- \`version\`: 1
- \`isDeleted\`: false
- \`groupIds\`: []
- \`boundElements\`: null or array of { id: string, type: "text" | "arrow" }
- \`link\`: null
- \`locked\`: false

### Text Elements
Additional fields: \`text\`, \`fontSize\` (16-24), \`fontFamily\` (1=hand, 2=normal, 3=mono), \`textAlign\` ("left"|"center"|"right"), \`verticalAlign\` ("top"|"middle"), \`baseline\`: 0, \`containerId\`: null or parent shape id

### Arrow/Line Elements
Additional fields: \`points\` (array of [x,y] relative to element x,y — first point always [0,0]), \`startBinding\` and \`endBinding\`: null or { elementId: string, focus: 0, gap: 5 }, \`lastCommittedPoint\`: null, \`startArrowhead\`: null, \`endArrowhead\`: "arrow" | null

### Color Palette
- Blue: "#1971c2", Light blue bg: "#a5d8ff"
- Green: "#2f9e44", Light green bg: "#b2f2bb"
- Red: "#e03131", Light red bg: "#ffc9c9"
- Orange: "#e8590c", Light orange bg: "#ffd8a8"
- Purple: "#7048e8", Light purple bg: "#d0bfff"
- Yellow: "#f08c00", Light yellow bg: "#ffec99"
- Gray: "#868e96", Light gray bg: "#dee2e6"
- Dark: "#1e1e1e"

### Layout Tips
- Space shapes ~200px apart horizontally, ~150px vertically
- Typical shape size: 160×80 for rectangles, 120×60 for ellipses
- Center text inside shapes using containerId
- Use arrows to show relationships (agreement, disagreement, influence)

### Compact Example
\`\`\`json
[
  {"type":"rectangle","id":"r1","x":50,"y":50,"width":160,"height":80,"strokeColor":"#1971c2","backgroundColor":"#a5d8ff","fillStyle":"solid","strokeWidth":2,"roughness":1,"opacity":100,"angle":0,"seed":1,"version":1,"isDeleted":false,"groupIds":[],"boundElements":[{"id":"t1","type":"text"},{"id":"a1","type":"arrow"}],"link":null,"locked":false},
  {"type":"text","id":"t1","x":60,"y":70,"width":140,"height":40,"text":"Counsellor A","fontSize":16,"fontFamily":2,"textAlign":"center","verticalAlign":"middle","baseline":0,"containerId":"r1","strokeColor":"#1e1e1e","backgroundColor":"transparent","fillStyle":"solid","strokeWidth":1,"roughness":0,"opacity":100,"angle":0,"seed":2,"version":1,"isDeleted":false,"groupIds":[],"boundElements":null,"link":null,"locked":false},
  {"type":"rectangle","id":"r2","x":350,"y":50,"width":160,"height":80,"strokeColor":"#2f9e44","backgroundColor":"#b2f2bb","fillStyle":"solid","strokeWidth":2,"roughness":1,"opacity":100,"angle":0,"seed":3,"version":1,"isDeleted":false,"groupIds":[],"boundElements":[{"id":"t2","type":"text"},{"id":"a1","type":"arrow"}],"link":null,"locked":false},
  {"type":"text","id":"t2","x":360,"y":70,"width":140,"height":40,"text":"Counsellor B","fontSize":16,"fontFamily":2,"textAlign":"center","verticalAlign":"middle","baseline":0,"containerId":"r2","strokeColor":"#1e1e1e","backgroundColor":"transparent","fillStyle":"solid","strokeWidth":1,"roughness":0,"opacity":100,"angle":0,"seed":4,"version":1,"isDeleted":false,"groupIds":[],"boundElements":null,"link":null,"locked":false},
  {"type":"arrow","id":"a1","x":210,"y":90,"width":140,"height":0,"points":[[0,0],[140,0]],"startBinding":{"elementId":"r1","focus":0,"gap":5},"endBinding":{"elementId":"r2","focus":0,"gap":5},"startArrowhead":null,"endArrowhead":"arrow","strokeColor":"#1e1e1e","backgroundColor":"transparent","fillStyle":"solid","strokeWidth":2,"roughness":1,"opacity":100,"angle":0,"seed":5,"version":1,"isDeleted":false,"groupIds":[],"boundElements":null,"link":null,"locked":false,"lastCommittedPoint":null}
]
\`\`\`
`.trim();
}
