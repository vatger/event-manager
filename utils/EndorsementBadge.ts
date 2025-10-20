export function getBadgeClassForEndorsement(endorsement?: string | null) {
  if(!endorsement) return "bg-gray-100 text-gray-800"
  switch (endorsement) {
    case "DEL":
      return "bg-green-100 text-green-800";
    case "GND":
      return "bg-blue-100 text-blue-800";
    case "TWR":
      return "bg-amber-100 text-amber-800";
    case "APP":
      return "bg-purple-100 text-purple-800";
    case "CTR":
      return "bg-red-100 text-red-800";
    case "S1":
      return "bg-blue-100 text-blue-800";
    case "S2":
      return "bg-amber-100 text-amber-800";
    case "S3":
      return "bg-purple-100 text-purple-800";
    case "C1":
      return "bg-red-100 text-red-800";
    case "C2":
      return "bg-red-100 text-red-800";
    case "C3":
      return "bg-red-100 text-red-800";
    case "I1":
      return "bg-red-100 text-red-800";
    case "I2":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}