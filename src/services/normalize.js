export function readValue(tagObj) {
if (tagObj == null) return null;
if (typeof tagObj === "object" && "value" in tagObj) return tagObj.value;
return tagObj;
}
export const toNum = (v, def=0) => (v==null || isNaN(+v)) ? def : +v;
export const toBool = (v) => !!toNum(v, 0);
export const fmt = (v) => {
if (v == null || Number.isNaN(+v)) return "--";
const n = +v;
if (Math.abs(n) >= 1000) return n.toLocaleString('pt-BR');
return Number.isInteger(n) ? String(n) : n.toFixed(1);
};


