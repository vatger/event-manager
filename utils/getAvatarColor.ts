/**
 * Hintergrundfarbe für Initialen-Avatare.
 *
 * Bewusst nur Abstufungen der Marken-Primärskala: Avatare sind reine
 * Wiedererkennung, keine Bedeutungsträger. Das Brandbook verlangt, dass jede
 * Farbe eine klare Funktion erfüllt – bunte Zufallsfarben widersprächen dem.
 */
const AVATAR_TONES = [
    'bg-primary-600',
    'bg-primary-700',
    'bg-primary-800',
    'bg-primary-900',
    'bg-secondary-600',
    'bg-secondary-700',
    'bg-secondary-800',
    'bg-secondary-900',
];

export function getAvatarColor(name?: string): string {
    const key = name && name.length > 0 ? name : "User";
    // Quersumme der Zeichencodes: stabiler als die reine Länge
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash + key.charCodeAt(i)) % AVATAR_TONES.length;
    return AVATAR_TONES[hash];
}
