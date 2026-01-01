export function HexToRgb(hex) {
    //Handle hex colors with or without # prefix
    const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;
    const r = parseInt(cleanHex.slice(1, 3), 16) / 255;
    const g = parseInt(cleanHex.slice(3, 5), 16) / 255;
    const b = parseInt(cleanHex.slice(5, 7), 16) / 255;
    return `${r.toFixed(6)} ${g.toFixed(6)} ${b.toFixed(6)}`;
};