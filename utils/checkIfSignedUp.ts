async function checkIfSignedUp(eventId: number, userId: number) {
    const res = await fetch(`/api/signups/${eventId}/${userId}`);
  
    if (res.status === 404) {
      return null; // User noch nicht angemeldet
    }
  
    if (!res.ok) {
      throw new Error("Fehler beim Abrufen");
    }
  
    return await res.json(); // enthält das Signup-Objekt
  }