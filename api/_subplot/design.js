// Which design a request renders. Same per-request pattern as the brand: a Node serverless
// instance handles one request at a time, so a module-level value is safe here.
let active = 1;
export const setDesign = v => { active = v === 2 ? 2 : 1; };
export const design = () => active;
