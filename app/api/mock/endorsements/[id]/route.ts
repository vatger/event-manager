// app/api/user/[cid]/endorsements/route.ts
import { NextResponse } from "next/server";

const MockData = [
  {
    cid: 1649341,
    endorsements: ["EDDM_GNDDEL", "EDDB_APP", "EDDV_APP", "EDMM_CTR"],
  },
  { 
    cid: 1649344,
    endorsements: [
    ]
  }
]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
  try {
    const cid = parseInt(id, 10);
    
    if (isNaN(cid)) {
      return NextResponse.json(
        { error: "Invalid CID" },
        { status: 400 }
      );
    }

    // Hier die Verbindung zum Trainingssystem
    // Beispiel: Externe API abfragen oder interne Datenbank
    const trainingData = await fetchTrainingEndorsements(cid);
    
    return NextResponse.json(trainingData);
  } catch (error) {
    console.error("Error fetching endorsements:", error);
    return NextResponse.json(
      { error: "Failed to fetch endorsements" },
      { status: 500 }
    );
  }
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Mock-Funktion - ersetze mit deiner Trainingssystem-Integration
async function fetchTrainingEndorsements(cid: number) {
  // Beispiel: Externe API call
  // const response = await fetch(`https://your-training-system.com/api/users/${cid}/endorsements`);
  // return await response.json();
  
  // Mock-Daten für Entwicklung
  await sleep(500);
  return MockData.find(item => item.cid == cid)
}