export function getRatingValue (ratingString: string): number {
    switch (ratingString) {
      case "S1": return 1;
      case "S2": return 2;
      case "S3": return 3;
      case "C1": return 4;
      case "C2": return 5;
      case "C3": return 6;
      case "I1": return 7;
      case "I2": return 8;
      case "I3": return 9;
      case "SUP": return 10;
      case "ADM": return 11;
      default: return 0;
    }
  };