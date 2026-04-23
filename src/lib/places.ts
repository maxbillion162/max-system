export interface PlaceResult {
  name: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  types: string[];
  openNow?: boolean;
  priceLevel?: number;
  googleMapsUri?: string;
}

export async function searchPlaces(
  query: string,
  location = "Orlando, FL",
): Promise<{ places: PlaceResult[]; error?: string }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { places: [], error: "Google Places not configured — add GOOGLE_PLACES_API_KEY" };

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.currentOpeningHours,places.priceLevel,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery: `${query} near ${location}`, maxResultCount: 5 }),
    });

    if (!res.ok) return { places: [], error: `Places API error ${res.status}` };
    const data = await res.json();

    const places: PlaceResult[] = (data.places ?? []).map((p: Record<string, unknown>) => ({
      name: (p.displayName as { text: string })?.text ?? "Unknown",
      address: (p.formattedAddress as string) ?? "",
      rating: (p.rating as number) ?? undefined,
      userRatingsTotal: (p.userRatingCount as number) ?? undefined,
      types: ((p.types as string[]) ?? []).slice(0, 3),
      openNow: (p.currentOpeningHours as { openNow?: boolean } | undefined)?.openNow ?? undefined,
      priceLevel: (p.priceLevel as number) ?? undefined,
      googleMapsUri: (p.googleMapsUri as string) ?? undefined,
    }));

    return { places };
  } catch (err) {
    return { places: [], error: String(err) };
  }
}
