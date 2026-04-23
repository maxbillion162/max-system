export interface YelpBusiness {
  name: string;
  rating: number;
  reviewCount: number;
  price?: string;
  categories: string[];
  address: string;
  phone?: string;
  url: string;
  isOpen?: boolean;
}

export async function searchYelp(
  term: string,
  location = "Orlando, FL",
  categories?: string,
): Promise<{ businesses: YelpBusiness[]; error?: string }> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) return { businesses: [], error: "Yelp not configured — add YELP_API_KEY" };

  try {
    const params = new URLSearchParams({ term, location, limit: "5", sort_by: "rating" });
    if (categories) params.set("categories", categories);

    const res = await fetch(`https://api.yelp.com/v3/businesses/search?${params}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (!res.ok) return { businesses: [], error: `Yelp error ${res.status}` };
    const data = await res.json();

    const businesses: YelpBusiness[] = (data.businesses ?? []).map((b: Record<string, unknown>) => ({
      name: b.name as string,
      rating: b.rating as number,
      reviewCount: b.review_count as number,
      price: (b.price as string) ?? undefined,
      categories: ((b.categories as { title: string }[]) ?? []).map(c => c.title),
      address: ((b.location as { display_address: string[] })?.display_address ?? []).join(", "),
      phone: (b.display_phone as string) ?? undefined,
      url: b.url as string,
      isOpen: !(b.is_closed as boolean),
    }));

    return { businesses };
  } catch (err) {
    return { businesses: [], error: String(err) };
  }
}
