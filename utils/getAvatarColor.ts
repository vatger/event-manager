export function getAvatarColor(name?: string): string {
    if (!name || name.length === 0) {
        name = "User";
    }
    const colors = [
        'bg-blue-900', 'bg-green-900', 'bg-purple-900', 'bg-orange-900', 
        'bg-pink-900', 'bg-indigo-900', 'bg-teal-900', 'bg-cyan-900'
    ];
    const index = name.length % colors.length;
    console.log("name", name)
    return colors[index];
}; 