import { Tier1Aiprots } from "@/config/Tier1Airports";

export function isAirportTier1(airport: string){
    if(Tier1Aiprots.includes(airport)) return true

    return false
}

export function getAirportFIR(airport: string){
    
}