export function readArcPreview() {
    if (typeof window === 'undefined')
        return null;
    const q = new URLSearchParams(window.location.search);
    const s = q.get('arc');
    if (s !== 'occupied' && s !== 'aged' && s !== 'ruined')
        return null;
    return { state: s, view: q.get('view') === 'b' ? 'b' : 'a' };
}
