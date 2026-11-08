// Amazon.com (US) root category IDs used by Keepa (domain 1).
export const CATEGORIES = {
  "Home & Kitchen": 1055398,
  "Kitchen & Dining": 284507,
  "Beauty & Personal Care": 3760911,
  "Health & Household": 3760901,
  "Sports & Outdoors": 3375251,
  "Toys & Games": 165793011,
  "Pet Supplies": 2619533011,
  "Baby": 165796011,
  "Electronics": 172282,
  "Office Products": 1064954,
  "Tools & Home Improvement": 228013,
  "Patio, Lawn & Garden": 2972638011,
  "Automotive": 15684181,
  "Arts, Crafts & Sewing": 2617941011,
  "Clothing, Shoes & Jewelry": 7141123011,
};

// Words people type (English + Roman Urdu) mapped to a category.
export const CATEGORY_WORDS = [
  [/kitchen|cook|bawarchi|baking|utensil/i, "Kitchen & Dining"],
  [/home|ghar|decor|storage|organi[sz]/i, "Home & Kitchen"],
  [/beauty|makeup|skin|hair|cosmetic|khoobsurti/i, "Beauty & Personal Care"],
  [/health|vitamin|supplement|sehat|household/i, "Health & Household"],
  [/sport|fitness|gym|outdoor|camping|exercise|warzish/i, "Sports & Outdoors"],
  [/toy|game|khilona|puzzle/i, "Toys & Games"],
  [/pet|dog|cat|kutta|billi/i, "Pet Supplies"],
  [/baby|bacha|bachay|infant|toddler/i, "Baby"],
  [/electronic|gadget|phone|charger|headphone|audio/i, "Electronics"],
  [/office|desk|stationery|school/i, "Office Products"],
  [/tool|hardware|diy|drill/i, "Tools & Home Improvement"],
  [/garden|patio|lawn|plant|baghicha/i, "Patio, Lawn & Garden"],
  [/car|auto|vehicle|gaari|gari/i, "Automotive"],
  [/craft|art|sewing|paint/i, "Arts, Crafts & Sewing"],
  [/cloth|shoe|jewel|fashion|kapr/i, "Clothing, Shoes & Jewelry"],
];
